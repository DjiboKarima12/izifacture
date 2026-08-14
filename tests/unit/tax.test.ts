import { describe, expect, it } from "vitest";

import { amountDue, computeLine, computeTotals, type ComputableLine } from "@/lib/tax";

const line = (overrides: Partial<ComputableLine> = {}): ComputableLine => ({
  quantity: 1,
  unitPrice: 100_000,
  taxRate: 18,
  discount: null,
  ...overrides,
});

describe("computeLine", () => {
  it("calcule le cas nominal à 18 %", () => {
    expect(computeLine(line())).toEqual({
      lineGross: 100_000,
      lineDiscount: 0,
      lineSubtotal: 100_000,
      lineTax: 18_000,
      lineTotal: 118_000,
    });
  });

  it("multiplie par la quantité", () => {
    const result = computeLine(line({ quantity: 3, unitPrice: 25_000 }));
    expect(result.lineSubtotal).toBe(75_000);
    expect(result.lineTax).toBe(13_500);
    expect(result.lineTotal).toBe(88_500);
  });

  it("gère les quantités fractionnaires sans erreur de flottant", () => {
    expect(computeLine(line({ quantity: 0.5, unitPrice: 15_000 })).lineSubtotal).toBe(7_500);
    expect(computeLine(line({ quantity: 1.333, unitPrice: 1_000 })).lineSubtotal).toBe(1_333);
    // 0,1 + 0,2 en flottant vaut 0,30000000000000004 : on vérifie qu'aucune
    // dérive de ce type ne remonte jusqu'au montant.
    expect(computeLine(line({ quantity: 0.3, unitPrice: 10_000 })).lineSubtotal).toBe(3_000);
  });

  it("arrondit la TVA à la moitié supérieure", () => {
    // 25 × 18 % = 4,5 → 5
    expect(computeLine(line({ quantity: 1, unitPrice: 25 })).lineTax).toBe(5);
    // 999 × 18 % = 179,82 → 180
    expect(computeLine(line({ quantity: 1, unitPrice: 999 })).lineTax).toBe(180);
  });

  it("accepte un taux de TVA nul (exonéré)", () => {
    const result = computeLine(line({ taxRate: 0 }));
    expect(result.lineTax).toBe(0);
    expect(result.lineTotal).toBe(100_000);
  });

  it("applique une remise en pourcentage", () => {
    const result = computeLine(line({ discount: { type: "percent", value: 10 } }));
    expect(result.lineGross).toBe(100_000);
    expect(result.lineDiscount).toBe(10_000);
    expect(result.lineSubtotal).toBe(90_000);
    expect(result.lineTax).toBe(16_200);
    expect(result.lineTotal).toBe(106_200);
  });

  it("applique une remise en montant", () => {
    const result = computeLine(line({ discount: { type: "amount", value: 15_000 } }));
    expect(result.lineSubtotal).toBe(85_000);
    expect(result.lineTax).toBe(15_300);
  });

  it("plafonne une remise supérieure au montant de la ligne", () => {
    const result = computeLine(line({ discount: { type: "amount", value: 500_000 } }));
    expect(result.lineDiscount).toBe(100_000);
    expect(result.lineSubtotal).toBe(0);
    expect(result.lineTax).toBe(0);
    expect(result.lineTotal).toBe(0);
  });

  it("rejette les entrées invalides", () => {
    expect(() => computeLine(line({ unitPrice: 10.5 }))).toThrow(/prix unitaire/);
    expect(() => computeLine(line({ taxRate: -1 }))).toThrow(/taux de TVA/);
    expect(() => computeLine(line({ quantity: Number.NaN }))).toThrow(/quantité/);
    expect(() => computeLine(line({ discount: { type: "percent", value: 150 } }))).toThrow(
      /remise en pourcentage/,
    );
  });
});

describe("computeTotals", () => {
  it("agrège plusieurs lignes", () => {
    const totals = computeTotals([
      line({ quantity: 2, unitPrice: 50_000 }),
      line({ quantity: 1, unitPrice: 30_000 }),
    ]);

    expect(totals.subtotal).toBe(130_000);
    expect(totals.taxTotal).toBe(23_400);
    expect(totals.total).toBe(153_400);
    expect(totals.discountTotal).toBe(0);
  });

  it("renvoie des totaux nuls pour une facture vide", () => {
    expect(computeTotals([])).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      taxBreakdown: [],
    });
  });

  it("ventile la TVA par taux, triée croissante", () => {
    const totals = computeTotals([
      line({ unitPrice: 100_000, taxRate: 18 }),
      line({ unitPrice: 50_000, taxRate: 0 }),
      line({ unitPrice: 20_000, taxRate: 18 }),
    ]);

    expect(totals.taxBreakdown).toEqual([
      { rate: 0, base: 50_000, tax: 0 },
      { rate: 18, base: 120_000, tax: 21_600 },
    ]);
    expect(totals.taxTotal).toBe(21_600);
  });

  it("garantit que la somme des lignes égale le total affiché", () => {
    // Des montants choisis pour produire des arrondis à chaque ligne.
    const lines = [
      line({ quantity: 3, unitPrice: 333, taxRate: 18 }),
      line({ quantity: 7, unitPrice: 777, taxRate: 18 }),
      line({ quantity: 1.5, unitPrice: 1_111, taxRate: 18 }),
      line({ quantity: 11, unitPrice: 25, taxRate: 18 }),
    ];

    const totals = computeTotals(lines);
    const computed = lines.map(computeLine);

    const sumOfLineTotals = computed.reduce((sum, item) => sum + item.lineTotal, 0);
    const sumOfLineSubtotals = computed.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const sumOfLineTaxes = computed.reduce((sum, item) => sum + item.lineTax, 0);

    // C'est l'invariant qui protège l'utilisateur de « l'écart d'un franc ».
    expect(totals.total).toBe(sumOfLineTotals);
    expect(totals.subtotal).toBe(sumOfLineSubtotals);
    expect(totals.taxTotal).toBe(sumOfLineTaxes);
    expect(totals.subtotal + totals.taxTotal).toBe(totals.total);
  });

  it("conserve des totaux entiers sur un grand nombre de lignes", () => {
    const lines = Array.from({ length: 200 }, (_, index) =>
      line({ quantity: 1, unitPrice: 1_000 + index, taxRate: 18 }),
    );

    const totals = computeTotals(lines);
    expect(Number.isInteger(totals.total)).toBe(true);
    expect(Number.isInteger(totals.taxTotal)).toBe(true);
    expect(totals.total).toBe(totals.subtotal + totals.taxTotal);
  });
});

describe("amountDue", () => {
  it("calcule le reste à payer", () => {
    expect(amountDue(118_000, 0)).toBe(118_000);
    expect(amountDue(118_000, 50_000)).toBe(68_000);
    expect(amountDue(118_000, 118_000)).toBe(0);
  });

  it("borne un trop-perçu à zéro", () => {
    expect(amountDue(118_000, 150_000)).toBe(0);
  });
});
