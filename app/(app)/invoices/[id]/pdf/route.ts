import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { buildReceiptPdf } from "@/lib/pdf/receipt";

/**
 * Téléchargement du document au format ticket 80 mm.
 *
 * Remplace l'impression navigateur : ici, personne ne choisit un format papier,
 * donc personne ne se retrouve avec un A4 aux trois quarts vide.
 *
 * `getSession()` redirige sans session, et le dépôt borne la requête à
 * `session.orgId` : une facture d'une autre organisation renvoie 404 — jamais
 * 403, qui confirmerait son existence.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const invoice = await repositories.invoices.get(session.orgId, params.id);

  if (!invoice) {
    return new NextResponse("Facture introuvable", { status: 404 });
  }

  // Les règlements se lisent APRÈS le 404 : les charger d'abord, en parallèle,
  // ferait une requête de plus pour un identifiant qui n'existe pas.
  const payments = await repositories.payments.listForInvoice(session.orgId, invoice.id);

  // Le snapshot fait foi dès l'émission : c'est ce que le client a reçu.
  const client = invoice.snapshot?.client ?? invoice.client;
  const issuer = invoice.snapshot?.organization ?? session.organization;

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

  const pdf = await buildReceiptPdf({
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

  // Le nom du fichier finit dans l'explorateur de l'utilisateur : on ne laisse
  // passer que ce qui est sûr dans un en-tête HTTP et dans un nom de fichier.
  const filename = `${invoice.number ?? "brouillon"}`.replace(/[^A-Za-z0-9._-]/g, "-");

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      // Un brouillon change à chaque enregistrement : jamais de cache.
      "Cache-Control": "no-store",
    },
  });
}
