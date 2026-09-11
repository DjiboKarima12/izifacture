import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Plus, Users } from "lucide-react";

import { ClientFormDialog } from "@/components/clients/client-form-dialog";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getSession();
  const search = searchParams.q?.trim() || undefined;

  const [{ rows: clients, total }, { rows: invoices }] = await Promise.all([
    repositories.clients.list(session.orgId, { search, pageSize: 100 }),
    repositories.invoices.list(session.orgId, { type: "invoice", pageSize: 500 }),
  ]);

  // Chiffre d'affaires par client, brouillons et annulées exclus.
  const revenue = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    // Une vente au comptoir n'a pas de client : elle ne s'impute à personne.
    if (!invoice.clientId) continue;
    revenue.set(invoice.clientId, (revenue.get(invoice.clientId) ?? 0) + invoice.total);
  }

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description={
          search
            ? `${total} résultat${total > 1 ? "s" : ""} pour « ${search} »`
            : `${total} client${total > 1 ? "s" : ""}`
        }
        actions={
          <ClientFormDialog
            trigger={
              <Button>
                <Plus aria-hidden />
                Nouveau client
              </Button>
            }
          />
        }
      />

      <Card className="mt-6">
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? "Aucun client ne correspond" : "Aucun client"}
              description={
                search
                  ? "Essayez un autre nom ou une autre adresse email."
                  : "Ajoutez un client pour pouvoir lui adresser des factures."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nom</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Facturé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="relative">
                    <TableCell className="font-medium">
                      {/* Le lien couvre la ligne tout en restant un vrai lien :
                          navigable au clavier, ouvrable dans un nouvel onglet. */}
                      <Link
                        href={`/clients/${client.id}`}
                        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {client.email ? (
                          <p className="flex items-center gap-1.5">
                            <Mail className="size-3" aria-hidden />
                            {client.email}
                          </p>
                        ) : null}
                        {client.phone ? (
                          <p className="flex items-center gap-1.5">
                            <Phone className="size-3" aria-hidden />
                            {client.phone}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[client.city, client.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatAmount(revenue.get(client.id) ?? 0, session.organization.currency)}
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
