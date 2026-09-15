"use server";

import { webcrypto } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { codeValide, genererCode, normaliserCode } from "@/lib/invitations";
import type { ActionResult } from "@/lib/actions/invoices";
import type { MemberRole } from "@/lib/domain/types";

/**
 * Invitations : faire entrer quelqu'un dans une boutique existante.
 *
 * Le contrôle d'accès vit dans la RLS — seuls `owner` et `admin` peuvent créer
 * ou révoquer une invitation. Ces actions n'ajoutent aucune vérification de
 * leur côté : dupliquer la règle ici, c'est se donner deux endroits où elle
 * peut diverger.
 */

export type Invitation = {
  id: string;
  code: string;
  role: MemberRole;
  expiresAt: string;
  acceptedAt: string | null;
};

function failure(error: unknown, contexte: string): ActionResult<never> {
  if (error instanceof Error && error.message) {
    console.error(`[invitation · ${contexte}]`, error);
  }
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

export async function listInvitations(): Promise<Invitation[]> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("invitations")
    .select("id, code, role, expires_at, accepted_at")
    .eq("org_id", session.orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Une liste vide plutôt qu'une page en erreur : un membre ordinaire n'a pas
  // le droit de lire cette table, et ce n'est pas une panne.
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    role: row.role as MemberRole,
    expiresAt: row.expires_at as string,
    acceptedAt: row.accepted_at as string | null,
  }));
}

/**
 * Tire un code et l'enregistre.
 *
 * Le code est unique en base. En cas de collision — improbable sur 31⁸, mais
 * pas impossible — on retire plutôt que de renvoyer une erreur que personne ne
 * saurait interpréter.
 */
export async function createInvitation(role: MemberRole = "member"): Promise<
  ActionResult<{ code: string }>
> {
  try {
    const session = await getSession();
    const supabase = createSupabaseServerClient();

    for (let essai = 0; essai < 5; essai += 1) {
      const code = genererCode((n) => webcrypto.getRandomValues(new Uint8Array(n)));

      const { error } = await supabase.from("invitations").insert({
        org_id: session.orgId,
        code,
        role,
        created_by: session.userId,
      });

      if (!error) {
        revalidatePath("/settings");
        return { ok: true, data: { code } };
      }

      // 23505 = violation d'unicité : le code existe déjà, on en tire un autre.
      if ((error as { code?: string }).code !== "23505") {
        return failure(error, "création");
      }
    }

    return { ok: false, error: "Impossible de générer un code. Réessayez." };
  } catch (error) {
    return failure(error, "création");
  }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    const supabase = createSupabaseServerClient();

    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId)
      .eq("org_id", session.orgId);

    if (error) return failure(error, "révocation");

    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "révocation");
  }
}

/**
 * Rejoint une boutique avec un code.
 *
 * Appelée depuis /onboarding, par un compte qui n'a encore aucune organisation.
 * La fonction en base fait tout le travail : elle vérifie le code, son expiration
 * et son unicité d'usage sous verrou de ligne.
 *
 * Les messages d'erreur de la base sont repris TELS QUELS — « Code invalide »,
 * « Ce code a déjà été utilisé », « Ce code a expiré » — parce qu'ils disent
 * précisément quoi faire. Les remplacer par « Une erreur est survenue »
 * laisserait le caissier bloqué devant un champ.
 */
export async function acceptInvitation(saisi: unknown): Promise<ActionResult> {
  if (typeof saisi !== "string" || !codeValide(saisi)) {
    return { ok: false, error: "Ce code n'a pas la forme attendue : 8 lettres ou chiffres." };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.rpc("accept_invitation", {
      p_code: normaliserCode(saisi),
    });

    if (error) {
      return { ok: false, error: error.message || "Code refusé." };
    }

    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "acceptation");
  }
}
