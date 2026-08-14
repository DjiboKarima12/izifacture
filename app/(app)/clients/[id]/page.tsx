import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Mail, MapPin, Phone, Receipt } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientDetailActions } from "@/components/clients/client-detail-actions";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { deriveDisplayStatus } from "@/lib/status";
import { amountDue } from "@/lib/tax";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const client = await repositories.clients.get(session.orgId, params.id);

  // 404 plutôt que 403 : on ne confirme pas l'existence d'un client
  // appartenant à une autre organisation.
  if (!client) notFound();

  const { rows: documents } = await repositories.invoices.list(session.orgId, {
    clientId: client.id,
    pageSize: 200,
  });

  const currency = session.organization.currency;
  // Brouillons, devis et documents annulés ne sont pas du chiffre d'affaires.
  const billable = documents.filter(
    (row) => row.type === "invoice" && row.status !== "draft" && row.status !== "cancelled",
  );
  const invoiced = billable.reduce((sum, row) => sum + row.total, 0);
  const paid = billable.reduce((sum, row) => sum + row.amountPaid, 0);

  return (
    <PageShell className="pt-0">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux clients
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
            {client.archivedAt ? (
              <span className="rounded-md bg-status-cancelled-bg px-2 py-0.5 text-xs font-medium text-status-cancelled">
                Archivé
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {documents.length} document{documents.length > 1 ? "s" : ""} ·{" "}
            {formatAmount(invoiced, currency)} facturés
          </p>
        </div>

        <ClientDetailActions client={client} invoiceCount={documents.length} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Coordonnées</h2>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-6 text-sm">
              {client.email ? (
                <p className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 break-words">{client.email}</span>
                </p>
              ) : null}
              {client.phone ? (
                <p className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{client.phone}</span>
                </p>
              ) : null}
              {client.addressLine || client.city ? (
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {client.addressLine}
                    {client.addressLine && (client.city || client.country) ? <br /> : null}
                    {[client.city, client.country].filter(Boolean).join(", ")}
                  </span>
                </p>
              ) : null}
              {client.taxId ? (
                <p className="flex items-start gap-2.5">
                  <Receipt className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{client.taxId}</span>
                </p>
              ) : null}
              {!client.email && !client.phone && !client.addressLine && !client.taxId ? (
                <p className="text-muted-foreground">Aucune coordonnée renseignée.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Encours</h2>
            </CardHeader>
            <CardContent className="space-y-2 pb-6 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Facturé</span>
                <span className="tabular font-medium">{formatAmount(invoiced, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Encaissé</span>
                <span className="tabular font-medium">{formatAmount(paid, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <span className="font-medium">Reste dû</span>
                <span className="tabular font-semibold">
                  {formatAmount(amountDue(invoiced, paid), currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold">Notes internes</h2>
              </CardHeader>
              <CardContent className="pb-6 text-sm text-muted-foreground">
                {client.notes}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 pb-4">
            <h2 className="text-base font-semibold">Documents</h2>
            <Button asChild size="sm">
              <Link href="/invoices/new">Nouvelle facture</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Aucun document"
                description="Les factures et devis adressés à ce client apparaîtront ici."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Numéro</TableHead>
                    <TableHead>Émission</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="pr-6 text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id} className="relative">
                      <TableCell className="tabular pl-6 font-medium">
                        <Link
                          href={`/invoices/${document.id}`}
                          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {document.number ?? (
                            <span className="text-muted-foreground">Brouillon</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {formatDate(document.issueDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deriveDisplayStatus(document)} />
                      </TableCell>
                      <TableCell className="tabular pr-6 text-right font-medium">
                        {formatAmount(document.total, document.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
