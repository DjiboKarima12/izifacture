-- Le client devient facultatif sur une facture.
--
-- POURQUOI — toutes les boutiques ne notent pas à qui elles vendent. Une gargote
-- qui sert cinquante couverts par jour n'a ni le temps ni l'usage de créer une
-- fiche client pour chacun ; elle veut un ticket, un montant, une monnaie rendue.
-- Obliger à désigner un client transformait chaque vente au comptoir en création
-- de fiche, ou pire, en réutilisation d'un client fourre-tout qui fausse ensuite
-- toutes les statistiques par client.
--
-- Ce qui NE change pas : dès qu'un client est renseigné, il reste lié par clé
-- étrangère avec `on delete restrict`. On assouplit la saisie, pas l'intégrité.

alter table public.invoices
  alter column client_id drop not null;

-- ---------------------------------------------------------------------------
-- LE PIÈGE : la vue faisait une jointure INTERNE sur les clients.
--
-- Sans ce correctif, une facture sans client disparaîtrait purement et
-- simplement de `invoices_view` — donc de la liste des factures, du tableau de
-- bord et de la recherche. Elle existerait en base, encaissements compris, et
-- serait introuvable dans l'application. C'est la panne silencieuse que ce
-- fichier existe pour éviter.
--
-- `create or replace` conserve la liste et l'ordre des colonnes : seule la
-- nature de la jointure change.
-- ---------------------------------------------------------------------------
create or replace view public.invoices_view
with (security_invoker = on) as
select
  i.*,
  case
    when i.status in ('sent', 'partially_paid') and i.due_date < current_date then 'overdue'
    else i.status::text
  end as display_status,
  greatest(i.total - i.amount_paid, 0) as amount_due,
  case
    when i.status in ('sent', 'partially_paid') and i.due_date < current_date
      then (current_date - i.due_date)
    else 0
  end as days_overdue,
  c.name as client_name,
  c.email as client_email
from public.invoices i
left join public.clients c on c.id = i.client_id;

-- ---------------------------------------------------------------------------
-- Le snapshot d'émission doit distinguer « pas de client » de « client aux
-- champs vides ».
--
-- Sans le `case`, `jsonb_build_object` sur une variable non renseignée produit
-- un objet dont toutes les clés valent `null` — le reçu afficherait alors une
-- ligne CLIENT vide au lieu de ne pas l'afficher du tout. `null` dit « la
-- question ne se pose pas » ; un objet vide dit « on a perdu le nom ».
-- ---------------------------------------------------------------------------
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
  -- Ne renvoie aucune ligne quand `client_id` est nul : `v_client` reste vide.
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
        'client', case
          -- `null` dit « la question ne se pose pas » ; un objet aux clés vides
          -- dirait « on a perdu le nom ». Le reçu n'affiche pas la même chose.
          when v_invoice.client_id is null then null
          else jsonb_build_object(
            'name', v_client.name, 'email', v_client.email, 'phone', v_client.phone,
            'addressLine', v_client.address_line, 'city', v_client.city,
            'country', v_client.country, 'taxId', v_client.tax_id
          )
        end
      )
  where id = p_invoice
  returning * into v_invoice;

  insert into public.invoice_events (org_id, invoice_id, type, meta)
  values (v_invoice.org_id, v_invoice.id, 'issued', jsonb_build_object('number', v_invoice.number));

  return v_invoice;
end;
$$;

-- `create or replace function` conserve les droits, mais on les repose pour que
-- ce fichier dise à lui seul qui peut appeler la fonction.
revoke execute on function public.issue_invoice(uuid) from public;
grant execute on function public.issue_invoice(uuid) to authenticated;

notify pgrst, 'reload schema';
