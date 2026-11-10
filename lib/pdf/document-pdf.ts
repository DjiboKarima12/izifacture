import "server-only";

import { buildReceiptPdf } from "@/lib/pdf/receipt";
import type { InvoiceWithItems, Organization, Payment } from "@/lib/domain/types";

/**
 * Le PDF ticket d'un document, tel que le client le reçoit — partagé par le
 * téléchargement depuis l'application et par le lien public envoyé au client :
 * deux chemins, un seul document.
 */
export async function documentPdf(
  invoice: InvoiceWithItems,
  issuer: Organization | NonNullable<InvoiceWithItems["snapshot"]>["organization"],
  payments: Pick<Payment, "method" | "amount" | "tendered">[],
): Promise<Uint8Array> {
  const client = invoice.snapshot?.client ?? invoice.client;

  /**
   * Ventilation de la TVA reconstruite à partir des montants STOCKÉS, sans les
   * recalculer : sur un document émis, ce qui a été enregistré fait foi, même
   * si les règles de calcul évoluaient ensuite.
   */
  const buckets = new Map<number, { rate: number; tax: number }>();
  for (const item of invoice.items) {
    const bucket = buckets.get(item.taxRate) ?? { rate: item.taxRate, tax: 0 };
    bucket.tax += item.lineTax;
    buckets.set(item.taxRate, bucket);
  }

  return buildReceiptPdf({
    issuer,
    client,
    currency: invoice.currency,
    type: invoice.type,
    number: invoice.number ?? "BROUILLON",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lines: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      lineSubtotal: item.lineSubtotal,
    })),
    totals: {
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      total: invoice.total,
      taxBreakdown: [...buckets.values()].sort((a, b) => a.rate - b.rate),
    },
    notes: invoice.notes ?? "",
    // L'encaissé vient de la facture, pas de la somme des règlements : c'est un
    // trigger Postgres qui le tient à jour, et lui seul fait foi.
    amountPaid: invoice.amountPaid,
    payments: payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      tendered: payment.tendered,
    })),
  });

}

/** Nom de fichier sûr dans un en-tête HTTP comme dans un explorateur. */
export function documentFilename(invoice: InvoiceWithItems): string {
  return `${invoice.number ?? "brouillon"}`.replace(/[^A-Za-z0-9._-]/g, "-") + ".pdf";
}
