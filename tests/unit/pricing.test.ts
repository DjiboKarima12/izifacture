import { describe, expect, it } from "vitest";

import {
  displayPrice,
  premiumPrice,
  PREMIUM_MONTHLY_PRICE,
  toDisplayCents,
} from "@/lib/pricing";

describe("premiumPrice", () => {
  it("facture le mois au prix affiché", () => {
    expect(premiumPrice("monthly")).toBe(PREMIUM_MONTHLY_PRICE);
  });

  it("offre deux mois sur l'année", () => {
    expect(premiumPrice("annual")).toBe(PREMIUM_MONTHLY_PRICE * 10);
  });
});

describe("toDisplayCents", () => {
  /** 2 000 / 655,957 = 3,0490… € — arrondi au centime le plus proche. */
  it("convertit à la parité fixe de l'euro", () => {
    expect(toDisplayCents(2_000, "EUR")).toBe(305);
    expect(toDisplayCents(20_000, "EUR")).toBe(3_049);
    expect(toDisplayCents(655_957, "EUR")).toBe(100_000);
  });

  it("convertit au taux indicatif du dollar", () => {
    expect(toDisplayCents(2_000, "USD")).toBe(357);
  });

  it("renvoie toujours un entier", () => {
    for (const amount of [1, 999, 2_000, 123_457]) {
      expect(Number.isInteger(toDisplayCents(amount, "EUR"))).toBe(true);
      expect(Number.isInteger(toDisplayCents(amount, "USD"))).toBe(true);
    }
  });
});

describe("displayPrice", () => {
  it("garde le franc CFA exact", () => {
    expect(displayPrice(20_000, "XOF")).toEqual({
      amount: "20 000",
      symbol: "F CFA",
      approximate: false,
    });
  });

  it("affiche l'euro avec ses centimes, sans approximation", () => {
    expect(displayPrice(2_000, "EUR")).toEqual({ amount: "3,05", symbol: "€", approximate: false });
  });

  it("signale le dollar comme approximatif", () => {
    expect(displayPrice(2_000, "USD")).toMatchObject({ amount: "3,57", approximate: true });
  });

  it("sépare les milliers au-delà de mille euros", () => {
    expect(displayPrice(1_000_000, "EUR").amount).toBe("1 524,49");
  });
});
