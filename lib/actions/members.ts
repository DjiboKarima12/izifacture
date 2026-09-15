"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adresseDeConnexion,
  identifiantValide,
  LONGUEUR_MIN_MOT_DE_PASSE,
} from "@/lib/members";
import type { ActionResult } from "@/lib/actions/invoices";

/**
 * Création directe d'un compte de caisse par le responsable.
 *
 * Plus simple que l'invitation par code pour une boutique : le patron ouvre les
 * comptes du matin, distribue les mots de passe, et personne n'a besoin d'une
 * adresse email ni de recopier quoi que ce soit.
 *
 * Passe par la CLÉ DE SERVICE, qui contourne la RLS. C'est le seul moyen de
 * créer un compte sans que l'intéressé s'inscrive lui-même — et c'est pourquoi
 * l'appartenance de l'appelant est vérifiée ici, explicitement, avant toute
 * écriture.
 */

const saisieSchema = z.object({
  fullName: z.string().trim().min(2, "Le nom est requis").max(120),
  identifiant: z
    .string()
    .trim()
    .toLowerCase()
    .refine(identifiantValide, "3 à 30 caractères : lettres, chiffres, point ou tiret."),
  password: z
    .string()
    .min(LONGUEUR_MIN_MOT_DE_PASSE, `Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`)
    .max(72),
  role: z.enum(["member", "admin"]).default("member"),
});

/**
 * L'appelant a-t-il le droit de créer un compte dans cette boutique ?
 *
 * Lu avec le client de SESSION, pas la clé de service : la RLS laisse chacun
 * lire sa propre appartenance, donc la réponse porte bien sur l'appelant et non
 * sur ce qu'il prétend être.
 */
async function estResponsable(orgId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = (data as { role?: string } | null)?.role;
  return role === "owner" || role === "admin";
}

export async function createMemberAccount(
  input: unknown,
): Promise<ActionResult<{ login: string }>> {
  const parsed = saisieSchema.safeParse(input);
  if (!parsed.success) {
    const premier = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: premier ?? "Formulaire invalide." };
  }

  const session = await getSession();

  if (!(await estResponsable(session.orgId, session.userId))) {
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent créer un compte." };
  }

  const login = adresseDeConnexion(parsed.data.identifiant, session.orgId);
  const admin = createSupabaseAdminClient();

  const { data: cree, error: erreurCompte } = await admin.auth.admin.createUser({
    email: login,
    password: parsed.data.password,
    // Confirmé d'office : l'adresse est interne, aucun courrier n'y arrivera
    // jamais. Sans ça, le caissier attendrait un email qui n'existe pas.
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (erreurCompte || !cree?.user) {
    const message = erreurCompte?.message ?? "";
    if (/already|registered|exists/i.test(message)) {
      return { ok: false, error: "Cet identifiant est déjà pris dans votre boutique." };
    }
    console.error("[compte caissier · création]", erreurCompte);
    return { ok: false, error: "Impossible de créer le compte. Réessayez." };
  }

  const { error: erreurMembre } = await admin.from("memberships").insert({
    org_id: session.orgId,
    user_id: cree.user.id,
    role: parsed.data.role,
  });

  /**
   * Si l'appartenance échoue, on SUPPRIME le compte qu'on vient de créer.
   *
   * Sans ce retour en arrière, il resterait un compte capable de se connecter
   * mais rattaché à aucune boutique : il tomberait sur l'écran de création
   * d'entreprise et se fabriquerait la sienne. L'identifiant serait pris, et
   * personne ne saurait pourquoi.
   */
  if (erreurMembre) {
    await admin.auth.admin.deleteUser(cree.user.id);
    console.error("[compte caissier · appartenance]", erreurMembre);
    return { ok: false, error: "Impossible de rattacher le compte à la boutique." };
  }

  revalidatePath("/settings");
  return { ok: true, data: { login } };
}

/**
 * Retire un membre de la boutique.
 *
 * On supprime l'APPARTENANCE, pas le compte : ses factures et ses encaissements
 * gardent leur auteur. Le compte subsiste sans boutique et ne peut plus rien
 * voir — ce qui est l'effet recherché, sans réécrire l'historique.
 */
export async function removeMember(userId: string): Promise<ActionResult> {
  const session = await getSession();

  if (!(await estResponsable(session.orgId, session.userId))) {
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent retirer un membre." };
  }

  if (userId === session.userId) {
    return { ok: false, error: "Vous ne pouvez pas vous retirer vous-même." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("org_id", session.orgId)
    .eq("user_id", userId);

  if (error) {
    // Le trigger `protect_last_owner` refuse de retirer le dernier propriétaire.
    return { ok: false, error: error.message || "Retrait impossible." };
  }

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
