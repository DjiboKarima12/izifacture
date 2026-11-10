import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { invoicesCsv, paymentsCsv } from "@/lib/csv";
import { repositories } from "@/lib/data";
import { addDays, addMonths, todayIso } from "@/lib/dates";
import type { IsoDate } from "@/lib/domain/types";

/**
 * Export CSV du mois pour le comptable : `/export/factures?mois=2026-11` ou
 * `/export/encaissements?mois=2026-11`.
 *
 * Borné à `session.orgId` comme toute lecture. Les brouillons et les devis
 * sont écartés : ni l'un ni l'autre n'est une écriture comptable.
 */

const PAGE = 200;

async function toutesLesPages<T>(lire: (page: number) => Promise<{ rows: T[]; total: number }>) {
  const lignes: T[] = [];
  for (let page = 1; ; page += 1) {
    const { rows, total } = await lire(page);
    lignes.push(...rows);
    if (rows.length < PAGE || lignes.length >= total) return lignes;
  }
}

export async function GET(request: Request, { params }: { params: { kind: string } }) {
  if (params.kind !== "factures" && params.kind !== "encaissements") {
    return new NextResponse("Export inconnu", { status: 404 });
  }
  const session = await getSession();

  const demande = new URL(request.url).searchParams.get("mois") ?? "";
  const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(demande) ? demande : todayIso().slice(0, 7);
  const from = `${mois}-01` as IsoDate;
  // Bornes INCLUSIVES côté dépôt : on s'arrête au dernier jour du mois.
  const to = addDays(addMonths(from, 1), -1);

  let csv: string;
  if (params.kind === "factures") {
    const invoices = await toutesLesPages((page) =>
      repositories.invoices.list(session.orgId, { from, to, page, pageSize: PAGE }),
    );
    csv = invoicesCsv(
      invoices
        .filter((invoice) => invoice.status !== "draft" && invoice.type !== "quote")
        .sort((a, b) => (a.number ?? "").localeCompare(b.number ?? "")),
    );
  } else {
    const payments = await toutesLesPages((page) =>
      repositories.payments.list(session.orgId, { from, to, page, pageSize: PAGE }),
    );
    csv = paymentsCsv(payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt)));
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.kind}-${mois}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
