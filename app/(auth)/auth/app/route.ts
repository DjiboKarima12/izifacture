import { NextResponse, type NextRequest } from "next/server";

import { supabaseDataEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Porte d'entrée de l'application INSTALLÉE (`start_url` du manifeste).
 *
 * Elle ferme la session puis ouvre la connexion : l'icône du bureau ne donne
 * jamais accès aux factures sans mot de passe, même sur un ordinateur prêté ou
 * partagé. Afficher seulement le formulaire ne suffirait pas — la session,
 * toujours valide derrière, resterait atteignable.
 *
 * `scope: "local"` : seule la session de CET ordinateur est fermée. Le
 * téléphone du commerçant, connecté de son côté, n'est pas déconnecté.
 *
 * Effet voulu et assumé : les cookies sont ceux du navigateur, donc un onglet
 * Chrome ouvert sur le site est déconnecté lui aussi.
 */
export async function GET(request: NextRequest) {
  // Jeu de démonstration : aucune session réelle à fermer.
  if (supabaseDataEnabled()) {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(new URL("/login?next=%2Fdashboard", request.url));
}
