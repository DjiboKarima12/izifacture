import type { Metadata } from "next";

import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { parseDocumentNumber } from "@/lib/numbering";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Nouveau devis" };

/**
 * Création d'un devis.
 *
 * Le même éditeur que pour une facture, en lui passant le type : les lignes, le
 * client, l'aperçu et les totaux sont identiques. Ce qui change, l'éditeur le
 * sait déjà — le préfixe du numéro, l'intitulé des boutons, et l'absence du bloc
 * de règlement, puisqu'un devis ne s'encaisse pas.
 *
 * La SÉQUENCE est celle des devis, pas celle des factures : `DEV-2026-0001` est
 * indépendant de `FAC-2026-0001`. Réutiliser la séquence des factures créerait
 * des trous dans l'une comme dans l'autre.
 */
export default async function NewQuotePage() {
  const session = await getSession();

  const [{ rows: clients }, { rows: products }, { rows: quotes }] = await Promise.all([
    repositories.clients.list(session.orgId, { pageSize: 200 }),
    repositories.products.list(session.orgId, { pageSize: 500 }),
    repositories.invoices.list(session.orgId, { type: "quote", pageSize: 500 }),
  ]);

  // Aperçu du numéro uniquement. Le vrai est attribué à l'émission, par la base,
  // sous verrou — ce calcul-ci n'est qu'indicatif.
  const year = Number(todayIso().slice(0, 4));
  const lastSequence = quotes.reduce((max, quote) => {
    const parsed = quote.number ? parseDocumentNumber(quote.number) : null;
    return parsed && parsed.year === year ? Math.max(max, parsed.sequence) : max;
  }, 0);

  return (
    <InvoiceEditor
      organization={session.organization}
      clients={clients}
      products={products}
      nextSequence={lastSequence + 1}
      documentType="quote"
    />
  );
}
