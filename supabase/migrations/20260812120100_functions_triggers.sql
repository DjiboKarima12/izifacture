-- IziFacture — fonctions et déclencheurs
--
-- Ce fichier contient la logique métier qui ne peut PAS vivre uniquement côté
-- application : les montants et la numérotation doivent rester justes même face
-- à une écriture directe via PostgREST, un script d'import ou un bug client.
--
-- Les règles d'arrondi répliquent exactement `lib/tax.ts` :
--   brut     = round(quantité × prix_unitaire)
--   remise   = round(brut × pct / 100)   ou   min(montant, brut)
--   base_HT  = brut - remise
--   TVA      = round(base_HT × taux / 100)      (arrondi PAR LIGNE)
--   TTC      = base_HT + TVA
-- `round()` sur numeric arrondit la moitié à l'écart de zéro, comme
-- `divideRound()` côté TypeScript. Toute évolution doit être faite des DEUX
-- côtés — les tests d'intégration de l'étape 3 comparent les deux calculs.

-- --------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();
create trigger recurring_schedules_touch before update on public.recurring_schedules
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- Appartenance / rôles

-- SECURITY DEFINER : contourne la RLS de `memberships`, sinon les policies qui
-- appellent cette fonction déclencheraient une récursion infinie.
create or replace function public.auth_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.auth_has_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and role = any (p_roles)
  );
$$;

revoke execute on function public.auth_org_ids() from public;
revoke execute on function public.auth_has_role(uuid, public.member_role[]) from public;
grant execute on function public.auth_org_ids() to authenticated;
grant execute on function public.auth_has_role(uuid, public.member_role[]) to authenticated;

-- --------------------------------------------------- Calcul des lignes / totaux

create or replace function public.compute_invoice_item_totals()
returns trigger
language plpgsql
as $$
declare
  v_gross bigint;
  v_discount bigint;
  v_subtotal bigint;
begin
  v_gross := round(new.quantity * new.unit_price)::bigint;

  if new.discount_type = 'percent' then
    v_discount := round(v_gross * new.discount_value / 100)::bigint;
  elsif new.discount_type = 'amount' then
    -- Une remise ne peut pas rendre la ligne négative.
    v_discount := least(round(new.discount_value)::bigint, v_gross);
  else
    v_discount := 0;
  end if;

  v_subtotal := v_gross - v_discount;

  -- Les valeurs fournies par le client sont ignorées, jamais lues.
  new.line_discount := v_discount;
  new.line_subtotal := v_subtotal;
  new.line_tax := round(v_subtotal * new.tax_rate / 100)::bigint;
  new.line_total := new.line_subtotal + new.line_tax;

  return new;
end;
$$;

create trigger invoice_items_compute
  before insert or update on public.invoice_items
  for each row execute function public.compute_invoice_item_totals();

create or replace function public.refresh_invoice_totals()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
  set subtotal = coalesce(agg.subtotal, 0),
      discount_total = coalesce(agg.discount_total, 0),
      tax_total = coalesce(agg.tax_total, 0),
      total = coalesce(agg.subtotal, 0) + coalesce(agg.tax_total, 0)
  from (
    select sum(line_subtotal) as subtotal,
           sum(line_discount) as discount_total,
           sum(line_tax) as tax_total
    from public.invoice_items
    where invoice_id = v_invoice
  ) agg
  where i.id = v_invoice;

  return null;
end;
$$;

create trigger invoice_items_refresh_totals
  after insert or update or delete on public.invoice_items
  for each row execute function public.refresh_invoice_totals();

-- ------------------------------------------------------------- Immuabilité

-- Une facture émise est figée : c'est une exigence fiscale (OHADA) autant qu'une
-- garantie pour le client, qui doit retrouver exactement le document reçu.
-- Seuls les champs liés au règlement et à l'annulation restent modifiables.
create or replace function public.enforce_invoice_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;

  if new.client_id is distinct from old.client_id
     or new.type is distinct from old.type
     or new.issue_date is distinct from old.issue_date
     or new.due_date is distinct from old.due_date
     or new.currency is distinct from old.currency
     or new.subtotal is distinct from old.subtotal
     or new.discount_total is distinct from old.discount_total
     or new.tax_total is distinct from old.tax_total
     or new.total is distinct from old.total
     or new.number is distinct from old.number
     or new.snapshot is distinct from old.snapshot
     or new.notes is distinct from old.notes
     or new.terms is distinct from old.terms
  then
    raise exception
      'Document % déjà émis : son contenu est figé. Créez un avoir pour le corriger.',
      coalesce(old.number, old.id::text)
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger invoices_immutability
  before update on public.invoices
  for each row execute function public.enforce_invoice_immutability();

-- Corollaire : on ne touche plus aux lignes d'un document émis.
create or replace function public.enforce_invoice_items_immutability()
returns trigger
language plpgsql
as $$
declare
  v_status public.invoice_status;
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select status into v_status from public.invoices where id = v_invoice;

  -- Ligne supprimée en cascade avec sa facture : rien à contrôler.
  if v_status is null then
    return coalesce(new, old);
  end if;

  if v_status <> 'draft' then
    raise exception 'Les lignes d''un document émis ne peuvent plus être modifiées.'
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger invoice_items_immutability
  before insert or update or delete on public.invoice_items
  for each row execute function public.enforce_invoice_items_immutability();

-- ------------------------------------------------------- Recalcul des paiements

create or replace function public.refresh_invoice_payment_state()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_paid bigint;
  v_total bigint;
  v_status public.invoice_status;
begin
  select coalesce(sum(amount), 0) into v_paid
  from public.payments where invoice_id = v_invoice;

  select total, status into v_total, v_status
  from public.invoices where id = v_invoice;

  if v_status is null or v_status in ('draft', 'cancelled') then
    return null;
  end if;

  update public.invoices
  set amount_paid = v_paid,
      status = case
        when v_paid <= 0 then 'sent'::public.invoice_status
        when v_paid >= v_total then 'paid'::public.invoice_status
        else 'partially_paid'::public.invoice_status
      end,
      paid_at = case when v_paid >= v_total then coalesce(paid_at, now()) else null end
  where id = v_invoice;

  return null;
end;
$$;

create trigger payments_refresh_invoice
  after insert or update or delete on public.payments
  for each row execute function public.refresh_invoice_payment_state();

-- Un encaissement ne se rattache qu'à un document déjà émis.
create or replace function public.enforce_payment_preconditions()
returns trigger
language plpgsql
as $$
declare
  v_status public.invoice_status;
  v_org uuid;
begin
  select status, org_id into v_status, v_org
  from public.invoices where id = new.invoice_id;

  if v_status is null then
    raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
  end if;
  -- Empêche de rattacher un encaissement à la facture d'une autre organisation.
  if v_org <> new.org_id then
    raise exception 'Facture hors de cette organisation.' using errcode = 'check_violation';
  end if;
  if v_status = 'draft' then
    raise exception 'Émettez la facture avant d''enregistrer un encaissement.'
      using errcode = 'check_violation';
  end if;
  if v_status = 'cancelled' then
    raise exception 'Cette facture est annulée.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger payments_preconditions
  before insert or update on public.payments
  for each row execute function public.enforce_payment_preconditions();

-- --------------------------------------------------------------- Numérotation

-- Séquence sans trou et sûre en concurrence : `on conflict do update` pose un
-- verrou de ligne, donc deux émissions simultanées ne peuvent pas obtenir le
-- même numéro ni en sauter un.
create or replace function public.next_document_number(
  p_org uuid,
  p_type public.document_type,
  p_year integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sequence integer;
begin
  insert into public.invoice_counters (org_id, doc_type, year, last_number)
  values (p_org, p_type, p_year, 1)
  on conflict (org_id, doc_type, year)
    do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v_sequence;

  return v_sequence;
end;
$$;

revoke execute on function public.next_document_number(uuid, public.document_type, integer) from public;

-- ------------------------------------------------------------------ Émission

-- Attribue le numéro, fige le snapshot et bascule le statut, le tout dans une
-- seule transaction. Exposée en RPC pour que l'application n'ait jamais à
-- composer ces trois écritures elle-même (et à risquer de n'en faire que deux).
create or replace function public.issue_invoice(p_invoice uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_org public.organizations;
  v_client public.clients;
  v_prefix text;
  v_sequence integer;
  v_year integer;
begin
  select * into v_invoice from public.invoices where id = p_invoice for update;
  if v_invoice.id is null then
    raise exception 'Facture introuvable.' using errcode = 'no_data_found';
  end if;

  -- SECURITY DEFINER contourne la RLS : l'appartenance est donc vérifiée ici,
  -- explicitement, sinon n'importe quel utilisateur pourrait émettre la facture
  -- d'une autre organisation en connaissant son identifiant.
  if not public.auth_has_role(v_invoice.org_id, array['owner', 'admin', 'member']::public.member_role[]) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Ce document a déjà été émis.' using errcode = 'restrict_violation';
  end if;

  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice) then
    raise exception 'Impossible d''émettre un document sans ligne.' using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations where id = v_invoice.org_id;
  select * into v_client from public.clients where id = v_invoice.client_id;

  v_prefix := case v_invoice.type
    when 'invoice' then v_org.invoice_prefix
    when 'quote' then v_org.quote_prefix
    when 'credit_note' then v_org.credit_note_prefix
  end;

  v_year := extract(year from v_invoice.issue_date)::integer;
  v_sequence := public.next_document_number(v_invoice.org_id, v_invoice.type, v_year);

  update public.invoices
  set number = v_prefix || '-' || v_year || '-' || lpad(v_sequence::text, 4, '0'),
      status = 'sent',
      sent_at = now(),
      snapshot = jsonb_build_object(
        'organization', jsonb_build_object(
          'name', v_org.name, 'legalName', v_org.legal_name, 'email', v_org.email,
          'phone', v_org.phone, 'addressLine', v_org.address_line, 'city', v_org.city,
          'country', v_org.country, 'taxId', v_org.tax_id, 'logoUrl', v_org.logo_url,
          'invoiceFooter', v_org.invoice_footer
        ),
        'client', jsonb_build_object(
          'name', v_client.name, 'email', v_client.email, 'phone', v_client.phone,
          'addressLine', v_client.address_line, 'city', v_client.city,
          'country', v_client.country, 'taxId', v_client.tax_id
        )
      )
  where id = p_invoice
  returning * into v_invoice;

  insert into public.invoice_events (org_id, invoice_id, type, meta)
  values (v_invoice.org_id, v_invoice.id, 'issued', jsonb_build_object('number', v_invoice.number));

  return v_invoice;
end;
$$;

revoke execute on function public.issue_invoice(uuid) from public;
grant execute on function public.issue_invoice(uuid) to authenticated;

-- ------------------------------------------------- Inscription : profil + org

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Création atomique organisation + appartenance owner. Sans cela, une erreur
-- entre les deux écritures laisserait un utilisateur sans organisation, donc
-- sans accès à quoi que ce soit.
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations (name) values (p_name) returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  insert into public.subscriptions (org_id) values (v_org.id);

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;
