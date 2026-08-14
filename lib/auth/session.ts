import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { repositories } from "@/lib/data";
import { DEMO_ORG_ID, DEMO_USER_ID } from "@/lib/data/mock/seed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseDataEnabled } from "@/lib/supabase/env";
import type { Organization, UUID } from "@/lib/domain/types";

export type Session = {
  userId: UUID;
  orgId: UUID;
  organization: Organization;
  user: { name: string; email: string };
};

/**
 * Session courante.
 *
 * Deux modes, selon `NEXT_PUBLIC_DATA_SOURCE` :
 *  - `mock` : organisation de démonstration, sans authentification ;
 *  - `supabase` : session réelle, et redirection vers /login sans utilisateur.
 *
 * C'EST ICI que se fait le contrôle d'accès, appelé par le layout serveur —
 * pas dans le middleware, qui est contournable (CVE-2025-29927).
 *
 * Mémoïsé par `cache()` : le layout ET la page appellent tous deux `getSession()`
 * pendant le même rendu. Sans mémoïsation, ce sont quatre allers-retours réseau
 * au lieu de deux — `getUser()` puis `listForUser()`, deux fois. La portée de
 * `cache()` est la requête : deux visiteurs ne partagent jamais une session, et
 * l'appel suivant du même visiteur repart à zéro.
 */
export const getSession = cache(async function getSession(): Promise<Session> {
  /**
   * Sort les pages du rendu statique. Sans ça, Next prérend le tableau de bord
   * et les listes au build : une facture créée ensuite n'y apparaîtrait jamais.
   */
  noStore();

  return supabaseDataEnabled() ? supabaseSession() : demoSession();
});

async function supabaseSession(): Promise<Session> {
  const supabase = createSupabaseServerClient();

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès de Supabase. `getSession()` lit un cookie, qui peut être forgé.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organizations = await repositories.organizations.listForUser(user.id);
  const organization = organizations[0];

  // Un compte sans organisation ne peut rien faire : on l'envoie la créer
  // plutôt que d'afficher des écrans vides.
  if (!organization) redirect("/onboarding");

  return {
    userId: user.id,
    orgId: organization.id,
    organization,
    user: {
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Utilisateur",
      email: user.email ?? "",
    },
  };
}

/** Mode démonstration — remplacé dès que `NEXT_PUBLIC_DATA_SOURCE=supabase`. */
async function demoSession(): Promise<Session> {
  const organization = await repositories.organizations.get(DEMO_ORG_ID);
  if (!organization) throw new Error("Organisation de démonstration introuvable");

  const members = await repositories.organizations.listMembers(DEMO_ORG_ID);
  const owner = members.find((member) => member.userId === DEMO_USER_ID);

  return {
    userId: DEMO_USER_ID,
    orgId: DEMO_ORG_ID,
    organization,
    user: {
      name: owner?.fullName ?? "Utilisateur",
      email: owner?.email ?? "",
    },
  };
}
