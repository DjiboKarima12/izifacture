import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceDetailActions } from "@/components/invoices/invoice-detail-actions";
import { PaymentsCard } from "@/components/invoices/payments-card";
import { PrintOnMount } from "@/components/invoices/print-on-mount";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount, formatQuantity } from "@/lib/money";
import { formatDate, formatDateLong } from "@/lib/dates";
import { deriveDisplayStatus } from "@/lib/status";
import { amountDue } from "@/lib/tax";
export const metadata: Metadata = { title: "Facture" };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { print?: string };
}) {
  const session = await getSession();
  const invoice = await repositories.invoices.get(session.orgId, params.id);

  // 404 plutôt que 403 : on ne confirme pas l'existence d'une facture qui
  // appartiendrait à une autre organisation.
  if (!invoice) notFound();

  const [payments, events] = await Promise.all([
    repositories.payments.listForInvoice(session.orgId, invoice.id),
    repositories.invoices.listEvents(session.orgId, invoice.id),
  ]);

  const remaining = amountDue(invoice.total, invoice.amountPaid);
  const currency = invoice.currency;
  // Le snapshot fait foi dès l'émission : c'est ce que le client a reçu.
  const client = invoice.snapshot?.client ?? invoice.client;
  const issuer = invoice.snapshot?.organization ?? session.organization;

  /**
   * Ventilation de la TVA reconstruite à partir des montants STOCKÉS de chaque
   * ligne, sans les recalculer : sur un document émis, ce qui a été enregistré
   * fait foi, même si les règles de calcul évoluaient ensuite.
   */
  const taxBuckets = new Map<number, { rate: number; base: number; tax: number }>();
  for (const item of invoice.items) {
    const bucket = taxBuckets.get(item.taxRate) ?? { rate: item.taxRate, base: 0, tax: 0 };
    bucket.base += item.lineSubtotal;
    bucket.tax += item.lineTax;
    taxBuckets.set(item.taxRate, bucket);
  }

  const storedTotals = {
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    taxBreakdown: [...taxBuckets.values()].sort((a, b) => a.rate - b.rate),
  };

  return (
    <PageShell className="pt-0">
      {searchParams.print === "1" ? <PrintOnMount /> : null}

      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux factures
      </Link>

      <div className="mt-4 flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="tabular text-xl font-bold tracking-tight">
              {invoice.number ?? "Brouillon"}
            </h1>
            <StatusBadge status={deriveDisplayStatus(invoice)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {client?.name ?? "—"} · émise le {formatDateLong(invoice.issueDate)}
          </p>
        </div>

        <InvoiceDetailActions
          className="print:hidden"
          invoiceId={invoice.id}
          type={invoice.type}
          status={invoice.status}
          remaining={remaining}
          currency={currency}
        />
      </div>

      {/*
        Feuille imprimée : le document seul, et rien d'autre.
        L'interface d'écran (5 cartes empilées, sans en-tête d'entreprise)
        débordait sur trois pages et ne ressemblait pas à une facture.
      */}
      <div className="hidden print:block">
        <InvoicePreview
          issuer={issuer}
          client={client}
          currency={currency}
          type={invoice.type}
          number={invoice.number ?? "Brouillon"}
          issueDate={invoice.issueDate}
          dueDate={invoice.dueDate}
          lines={invoice.items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
          }))}
          totals={storedTotals}
          notes={invoice.notes ?? ""}
        />
      </div>

      <div className="mt-5 grid gap-4 print:hidden lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold">Lignes</h2>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Désignation</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="pr-6 text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 font-medium">{item.description}</TableCell>
                    <TableCell className="tabular text-right">
                      {formatQuantity(item.quantity)}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {formatAmount(item.unitPrice, currency)}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {item.taxRate} %
                    </TableCell>
                    <TableCell className="tabular pr-6 text-right font-medium">
                      {formatAmount(item.lineSubtotal, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <dl className="space-y-2 border-t border-border px-6 py-5 text-sm">
              <Row label="Total HT" value={formatAmount(invoice.subtotal, currency)} />
              {invoice.discountTotal > 0 ? (
                <Row label="Remise" value={`− ${formatAmount(invoice.discountTotal, currency)}`} />
              ) : null}
              <Row label="TVA" value={formatAmount(invoice.taxTotal, currency)} />
              <div className="flex items-center justify-between border-t border-border pt-2.5 text-base">
                <dt className="font-semibold">Total TTC</dt>
                <dd className="tabular font-bold">{formatAmount(invoice.total, currency)}</dd>
              </div>
              {invoice.amountPaid > 0 ? (
                <>
                  <Row label="Déjà encaissé" value={formatAmount(invoice.amountPaid, currency)} />
                  <Row label="Reste dû" value={formatAmount(remaining, currency)} />
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Client</h2>
            </CardHeader>
            <CardContent className="space-y-1 pb-6 text-sm">
              <p className="font-medium">{client?.name ?? "—"}</p>
              {[
                client?.email,
                client?.phone,
                client?.addressLine,
                [client?.city, client?.country].filter(Boolean).join(", ") || null,
                client?.taxId,
              ]
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="text-muted-foreground">
                    {line}
                  </p>
                ))}
              {invoice.snapshot ? (
                <p className="pt-2 text-xs text-muted-foreground">
                  Coordonnées figées à l&apos;émission.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Dates</h2>
            </CardHeader>
            <CardContent className="space-y-2 pb-6 text-sm">
              <Row label="Émission" value={formatDate(invoice.issueDate)} />
              <Row label="Échéance" value={formatDate(invoice.dueDate)} />
            </CardContent>
          </Card>

          <PaymentsCard
            invoiceId={invoice.id}
            status={invoice.status}
            payments={payments}
            remaining={remaining}
            currency={currency}
          />

          {events.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold">Historique</h2>
              </CardHeader>
              <CardContent className="pb-6 text-sm">
                <ul className="space-y-1.5 text-muted-foreground">
                  {events.map((event) => (
                    <li key={event.id}>
                      {EVENT_LABELS[event.type] ?? event.type} ·{" "}
                      {formatDate(event.createdAt.slice(0, 10))}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: "Créée",
  issued: "Émise",
  sent: "Envoyée au client",
  viewed: "Consultée par le client",
  payment_recorded: "Encaissement enregistré",
  paid: "Soldée",
  cancelled: "Annulée",
  reminder_sent: "Relance envoyée",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
