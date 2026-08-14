import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { publicSupabaseConfig, serviceRoleKey, type CookiesToSet } from "@/lib/supabase/env";

/**
 * Client Supabase pour les composants serveur et les Server Actions.
 *
 * Il porte la session de l'utilisateur via les cookies : toutes ses requêtes
 * passent donc par la RLS. C'est le client à utiliser partout, par défaut.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, anonKey } = publicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un composant serveur ne peut pas écrire de cookie. Ce n'est pas une
          // erreur : le middleware a déjà rafraîchi la session pour cette requête.
        }
      },
    },
  });
}

/**
 * Client administrateur — CONTOURNE LA RLS.
 *
 * Réservé à ce qui n'a pas d'utilisateur : webhooks de facturation, tâches
 * planifiées, consultation d'une facture par jeton public. Chaque appel doit
 * borner lui-même son périmètre, puisque la base ne le fera plus.
 */
export function createSupabaseAdminClient() {
  const { url } = publicSupabaseConfig();

  return createServerClient(url, serviceRoleKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Aucune session à propager : ce client n'agit au nom de personne.
      },
    },
  });
}
