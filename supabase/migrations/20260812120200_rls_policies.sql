-- IziFacture — Row Level Security
--
-- C'est la couche de sécurité qui compte réellement. Le middleware Next.js ne
-- fait que rafraîchir la session (cf. CVE-2025-29927, où un en-tête forgé
-- contournait entièrement le middleware) ; l'isolation entre organisations est
-- garantie ici, dans Postgres, où aucune requête de l'application ne peut la
-- contourner.
--
-- Modèle : chaque policy borne l'accès à `org_id in (select auth_org_ids())`.
-- La sous-requête est intentionnelle : elle permet à Postgres d'évaluer la
-- fonction une seule fois par requête au lieu d'une fois par ligne.

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.recurring_schedules enable row level security;
alter table public.recurring_runs enable row level security;
alter table public.invoice_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

-- `anon` n'a besoin d'aucun accès direct : la seule lecture non authentifiée est
-- la consultation d'une facture par jeton, qui passe par une fonction dédiée.
revoke all on public.profiles, public.organizations, public.memberships,
  public.clients, public.invoices, public.invoice_items, public.payments,
  public.invoice_counters, public.recurring_schedules, public.recurring_runs,
  public.invoice_events, public.subscriptions, public.billing_events
  from anon;

-- ------------------------------------------------------------------ Profils

create policy "profiles_select_self_or_teammate" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id and m.org_id in (select public.auth_org_ids())
    )
  );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------ Organisations

create policy "organizations_select_members" on public.organizations
  for select to authenticated
  using (id in (select public.auth_org_ids()));

-- La création passe par `create_organization()` : elle doit rester atomique avec
-- l'appartenance owner, donc aucune policy d'insertion directe.
create policy "organizations_update_admins" on public.organizations
  for update to authenticated
  using (public.auth_has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.auth_has_role(id, array['owner', 'admin']::public.member_role[]));

create policy "organizations_delete_owner" on public.organizations
  for delete to authenticated
  using (public.auth_has_role(id, array['owner']::public.member_role[]));

-- ------------------------------------------------------------ Appartenances

create policy "memberships_select_org" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or org_id in (select public.auth_org_ids()));

create policy "memberships_insert_admins" on public.memberships
  for insert to authenticated
  with check (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "memberships_update_admins" on public.memberships
  for update to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "memberships_delete_admins" on public.memberships
  for delete to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

-- Le dernier owner ne peut pas être retiré : l'organisation deviendrait
-- administrable par personne.
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'owner' and not exists (
    select 1 from public.memberships
    where org_id = old.org_id and role = 'owner' and id <> old.id
  ) then
    raise exception 'Une organisation doit conserver au moins un propriétaire.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

create trigger memberships_protect_last_owner
  before delete or update on public.memberships
  for each row execute function public.protect_last_owner();

-- ------------------------------------------------------------------ Clients

create policy "clients_select_org" on public.clients
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "clients_insert_org" on public.clients
  for insert to authenticated with check (org_id in (select public.auth_org_ids()));

create policy "clients_update_org" on public.clients
  for update to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create policy "clients_delete_admins" on public.clients
  for delete to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

-- ----------------------------------------------------------------- Factures

create policy "invoices_select_org" on public.invoices
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "invoices_insert_org" on public.invoices
  for insert to authenticated with check (org_id in (select public.auth_org_ids()));

create policy "invoices_update_org" on public.invoices
  for update to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

-- Seul un brouillon se supprime, et seulement par un administrateur. Le reste
-- s'annule (statut `cancelled`) pour préserver la piste d'audit.
create policy "invoices_delete_draft_admins" on public.invoices
  for delete to authenticated
  using (
    status = 'draft'
    and public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[])
  );

-- ------------------------------------------------------------------- Lignes

create policy "invoice_items_all_org" on public.invoice_items
  for all to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.org_id in (select public.auth_org_ids())
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.org_id in (select public.auth_org_ids())
    )
  );

-- ---------------------------------------------------------------- Paiements

create policy "payments_select_org" on public.payments
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "payments_insert_org" on public.payments
  for insert to authenticated with check (org_id in (select public.auth_org_ids()));

create policy "payments_update_org" on public.payments
  for update to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create policy "payments_delete_admins" on public.payments
  for delete to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

-- --------------------------------------------------------------- Récurrence

create policy "recurring_select_org" on public.recurring_schedules
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "recurring_write_org" on public.recurring_schedules
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create policy "recurring_runs_select_org" on public.recurring_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.recurring_schedules s
      where s.id = recurring_runs.schedule_id and s.org_id in (select public.auth_org_ids())
    )
  );

-- ------------------------------------------------------------------ Journal

create policy "invoice_events_select_org" on public.invoice_events
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "invoice_events_insert_org" on public.invoice_events
  for insert to authenticated with check (org_id in (select public.auth_org_ids()));

-- --------------------------------------------------------------- Abonnement

-- Lecture seule côté application : seul le webhook (service role) écrit ici,
-- sinon un utilisateur pourrait s'attribuer un plan payant.
create policy "subscriptions_select_org" on public.subscriptions
  for select to authenticated using (org_id in (select public.auth_org_ids()));

-- `invoice_counters` et `billing_events` : RLS active, aucune policy. Tout accès
-- direct est donc refusé ; seules les fonctions SECURITY DEFINER y écrivent.

-- ------------------------------------------------- Consultation publique

-- Le lien public envoyé au client. Fonction dédiée plutôt qu'une policy ouverte
-- à `anon` : la surface exposée se limite exactement aux champs listés ici, et
-- ne peut pas être élargie par une requête PostgREST arbitraire.
create or replace function public.get_public_invoice(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_items jsonb;
begin
  select * into v_invoice from public.invoices where public_token = p_token;

  -- Un brouillon n'a jamais été communiqué : son lien ne doit rien exposer.
  if v_invoice.id is null or v_invoice.status = 'draft' then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.position), '[]'::jsonb)
  into v_items
  from (
    select position, description, quantity, unit_price, tax_rate,
           line_subtotal, line_discount, line_tax, line_total
    from public.invoice_items where invoice_id = v_invoice.id
  ) item;

  return jsonb_build_object(
    'id', v_invoice.id,
    'type', v_invoice.type,
    'number', v_invoice.number,
    'status', v_invoice.status,
    'issueDate', v_invoice.issue_date,
    'dueDate', v_invoice.due_date,
    'currency', v_invoice.currency,
    'subtotal', v_invoice.subtotal,
    'discountTotal', v_invoice.discount_total,
    'taxTotal', v_invoice.tax_total,
    'total', v_invoice.total,
    'amountPaid', v_invoice.amount_paid,
    'notes', v_invoice.notes,
    'terms', v_invoice.terms,
    'snapshot', v_invoice.snapshot,
    'items', v_items
  );
end;
$$;

revoke execute on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;
