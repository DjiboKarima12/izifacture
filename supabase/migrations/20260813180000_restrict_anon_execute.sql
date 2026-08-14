-- Referme l'exécution des fonctions de `public` aux rôles PostgREST.
--
-- Les migrations précédentes protégeaient les fonctions internes par
-- `revoke execute ... from public`. Insuffisant : Supabase pose des privilèges
-- par défaut qui accordent `execute` **directement** à `anon`, `authenticated`
-- et `service_role` sur toute fonction créée dans `public`. Une révocation
-- depuis le pseudo-rôle PUBLIC ne retire pas une concession directe, donc les
-- fonctions restaient joignables depuis l'API REST.
--
-- Le cas grave était `next_document_number` : `security definer`, sans contrôle
-- d'appartenance (elle n'était pas censée être atteignable de l'extérieur), et
-- dont chaque appel incrémente le compteur. Un appelant anonyme muni d'un
-- `org_id` pouvait donc creuser des trous dans la numérotation — ce que la
-- règle métier 4 interdit, et que l'OHADA n'admet pas.
--
-- On repart d'une base fermée puis on ré-accorde explicitement, plutôt que
-- d'énumérer les révocations : toute fonction ajoutée plus tard sera fermée par
-- défaut, et devra être ouverte à la main. C'est le sens de marche voulu.

revoke execute on all functions in schema public from anon, authenticated;

-- Seule lecture non authentifiée du produit : la consultation d'une facture par
-- son jeton public. La fonction filtre elle-même sur le jeton.
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- Rappelées depuis l'application, chacune vérifiant l'appartenance en interne.
grant execute on function public.auth_org_ids() to authenticated;
grant execute on function public.auth_has_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_credit_note(uuid) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid) to authenticated;
grant execute on function public.dashboard_stats(uuid) to authenticated;
grant execute on function public.monthly_totals(uuid, integer) to authenticated;

-- `next_document_number` n'est délibérément accordée à personne. Son seul
-- appelant légitime est `issue_invoice`, qui est `security definer` et s'exécute
-- donc avec les droits de son propriétaire, lesquels ne passent pas par ces
-- concessions. L'ouvrir à `authenticated` rouvrirait la faille : la fonction ne
-- vérifie aucune appartenance et accepterait n'importe quel `org_id`.
