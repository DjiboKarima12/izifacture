"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { invoiceInputSchema, paymentInputSchema } from "@/lib/domain/schemas";
import { amountDue } from "@/lib/tax";
import { todayIso } from "@/lib/dates";

/**
 * Server Actions des factures.
 *
 * Toute entrée repasse par le schéma Zod, même si le formulaire l'a déjà
 * validée : la validation client n'est qu'un confort d'affichage, c'est celle-ci
 * qui protège les données. Les totaux transmis sont ignorés — le dépôt les
 * recalcule.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function failure(error: unknown): ActionResult<never> {
  // Les erreurs de domaine portent un message destiné à l'utilisateur ; toute
  // autre erreur reste générique pour ne rien divulguer d'interne.
  if (error instanceof Error && (error.name === "DomainError" || error.name === "NotFoundError")) {
    return { ok: false, error: error.message };
  }
  console.error("[action facture]", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez." };
}

function revalidateInvoices(invoiceId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/quotes");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

/** Crée un brouillon, puis l'émet immédiatement si `issue` est vrai. */
export async function saveInvoice(
  input: unknown,
  { issue }: { issue: boolean },
): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Le formulaire comporte des erreurs.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const session = await getSession();
    const draft = await repositories.invoices.createDraft(
      session.orgId,
      parsed.data,
      session.userId,
    );
    if (issue) await repositories.invoices.issue(session.orgId, draft.id);

    revalidateInvoices(draft.id);
    return { ok: true, data: { id: draft.id } };
  } catch (error) {
    return failure(error);
  }
}

/** Met à jour un brouillon. Échoue si le document a déjà été émis. */
export async function updateInvoice(
  invoiceId: string,
  input: unknown,
  { issue }: { issue: boolean },
): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Le formulaire comporte des erreurs.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const session = await getSession();
    await repositories.invoices.updateDraft(session.orgId, invoiceId, parsed.data);
    if (issue) await repositories.invoices.issue(session.orgId, invoiceId);

    revalidateInvoices(invoiceId);
    return { ok: true, data: { id: invoiceId } };
  } catch (error) {
    return failure(error);
  }
}

export async function issueInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.invoices.issue(session.orgId, invoiceId);
    revalidateInvoices(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.invoices.cancel(session.orgId, invoiceId);
    revalidateInvoices(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Solde la facture en enregistrant le règlement du reste dû.
 *
 * On passe par un encaissement plutôt que par une écriture directe du statut :
 * une facture payée sans trace de paiement serait incohérente au moment du
 * rapprochement comptable.
 */
export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    const invoice = await repositories.invoices.get(session.orgId, invoiceId);
    if (!invoice) return { ok: false, error: "Facture introuvable." };

    const remaining = amountDue(invoice.total, invoice.amountPaid);
    if (remaining <= 0) return { ok: false, error: "Cette facture est déjà soldée." };

    const payment = paymentInputSchema.parse({
      invoiceId,
      amount: remaining,
      paidAt: todayIso(),
      method: "cash",
      reference: null,
      note: null,
    });

    await repositories.payments.record(session.orgId, payment, session.userId);
    revalidateInvoices(invoiceId);
    revalidatePath("/payments");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/** Supprime un brouillon. Un document émis s'annule, il ne se supprime pas. */
export async function deleteInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    await repositories.invoices.deleteDraft(session.orgId, invoiceId);
    revalidateInvoices();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Convertit un devis accepté en facture (brouillon).
 *
 * Le devis n'est pas transformé : il reste tel quel, et une facture distincte
 * est créée à partir de ses lignes. Les deux documents doivent coexister — le
 * client a accepté un devis précis, il faut pouvoir y revenir.
 */
export async function convertQuote(quoteId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession();
    const invoice = await repositories.invoices.convertQuoteToInvoice(
      session.orgId,
      quoteId,
      session.userId,
    );

    revalidateInvoices(quoteId);
    return { ok: true, data: { id: invoice.id } };
  } catch (error) {
    return failure(error);
  }
}

/** Crée un avoir rattaché à une facture émise, en brouillon. */
export async function createCreditNote(
  invoiceId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession();
    const creditNote = await repositories.invoices.createCreditNote(
      session.orgId,
      invoiceId,
      session.userId,
    );
    revalidateInvoices(invoiceId);
    return { ok: true, data: { id: creditNote.id } };
  } catch (error) {
    return failure(error);
  }
}
