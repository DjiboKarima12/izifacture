import { describe, expect, it } from "vitest";

import {
  FREE_MONTHLY_QUOTA,
  isPremium,
  monthBounds,
  monthKey,
  monthlyQuota,
  planOf,
  quotaMessage,
  quotaState,
  TRIAL_DAYS,
  TRIAL_LAUNCH,
  trialState,
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

  /**
   * Un mois payé et activé à la main doit s'arrêter seul : personne ne
   * repassera le statut à la main le jour de l'échéance.
   */
  it("retombe sur le plan gratuit à l'échéance de la période payée", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(resolvePlan("premium", "active", "2026-12-09T12:00:00Z", now)).toBe("premium");
    expect(resolvePlan("premium", "active", "2026-11-09T12:00:00Z", now)).toBe("free");
    expect(resolvePlan("premium", "active", "2026-10-09T12:00:00Z", now)).toBe("free");
    expect(resolvePlan("premium", "active", "pas une date", now)).toBe("free");
    expect(resolvePlan("premium", "active", null, now)).toBe("premium");
  });
});

describe("planOf", () => {
  it("lit l'abonnement complet", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(
      planOf({ plan: "premium", status: "active", currentPeriodEnd: "2026-11-10T00:00:00Z" }, now),
    ).toBe("premium");
    expect(
      planOf({ plan: "premium", status: "active", currentPeriodEnd: "2026-11-01T00:00:00Z" }, now),
    ).toBe("free");
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

describe("trialState", () => {
  it("dure quinze jours à partir de la création", () => {
    const created = "2026-12-01T10:00:00Z";
    expect(trialState(created, new Date("2026-12-01T10:00:00Z"))).toMatchObject({
      daysLeft: TRIAL_DAYS,
      expired: false,
    });
    expect(trialState(created, new Date("2026-12-15T11:00:00Z")).daysLeft).toBe(1);
    expect(trialState(created, new Date("2026-12-16T10:00:00Z"))).toMatchObject({
      daysLeft: 0,
      expired: true,
    });
  });

  /**
   * Les comptes inscrits avant l'arrivée de l'essai n'ont jamais été prévenus :
   * leur essai part du lancement, pas de leur inscription.
   */
  it("fait partir les comptes anciens du lancement de l'essai", () => {
    const state = trialState("2026-09-01T00:00:00Z", new Date("2026-11-10T00:00:00Z"));
    expect(state.expired).toBe(false);
    expect(state.endsAt.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });

  it("traite une date illisible comme une inscription au lancement", () => {
    expect(trialState("n'importe quoi", new Date(TRIAL_LAUNCH)).daysLeft).toBe(TRIAL_DAYS);
  });
});

describe("quotaState pendant et après l'essai", () => {
  it("refuse toute émission une fois l'essai terminé, même sous le quota", () => {
    const state = quotaState("free", 0, true);
    expect(state.allowed).toBe(false);
    expect(state.trialExpired).toBe(true);
    expect(quotaMessage(state)).toContain("essai gratuit");
  });

  it("ignore la fin d'essai pour le premium", () => {
    expect(quotaState("premium", 0, true).allowed).toBe(true);
  });
});
