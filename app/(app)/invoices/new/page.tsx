import type { Metadata } from "next";

import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { parseDocumentNumber } from "@/lib/numbering";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default async function NewInvoicePage() {
  const session = await getSession();

  const [{ rows: clients }, { rows: invoices }] = await Promise.all([
    repositories.clients.list(session.orgId, { pageSize: 200 }),
    repositories.invoices.list(session.orgId, { type: "invoice", pageSize: 500 }),
  ]);

  // Aperçu du numéro uniquement. Le vrai numéro est attribué à l'émission, par
  // la base, sous verrou — ce calcul-ci n'est qu'indicatif.
  const year = Number(todayIso().slice(0, 4));
  const lastSequence = invoices.reduce((max, invoice) => {
    const parsed = invoice.number ? parseDocumentNumber(invoice.number) : null;
    return parsed && parsed.year === year ? Math.max(max, parsed.sequence) : max;
  }, 0);

  return (
    <InvoiceEditor
      organization={session.organization}
      clients={clients}
      nextSequence={lastSequence + 1}
    />
  );
}
