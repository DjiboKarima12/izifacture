import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { deriveDisplayStatus, STATUS_LABELS } from "@/lib/status";
import { amountDue } from "@/lib/tax";
import type { DocumentType, InvoiceWithItems } from "@/lib/domain/types";
import type { PaymentWithContext } from "@/lib/data/repository";

/**
 * Exports CSV pour le comptable, taillés pour Excel en français :
 *
 *  - séparateur `;` — Excel FR lit la virgule comme décimale et mettrait tout
 *    dans une seule colonne ;
 *  - BOM UTF-8 en tête — sans lui, Excel lit « Ã© » à la place de « é » ;
 *  - montants en ENTIERS bruts, sans espace de milliers ni « F CFA » : Excel
 *    doit pouvoir les additionner.
 */

type Cellule = string | number | null | undefined;

const BOM = "﻿";

function cellule(valeur: Cellule): string {
  if (valeur === null || valeur === undefined) return "";
  const texte = String(valeur);
  // Une formule glissée dans un nom de client (« =HYPERLINK(...) ») serait
  // exécutée à l'ouverture dans Excel : on la neutralise par une apostrophe.
  const sur = /^[=+\-@\t\r]/.test(texte) && typeof valeur === "string" ? `'${texte}` : texte;
  return /[;"\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
}

export function toCsv(entetes: string[], lignes: Cellule[][]): string {
  return BOM + [entetes, ...lignes].map((ligne) => ligne.map(cellule).join(";")).join("\r\n") + "\r\n";
}

const TYPES: Record<DocumentType, string> = {
  invoice: "Facture",
  quote: "Devis",
  credit_note: "Avoir",
};

export function invoicesCsv(invoices: InvoiceWithItems[]): string {
  return toCsv(
    ["Type", "Numéro", "Date", "Échéance", "Client", "Statut", "Total HT", "TVA", "Total TTC", "Encaissé", "Reste dû", "Devise"],
    invoices.map((invoice) => [
      TYPES[invoice.type],
      invoice.number,
      invoice.issueDate,
      invoice.dueDate,
      (invoice.snapshot?.client ?? invoice.client)?.name,
      STATUS_LABELS[deriveDisplayStatus(invoice)],
      invoice.subtotal,
      invoice.taxTotal,
      invoice.total,
      invoice.amountPaid,
      amountDue(invoice.total, invoice.amountPaid),
      invoice.currency,
    ]),
  );
}

export function paymentsCsv(payments: PaymentWithContext[]): string {
  return toCsv(
    ["Date", "Facture", "Client", "Moyen de paiement", "Montant", "Devise"],
    payments.map((payment) => [
      payment.paidAt,
      payment.invoice.number,
      payment.client?.name,
      PAYMENT_METHOD_LABELS[payment.method],
      payment.amount,
      payment.invoice.currency,
    ]),
  );
}
