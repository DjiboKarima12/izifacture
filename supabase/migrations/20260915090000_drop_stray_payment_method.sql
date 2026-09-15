-- Retire la valeur `autres`, ajoutée en base mais absente du code.
--
-- D'OÙ ELLE VIENT — la migration `payment_methods_niger` a été appliquée à la
-- main dans l'éditeur SQL du tableau de bord, et un `autres` s'y est glissé.
-- Le code ne connaît que `other`, affiché « Autre » : deux orthographes pour la
-- même idée, dont une seule existe des deux côtés.
--
-- POURQUOI LA RETIRER PLUTÔT QUE L'ADOPTER — le schéma est en anglais partout
-- (`cash`, `other`), le français vit dans les libellés. Et surtout : une valeur
-- que le code ignore est une valeur qu'il ne sait pas afficher. Le jour où une
-- ligne la porterait, le reçu imprimerait « undefined » à la place du moyen de
-- paiement.
--
-- Sans perte : aucun encaissement ne l'utilise, vérifié avant écriture. Si une
-- ligne en portait une, le `using` ci-dessous échouerait et la migration serait
-- annulée en entier — un échec franc plutôt qu'une valeur choisie à la place de
-- l'utilisateur.

drop view public.payments_view;

alter type public.payment_method rename to payment_method_old;

create type public.payment_method as enum (
  'cash',
  'my_nita',
  'amanata',
  'wave',
  'airtel_money',
  'other'
);

alter table public.payments
  alter column method drop default,
  alter column method type public.payment_method
    using method::text::public.payment_method,
  alter column method set default 'cash';

drop type public.payment_method_old;

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
  c.email as client_email,
  p.tendered
from public.payments p
join public.invoices i on i.id = p.invoice_id
left join public.clients c on c.id = i.client_id;

-- Les droits ne survivent pas à un `drop view` : on les repose.
revoke all on public.payments_view from anon;
grant select on public.payments_view to authenticated;

notify pgrst, 'reload schema';
