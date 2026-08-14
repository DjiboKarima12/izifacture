"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Client Supabase du navigateur.
 *
 * Utilisé uniquement pour l'authentification (connexion, inscription,
 * déconnexion). Les données métier passent par les Server Actions et les
 * composants serveur : le navigateur n'interroge jamais les tables directement.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = publicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
