import * as React from "react";

import { code39Runs, code39Width } from "@/lib/barcode/code39";
import { isValidLogo } from "@/lib/domain/logo";
import { formatAmount, formatQuantity, type Currency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  changeGiven,
  PAYMENT_METHOD_LABELS,
  paymentSummary,
  showsSettlement,
} from "@/lib/payments";
import type { ComputedTotals } from "@/lib/tax";
import type { DocumentType, IsoDate, PaymentMethod } from "@/lib/domain/types";
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

/** Un encaissement tel qu'il s'imprime : le moyen, ce qu'il règle, ce qui a été tendu. */
export type PreviewPayment = {
  method: PaymentMethod;
  amount: number;
  /** Montant remis par le client, espèces uniquement. `null` ailleurs. */
  tendered?: number | null;
};

export type PreviewIssuer = PreviewParty & {
  legalName: string | null;
  invoiceFooter: string | null;
  logoUrl: string | null;
};

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  invoice: "FACTURE",
  quote: "DEVIS",
  credit_note: "AVOIR",
};

/**
 * Le document tel que le client le reçoit — ticket de caisse, 80 mm de large.
 *
 * Sert à la fois d'aperçu en direct dans le formulaire et de feuille imprimée.
 * Les deux DOIVENT être le même composant : un aperçu qui diffère du document
 * final ne sert à rien.
 *
 * Les partis pris viennent du reçu de caisse classique, parce que c'est l'objet
 * que le client reconnaît immédiatement comme une preuve d'achat :
 *
 *  - TOUT est en chasse fixe. C'est la signature du ticket, et accessoirement ce
 *    qui aligne les montants sans avoir à construire un tableau.
 *  - Le nom de l'entreprise est encadré et espacé, seul en haut.
 *  - Les libellés passent en capitales ; le texte libre (note) reste tel quel,
 *    parce qu'une phrase en capitales ne se lit plus.
 *  - Les totaux forment un bloc collé à droite, pas une liste pleine largeur.
 *  - Aucune couleur : ces tickets s'impriment en thermique, qui est monochrome.
 *    La pastille de marque a donc disparu du document.
 *
 * La hauteur suit le contenu (`@page { size: 80mm auto }`) : une facture d'une
 * ligne ne produit pas une page vide aux trois quarts.
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
  amountPaid = 0,
  payments = [],
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
  /**
   * Encaissé cumulé, tel qu'il est STOCKÉ sur la facture — pas la somme de
   * `payments`. Un trigger Postgres le maintient ; le recalculer ici ferait
   * dépendre le ticket de ce qui a été chargé dans la page.
   */
  amountPaid?: number;
  /** Le détail des règlements. Vide sur un brouillon, qui n'en a aucun. */
  payments?: PreviewPayment[];
  className?: string;
}) {
  // Revalidé à l'affichage, pas seulement à l'enregistrement : une valeur
  // ancienne ou écrite hors application ne doit pas faire charger une adresse
  // distante au navigateur.
  const logo = isValidLogo(issuer.logoUrl) ? issuer.logoUrl : null;

  // `null` sur un devis, un avoir ou un total nul — cf. `showsSettlement`.
  const settlement = showsSettlement(type, totals.total)
    ? paymentSummary(totals.total, amountPaid)
    : null;

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[80mm] rounded-xl border border-border bg-card p-[6mm] font-mono text-[0.68rem] leading-tight shadow-card",
        "print:w-[80mm] print:max-w-none print:rounded-none print:border-0 print:p-[5mm] print:shadow-none",
        className,
      )}
    >
      {/*
        Deux dispositions, une seule raison : le logo prend la moitié droite,
        donc le nom et les coordonnées ne peuvent plus être centrés sous peine
        de tomber sous l'image. Sans logo, le bloc reste centré comme sur un
        ticket de caisse ordinaire.
      */}
      {logo ? (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-block bg-foreground px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-background">
              {issuer.legalName ?? issuer.name}
            </p>
            <IssuerLines issuer={issuer} className="mt-2" />
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element -- data URI : rien à optimiser, et `next/image` refuse ce schéma. */}
          <img
            src={logo}
            alt={issuer.legalName ?? issuer.name}
            className="max-h-14 w-auto max-w-[38%] shrink-0 object-contain"
          />
        </header>
      ) : (
        <header className="text-center">
          {/* Bandeau plein, texte en réserve — l'enseigne du ticket de caisse. */}
          <p className="inline-block bg-foreground px-2.5 py-1 text-xs font-bold uppercase tracking-[0.25em] text-background">
            {issuer.legalName ?? issuer.name}
          </p>
          <IssuerLines issuer={issuer} className="mt-2" />
        </header>
      )}

      <Tear />

      <dl className="space-y-0.5">
        <Row label={DOCUMENT_TITLES[type]} value={number} strong />
        <Row label="Date" value={formatDate(issueDate)} />
        <Row label={type === "quote" ? "Validité" : "Échéance"} value={formatDate(dueDate)} />
        {/*
          Pas de ligne du tout sans client, plutôt qu'une ligne à tiret.
          Une vente au comptoir n'a pas de destinataire : afficher « CLIENT — »
          laisserait croire qu'on a perdu le nom.
        */}
        {client ? <Row label="Client" value={client.name} /> : null}
      </dl>

      <Tear />

      {lines.length === 0 ? (
        <p className="text-center uppercase text-muted-foreground">Aucune ligne</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((line) => (
            <li key={line.id}>
              <p className="uppercase">{line.description || "—"}</p>
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular text-muted-foreground">
                  {formatQuantity(line.quantity)} ×{" "}
                  {formatAmount(line.unitPrice, currency, { withSymbol: false })}
                  {line.taxRate > 0 ? ` · TVA ${line.taxRate} %` : ""}
                </span>
                <span className="tabular shrink-0">
                  {formatAmount(line.lineSubtotal, currency, { withSymbol: false })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Tear />

      {/* Bloc de totaux collé à droite, comme sur un reçu de caisse. */}
      <dl className="ml-auto w-[72%] space-y-0.5">
        <Row
          label="Sous-total"
          value={formatAmount(totals.subtotal, currency, { withSymbol: false })}
        />
        {totals.discountTotal > 0 ? (
          <Row
            label="Remise"
            value={`− ${formatAmount(totals.discountTotal, currency, { withSymbol: false })}`}
          />
        ) : null}
        {totals.taxBreakdown
          .filter((bucket) => bucket.rate > 0)
          .map((bucket) => (
            <Row
              key={bucket.rate}
              label={`TVA ${bucket.rate} %`}
              value={formatAmount(bucket.tax, currency, { withSymbol: false })}
            />
          ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 text-xs">
          <dt className="font-bold uppercase">Total</dt>
          <dd className="tabular shrink-0 font-bold">{formatAmount(totals.total, currency)}</dd>
        </div>
      </dl>

      {/*
        Bloc de règlement. Il vient juste après les totaux, parce qu'il répond à
        la question que le client se pose en les lisant : est-ce que je dois
        encore quelque chose ?

        Le moyen de paiement est repris tel qu'il a été saisi à l'encaissement.
        Le reste à payer n'apparaît que s'il est non nul : l'imprimer à zéro sur
        une facture soldée ajoute une ligne qui ne dit rien.
      */}
      {settlement ? (
        <>
          <Tear />

          <dl className="space-y-0.5">
            {payments.map((payment, index) => {
              // `null` dès que la question ne se pose pas : pas d'espèces, ou
              // aucun montant remis saisi. Zéro reste affiché — « compte juste »
              // est une information, et c'est celle qu'on vient vérifier.
              const change = changeGiven(payment.amount, payment.tendered);

              return (
                <React.Fragment key={index}>
                  <Row
                    label={PAYMENT_METHOD_LABELS[payment.method]}
                    value={formatAmount(payment.amount, currency, { withSymbol: false })}
                  />

                  {change !== null ? (
                    <>
                      <Row
                        label="Reçu"
                        value={formatAmount(payment.tendered ?? 0, currency, {
                          withSymbol: false,
                        })}
                      />
                      <Row
                        label="Monnaie rendue"
                        value={formatAmount(change, currency, { withSymbol: false })}
                      />
                    </>
                  ) : null}
                </React.Fragment>
              );
            })}

            {/* Le cumul n'a d'intérêt que face à plusieurs versements. */}
            {payments.length > 1 ? (
              <Row
                label="Total payé"
                value={formatAmount(settlement.paid, currency, { withSymbol: false })}
              />
            ) : null}

            {settlement.remaining > 0 ? (
              <Row
                label="Reste à payer"
                value={formatAmount(settlement.remaining, currency)}
                strong
              />
            ) : null}
          </dl>

          {/* La mention en toutes lettres : c'est ce qu'on cherche d'un coup d'œil. */}
          <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.15em]">
            {settlement.label}
          </p>
        </>
      ) : null}

      <Barcode value={number} caption={notes} />

      {issuer.invoiceFooter ? (
        <p className="mt-3 text-center uppercase tracking-wide">{issuer.invoiceFooter}</p>
      ) : null}
    </article>
  );
}

/**
 * Code-barres du numéro de document, en Code 39, et sa légende.
 *
 * Les barres sont des `<div>` proportionnels plutôt qu'une image : rien à
 * charger, net à toutes les tailles, et le même encodeur que le PDF
 * (`lib/barcode/code39`) — l'aperçu ne peut donc pas montrer un code différent
 * de celui qui sera téléchargé.
 *
 * LA LÉGENDE EST LA NOTE quand il y en a une, le numéro sinon. C'est un arbitrage
 * assumé : la ligne sous un code-barres sert normalement de recours quand le scan
 * échoue, et on y renonce. Le numéro reste lisible en tête du ticket, sur la ligne
 * FACTURE, donc il n'est perdu pour personne — et la place du bas revient au
 * message que l'émetteur adresse à son client.
 *
 * Un brouillon n'a pas encore de numéro : pas de code-barres plutôt qu'un code
 * qui ne renverrait à rien. La note, elle, reste affichée — sinon elle
 * disparaîtrait de l'aperçu au moment précis où on la saisit.
 */
function Barcode({ value, caption }: { value: string; caption: string }) {
  const note = caption.trim();
  const numbered = Boolean(value.trim()) && !/^brouillon$/i.test(value);

  if (!numbered) {
    return note ? <Caption>{note}</Caption> : null;
  }

  const runs = code39Runs(value);
  const total = code39Width(value);

  return (
    <div className="mt-4">
      <div className="flex h-10 w-full items-stretch" aria-hidden>
        {runs.map((run, index) => (
          <span
            key={index}
            className={run.dark ? "bg-foreground" : undefined}
            style={{ width: `${(run.width / total) * 100}%` }}
          />
        ))}
      </div>
      {note ? (
        <Caption>{note}</Caption>
      ) : (
        <p className="tabular mt-1 text-center tracking-[0.15em]">{value}</p>
      )}
    </div>
  );
}

/**
 * Texte libre sous le code-barres. Ni `tabular` ni interlettrage : ces réglages
 * servent à aligner des chiffres, ils abîment une phrase. Et pas de capitales
 * non plus — une phrase entière en capitales ne se lit plus.
 */
function Caption({ children }: { children: string }) {
  return <p className="mt-1 text-center text-muted-foreground">{children}</p>;
}

/** Coordonnées de l'émetteur, dans l'ordre où on les cherche sur un ticket. */
function IssuerLines({ issuer, className }: { issuer: PreviewIssuer; className?: string }) {
  const lines = [
    issuer.addressLine,
    [issuer.city, issuer.country].filter(Boolean).join(", ") || null,
    issuer.phone,
    issuer.taxId ? `NIF ${issuer.taxId}` : null,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) return null;

  return (
    <div className={cn("space-y-0.5 uppercase text-muted-foreground", className)}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/** Pointillé de séparation — le repère visuel du ticket de caisse. */
function Tear() {
  return <div className="my-2.5 border-t border-dashed border-border" aria-hidden />;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="uppercase text-muted-foreground">{label}</dt>
      <dd className={cn("tabular shrink-0 text-right uppercase", strong && "font-bold")}>
        {value}
      </dd>
    </div>
  );
}
