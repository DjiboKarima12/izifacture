-- IziFacture — schéma initial
--
-- Principes structurants :
--  * Toute table métier porte `org_id` : c'est l'unique axe d'isolation, et la
--    RLS (migration 0003) s'appuie dessus sans exception.
--  * Tous les montants sont des BIGINT en unités mineures. Le franc CFA n'ayant
--    pas de décimale, 1 unité = 1 franc. Aucun `numeric` ni `float` pour l'argent.
--  * Les totaux ne sont jamais acceptés tels quels : ils sont recalculés par
--    trigger (migration 0002), y compris sur une écriture directe via PostgREST.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- Énumérations

create type public.member_role as enum ('owner', 'admin', 'member');
create type public.document_type as enum ('invoice', 'quote', 'credit_note');
create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'cancelled');
create type public.discount_type as enum ('amount', 'percent');
create type public.payment_method as enum (
  'cash', 'mobile_money', 'bank_transfer', 'cheque', 'card', 'other'
);
create type public.recurrence_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.invoice_event_type as enum (
  'created', 'issued', 'sent', 'viewed', 'payment_recorded', 'paid', 'cancelled', 'reminder_sent'
);

-- ------------------------------------------------------------------ Profils

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ Organisations

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 200),
  legal_name text,
  email text,
  phone text,
  address_line text,
  city text,
  country text not null default 'Sénégal',
  tax_id text,
  logo_url text,
  currency text not null default 'XOF' check (currency in ('XOF', 'XAF')),
  default_tax_rate numeric(5, 2) not null default 18 check (default_tax_rate between 0 and 100),
  default_payment_terms integer not null default 30 check (default_payment_terms between 0 and 365),
  invoice_prefix text not null default 'FAC' check (invoice_prefix ~ '^[A-Z0-9-]{1,8}$'),
  quote_prefix text not null default 'DEV' check (quote_prefix ~ '^[A-Z0-9-]{1,8}$'),
  credit_note_prefix text not null default 'AV' check (credit_note_prefix ~ '^[A-Z0-9-]{1,8}$'),
  invoice_footer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Index critique : `auth_org_ids()` interroge cette table à CHAQUE évaluation de
-- policy. Sans lui, la RLS s'effondre en performance dès quelques milliers de lignes.
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_org_id_idx on public.memberships (org_id);

-- ------------------------------------------------------------------ Clients

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 200),
  email text,
  phone text,
  address_line text,
  city text,
  country text,
  tax_id text,
  notes text,
  -- Archivage logique : un client déjà facturé ne doit jamais disparaître,
  -- sinon les factures émises perdraient leur contrepartie.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_org_id_idx on public.clients (org_id);
create index clients_org_active_idx on public.clients (org_id) where archived_at is null;

-- ----------------------------------------------------------------- Compteurs

-- Séquence par organisation / type / année. Verrouillée à l'émission par
-- `next_document_number()`, ce qui garantit une numérotation sans trou.
create table public.invoice_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type public.document_type not null,
  year integer not null check (year between 1970 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (org_id, doc_type, year)
);

-- ----------------------------------------------------------------- Documents

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  type public.document_type not null default 'invoice',
  -- NULL tant que brouillon : un brouillon abandonné ne consomme aucun numéro.
  number text,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null,
  currency text not null default 'XOF' check (currency in ('XOF', 'XAF')),

  subtotal bigint not null default 0,
  discount_total bigint not null default 0 check (discount_total >= 0),
  tax_total bigint not null default 0,
  total bigint not null default 0,
  amount_paid bigint not null default 0 check (amount_paid >= 0),

  notes text,
  terms text,

  -- Jeton du lien public. 32 octets aléatoires : non énumérable.
  public_token text not null default encode(gen_random_bytes(32), 'hex'),
  -- Copie figée de l'entreprise et du client au moment de l'émission.
  snapshot jsonb,
  parent_invoice_id uuid references public.invoices (id) on delete set null,

  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_total_coherent check (total = subtotal + tax_total),
  -- Un document émis a forcément un numéro et un snapshot ; un brouillon, jamais
  -- de numéro. Cette contrainte rend l'état incohérent impossible à écrire.
  constraint invoices_issued_has_number check (
    (status = 'draft' and number is null and snapshot is null)
    or (status <> 'draft' and number is not null and snapshot is not null)
  ),
  constraint invoices_number_unique unique (org_id, type, number)
);

create index invoices_org_id_idx on public.invoices (org_id);
create index invoices_org_status_idx on public.invoices (org_id, status);
create index invoices_org_issue_date_idx on public.invoices (org_id, issue_date desc);
create index invoices_client_id_idx on public.invoices (client_id);
-- Le lien public se résout par ce seul index, sans scan.
create unique index invoices_public_token_idx on public.invoices (public_token);
-- Sert la liste « en retard », le filtre le plus consulté du produit.
create index invoices_outstanding_due_idx on public.invoices (org_id, due_date)
  where status in ('sent', 'partially_paid');

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null check (position >= 0),
  description text not null check (length(btrim(description)) between 1 and 500),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  tax_rate numeric(5, 2) not null default 18 check (tax_rate between 0 and 100),
  discount_type public.discount_type,
  discount_value numeric(12, 2) check (discount_value >= 0),

  -- Champs calculés : écrasés par trigger, jamais lus depuis le client.
  line_subtotal bigint not null default 0,
  line_discount bigint not null default 0,
  line_tax bigint not null default 0,
  line_total bigint not null default 0,

  constraint invoice_items_discount_pair check (
    (discount_type is null and discount_value is null)
    or (discount_type is not null and discount_value is not null)
  ),
  unique (invoice_id, position)
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------- Paiements

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount bigint not null check (amount > 0),
  paid_at date not null default current_date,
  method public.payment_method not null default 'cash',
  reference text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payments_org_id_idx on public.payments (org_id);
create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_org_paid_at_idx on public.payments (org_id, paid_at desc);

-- --------------------------------------------------------------- Récurrence

create table public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  label text not null check (length(btrim(label)) between 2 and 200),
  frequency public.recurrence_frequency not null,
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  start_date date not null,
  end_date date,
  next_run_on date,
  payment_terms integer not null default 30 check (payment_terms between 0 and 365),
  active boolean not null default true,
  template jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_end_after_start check (end_date is null or end_date >= start_date)
);

create index recurring_schedules_org_id_idx on public.recurring_schedules (org_id);
create index recurring_schedules_due_idx on public.recurring_schedules (next_run_on)
  where active is true;

-- Idempotence de la génération récurrente : la contrainte d'unicité rend
-- impossible la création de deux factures pour la même période, même si le cron
-- se déclenche deux fois ou qu'une exécution est rejouée.
create table public.recurring_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.recurring_schedules (id) on delete cascade,
  period_start date not null,
  invoice_id uuid references public.invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_id, period_start)
);

-- ------------------------------------------------------------------ Journal

create table public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  type public.invoice_event_type not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index invoice_events_invoice_id_idx on public.invoice_events (invoice_id, created_at desc);

-- -------------------------------------------------------------- Abonnement

-- Volontairement agnostique du fournisseur : Stripe n'est pas disponible pour
-- des marchands au Sénégal, en Côte d'Ivoire ou au Cameroun, et un adaptateur
-- Mobile Money (PayDunya / CinetPay) devra pouvoir s'y brancher sans migration.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotence des webhooks : un événement rejoué par le fournisseur ne peut pas
-- être traité deux fois.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  type text not null,
  payload jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
