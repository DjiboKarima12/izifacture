-- IziFacture — opérations composées et vue de recherche
--
-- Ce que ce fichier ajoute ne pourrait PAS être fait correctement depuis
-- l'application : créer un avoir, c'est insérer un document puis copier ses
-- lignes. Fait en deux requêtes depuis le client, un échec intermédiaire
-- laisserait un avoir vide et incohérent. En fonction, c'est atomique.

-- ------------------------------------------------------------------ Avoir

create or replace function public.create_credit_note(p_invoice uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.invoices;
  v_credit public.invoices;
begin
  select * into v_source from public.invoices where id = p_invoice;
  if v_source.id is null then
    raise exception 'Facture introuvable.' using errcode = 'no_data_found';
  end if;

  -- SECURITY DEFINER contourne la RLS : l'appartenance se vérifie ici,
  -- explicitement, sinon n'importe qui pourrait créer un avoir sur la facture
  -- d'une autre organisation en connaissant son identifiant.
  if not public.auth_has_role(
    v_source.org_id,
    array['owner', 'admin', 'member']::public.member_role[]
  ) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if v_source.type <> 'invoice' then
    raise exception 'Un avoir ne peut porter que sur une facture.'
      using errcode = 'check_violation';
  end if;
  if v_source.status = 'draft' then
    raise exception 'Un brouillon se modifie directement : aucun avoir n''est nécessaire.'
      using errcode = 'check_violation';
  end if;

  insert into public.invoices (
    org_id, client_id, type, status, issue_date, due_date, currency,
    notes, terms, parent_invoice_id, created_by
  )
  values (
    v_source.org_id, v_source.client_id, 'credit_note', 'draft',
    current_date, current_date, v_source.currency,
    v_source.notes, v_source.terms, v_source.id, auth.uid()
  )
  returning * into v_credit;

  -- Les montants des lignes sont recalculés par le trigger : on ne copie que
  -- les valeurs saisies, jamais les totaux.
  insert into public.invoice_items (
    invoice_id, position, description, quantity, unit_price, tax_rate,
    discount_type, discount_value
  )
  select v_credit.id, position, description, quantity, unit_price, tax_rate,
         discount_type, discount_value
  from public.invoice_items
  where invoice_id = v_source.id;

  insert into public.invoice_events (org_id, invoice_id, type, meta)
  values (
    v_credit.org_id, v_credit.id, 'created',
    jsonb_build_object('parentInvoiceId', v_source.id)
  );

  select * into v_credit from public.invoices where id = v_credit.id;
  return v_credit;
end;
$$;

revoke execute on function public.create_credit_note(uuid) from public;
grant execute on function public.create_credit_note(uuid) to authenticated;

-- ------------------------------------------------ Conversion d'un devis

-- Le devis n'est PAS transformé : une facture distincte est créée à partir de
-- ses lignes. Les deux documents coexistent — le client a accepté un devis
-- précis, il faut pouvoir y revenir.
create or replace function public.convert_quote_to_invoice(p_quote uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.invoices;
  v_org public.organizations;
  v_invoice public.invoices;
begin
  select * into v_quote from public.invoices where id = p_quote;
  if v_quote.id is null then
    raise exception 'Devis introuvable.' using errcode = 'no_data_found';
  end if;

  if not public.auth_has_role(
    v_quote.org_id,
    array['owner', 'admin', 'member']::public.member_role[]
  ) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if v_quote.type <> 'quote' then
    raise exception 'Ce document n''est pas un devis.' using errcode = 'check_violation';
  end if;

  select * into v_org from public.organizations where id = v_quote.org_id;

  insert into public.invoices (
    org_id, client_id, type, status, issue_date, due_date, currency,
    notes, terms, parent_invoice_id, created_by
  )
  values (
    v_quote.org_id, v_quote.client_id, 'invoice', 'draft',
    current_date, current_date + coalesce(v_org.default_payment_terms, 30),
    v_quote.currency, v_quote.notes, null, v_quote.id, auth.uid()
  )
  returning * into v_invoice;

  insert into public.invoice_items (
    invoice_id, position, description, quantity, unit_price, tax_rate,
    discount_type, discount_value
  )
  select v_invoice.id, position, description, quantity, unit_price, tax_rate,
         discount_type, discount_value
  from public.invoice_items
  where invoice_id = v_quote.id;

  insert into public.invoice_events (org_id, invoice_id, type, meta)
  values (
    v_invoice.org_id, v_invoice.id, 'created',
    jsonb_build_object('convertedFromQuoteId', v_quote.id)
  );

  select * into v_invoice from public.invoices where id = v_invoice.id;
  return v_invoice;
end;
$$;

revoke execute on function public.convert_quote_to_invoice(uuid) from public;
grant execute on function public.convert_quote_to_invoice(uuid) to authenticated;

-- ------------------------------------------------- Vue des encaissements

-- Les encaissements se cherchent par numéro de facture ou par nom de client,
-- qui vivent dans d'autres tables. Sans cette vue, il faudrait charger toutes
-- les lignes pour filtrer côté application — donc plus de pagination possible.
create view public.payments_view
with (security_invoker = on) as
select
  p.id,
  p.org_id,
  p.invoice_id,
  p.amount,
  p.paid_at,
  p.method,
  p.reference,
  p.note,
  p.created_by,
  p.created_at,
  i.number as invoice_number,
  i.type as invoice_type,
  i.status as invoice_status,
  i.currency as invoice_currency,
  c.id as client_id,
  c.name as client_name,
  c.email as client_email
from public.payments p
join public.invoices i on i.id = p.invoice_id
left join public.clients c on c.id = i.client_id;

revoke all on public.payments_view from anon;
grant select on public.payments_view to authenticated;
