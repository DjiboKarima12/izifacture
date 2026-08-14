import type { Metadata } from "next";
import Link from "next/link";
import { Search, Wallet, X } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, inputClasses } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount, parseAmountInput } from "@/lib/money";
import { formatDate, isIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Encaissements" };

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  cheque: "Chèque",
  card: "Carte",
  other: "Autre",
};

type SearchParams = {
  q?: string;
  method?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
};

/** Une saisie invalide est ignorée plutôt que de vider la liste sans explication. */
function parseDate(value?: string) {
  return value && isIsoDate(value) ? value : undefined;
}

function parseAmount(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = parseAmountInput(value);
  return parsed === null ? undefined : parsed;
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const currency = session.organization.currency;

  const method = PAYMENT_METHODS.includes(searchParams.method as PaymentMethod)
    ? (searchParams.method as PaymentMethod)
    : undefined;

  const filters = {
    search: searchParams.q?.trim() || undefined,
    method,
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to),
    minAmount: parseAmount(searchParams.min),
    maxAmount: parseAmount(searchParams.max),
  };

  const { rows, total, totalAmount } = await repositories.payments.list(session.orgId, {
    ...filters,
    pageSize: 100,
  });

  const hasFilters = Object.values(filters).some((value) => value !== undefined);

  return (
    <PageShell className="pt-0">
      <PageHeader
        title="Encaissements"
        description={`${formatAmount(totalAmount, currency)} sur ${total} mouvement${total > 1 ? "s" : ""}${hasFilters ? " (filtrés)" : ""}`}
      />

      {/*
        Formulaire GET : les filtres vivent dans l'URL, donc la vue est
        partageable, survit à un rechargement, et fonctionne sans JavaScript —
        ce qui compte sur les connexions visées.
      */}
      <Card className="mt-5">
        <CardContent className="p-4">
          <form action="/payments" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="Facture ou client" htmlFor="filter-q" className="lg:col-span-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="filter-q"
                  name="q"
                  defaultValue={searchParams.q ?? ""}
                  placeholder="FAC-2026-0017, Zinder…"
                  className="pl-9"
                />
              </div>
            </Field>

            <Field label="Moyen" htmlFor="filter-method">
              <select
                id="filter-method"
                name="method"
                defaultValue={method ?? ""}
                className={cn(inputClasses, "cursor-pointer")}
              >
                <option value="">Tous</option>
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {METHOD_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:contents">
              <Field label="Du" htmlFor="filter-from">
                <Input
                  id="filter-from"
                  name="from"
                  type="date"
                  defaultValue={searchParams.from ?? ""}
                />
              </Field>
              <Field label="Au" htmlFor="filter-to">
                <Input id="filter-to" name="to" type="date" defaultValue={searchParams.to ?? ""} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:contents">
              <Field label="Montant min." htmlFor="filter-min">
                <Input
                  id="filter-min"
                  name="min"
                  inputMode="numeric"
                  className="tabular"
                  defaultValue={searchParams.min ?? ""}
                  placeholder="0"
                />
              </Field>
              <Field label="Montant max." htmlFor="filter-max">
                <Input
                  id="filter-max"
                  name="max"
                  inputMode="numeric"
                  className="tabular"
                  defaultValue={searchParams.max ?? ""}
                  placeholder="—"
                />
              </Field>
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="submit" size="sm">
                Filtrer
              </Button>
              {hasFilters ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/payments">
                    <X aria-hidden />
                    Effacer
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={hasFilters ? "Aucun encaissement ne correspond" : "Aucun encaissement"}
              description={
                hasFilters
                  ? "Élargissez la période ou le montant, ou effacez les filtres."
                  : "Les règlements enregistrés sur vos factures apparaîtront ici."
              }
              action={
                hasFilters ? (
                  <Button asChild variant="outline">
                    <Link href="/payments">Effacer les filtres</Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Moyen</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="pr-6 text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((payment) => (
                  <TableRow key={payment.id} className="relative">
                    <TableCell className="tabular pl-6 text-muted-foreground">
                      {formatDate(payment.paidAt)}
                    </TableCell>
                    <TableCell className="tabular font-medium">
                      <Link
                        href={`/invoices/${payment.invoiceId}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {payment.invoice.number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{payment.client?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {METHOD_LABELS[payment.method]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.reference ?? "—"}
                    </TableCell>
                    <TableCell className="tabular pr-6 text-right font-semibold">
                      {formatAmount(payment.amount, currency)}
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
