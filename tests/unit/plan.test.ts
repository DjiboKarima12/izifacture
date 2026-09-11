import { describe, expect, it } from "vitest";

import {
  FREE_MONTHLY_QUOTA,
  isPremium,
  monthBounds,
  monthKey,
  monthlyQuota,
  quotaState,
  resolvePlan,
} from "@/lib/plan";

describe("resolvePlan", () => {
  it("reconnaît les deux plans", () => {
    expect(resolvePlan("free")).toBe("free");
    expect(resolvePlan("premium")).toBe("premium");
  });

  /**
   * Le sens du défaut est une décision de sécurité : une colonne vide, une
   * valeur inconnue ou un abonnement inactif doivent TOUS retomber sur le plan
   * gratuit. L'inverse ouvrirait l'application à qui saurait écrire n'importe
   * quoi en base.
   */
  it("retombe sur le plan gratuit devant l'inconnu", () => {
    expect(resolvePlan(null)).toBe("free");
    expect(resolvePlan(undefined)).toBe("free");
    expect(resolvePlan("")).toBe("free");
    expect(resolvePlan("PREMIUM")).toBe("free");
    expect(resolvePlan("entreprise")).toBe("free");
  });

  it("ignore un plan payant dont l'abonnement n'est plus actif", () => {
    expect(resolvePlan("premium", "past_due")).toBe("free");
    expect(resolvePlan("premium", "canceled")).toBe("free");
    expect(resolvePlan("premium", null)).toBe("free");
    expect(resolvePlan("premium", "active")).toBe("premium");
  });
});

describe("monthlyQuota", () => {
  it("limite le plan gratuit et libère le premium", () => {
    expect(monthlyQuota("free")).toBe(FREE_MONTHLY_QUOTA);
    expect(monthlyQuota("premium")).toBeNull();
    expect(isPremium("premium")).toBe(true);
  });
});

describe("monthKey", () => {
  it("regroupe par mois calendaire", () => {
    expect(monthKey("2026-09-07")).toBe("2026-09");
    expect(monthKey("2026-09-30")).toBe("2026-09");
    expect(monthKey("2026-10-01")).toBe("2026-10");
  });
});

describe("monthBounds", () => {
  it("va du 1er du mois au 1er du mois suivant, borne haute exclue", () => {
    expect(monthBounds("2026-09-07")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
  });

  it("passe l'année sans se tromper", () => {
    expect(monthBounds("2026-12-31")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });

  it("ne dépend pas du nombre de jours du mois", () => {
    expect(monthBounds("2028-02-29")).toEqual({ from: "2028-02-01", to: "2028-03-01" });
    expect(monthBounds("2026-02-15")).toEqual({ from: "2026-02-01", to: "2026-03-01" });
  });
});

describe("quotaState", () => {
  it("laisse passer tant que le quota n'est pas atteint", () => {
    const state = quotaState("free", 3);

    expect(state.allowed).toBe(true);
    expect(state.reached).toBe(false);
    expect(state.remaining).toBe(2);
    expect(state.limit).toBe(5);
  });

  it("bloque à la cinquième facture du mois", () => {
    const state = quotaState("free", 5);

    expect(state.allowed).toBe(false);
    expect(state.reached).toBe(true);
    expect(state.remaining).toBe(0);
  });

  /**
   * Le compte peut dépasser la limite : un abonnement premium qui expire laisse
   * derrière lui des factures déjà émises. Le restant ne doit pas devenir
   * négatif, sinon un « il vous reste -3 factures » finirait à l'écran.
   */
  it("ne descend jamais sous zéro après un déclassement", () => {
    const state = quotaState("free", 42);

    expect(state.remaining).toBe(0);
    expect(state.allowed).toBe(false);
    expect(state.used).toBe(42);
  });

  it("ne limite pas le premium", () => {
    const state = quotaState("premium", 900);

    expect(state.allowed).toBe(true);
    expect(state.reached).toBe(false);
    expect(state.limit).toBeNull();
    expect(state.remaining).toBeNull();
  });

  it("traite un compteur absurde comme zéro plutôt que d'ouvrir la porte", () => {
    expect(quotaState("free", -10).used).toBe(0);
    expect(quotaState("free", -10).remaining).toBe(5);
  });
});
