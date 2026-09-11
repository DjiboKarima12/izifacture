import type { Metadata } from "next";
import { Barcode, Package, Pencil, Plus } from "lucide-react";

import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Produits" };

/**
 * Catalogue des articles vendus.
 *
 * Enregistrer un produit une fois évite de retaper son nom, son prix et son
 * taux à chaque vente — à cinquante ventes par jour, c'est la principale perte
 * de temps et la principale source de fautes de frappe sur un prix.
 */
export default async function ProductsPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getSession();
  const search = searchParams.q?.trim() || undefined;

  const { rows: products, total } = await repositories.products.list(session.orgId, {
    search,
    pageSize: 200,
  });

  const { currency, defaultTaxRate } = session.organization;
  const avecCode = products.filter((product) => product.barcode !== null).length;

  return (
    <PageShell>
      <PageHeader
        title="Produits"
        description={
          search
            ? `${total} résultat${total > 1 ? "s" : ""} pour « ${search} »`
            : `${total} produit${total > 1 ? "s" : ""}${avecCode > 0 ? ` · ${avecCode} avec code-barres` : ""}`
        }
        actions={
          <ProductFormDialog
            currency={currency}
            defaultTaxRate={defaultTaxRate}
            trigger={
              <Button>
                <Plus aria-hidden />
                Nouveau produit
              </Button>
            }
          />
        }
      />

      <Card className="mt-6">
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title={search ? "Aucun produit ne correspond" : "Aucun produit"}
              description={
                search
                  ? "Essayez un autre nom ou un autre code-barres."
                  : "Enregistrez vos articles une fois : vous n'aurez plus à retaper leur nom ni leur prix sur chaque facture."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produit</TableHead>
                  <TableHead>Code-barres</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                      {product.unit ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          / {product.unit}
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {product.barcode ? (
                        <span className="tabular inline-flex items-center gap-1.5 text-xs">
                          <Barcode className="size-3.5" aria-hidden />
                          {product.barcode}
                        </span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </TableCell>

                    <TableCell className="tabular text-right text-muted-foreground">
                      {product.taxRate} %
                    </TableCell>

                    <TableCell className="tabular text-right font-medium">
                      {formatAmount(product.unitPrice, currency)}
                    </TableCell>

                    <TableCell className="pr-4 text-right">
                      <ProductFormDialog
                        product={product}
                        currency={currency}
                        defaultTaxRate={defaultTaxRate}
                        trigger={
                          <Button variant="outline" size="sm" aria-label={`Modifier ${product.name}`}>
                            <Pencil aria-hidden />
                            Modifier
                          </Button>
                        }
                      />
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
