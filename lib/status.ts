/**
 * Machine à états des documents.
 *
 * `overdue` n'est jamais persisté : il se dérive de `status` + `dueDate`. Une
 * facture devient donc « en retard » à la seconde où l'échéance passe, sans
 * qu'aucune tâche planifiée n'ait à tourner — et une facture ne peut pas rester
 * affichée « en retard » après avoir été payée à cause d'un job qui a échoué.
 */

import type { DisplayStatus, DocumentType, Invoice, InvoiceStatus } from "@/lib/domain/types";
import { isBefore, todayIso } from "@/lib/dates";
import type { IsoDate } from "@/lib/domain/types";

/** Libellés des factures et des avoirs. */
export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  expired: "Expirée",
  cancelled: "Annulée",
};

/**
 * Libellés des devis. Un devis ne se paie pas et n'est jamais en retard : il est
 * envoyé, accepté, refusé, ou sa validité est passée. Les accords sont au
 * masculin — « Envoyée » sur un devis trahit un libellé copié des factures.
 */
const QUOTE_STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  partially_paid: "Envoyé",
  paid: "Accepté",
  overdue: "Expiré",
  expired: "Expiré",
  cancelled: "Refusé",
};

export function statusLabel(status: DisplayStatus, type: DocumentType = "invoice"): string {
  return type === "quote" ? QUOTE_STATUS_LABELS[status] : STATUS_LABELS[status];
}

/** Transitions autorisées. Toute autre transition doit être rejetée côté serveur. */
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["partially_paid", "paid", "cancelled"],
  partially_paid: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transition de statut interdite : ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}`,
    );
  }
}

/** Un brouillon est modifiable ; tout le reste est figé (correction par avoir). */
export function isEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function isOutstanding(status: InvoiceStatus): boolean {
  return status === "sent" || status === "partially_paid";
}

/**
 * Statut affiché, dérivé de la date.
 *
 * Le sens de `dueDate` dépend du type : échéance de paiement pour une facture,
 * date de fin de validité pour un devis. Un devis dépassé est donc « expiré »,
 * pas « en retard » — il ne doit rien.
 */
export function deriveDisplayStatus(
  document: Pick<Invoice, "status" | "dueDate"> & Partial<Pick<Invoice, "type">>,
  reference: IsoDate = todayIso(),
): DisplayStatus {
  const isPastDate = isOutstanding(document.status) && isBefore(document.dueDate, reference);
  if (!isPastDate) return document.status;

  return document.type === "quote" ? "expired" : "overdue";
}

/**
 * Statut résultant d'un encaissement. Utilisé côté serveur (et répliqué par un
 * trigger Postgres) après chaque insertion dans `payments`.
 */
export function statusAfterPayment(
  current: InvoiceStatus,
  total: number,
  amountPaid: number,
): InvoiceStatus {
  if (current === "draft" || current === "cancelled") return current;
  if (amountPaid <= 0) return "sent";
  if (amountPaid >= total) return "paid";
  return "partially_paid";
}
