/**
 * Point d'entrée unique de l'accès aux données.
 *
 * Les composants importent `repositories` d'ici et rien d'autre. Basculer entre
 * la base en mémoire et Supabase se fait par la variable d'environnement
 * `NEXT_PUBLIC_DATA_SOURCE` — sans toucher une seule ligne de composant.
 *
 * Le drapeau, plutôt qu'un remplacement pur et simple, permet de revenir au
 * mock en une variable si la bascule pose problème en cours de migration.
 */

import { mockRepositories } from "@/lib/data/mock";
import { supabaseDataEnabled } from "@/lib/supabase/env";
import type { Repositories } from "@/lib/data/repository";

/**
 * Import différé : `lib/data/supabase` est marqué `server-only` et lit les
 * cookies. Le charger inconditionnellement casserait tout rendu qui n'a pas de
 * requête, et exigerait les variables Supabase même en mode mock.
 */
function resolveRepositories(): Repositories {
  if (!supabaseDataEnabled()) return mockRepositories;

  // Pas de directive `eslint-disable` ici : le greffon `@typescript-eslint`
  // n'est pas chargé dans cette configuration, et désactiver une règle absente
  // déclenche « Definition for rule ... was not found » — une erreur bloquante
  // au build. Le `require` est volontaire, cf. le commentaire ci-dessus.
  const { supabaseRepositories } = require("@/lib/data/supabase") as {
    supabaseRepositories: Repositories;
  };
  return supabaseRepositories;
}

export const repositories: Repositories = resolveRepositories();

export * from "@/lib/data/repository";
