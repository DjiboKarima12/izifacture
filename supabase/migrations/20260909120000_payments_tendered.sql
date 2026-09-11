-- Le montant remis par le client, pour pouvoir imprimer la monnaie rendue.
--
-- CE QUI MANQUAIT — `payments.amount` dit ce que le règlement a réglé, jamais ce
-- que le client a effectivement tendu. Un billet de 5 000 sur une facture de
-- 2 950 et un paiement de 2 950 pile produisaient exactement la même ligne, donc
-- le ticket ne pouvait pas annoncer la monnaie. Or c'est le premier chiffre que
-- regarde quelqu'un qui paie en espèces, et le seul qui se conteste au comptoir.
--
-- POURQUOI PAS STOCKER LA MONNAIE — elle se déduit : `tendered - amount`. La
-- stocker créerait un second chiffre à maintenir cohérent avec les deux autres,
-- pour rien. Même raison que `overdue`, qui se dérive au lieu d'être écrit.
--
-- NULLABLE, ET C'EST LE POINT — la colonne ne vaut que pour les espèces. Un
-- virement, un paiement par carte ou par mobile money ne rend pas de monnaie :
-- `null` y signifie « la question ne se pose pas », ce qu'un zéro dirait mal
-- puisqu'il se lit aussi « le client n'a rien tendu ». Les encaissements déjà
-- saisis restent donc valides sans reprise.
--
-- La contrainte interdit de recevoir moins que ce qu'on encaisse : la monnaie
-- rendue serait négative, ce qui n'est pas une monnaie mais une erreur de saisie.

alter table public.payments
  add column tendered bigint
  check (tendered is null or tendered >= amount);

comment on column public.payments.tendered is
  'Montant remis par le client, espèces uniquement. La monnaie rendue vaut tendered - amount ; elle n''est pas stockée.';

-- La vue énumère ses colonnes une à une : sans cet ajout, `payments_view`
-- ignorerait `tendered` et le dépôt renverrait `null` pour tout encaissement lu
-- par la liste — un champ faux, plus difficile à débusquer qu'un champ absent.
--
-- `create or replace` n'autorise l'ajout qu'EN FIN de liste : les colonnes déjà
-- publiées doivent garder leur nom, leur type et leur rang. D'où `tendered`
-- placé après `client_email` plutôt qu'à côté de `method`, où il se lirait mieux.
-- Le prix d'un `drop ... cascade` — les droits à reposer, la vue indisponible le
-- temps de la transaction — ne vaut pas ce confort de lecture.
create or replace view public.payments_view
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

notify pgrst, 'reload schema';
