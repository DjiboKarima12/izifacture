"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/domain/schemas";
import { completerIdentifiant } from "@/lib/members";
import { safeNextPath } from "@/lib/auth/next-path";
import { siteUrl } from "@/lib/site";
import type { ActionResult } from "@/lib/actions/invoices";

/**
 * À la CONNEXION, un identifiant nu est accepté.
 *
 * Un caissier reçoit « majida », pas une adresse : c'est la seule chose qu'on lui
 * a apprise à taper. On la complète en adresse interne AVANT de la valider, de
 * sorte que le reste de la chaîne ne manipule jamais qu'une adresse.
 *
 * L'INSCRIPTION garde `credentialsSchema` et exige une vraie adresse : un compte
 * qu'on crée soi-même doit pouvoir recevoir un lien de réinitialisation.
 */
const loginSchema = z.object({
  email: z.string().trim().transform(completerIdentifiant).pipe(emailSchema),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

const credentialsSchema = z.object({
  email: emailSchema,
  // 8 caractères minimum : le défaut de Supabase est 6, trop court pour une
  // application qui donne accès à la comptabilité d'une entreprise.
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Votre nom est requis."),
  organizationName: z.string().trim().min(2, "Le nom de l'entreprise est requis."),
});

function invalid(error: z.ZodError): ActionResult<never> {
  const first = Object.values(error.flatten().fieldErrors).flat()[0];
  return { ok: false, error: first ?? "Formulaire invalide." };
}

/**
 * Supabase injoignable (réseau coupé, service en panne) : ce n'est pas une
 * réponse sur le compte, donc la dire ne révèle rien. La taire ferait passer une
 * coupure pour un mauvais mot de passe, ou pour un email parti qui ne l'est pas.
 */
function serviceInjoignable(error: AuthError): boolean {
  return isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500;
}

const MESSAGE_INJOIGNABLE =
  "Service injoignable. Vérifiez votre connexion internet et réessayez.";

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (serviceInjoignable(error)) return { ok: false, error: MESSAGE_INJOIGNABLE };
    // Message volontairement identique pour un email inconnu et un mot de passe
    // faux : distinguer les deux permettrait d'énumérer les comptes existants.
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * `confirmEmail` vrai : la confirmation par email est activée, aucune session
 * n'existe encore. Le formulaire doit alors dire de suivre le lien reçu, et non
 * pousser vers une page qui renverrait à la connexion.
 *
 * Le lien de confirmation ramène sur `/auth/callback` avec la destination
 * voulue (`next`) : qui a cliqué « Choisir le Premium » retombe sur le
 * paiement, pas sur un écran de connexion. Le nom de l'entreprise voyage dans
 * les métadonnées du compte, pour que le retour du lien crée l'organisation
 * sans redemander ce qui a déjà été saisi.
 */
export async function signUp(
  input: unknown,
  next?: string | null,
): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const destination = safeNextPath(next) ?? "/dashboard";
  const origin = (await headers()).get("origin");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization_name: parsed.data.organizationName,
      },
      emailRedirectTo: `${siteUrl(origin)}/auth/callback?next=${encodeURIComponent(destination)}`,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.session) return { ok: true, data: { confirmEmail: true } };

  // Organisation + appartenance owner en une seule transaction, côté base.
  const { error: orgError } = await supabase.rpc("create_organization", {
    p_name: parsed.data.organizationName,
  });
  if (orgError) return { ok: false, error: orgError.message };

  revalidatePath("/", "layout");
  return { ok: true, data: { confirmEmail: false } };
}

export async function signOut(): Promise<never> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Crée l'organisation d'un compte qui n'en a pas encore (page /onboarding). */
export async function createOrganization(name: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(2, "Le nom de l'entreprise est requis.").safeParse(name);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", { p_name: parsed.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Envoie un lien de réinitialisation de mot de passe par email.
 *
 * Même principe anti-énumération que pour `signIn` : on retourne toujours un
 * message de succès, que le compte existe ou non. Un attaquant ne doit pas
 * pouvoir distinguer les deux cas.
 */
export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const headerList = await headers();
  const origin = headerList.get("origin") ?? "";
  const supabase = createSupabaseServerClient();

  const redirectToUrl = `${siteUrl(origin)}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectToUrl,
  });

  if (error) {
    console.error("Erreur lors de l'envoi de l'email de réinitialisation :", error);
    if (serviceInjoignable(error)) return { ok: false, error: MESSAGE_INJOIGNABLE };
    // Plafond d'envoi de tout le projet, pas d'un compte : le dire ne révèle rien.
    if (error.code === "over_email_send_rate_limit") {
      return {
        ok: false,
        error: "Trop d'emails envoyés pour le moment. Réessayez dans une heure.",
      };
    }
  }

  // Hors panne, toujours un succès — ne pas révéler si le compte existe.
  return { ok: true, data: undefined };
}

/**
 * Met à jour le mot de passe de l'utilisateur connecté.
 *
 * Appelé depuis la page `/reset-password`, après que le callback ait échangé le
 * code de réinitialisation contre une session.
 */
export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}