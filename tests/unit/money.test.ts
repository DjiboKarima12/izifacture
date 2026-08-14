import { describe, expect, it } from "vitest";

import {
  applyBasisPoints,
  assertAmount,
  divideRound,
  formatAmount,
  formatQuantity,
  isValidAmount,
  parseAmountInput,
  sumAmounts,
  toBasisPoints,
} from "@/lib/money";

/** Intl utilise une espace fine insécable ; on normalise pour comparer. */
const normalise = (value: string) => value.replace(/\s/gu, " ");

describe("isValidAmount", () => {
  it("accepte les entiers dans les bornes", () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(1_250_000)).toBe(true);
    expect(isValidAmount(-5_000)).toBe(true);
  });

  it("rejette les flottants, NaN et l'infini", () => {
    expect(isValidAmount(1250.5)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidAmount("1250")).toBe(false);
    expect(isValidAmount(null)).toBe(false);
  });

  it("rejette les montants hors bornes", () => {
    expect(isValidAmount(1_000_000_000_001)).toBe(false);
    expect(isValidAmount(-1_000_000_000_001)).toBe(false);
  });
});

describe("assertAmount", () => {
  it("lève une erreur explicite sur un flottant", () => {
    expect(() => assertAmount(10.5, "prix unitaire")).toThrow(/prix unitaire invalide/);
  });
});

describe("divideRound", () => {
  it("arrondit la moitié vers le haut pour les positifs", () => {
    expect(divideRound(5, 2)).toBe(3);
    expect(divideRound(4, 2)).toBe(2);
    expect(divideRound(3, 2)).toBe(2);
    expect(divideRound(1, 3)).toBe(0);
    expect(divideRound(2, 3)).toBe(1);
  });

  it("arrondit la moitié à l'écart de zéro pour les négatifs", () => {
    // Math.round(-2.5) donnerait -2 : la symétrie des avoirs serait cassée.
    expect(divideRound(-5, 2)).toBe(-3);
    expect(divideRound(-3, 2)).toBe(-2);
    expect(divideRound(-1, 3)).toBe(0);
  });

  it("est symétrique : f(-n) === -f(n)", () => {
    for (const n of [5, 7, 12, 99, 1234, 45_678]) {
      expect(divideRound(-n, 7)).toBe(-divideRound(n, 7));
    }
  });

  it("ne renvoie jamais de zéro négatif", () => {
    // -0 s'afficherait « -0 FCFA » et ferait échouer les comparaisons strictes.
    for (const [numerator, denominator] of [
      [-1, 3],
      [-1, 7],
      [0, 5],
      [-2, 100],
    ] as const) {
      expect(Object.is(divideRound(numerator, denominator), -0)).toBe(false);
    }
  });

  it("refuse une division par zéro", () => {
    expect(() => divideRound(10, 0)).toThrow(/division par zéro/);
  });
});

describe("toBasisPoints / applyBasisPoints", () => {
  it("convertit un pourcentage en points de base", () => {
    expect(toBasisPoints(18)).toBe(1800);
    expect(toBasisPoints(18.5)).toBe(1850);
    expect(toBasisPoints(0)).toBe(0);
  });

  it("calcule la TVA à 18 %", () => {
    expect(applyBasisPoints(100_000, 1800)).toBe(18_000);
    expect(applyBasisPoints(0, 1800)).toBe(0);
  });

  it("arrondit la demi-unité vers le haut", () => {
    // 25 × 18 % = 4,5 → 5
    expect(applyBasisPoints(25, 1800)).toBe(5);
    // 999 × 18 % = 179,82 → 180
    expect(applyBasisPoints(999, 1800)).toBe(180);
  });
});

describe("sumAmounts", () => {
  it("additionne des entiers", () => {
    expect(sumAmounts([1000, 2500, 300])).toBe(3800);
    expect(sumAmounts([])).toBe(0);
  });

  it("refuse un flottant glissé dans la liste", () => {
    expect(() => sumAmounts([1000, 2.5])).toThrow();
  });
});

describe("formatAmount", () => {
  it("affiche les F CFA sans décimale, groupés par milliers", () => {
    expect(normalise(formatAmount(1_250_000))).toBe("1 250 000 F CFA");
    expect(normalise(formatAmount(0))).toBe("0 F CFA");
    expect(normalise(formatAmount(999))).toBe("999 F CFA");
  });

  it("gère les montants négatifs", () => {
    expect(normalise(formatAmount(-25_000))).toBe("-25 000 F CFA");
  });

  it("peut omettre le symbole", () => {
    expect(normalise(formatAmount(1_250_000, "XOF", { withSymbol: false }))).toBe("1 250 000");
  });

  it("affiche XAF avec le même sigle que XOF", () => {
    expect(normalise(formatAmount(5_000, "XAF"))).toBe("5 000 F CFA");
  });
});

describe("formatQuantity", () => {
  it("supprime les zéros décimaux inutiles", () => {
    expect(formatQuantity(1)).toBe("1");
    expect(normalise(formatQuantity(1.5))).toBe("1,5");
    expect(normalise(formatQuantity(2.25))).toBe("2,25");
  });
});

describe("parseAmountInput", () => {
  it("parse une saisie simple", () => {
    expect(parseAmountInput("1250")).toBe(1250);
    expect(parseAmountInput("0")).toBe(0);
  });

  it("tolère les espaces et le sigle", () => {
    expect(parseAmountInput("1 250 000")).toBe(1_250_000);
    expect(parseAmountInput("1 250 000 FCFA")).toBe(1_250_000);
    expect(parseAmountInput("1 250 000")).toBe(1_250_000);
  });

  it("traite les groupes de 3 chiffres comme des milliers, pas des décimales", () => {
    expect(parseAmountInput("1.250.000")).toBe(1_250_000);
    expect(parseAmountInput("1,250,000")).toBe(1_250_000);
    expect(parseAmountInput("1.250")).toBe(1250);
  });

  it("traite 1 ou 2 chiffres finaux comme des décimales et arrondit en FCFA", () => {
    expect(parseAmountInput("1250,75")).toBe(1251);
    expect(parseAmountInput("1250,4")).toBe(1250);
  });

  it("gère les montants négatifs", () => {
    expect(parseAmountInput("-5000")).toBe(-5000);
  });

  it("renvoie null sur une saisie inexploitable", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("   ")).toBeNull();
    expect(parseAmountInput("-")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("12a34")).toBeNull();
  });

  it("renvoie null au-delà des bornes", () => {
    expect(parseAmountInput("99999999999999")).toBeNull();
  });
});
