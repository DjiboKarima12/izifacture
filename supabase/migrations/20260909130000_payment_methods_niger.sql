-- Les moyens de paiement deviennent ceux qu'on utilise réellement au Niger.
--
-- L'énumération d'origine était générique — « mobile money », « virement »,
-- « carte » — et ne nommait aucun des services par lesquels l'argent circule ici.
-- Un commerçant ne dit pas « mobile money » : il dit MyNita, Amanata, Wave ou
-- Airtel Money. Un libellé qu'il faut traduire mentalement à chaque saisie est
-- un libellé qui sera mal choisi.
--
-- REMPLACEMENT ET NON AJOUT — les anciennes valeurs disparaissent. C'est possible
-- sans perte parce qu'AUCUNE n'est utilisée : les encaissements enregistrés sont
-- tous en `cash`, la seule valeur conservée. Si une ligne portait autre chose, le
-- `using` ci-dessous échouerait et la migration entière serait annulée — un échec
-- franc plutôt qu'une conversion silencieuse vers une valeur approchante.
--
-- « Autre » est conservée, en fin de liste : il faut bien pouvoir enregistrer un
-- règlement qui n'entre dans aucune case, et l'absence d'échappatoire pousserait à
-- cocher un moyen faux — ce qui abîmerait les statistiques bien plus sûrement.

-- La vue lit `payments.method` : Postgres refuse de changer le type d'une colonne
-- dont dépend une vue. On la supprime ici et on la repose à l'identique en fin de
-- migration — la transaction garantit qu'elle ne peut pas rester absente.
drop view public.payments_view;

alter type public.payment_method rename to payment_method_old;

create type public.payment_method as enum (
  'cash',
  'my_nita',
  'amanata',
  'wave',
  'airtel_money',
  -- Dernière de la liste, et volontairement sans intitulé précis : elle absorbe
  -- ce qui n'entre nulle part plutôt que de forcer un choix faux. En abuser rend
  -- les statistiques par moyen de paiement inexploitables — d'où la place, en fin
  -- de liste, où l'on ne tombe qu'après avoir écarté les autres.
  'other'
);

-- Le défaut porte l'ancien type : il doit tomber avant la conversion, et être
-- reposé après, sinon Postgres refuse de convertir la colonne.
alter table public.payments
  alter column method drop default,
  alter column method type public.payment_method
    using method::text::public.payment_method,
  alter column method set default 'cash';

drop type public.payment_method_old;

-- Vue reposée à l'identique, `tendered` compris (cf. 20260909120000).
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
