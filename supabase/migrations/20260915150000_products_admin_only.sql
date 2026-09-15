-- Le catalogue se gère, il ne se modifie pas en caisse.
--
-- POURQUOI — un caissier scanne et vend aux prix enregistrés. S'il peut corriger
-- un prix au passage, la différence ne se retrouve nulle part : la vente est
-- juste par rapport au ticket, et fausse par rapport au catalogue. C'est le
-- genre de perte qu'on ne découvre qu'à l'inventaire, sans savoir quand elle a
-- commencé.
--
-- La LECTURE reste ouverte à tous : sans elle, ni la douchette ni la suggestion
-- à la frappe ne fonctionneraient, et le caissier ne pourrait plus vendre.

drop policy "products_insert_org" on public.products;
drop policy "products_update_org" on public.products;

create policy "products_insert_admins" on public.products
  for insert to authenticated
  with check (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "products_update_admins" on public.products
  for update to authenticated
  using (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.auth_has_role(org_id, array['owner', 'admin']::public.member_role[]));

notify pgrst, 'reload schema';
