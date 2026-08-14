import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories, type InvoiceListFilters } from "@/lib/data";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { deriveDisplayStatus, STATUS_LABELS } from "@/lib/status";
import { amountDue } from "@/lib/tax";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Factures" };

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "draft", label: STATUS_LABELS.draft },
  { value: "sent", label: STATUS_LABELS.sent },
  { value: "partially_paid", label: STATUS_LABELS.partially_paid },
  { value: "overdue", label: STATUS_LABELS.overdue },
  { value: "paid", label: STATUS_LABELS.paid },
] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const session = await getSession();

  const status = FILTERS.some((filter) => filter.value === searchParams.status)
    ? (searchParams.status as InvoiceListFilters["status"])
    : undefined;

  const { rows, total } = await repositories.invoices.list(session.orgId, {
    type: "invoice",
    status: status || undefined,
    search: searchParams.q,
    pageSize: 50,
  });

  return (
    <PageShell>
      <PageHeader
        title="Factures"
        description={`${total} facture${total > 1 ? "s" : ""}`}
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus aria-hidden />
              Nouvelle facture
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtres en une seule rangée au-dessus du tableau. */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = (searchParams.status ?? "") === filter.value;
            const query = new URLSearchParams();
            if (filter.value) query.set("status", filter.value);
            if (searchParams.q) query.set("q", searchParams.q);

            return (
              <Link
                key={filter.value || "all"}
                href={`/invoices${query.toString() ? `?${query}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <form className="relative sm:w-64" action="/invoices">
          {searchParams.status ? (
            <input type="hidden" name="status" value={searchParams.status} />
          ) : null}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Numéro ou client…"
            aria-label="Rechercher une facture"
            className="pl-9"
          />
        </form>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucune facture ne correspond"
              description="Ajustez les filtres, ou créez une nouvelle facture."
              action={
                <Button asChild>
                  <Link href="/invoices/new">Créer une facture</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((invoice) => (
                  <TableRow key={invoice.id} className="relative">
                    <TableCell className="tabular font-medium">
                      {/* Le lien couvre toute la ligne, mais reste un vrai lien :
                          navigable au clavier et ouvrable dans un nouvel onglet. */}
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {invoice.number ?? (
                          <span className="text-muted-foreground">Brouillon</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={deriveDisplayStatus(invoice)} />
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatAmount(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">
                      {formatAmount(amountDue(invoice.total, invoice.amountPaid), invoice.currency)}
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
