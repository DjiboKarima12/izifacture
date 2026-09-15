-- Referme `accept_invitation` à `anon`, et empêche le défaut de se reproduire.
--
-- CE QUI S'EST PASSÉ — la migration précédente faisait
-- `revoke execute ... from public` puis `grant ... to authenticated`, en croyant
-- avoir tout fermé. Mais Supabase pose une concession DIRECTE à `anon` sur toute
-- fonction créée dans `public` : révoquer depuis le pseudo-rôle PUBLIC ne
-- l'annule pas. C'est exactement l'erreur que `20260909110000` avait corrigée
-- sur dix-neuf fonctions, reproduite sur la vingtième.
--
-- Le risque était faible — la fonction refuse un appelant sans `auth.uid()` — et
-- les messages d'erreur ne permettaient pas de deviner un code valide. Mais une
-- porte fermée par hasard reste une porte qu'on a oublié de verrouiller.

revoke execute on function public.accept_invitation(text) from public, anon;

-- ---------------------------------------------------------------------------
-- LA VRAIE CORRECTION : changer le défaut, pas seulement le cas présent.
--
-- Sans ça, la prochaine fonction ajoutée au schéma naîtra de nouveau ouverte à
-- `anon`, et il faudra y penser — ce qui, à l'évidence, ne marche pas. On retire
-- donc la concession automatique : toute fonction future est fermée à la
-- création, et devra être ouverte explicitement.
--
-- Ne vaut que pour les objets créés par `postgres`, le rôle qui applique les
-- migrations. C'est précisément celui qui nous intéresse.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  revoke execute on functions from anon;

notify pgrst, 'reload schema';
