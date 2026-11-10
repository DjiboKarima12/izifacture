import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { documentFilename, documentPdf } from "@/lib/pdf/document-pdf";

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
  const issuer = invoice.snapshot?.organization ?? session.organization;
  const pdf = await documentPdf(invoice, issuer, payments);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${documentFilename(invoice)}"`,
      // Un brouillon change à chaque enregistrement : jamais de cache.
      "Cache-Control": "no-store",
    },
  });
}
