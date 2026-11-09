import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour des liens envoyés par email : confirmation d'inscription et
 * réinitialisation du mot de passe.
 *
 * `next` est repassé par `safeNextPath()` : sans quoi `?next=@site-pirate.com`
 * donnait `https://facture…@site-pirate.com`, une redirection hors du site
 * portée par un lien qui semble venir de chez nous.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  // Si le type n'est pas dans l'URL mais qu'on a un token_hash, on force "recovery" par défaut
  const type = (searchParams.get("type") as EmailOtpType) || "recovery";
  const next = safeNextPath(searchParams.get("next")) ?? "/reset-password";

  const supabase = createSupabaseServerClient();

  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      await createPendingOrganization(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Erreur verifyOtp:", error.message);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await createPendingOrganization(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
}

/**
 * Crée l'organisation saisie à l'inscription, quand la confirmation par email
 * a empêché de le faire sur le moment (`signUp` n'avait pas de session).
 *
 * Seulement pour un compte qui n'en a AUCUNE : un lien de réinitialisation suivi
 * par un membre existant ne doit pas lui ouvrir une seconde boutique. En cas
 * d'échec, rien n'est perdu — `/onboarding` redemandera le nom.
 */
async function createPendingOrganization(supabase: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const name = user?.user_metadata?.organization_name;
    if (!user || typeof name !== "string" || name.trim().length < 2) return;

    // Le même client que celui qui vient d'ouvrir la session : un client neuf
    // pourrait ne pas encore la voir, lire zéro appartenance sous la RLS, et
    // créer une seconde boutique.
    const { data: memberships, error: readError } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1);
    if (readError || (memberships ?? []).length > 0) return;

    const { error } = await supabase.rpc("create_organization", { p_name: name.trim() });
    if (error) console.error("Création de l'organisation au retour du lien :", error.message);
  } catch (error) {
    console.error("Création de l'organisation au retour du lien :", error);
  }
}
