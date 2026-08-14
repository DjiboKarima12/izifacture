import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { supabaseDataEnabled } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  // Tant que la source de données est le mock, il n'y a aucune session à
  // rafraîchir — et exiger les variables Supabase ferait échouer chaque requête.
  if (!supabaseDataEnabled()) {
    const { NextResponse } = await import("next/server");
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  /**
   * Exclut les fichiers statiques et les images : les faire passer par le
   * middleware coûterait un aller-retour de session pour rien.
   *
   * `/login` et `/signup` sont exclus pour la même raison : `getUser()` est un
   * appel réseau au serveur d'auth, et ces deux pages s'affichent précisément
   * quand il n'y a pas de session à rafraîchir. Elles portaient jusqu'ici le
   * coût d'un aller-retour inutile — c'est ce qui rendait l'arrivée sur le
   * formulaire d'inscription lente. `/onboarding` reste couvert : il exige une
   * session valide.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|signup|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
