import { addMonths, assertIsoDate, todayIso } from "@/lib/dates";
import type { IsoDate } from "@/lib/domain/types";

/**
 * Plans et quota d'émission.
 *
 * Logique pure, sans accès aux données : elle reçoit un plan et un nombre de
 * documents déjà émis, elle répond. C'est ce qui permet de la tester
 * entièrement, et de l'appeler aussi bien depuis une Server Action que depuis
 * une page pour afficher « il vous reste 2 factures ce mois-ci ».
 *
 * CE QUI EST COMPTÉ — les factures ÉMISES dans le mois calendaire en cours.
 * Trois conséquences voulues :
 *
 *  - un brouillon ne consomme rien : on peut préparer autant de documents qu'on
 *    veut, le quota ne se paie qu'au moment où le numéro est attribué ;
 *  - un DEVIS ne consomme rien non plus : il ne prouve aucune vente, et faire
 *    payer un prospect qui n'a encore rien acheté n'a pas de sens ;
 *  - un AVOIR ne consomme rien : c'est une correction, souvent imposée par la
 *    réglementation. Bloquer la correction d'une erreur serait indéfendable.
 *
 * Le mois se lit sur `sentAt`, l'horodatage posé par le serveur à l'émission —
 * pas sur la date d'émission saisie, que l'utilisateur choisit et pourrait
 * antidater pour repasser sous le quota.
 */

export const PLANS = ["free", "premium"] as const;
export type Plan = (typeof PLANS)[number];

/** Factures émises offertes par mois calendaire. */
export const FREE_MONTHLY_QUOTA = 5;

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/**
 * Tout ce qui n'est pas un plan payant reconnu ET actif retombe sur `free`.
 *
 * Le sens du défaut compte : une valeur inconnue en base, un abonnement expiré
 * ou en impayé donne le plan gratuit. L'inverse ouvrirait l'application à qui
 * saurait écrire n'importe quoi dans la colonne.
 */
export function resolvePlan(
  plan: string | null | undefined,
  status: string | null | undefined = "active",
): Plan {
  if (status !== "active") return "free";
  return isPlan(plan) ? plan : "free";
}

export function isPremium(plan: Plan): boolean {
  return plan === "premium";
}

/** Nombre de factures émises autorisées par mois — `null` = sans limite. */
export function monthlyQuota(plan: Plan): number | null {
  return isPremium(plan) ? null : FREE_MONTHLY_QUOTA;
}

/** Clé de regroupement mensuelle : « 2026-09 ». */
export function monthKey(date: IsoDate): string {
  return assertIsoDate(date).slice(0, 7);
}

/**
 * Bornes du mois calendaire contenant `reference`, en demi-ouvert `[from, to[`.
 *
 * Demi-ouvert et non `[from, to]` : la borne haute est le 1er du mois suivant,
 * donc une facture émise le 30 à 23 h 59 est comptée sans avoir à raisonner sur
 * les heures ni sur le nombre de jours du mois.
 */
export function monthBounds(reference: IsoDate = todayIso()): { from: IsoDate; to: IsoDate } {
  const from = `${monthKey(reference)}-01` as IsoDate;
  return { from, to: addMonths(from, 1) };
}

export type QuotaState = {
  plan: Plan;
  /** `null` sur un plan sans limite. */
  limit: number | null;
  used: number;
  /** `null` sur un plan sans limite. Jamais négatif. */
  remaining: number | null;
  /** Une facture de plus peut-elle être émise ? */
  allowed: boolean;
  /** Le quota est atteint : c'est le moment de proposer le premium. */
  reached: boolean;
};

export function quotaState(plan: Plan, issuedThisMonth: number): QuotaState {
  const limit = monthlyQuota(plan);
  const used = Math.max(0, Math.trunc(issuedThisMonth));

  if (limit === null) {
    return { plan, limit: null, used, remaining: null, allowed: true, reached: false };
  }

  const remaining = Math.max(0, limit - used);

  return {
    plan,
    limit,
    used,
    remaining,
    allowed: remaining > 0,
    reached: remaining === 0,
  };
}

/** Message affiché à l'utilisateur quand l'émission est refusée. */
export function quotaMessage(state: QuotaState): string {
  return (
    `Vous avez émis ${state.used} factures ce mois-ci, la limite du plan gratuit. ` +
    "Passez au premium pour en émettre sans limite — vos brouillons sont conservés."
  );
}
