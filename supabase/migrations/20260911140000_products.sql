-- Catalogue de produits : un nom, un prix, éventuellement un code-barres.
--
-- POURQUOI — la plupart des boutiques vendent toujours les mêmes articles. Sans
-- catalogue, chaque vente se retape entièrement : le nom, le prix, le taux. À
-- cinquante ventes par jour, c'est la principale perte de temps de la journée,
-- et la principale source de fautes de frappe sur un prix.
--
-- Le code-barres est FACULTATIF. Une gargote vend de l'attiéké, qui ne porte
-- aucun code ; une boutique d'alimentation vend des boîtes qui en ont un. Le
-- catalogue doit servir les deux, donc le code ne peut pas être obligatoire.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),

  -- Entier en unités mineures, comme partout ailleurs : le franc CFA n'a pas de
  -- décimale, donc 1 unité = 1 franc. Aucun flottant ne touche un montant.
  unit_price bigint not null default 0 check (unit_price >= 0),

  -- Par produit, parce qu'un même commerce vend souvent des articles taxés
  -- différemment. Par défaut, celui de l'organisation.
  tax_rate numeric(5, 2) not null default 19 check (tax_rate between 0 and 100),

  barcode text check (barcode is null or length(btrim(barcode)) between 1 and 64),
  unit text check (unit is null or length(btrim(unit)) between 1 and 20),
  notes text,

  -- Archivage logique, comme pour les clients : un produit déjà facturé ne doit
  -- jamais disparaître. Les lignes de facture recopient le nom et le prix au
  -- moment de la vente, mais l'historique du catalogue reste consultable.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_org_id_idx on public.products (org_id);
create index products_org_active_idx on public.products (org_id) where archived_at is null;

-- Un code-barres identifie UN article dans UNE boutique. L'unicité est donc par
-- organisation, pas globale : deux commerces peuvent très bien vendre le même
-- produit du commerce, avec le même code EAN.
--
-- Index partiel : les produits sans code ne s'y trouvent pas, donc ils ne se
-- gênent pas entre eux. Un index unique ordinaire aurait laissé passer les
-- doublons de `null` mais interdit d'en avoir plusieurs sur certains moteurs —
-- ici la règle est explicite.
create unique index products_org_barcode_key
  on public.products (org_id, barcode)
  where barcode is not null and archived_at is null;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- Accès

alter table public.products enable row level security;

-- `anon` n'a aucun accès direct : la seule lecture non authentifiée du produit
-- est la consultation d'une facture par jeton, qui passe par une fonction.
revoke all on public.products from anon;

create policy "products_select_org" on public.products
  for select to authenticated using (org_id in (select public.auth_org_ids()));

create policy "products_insert_org" on public.products
  for insert to authenticated with check (org_id in (select public.auth_org_ids()));

create policy "products_update_org" on public.products
  for update to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create policy "products_delete_admins" on public.products
  for delete to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

notify pgrst, 'reload schema';
