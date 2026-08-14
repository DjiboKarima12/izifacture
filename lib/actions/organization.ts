"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { organizationSettingsSchema } from "@/lib/domain/schemas";
import type { ActionResult } from "@/lib/actions/invoices";

/**
 * Enregistre le profil de l'entreprise.
 *
 * Le formulaire envoie TOUJOURS l'objet complet, même quand un seul onglet est
 * affiché : le schéma valide l'organisation entière, et un envoi partiel
 * effacerait les champs absents.
 *
 * Ces coordonnées alimentent les nouveaux documents. Les factures déjà émises
 * ne bougent pas : elles portent un snapshot figé de l'entreprise au moment de
 * l'émission, et c'est ce que le client a reçu.
 */
export async function updateOrganization(
  input: unknown,
): Promise<ActionResult<{ updatedAt: string }>> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return {
      ok: false,
      error: Object.values(fieldErrors).flat()[0] ?? "Formulaire invalide.",
      fieldErrors,
    };
  }

  try {
    const session = await getSession();
    await repositories.organizations.update(session.orgId, parsed.data);

    // Les coordonnées de l'entreprise apparaissent un peu partout — aperçu de
    // facture, en-têtes, paramètres. On invalide donc tout l'arbre.
    revalidatePath("/", "layout");
    return { ok: true, data: { updatedAt: new Date().toISOString() } };
  } catch (error) {
    if (error instanceof Error && (error.name === "DomainError" || error.name === "NotFoundError")) {
      return { ok: false, error: error.message };
    }
    console.error("[action organisation]", error);
    return { ok: false, error: "Une erreur est survenue. Réessayez." };
  }
}
