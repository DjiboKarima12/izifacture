import { formatAmount, formatQuantity, type Currency } from "@/lib/money";
import { formatDateLong } from "@/lib/dates";
import type { ComputedTotals } from "@/lib/tax";
import type { DocumentType, IsoDate } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type PreviewLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineSubtotal: number;
  lineTotal: number;
};

/** Coordonnées d'une partie — compatible avec le snapshot figé d'une facture émise. */
export type PreviewParty = {
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
};

export type PreviewIssuer = PreviewParty & {
  legalName: string | null;
  invoiceFooter: string | null;
};

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  invoice: "FACTURE",
  quote: "DEVIS",
  credit_note: "AVOIR",
};

/**
 * Le document tel que le client le reçoit.
 *
 * Sert à la fois d'aperçu en direct dans le formulaire et de feuille imprimée.
 * Les deux DOIVENT être le même composant : un aperçu qui diffère du document
 * final ne sert à rien.
 *
 * Purement présentationnel — il ne recalcule aucun montant. Sur une facture
 * émise, on lui passe le snapshot figé, pas les coordonnées actuelles.
 */
export function InvoicePreview({
  issuer,
  client,
  currency,
  type = "invoice",
  number,
  issueDate,
  dueDate,
  lines,
  totals,
  notes,
  className,
}: {
  issuer: PreviewIssuer;
  client: PreviewParty | null;
  currency: Currency;
  type?: DocumentType;
  number: string;
  issueDate: IsoDate;
  dueDate: IsoDate;
  lines: PreviewLine[];
  totals: ComputedTotals;
  notes: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-card sm:p-8",
        // Le document ne doit jamais être coupé en deux pages.
        "print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{DOCUMENT_TITLES[type]}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Numéro <span className="tabular font-medium text-foreground">{number}</span>
          </p>
        </div>
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground"
          aria-hidden
        >
          {issuer.name.slice(0, 2).toUpperCase()}
        </span>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div>
          <p className="text-muted-foreground">Émis par :</p>
          <p className="mt-1.5 font-semibold">{issuer.legalName ?? issuer.name}</p>
          <PartyLines
            lines={[
              issuer.email,
              issuer.phone,
              issuer.addressLine,
              [issuer.city, issuer.country].filter(Boolean).join(", ") || null,
              issuer.taxId,
            ]}
          />
        </div>
        <div>
          <p className="text-muted-foreground">Facturé à :</p>
          <p className="mt-1.5 font-semibold">{client?.name ?? "—"}</p>
          <PartyLines
            lines={[
              client?.email ?? null,
              client?.phone ?? null,
              client?.addressLine ?? null,
              [client?.city, client?.country].filter(Boolean).join(", ") || null,
              client?.taxId ?? null,
            ]}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
        <div>
          <p className="text-muted-foreground">Date d&apos;émission :</p>
          <p className="mt-1 font-semibold">{formatDateLong(issueDate)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">
            {type === "quote" ? "Valable jusqu'au :" : "Échéance :"}
          </p>
          <p className="mt-1 font-semibold">{formatDateLong(dueDate)}</p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Désignation</th>
              <th className="pb-2 pr-3 text-right font-medium">Qté</th>
              <th className="pb-2 pr-3 text-right font-medium">P.U.</th>
              <th className="pb-2 pr-3 text-right font-medium">TVA</th>
              <th className="pb-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  Aucune ligne pour l&apos;instant
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 pr-3">{line.description || "—"}</td>
                  <td className="tabular py-2 pr-3 text-right">{formatQuantity(line.quantity)}</td>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatAmount(line.unitPrice, currency)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">{line.taxRate} %</td>
                  <td className="tabular py-2 text-right font-medium">
                    {formatAmount(line.lineSubtotal, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <dl className="mt-6 space-y-2 text-xs">
        <Row label="Total HT" value={formatAmount(totals.subtotal, currency)} />
        {totals.discountTotal > 0 ? (
          <Row label="Remise" value={`− ${formatAmount(totals.discountTotal, currency)}`} />
        ) : null}
        {totals.taxBreakdown
          .filter((bucket) => bucket.rate > 0)
          .map((bucket) => (
            <Row
              key={bucket.rate}
              label={`TVA ${bucket.rate} %`}
              value={formatAmount(bucket.tax, currency)}
            />
          ))}
        <div className="flex items-center justify-between border-t border-border pt-2.5 text-sm">
          <dt className="font-semibold">Total TTC</dt>
          <dd className="tabular font-bold">{formatAmount(totals.total, currency)}</dd>
        </div>
      </dl>

      {notes ? (
        <p className="mt-6 rounded-lg bg-surface px-3 py-2.5 text-[0.7rem] text-muted-foreground print:border print:border-border">
          {notes}
        </p>
      ) : null}

      {issuer.invoiceFooter ? (
        <footer className="mt-6 border-t border-border pt-4 text-[0.7rem] text-muted-foreground">
          {issuer.invoiceFooter}
        </footer>
      ) : null}
    </article>
  );
}

function PartyLines({ lines }: { lines: Array<string | null> }) {
  return (
    <div className="mt-1 space-y-0.5 text-muted-foreground">
      {lines.filter(Boolean).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
