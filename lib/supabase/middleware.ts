import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicSupabaseConfig, type CookiesToSet } from "@/lib/supabase/env";

/**
 * Rafraîchissement de la session — ET RIEN D'AUTRE.
 *
 * Ce middleware ne décide JAMAIS d'un accès. La CVE-2025-29927 a montré qu'un
 * en-tête HTTP forgé permettait de contourner entièrement le middleware de
 * Next : toute autorisation qui vivrait ici serait donc contournable.
 *
 * Le contrôle d'accès réel est ailleurs, à deux niveaux :
 *   1. les layouts serveur et les Server Actions, qui redirigent sans session ;
 *   2. la RLS Postgres, qui refuse les lignes d'une autre organisation même si
 *      les deux premiers étaient contournés.
 *
 * Son seul rôle : appeler `getUser()` pour que le jeton soit renouvelé et que
 * les composants serveur voient une session valide.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = publicSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès du serveur Supabase. `getSession()` se contente de lire le cookie,
  // qui peut avoir été forgé.
  await supabase.auth.getUser();

  return response;
}
