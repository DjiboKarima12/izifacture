import { describe, expect, it } from "vitest";

import {
  changeGiven,
  PAYMENT_METHOD_LABELS,
  paymentSummary,
  settleAtCounter,
  showsSettlement,
} from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/domain/types";

describe("paymentSummary", () => {
  it("rien encaissé : non payée, tout reste dû", () => {
    expect(paymentSummary(590, 0)).toEqual({
      state: "unpaid",
      label: "Non payée",
      paid: 0,
      remaining: 590,
    });
  });

  it("encaissement partiel : le reste est le complément exact", () => {
    const summary = paymentSummary(590, 500);
    expect(summary.state).toBe("partial");
    expect(summary.remaining).toBe(90);
  });

  it("soldée au franc près : payée, plus rien à devoir", () => {
    const summary = paymentSummary(590, 590);
    expect(summary.state).toBe("paid");
    expect(summary.remaining).toBe(0);
  });

  it("trop-perçu : payée, et le reste ne devient jamais négatif", () => {
    const summary = paymentSummary(590, 1000);
    expect(summary.state).toBe("paid");
    expect(summary.remaining).toBe(0);
  });

  it("un encaissé négatif est ignoré plutôt que soustrait du total", () => {
    expect(paymentSummary(590, -100).remaining).toBe(590);
    expect(paymentSummary(590, -100).state).toBe("unpaid");
  });
});

describe("showsSettlement", () => {
  it("affiché sur une facture qui porte un montant", () => {
    expect(showsSettlement("invoice", 590)).toBe(true);
  });

  it("jamais sur un devis ni sur un avoir — aucun des deux n'appelle de paiement", () => {
    expect(showsSettlement("quote", 590)).toBe(false);
    expect(showsSettlement("credit_note", 590)).toBe(false);
  });

  it("jamais sur un total nul : un brouillon vide n'est pas une facture payée", () => {
    expect(showsSettlement("invoice", 0)).toBe(false);
    expect(paymentSummary(0, 0).state).toBe("paid"); // d'où la garde ci-dessus
  });
});

describe("PAYMENT_METHOD_LABELS", () => {
  it("couvre tous les moyens de paiement du domaine", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeTruthy();
    }
    expect(Object.keys(PAYMENT_METHOD_LABELS)).toHaveLength(PAYMENT_METHODS.length);
  });
});

describe("changeGiven", () => {
  it("rien de tendu : la question ne se pose pas", () => {
    expect(changeGiven(2950, null)).toBeNull();
    expect(changeGiven(2950, undefined)).toBeNull();
  });

  it("un billet de 5 000 sur 2 950 : 2 050 à rendre", () => {
    expect(changeGiven(2950, 5000)).toBe(2050);
  });

  it("compte juste : zéro, PAS null — c'est une information à imprimer", () => {
    expect(changeGiven(2950, 2950)).toBe(0);
  });

  it("tendu inférieur à l'encaissé : jamais de monnaie négative sur un ticket", () => {
    expect(changeGiven(2950, 1000)).toBe(0);
  });
});

describe("settleAtCounter", () => {
  it("le compte juste : rien à rendre, rien à devoir", () => {
    expect(settleAtCounter(5900, "cash", null)).toEqual({
      amount: 5900,
      tendered: null,
      change: 0,
      remaining: 0,
    });
  });

  it("ACOMPTE — 4 000 sur 5 900 : on encaisse 4 000, il reste 1 900", () => {
    expect(settleAtCounter(5900, "cash", 4000)).toEqual({
      amount: 4000,
      tendered: null,
      change: 0,
      remaining: 1900,
    });
  });

  it("un billet de 10 000 sur 5 900 : on encaisse 5 900 et on rend 4 100", () => {
    expect(settleAtCounter(5900, "cash", 10000)).toEqual({
      amount: 5900,
      tendered: 10000,
      change: 4100,
      remaining: 0,
    });
  });

  it("n'encaisse jamais plus que le total, même si on tend davantage", () => {
    expect(settleAtCounter(5900, "cash", 10000).amount).toBe(5900);
  });

  it("un paiement Wave ne rend pas de monnaie, même excédentaire", () => {
    const settlement = settleAtCounter(5900, "wave", 10000);
    expect(settlement.change).toBe(0);
    expect(settlement.tendered).toBeNull();
    expect(settlement.amount).toBe(5900);
  });

  it("un paiement Wave partiel reste un acompte", () => {
    expect(settleAtCounter(5900, "wave", 4000)).toMatchObject({
      amount: 4000,
      remaining: 1900,
    });
  });

  it("un montant négatif n'encaisse rien plutôt que de créditer le client", () => {
    expect(settleAtCounter(5900, "cash", -100)).toMatchObject({
      amount: 0,
      remaining: 5900,
    });
  });
});
