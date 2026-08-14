-- IziFacture — vues de lecture
--
-- `security_invoker = on` : la vue s'exécute avec les droits de l'appelant, donc
-- la RLS des tables sous-jacentes s'applique normalement. Sans cette option, une
-- vue s'exécute avec les droits de son propriétaire et court-circuiterait
-- l'isolation entre organisations.

-- `overdue` est calculé ici plutôt que stocké : une facture devient « en retard »
-- à la seconde où l'échéance passe, sans tâche planifiée, et ne peut pas rester
-- affichée en retard après paiement à cause d'un job qui aurait échoué.
create view public.invoices_view
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
join public.clients c on c.id = i.client_id;

revoke all on public.invoices_view from anon;
grant select on public.invoices_view to authenticated;

-- Statistiques du tableau de bord, calculées en base plutôt que côté client :
-- une organisation avec plusieurs milliers de factures ne doit pas les
-- télécharger toutes pour afficher quatre chiffres.
create or replace function public.dashboard_stats(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Brouillons, devis et documents annulés sont exclus : ce ne sont pas des
  -- créances, les compter gonflerait artificiellement le chiffre d'affaires.
  with scoped as (
    select * from public.invoices
    where org_id = p_org
      and type = 'invoice'
      and status not in ('draft', 'cancelled')
  )
  select jsonb_build_object(
    'invoiceCount', count(*),
    'totalInvoiced', coalesce(sum(total), 0),
    'totalPaid', coalesce(sum(amount_paid), 0),
    'totalOutstanding', coalesce(sum(total - amount_paid), 0),
    'totalOverdue', coalesce(sum(total - amount_paid)
      filter (where status in ('sent', 'partially_paid') and due_date < current_date), 0),
    'overdueCount', count(*)
      filter (where status in ('sent', 'partially_paid') and due_date < current_date)
  )
  from scoped;
$$;

grant execute on function public.dashboard_stats(uuid) to authenticated;

-- Série mensuelle facturé / encaissé pour le graphique du tableau de bord.
create or replace function public.monthly_totals(p_org uuid, p_months integer default 12)
returns table (month date, invoiced bigint, paid bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - make_interval(months => p_months - 1),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month
  )
  select
    m.month,
    coalesce((
      select sum(i.total) from public.invoices i
      where i.org_id = p_org and i.type = 'invoice'
        and i.status not in ('draft', 'cancelled')
        and date_trunc('month', i.issue_date)::date = m.month
    ), 0)::bigint as invoiced,
    coalesce((
      select sum(p.amount) from public.payments p
      where p.org_id = p_org
        and date_trunc('month', p.paid_at)::date = m.month
    ), 0)::bigint as paid
  from months m
  order by m.month;
$$;

grant execute on function public.monthly_totals(uuid, integer) to authenticated;
