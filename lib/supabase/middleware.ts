import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicSupabaseConfig, type CookiesToSet } from "@/lib/supabase/env";

/**
 * Marge avant expiration à partir de laquelle on renouvelle le jeton.
 *
 * Le jeton d'accès Supabase vit une heure. Cinq minutes suffisent largement à
 * couvrir la requête en cours et les quelques suivantes ; en dessous, on
 * renouvelle.
 */
const REFRESH_MARGIN_SECONDS = 5 * 60;

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
 * Son seul rôle : maintenir un jeton valide pour que les composants serveur
 * voient une session utilisable.
 *
 * COÛT — c'est le premier maillon de chaque navigation, et il est SÉQUENTIEL :
 * rien ne commence à s'afficher tant qu'il n'a pas répondu. Un `getUser()`
 * systématique ajoutait un aller-retour réseau à chaque clic, mesuré ici entre
 * 0,8 et 1,5 s. Or il n'apprend rien neuf fois sur dix : le jeton est encore
 * valide et Supabase le confirme, au prix d'un aller-retour.
 *
 * On regarde donc d'abord la date d'expiration, qui est DANS le cookie et ne
 * coûte aucun réseau, et on n'appelle Supabase qu'à l'approche de l'échéance.
 *
 * `getSession()` est ici le bon outil, malgré sa réputation : on ne s'en sert
 * pas pour identifier qui que ce soit — seulement pour lire une date et décider
 * s'il faut renouveler. Un cookie forgé ne gagne rien à mentir sur cette date :
 * il ne franchira ni le `getUser()` du layout serveur, ni la RLS. La règle
 * « getUser, jamais getSession » vaut pour l'authentification ; ce n'en est pas.
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

  // Lecture locale du cookie : aucun appel réseau tant que le jeton est bon.
  // On ne touche pas à `session.user` — cette valeur-là n'est pas digne de
  // confiance, et on n'en a pas besoin.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Visiteur non connecté : il n'y a rien à renouveler. C'est aussi ce qui rend
  // /login et /signup instantanés.
  if (!session) return response;

  const secondsLeft = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
  if (secondsLeft > REFRESH_MARGIN_SECONDS) return response;

  // Échéance proche (ou dépassée) : là, l'aller-retour est justifié. `getUser()`
  // renouvelle le jeton et `setAll` réécrit les cookies au passage.
  await supabase.auth.getUser();

  return response;
}
