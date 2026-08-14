import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { deriveDisplayStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Devis" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getSession();
  const search = searchParams.q?.trim() || undefined;

  const { rows, total } = await repositories.invoices.list(session.orgId, {
    type: "quote",
    search,
    pageSize: 100,
  });

  return (
    <PageShell>
      <PageHeader
        title="Devis"
        description={search ? `${total} résultat${total > 1 ? "s" : ""} pour « ${search} »` : `${total} devis`}
      />

      <Card className="mt-6">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={search ? "Aucun devis ne correspond" : "Aucun devis"}
              description="Un devis propose un montant sans rien facturer. Une fois accepté, il se convertit en facture."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Émission</TableHead>
                  {/* Sur un devis, `dueDate` porte la fin de validité, pas une
                      échéance de paiement. */}
                  <TableHead>Valable jusqu&apos;au</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-6 text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((quote) => (
                  <TableRow key={quote.id} className="relative">
                    <TableCell className="tabular pl-6 font-medium">
                      <Link
                        href={`/invoices/${quote.id}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {quote.number ?? <span className="text-muted-foreground">Brouillon</span>}
                      </Link>
                    </TableCell>
                    <TableCell>{quote.client?.name ?? "—"}</TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatDate(quote.issueDate)}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatDate(quote.dueDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={deriveDisplayStatus(quote)} type="quote" />
                    </TableCell>
                    <TableCell className="tabular pr-6 text-right font-medium">
                      {formatAmount(quote.total, quote.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
