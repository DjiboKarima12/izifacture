import { NextResponse } from "next/server";

import { repositories } from "@/lib/data";
import { documentFilename, documentPdf } from "@/lib/pdf/document-pdf";

/**
 * Le document tel que le client le reçoit, par le lien envoyé sur WhatsApp —
 * sans compte ni connexion.
 *
 * Le jeton (32 octets aléatoires, unique par document) EST l'autorisation : le
 * dépôt refuse les brouillons, jamais communiqués. Le format est vérifié
 * avant toute requête, pour qu'un essai au hasard ne coûte rien à la base.
 *
 * Seul ce qui figure sur le document est servi, et depuis le snapshot figé à
 * l'émission : le client voit ce qu'on lui a envoyé, pas l'état actuel de la
 * fiche de la boutique. Les règlements détaillés (billet tendu, monnaie
 * rendue) restent internes ; le déjà-payé figure, lui, sur le document.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  if (!/^[0-9a-f]{64}$|^tok_[0-9a-f]{32}$/.test(params.token)) {
    return new NextResponse("Document introuvable", { status: 404 });
  }

  const invoice = await repositories.invoices.getByPublicToken(params.token);
  const issuer = invoice?.snapshot?.organization;
  if (!invoice || !issuer) {
    return new NextResponse("Document introuvable", { status: 404 });
  }

  const pdf = await documentPdf(invoice, issuer, []);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` : le téléphone l'ouvre directement au lieu de le ranger dans
      // les téléchargements.
      "Content-Disposition": `inline; filename="${documentFilename(invoice)}"`,
      // Le statut (payée, annulée) peut changer : pas de cache partagé.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
