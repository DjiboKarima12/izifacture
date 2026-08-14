"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { paymentInputSchema } from "@/lib/domain/schemas";
import type { ActionResult } from "@/lib/actions/invoices";

function revalidateAfterPayment(invoiceId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath(`/invoices/${invoiceId}`);
}

function toActionError(error: unknown): ActionResult {
  if (error instanceof Error && (error.name === "DomainError" || error.name === "NotFoundError")) {
    return { ok: false, error: error.message };
  }
  console.error("[action encaissement]", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

/** Enregistre un encaissement. Le statut de la facture est recalculé par le dépôt. */
export async function recordPayment(input: unknown): Promise<ActionResult> {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Encaissement invalide." };
  }

  try {
    const session = await getSession();
    await repositories.payments.record(session.orgId, parsed.data, session.userId);

    revalidateAfterPayment(parsed.data.invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Supprime un encaissement saisi par erreur.
 *
 * Le dépôt recalcule ensuite `amountPaid` et le statut : retirer le règlement
 * d'une facture soldée la fait repasser en « partiellement payée » ou
 * « envoyée ». C'est ce qui permet de corriger une erreur de saisie sans
 * toucher au contenu de la facture, qui lui reste figé.
 */
export async function deletePayment(paymentId: string, invoiceId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.payments.remove(session.orgId, paymentId);

    revalidateAfterPayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
