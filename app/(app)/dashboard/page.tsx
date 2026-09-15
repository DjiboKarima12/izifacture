import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, CreditCard, FileText, Wallet } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount } from "@/lib/money";
import { formatDate, todayIso } from "@/lib/dates";
import { deriveDisplayStatus, isOutstanding } from "@/lib/status";

export const metadata: Metadata = { title: "Dashboard" };

/** Variation en pourcentage, formatée avec son signe. `null` si non calculable. */
function formatDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toLocaleString("fr-FR")} %`;
}

export default async function DashboardPage() {
  const session = await getSession();
  const today = todayIso();
  const currentMonth = today.slice(0, 7);

  const [stats, monthly, all, clients] = await Promise.all([
    repositories.invoices.stats(session.orgId),
    repositories.invoices.monthlyTotals(session.orgId, 12),
    repositories.invoices.list(session.orgId, { type: "invoice", pageSize: 500 }),
    repositories.clients.list(session.orgId, { pageSize: 500 }),
  ]);

  const recent = all.rows.slice(0, 5);
  const outstandingCount = all.rows.filter((invoice) => isOutstanding(invoice.status)).length;

  const thisMonth = monthly.at(-1);
  const lastMonth = monthly.at(-2);
  const paidDelta = thisMonth && lastMonth ? formatDelta(thisMonth.paid, lastMonth.paid) : null;

  const newClients = clients.rows.filter(
    (client) => client.createdAt.slice(0, 7) === currentMonth,
  ).length;

  const firstName = session.user.name.split(" ")[0];

  /**
   * Les CHIFFRES DE L'ENTREPRISE ne sont pas montrés à un caissier.
   *
   * Encaissé du mois, créances, retards : c'est la santé du commerce, et
   * beaucoup de commerçants ne souhaitent pas que leur personnel la connaisse.
   * Les factures récentes restent visibles — il en a besoin pour travailler.
   *
   * Ce masquage n'est PAS une protection : la RLS laisse un membre lire les
   * factures, donc quelqu'un de déterminé recalculerait le total. C'est une
   * question de discrétion, pas de sécurité, et il vaut mieux le dire.
   */
  const voitLesChiffres = session.role === "owner" || session.role === "admin";

  return (
    <PageShell className="max-w-[1240px] pt-0">
      <h1 className="text-xl font-bold tracking-tight">Bonjour, {firstName}</h1>

      {voitLesChiffres ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            order={0}
            accent="paid"
            label="Total Encaissé"
            value={formatAmount(stats.totalPaid, session.organization.currency)}
            context={
              paidDelta ? `${paidDelta} par rapport au mois dernier` : "Premier mois de référence"
            }
            icon={Wallet}
          />
          <StatCard
            order={1}
            accent="pending"
            label="Factures en Attente"
            value={formatAmount(stats.totalOutstanding, session.organization.currency)}
            context={`${outstandingCount} facture${outstandingCount > 1 ? "s" : ""} envoyée${outstandingCount > 1 ? "s" : ""}`}
            icon={FileText}
          />
          <StatCard
            order={2}
            accent="overdue"
            label="En Retard"
            value={formatAmount(stats.totalOverdue, session.organization.currency)}
            context={`${stats.overdueCount} facture${stats.overdueCount > 1 ? "s" : ""} en retard`}
            icon={Activity}
            tone="critical"
          />
          <StatCard
            order={3}
            accent="info"
            label="Nouveaux Clients"
            value={`+${newClients}`}
            context="Ce mois-ci"
            icon={CreditCard}
          />
        </div>
      ) : null}

      {/* Entre après les quatre tuiles : la rangée se pose, puis le tableau. */}
      <Card className="animate-rise-in mt-5" style={{ animationDelay: "260ms" }}>
        <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Factures Récentes</h2>
            <p className="text-sm text-muted-foreground">
              Aperçu de vos 5 dernières factures générées.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/invoices">
              Tout voir
              <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {recent.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucune facture pour l'instant"
              description="Créez votre première facture, elle apparaîtra ici avec son statut de paiement."
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
                  <TableHead className="pl-6">Client</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-6 text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="pl-6">
                      <span className="block font-medium">{invoice.client?.name ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {invoice.client?.email ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {invoice.number ?? "—"}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {formatDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={deriveDisplayStatus(invoice, today)} />
                    </TableCell>
                    <TableCell className="tabular pr-6 text-right font-semibold">
                      {formatAmount(invoice.total, invoice.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Le graphique ferme la séquence : on le lit après les chiffres. Il porte
          les mêmes totaux, donc il suit la même règle. */}
      {voitLesChiffres ? (
        <Card className="animate-rise-in mt-5" style={{ animationDelay: "320ms" }}>
          <CardHeader className="pb-4">
            <h2 className="text-base font-semibold">Facturé et encaissé</h2>
            <p className="text-sm text-muted-foreground">Sur les 12 derniers mois.</p>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={monthly} />
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
