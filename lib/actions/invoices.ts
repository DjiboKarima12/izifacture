"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { DomainError, NotFoundError } from "@/lib/data/repository";
import {
  invoiceInputSchema,
  invoiceSettlementSchema,
  paymentInputSchema,
} from "@/lib/domain/schemas";
import { settleAtCounter } from "@/lib/payments";
import { monthBounds, quotaMessage, quotaState, resolvePlan } from "@/lib/plan";
import { amountDue } from "@/lib/tax";
import { todayIso } from "@/lib/dates";
import type { DocumentType, IsoDate, PaymentMethod } from "@/lib/domain/types";

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

/**
 * Barrière du quota mensuel, franchie à CHAQUE émission.
 *
 * Elle vit ici, dans la Server Action, et pas dans le composant : le bouton
 * peut être masqué à l'écran, la Server Action reste appelable directement. Un
 * paywall qui ne tient que dans l'interface n'est pas un paywall.
 *
 * Le plan est relu à chaque appel plutôt que porté par la session : un
 * abonnement activé pendant que l'utilisateur a l'application ouverte doit
 * débloquer l'émission tout de suite, sans qu'il ait à se reconnecter.
 *
 * Seules les FACTURES sont comptées. Un devis ne prouve aucune vente, et un
 * avoir est une correction souvent imposée par la réglementation : bloquer la
 * correction d'une erreur derrière un paiement serait indéfendable.
 */
async function assertCanIssue(orgId: string, documentType: DocumentType): Promise<void> {
  if (documentType !== "invoice") return;

  const { from, to } = monthBounds();

  // En parallèle : deux allers-retours réseau, mais un seul temps d'attente.
  const [subscription, issued] = await Promise.all([
    repositories.organizations.getSubscription(orgId),
    repositories.invoices.countIssuedBetween(orgId, from, to),
  ]);

  const state = quotaState(resolvePlan(subscription.plan, subscription.status), issued);
  if (!state.allowed) throw new DomainError(quotaMessage(state));
}

/**
 * Encaisse le document qui vient d'être émis, quand la vente a été réglée au
 * comptoir.
 *
 * LE MONTANT VIENT DU SERVEUR — `invoice.total`, recalculé depuis les lignes au
 * moment de l'enregistrement. Le navigateur n'envoie que le moyen de paiement et
 * le billet tendu ; il ne dit jamais combien il a encaissé.
 *
 * Le billet tendu est vérifié AVANT l'émission par l'appelant : une fois le
 * numéro attribué, le document est figé, et échouer là laisserait une facture
 * émise que rien n'aurait réglée.
 */
async function settleIssuedInvoice(
  orgId: string,
  invoice: { id: string; total: number; issueDate: string },
  settlement: { method: PaymentMethod; received?: number | null },
  userId: string | null,
): Promise<void> {
  // Le total vient du document enregistré, jamais du navigateur : c'est lui qui
  // borne l'encaissement et décide de la monnaie.
  const { amount, tendered } = settleAtCounter(
    invoice.total,
    settlement.method,
    settlement.received,
  );

  // Rien de reçu : la facture part simplement impayée. Insérer un encaissement
  // à zéro violerait `amount > 0` en base, pour ne rien représenter.
  if (amount <= 0) return;

  await repositories.payments.record(
    orgId,
    {
      invoiceId: invoice.id,
      amount,
      // La date de la vente, pas celle du serveur : une vente saisie le
      // lendemain matin reste la vente de la veille.
      paidAt: invoice.issueDate as IsoDate,
      method: settlement.method,
      tendered,
      reference: null,
      note: null,
    },
    userId,
  );
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
  { issue, settlement }: { issue: boolean; settlement?: unknown },
): Promise<ActionResult<{ id: string; settlementFailed?: string }>> {
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Le formulaire comporte des erreurs.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  /**
   * Le règlement n'accompagne qu'une ÉMISSION. Un brouillon n'a pas de numéro,
   * donc rien à encaisser : le trigger `enforce_payment_preconditions` le
   * refuserait en base, autant ne pas le tenter.
   */
  const parsedSettlement =
    issue && settlement != null ? invoiceSettlementSchema.safeParse(settlement) : null;

  if (parsedSettlement && !parsedSettlement.success) {
    return { ok: false, error: "Le règlement saisi est invalide." };
  }

  try {
    const session = await getSession();
    const draft = await repositories.invoices.createDraft(
      session.orgId,
      parsed.data,
      session.userId,
    );

    if (issue) {
      // Le brouillon est déjà enregistré : si le quota refuse l'émission, la
      // saisie n'est pas perdue, elle reste modifiable et émettable plus tard.
      await assertCanIssue(session.orgId, draft.type);

      await repositories.invoices.issue(session.orgId, draft.id);

      if (parsedSettlement && draft.type === "invoice") {
        /**
         * L'encaissement échoue APRÈS l'attribution du numéro, et le document
         * est alors figé — impossible de revenir en arrière.
         *
         * On rend donc la facture comme un succès, en signalant ce qui a raté.
         * La faire passer pour un échec global serait pire que le bug : elle
         * existe, elle porte un numéro, et l'utilisateur invité à « réessayer »
         * en créerait une seconde. Une séquence sans trou n'admet pas les
         * doublons de confort (cf. règle métier 4).
         *
         * Le règlement se rattrape depuis la facture, avec « Encaisser » : rien
         * de la vente n'est perdu, seul le geste est à refaire.
         */
        try {
          await settleIssuedInvoice(session.orgId, draft, parsedSettlement.data, session.userId);
        } catch (error) {
          console.error("[encaissement à l'émission]", error);
          revalidateInvoices(draft.id);
          return {
            ok: true,
            data: {
              id: draft.id,
              settlementFailed:
                error instanceof Error && error.name === "DomainError"
                  ? error.message
                  : "L'encaissement n'a pas pu être enregistré.",
            },
          };
        }
      }
    }

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

    // Le type est relu en base, jamais reçu du client : c'est lui qui décide si
    // le document compte dans le quota.
    const invoice = await repositories.invoices.get(session.orgId, invoiceId);
    if (!invoice) throw new NotFoundError("Facture");

    await assertCanIssue(session.orgId, invoice.type);
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

/*
 * `markInvoicePaid` a été retirée : elle soldait la facture SANS RIEN DEMANDER,
 * en supposant un règlement en espèces du reste exact. Un client qui rapporte
 * une partie de sa dette — le cas courant au comptoir — n'avait alors nulle part
 * où saisir ce qu'il avait donné. L'entrée de menu ouvre désormais la fenêtre
 * d'encaissement, pré-remplie avec le reste dû, où le montant se corrige.
 */

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
