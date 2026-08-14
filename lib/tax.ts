/**
 * Calcul des totaux d'une facture. Unique source de vérité : l'UI l'utilise pour
 * l'aperçu en direct, le serveur le rejoue avant toute écriture, et les totaux
 * envoyés par le client sont systématiquement ignorés.
 *
 * Convention d'arrondi : ARRONDI PAR LIGNE.
 * La TVA est arrondie ligne par ligne, et les totaux du document sont les sommes
 * exactes des lignes. Conséquence : les colonnes affichées se somment toujours au
 * franc près. Un arrondi global par taux serait marginalement plus « juste »
 * mathématiquement, mais produirait un écart d'un franc entre la somme visible
 * des lignes et le total — c'est exactement ce que les clients relèvent.
 */

import { applyBasisPoints, assertAmount, divideRound, toBasisPoints } from "@/lib/money";
import type { Discount, InvoiceItem } from "@/lib/domain/types";

/** Précision de `quantity` : numeric(12,3) côté base. */
const QUANTITY_SCALE = 1000;

export type ComputableLine = {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: Discount | null;
};

export type ComputedLine = {
  /** Montant HT avant remise. */
  lineGross: number;
  lineDiscount: number;
  /** Montant HT après remise — c'est la base d'imposition. */
  lineSubtotal: number;
  lineTax: number;
  /** TTC de la ligne. */
  lineTotal: number;
};

export type ComputedTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  /** Ventilation de la TVA par taux, pour le pied de facture. */
  taxBreakdown: Array<{ rate: number; base: number; tax: number }>;
};

export function computeLine(line: ComputableLine): ComputedLine {
  assertAmount(line.unitPrice, "prix unitaire");

  if (!Number.isFinite(line.quantity)) {
    throw new RangeError(`quantité non finie : ${line.quantity}`);
  }
  if (!Number.isFinite(line.taxRate) || line.taxRate < 0) {
    throw new RangeError(`taux de TVA invalide : ${line.taxRate}`);
  }

  // On repasse en entiers avant de multiplier : jamais de produit flottant.
  const quantityMilli = Math.round(line.quantity * QUANTITY_SCALE);
  const lineGross = divideRound(quantityMilli * line.unitPrice, QUANTITY_SCALE);

  const lineDiscount = computeDiscount(lineGross, line.discount ?? null);
  const lineSubtotal = lineGross - lineDiscount;
  const lineTax = applyBasisPoints(lineSubtotal, toBasisPoints(line.taxRate));

  return {
    lineGross,
    lineDiscount,
    lineSubtotal,
    lineTax,
    lineTotal: lineSubtotal + lineTax,
  };
}

function computeDiscount(gross: number, discount: Discount | null): number {
  if (!discount || discount.value === 0) return 0;

  if (discount.type === "percent") {
    if (discount.value < 0 || discount.value > 100) {
      throw new RangeError(`remise en pourcentage hors bornes : ${discount.value}`);
    }
    return applyBasisPoints(gross, toBasisPoints(discount.value));
  }

  assertAmount(discount.value, "remise");
  // Une remise ne peut pas dépasser le montant de la ligne : sinon le HT devient
  // négatif et la facture n'a plus de sens comptable.
  return Math.min(discount.value, gross);
}

export function computeTotals(lines: readonly ComputableLine[]): ComputedTotals {
  const byRate = new Map<number, { base: number; tax: number }>();

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const computed = computeLine(line);

    subtotal += computed.lineSubtotal;
    discountTotal += computed.lineDiscount;
    taxTotal += computed.lineTax;

    const bucket = byRate.get(line.taxRate) ?? { base: 0, tax: 0 };
    bucket.base += computed.lineSubtotal;
    bucket.tax += computed.lineTax;
    byRate.set(line.taxRate, bucket);
  }

  const taxBreakdown = [...byRate.entries()]
    .map(([rate, { base, tax }]) => ({ rate, base, tax }))
    .sort((a, b) => a.rate - b.rate);

  return {
    subtotal: assertAmount(subtotal, "total HT"),
    discountTotal: assertAmount(discountTotal, "total des remises"),
    taxTotal: assertAmount(taxTotal, "total TVA"),
    total: assertAmount(subtotal + taxTotal, "total TTC"),
    taxBreakdown,
  };
}

/** Reste à payer, borné à zéro (un trop-perçu ne crée pas un dû négatif). */
export function amountDue(total: number, amountPaid: number): number {
  return Math.max(0, assertAmount(total) - assertAmount(amountPaid));
}

/**
 * Complète les champs calculés d'une ligne persistée. Utilisé côté serveur avant
 * écriture, pour ne jamais faire confiance aux totaux transmis par le client.
 */
export function withComputedFields<T extends ComputableLine>(
  line: T,
): T & Omit<ComputedLine, "lineGross"> {
  const { lineDiscount, lineSubtotal, lineTax, lineTotal } = computeLine(line);
  return { ...line, lineDiscount, lineSubtotal, lineTax, lineTotal };
}

export type PersistedLineTotals = Pick<
  InvoiceItem,
  "lineSubtotal" | "lineDiscount" | "lineTax" | "lineTotal"
>;
