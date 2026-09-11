"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { productInputSchema } from "@/lib/domain/schemas";
import type { ActionResult } from "@/lib/actions/invoices";

/**
 * Server Actions du catalogue.
 *
 * Le catalogue sert à SAISIR vite, pas à définir ce qui a été vendu : les lignes
 * de facture recopient le nom et le prix au moment de la vente. Modifier un
 * produit ici ne réécrit donc jamais une facture émise.
 */

function failure(error: unknown): ActionResult<never> {
  if (error instanceof Error && (error.name === "DomainError" || error.name === "NotFoundError")) {
    return { ok: false, error: error.message };
  }

  /**
   * Le code-barres est unique par organisation (index partiel en base). Sans ce
   * cas particulier, l'utilisateur lirait « Une erreur est survenue » là où il
   * a simplement scanné un code déjà attribué — l'erreur la plus probable, et
   * la plus facile à corriger si on la nomme.
   */
  const message = error instanceof Error ? error.message : "";
  if (message.includes("products_org_barcode_key") || message.includes("duplicate key")) {
    return { ok: false, error: "Ce code-barres est déjà utilisé par un autre produit." };
  }

  console.error("[action produit]", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function revalidateProducts() {
  revalidatePath("/products");
  // L'éditeur de facture lit le catalogue : un prix corrigé doit s'y voir tout
  // de suite, sinon la vente suivante repart sur l'ancien.
  revalidatePath("/invoices/new");
}

function validate(input: unknown) {
  const parsed = productInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, error: null };

  const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
  return {
    data: null,
    error: {
      ok: false as const,
      error: Object.values(fieldErrors).flat()[0] ?? "Formulaire invalide.",
      fieldErrors,
    },
  };
}

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { data, error } = validate(input);
  if (!data) return error;

  try {
    const session = await getSession();
    const product = await repositories.products.create(session.orgId, data);
    revalidateProducts();
    return { ok: true, data: { id: product.id } };
  } catch (caught) {
    return failure(caught);
  }
}

export async function updateProduct(
  productId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = validate(input);
  if (!data) return error;

  try {
    const session = await getSession();
    await repositories.products.update(session.orgId, productId, data);
    revalidateProducts();
    return { ok: true, data: { id: productId } };
  } catch (caught) {
    return failure(caught);
  }
}

/**
 * Retire l'article du catalogue sans le supprimer.
 *
 * Une suppression ferait disparaître un produit déjà vendu de l'historique du
 * catalogue. L'archivage le sort des listes et du scan, et reste réversible.
 */
export async function archiveProduct(productId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.products.archive(session.orgId, productId);
    revalidateProducts();
    return { ok: true, data: undefined };
  } catch (caught) {
    return failure(caught);
  }
}

export async function restoreProduct(productId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.products.restore(session.orgId, productId);
    revalidateProducts();
    return { ok: true, data: undefined };
  } catch (caught) {
    return failure(caught);
  }
}
