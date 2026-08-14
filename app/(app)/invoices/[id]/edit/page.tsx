import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { parseDocumentNumber } from "@/lib/numbering";
import { isEditable } from "@/lib/status";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Modifier la facture" };

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const invoice = await repositories.invoices.get(session.orgId, params.id);

  if (!invoice) notFound();

  // Un document émis est figé : on renvoie vers le détail plutôt que d'afficher
  // un formulaire dont l'enregistrement serait de toute façon refusé.
  if (!isEditable(invoice.status)) redirect(`/invoices/${invoice.id}`);

  const [{ rows: clients }, { rows: invoices }] = await Promise.all([
    repositories.clients.list(session.orgId, { pageSize: 200 }),
    repositories.invoices.list(session.orgId, { type: "invoice", pageSize: 500 }),
  ]);

  const year = Number(todayIso().slice(0, 4));
  const lastSequence = invoices.reduce((max, row) => {
    const parsed = row.number ? parseDocumentNumber(row.number) : null;
    return parsed && parsed.year === year ? Math.max(max, parsed.sequence) : max;
  }, 0);

  return (
    <InvoiceEditor
      organization={session.organization}
      clients={clients}
      nextSequence={lastSequence + 1}
      invoice={invoice}
    />
  );
}
