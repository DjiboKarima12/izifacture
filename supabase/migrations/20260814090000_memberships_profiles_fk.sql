-- Relie `memberships` à `profiles` pour que PostgREST puisse embarquer le profil.
--
-- `memberships.user_id` et `profiles.id` référencent tous deux `auth.users (id)`,
-- mais aucune clé étrangère ne les relie l'un à l'autre. PostgREST n'embarque
-- qu'à travers une contrainte déclarée — il ne déduit pas une relation d'un
-- ancêtre commun. D'où l'échec de `profile:profiles(full_name)` dans
-- `listMembers` : « Could not find a relationship between 'memberships' and
-- 'profiles' in the schema cache ».
--
-- La contrainte est sûre : `handle_new_user` insère le profil au moment où le
-- compte est créé, donc toute ligne de `memberships` a déjà son profil. La
-- colonne garde aussi sa clé étrangère vers `auth.users` ; deux contraintes sur
-- la même colonne ne se gênent pas, et l'embarquement reste sans ambiguïté
-- puisqu'une seule des deux vise `profiles`.

alter table public.memberships
  add constraint memberships_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- PostgREST tient un cache du schéma et ne verrait pas la nouvelle relation
-- avant son prochain rechargement, qui peut tarder. On le force.
notify pgrst, 'reload schema';
