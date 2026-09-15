"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/domain/schemas";
import { completerIdentifiant } from "@/lib/members";
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

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message volontairement identique pour un email inconnu et un mot de passe
    // faux : distinguer les deux permettrait d'énumérer les comptes existants.
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function signUp(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    // Confirmation par email activée : aucune session tant que le lien n'est
    // pas suivi, donc l'organisation sera créée à la première connexion.
    return { ok: true, data: undefined };
  }

  // Organisation + appartenance owner en une seule transaction, côté base.
  const { error: orgError } = await supabase.rpc("create_organization", {
    p_name: parsed.data.organizationName,
  });
  if (orgError) return { ok: false, error: orgError.message };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
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

  const origin = headers().get("origin") ?? "";
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Erreur lors de l'envoi de l'email de réinitialisation :", error);
  }

  // Toujours un succès — ne pas révéler si le compte existe.
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
