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
 *
 * Une période payée et ÉCHUE retombe aussi sur `free`, sans attendre qu'un
 * webhook ou une main repasse le statut : l'activation manuelle d'un mois payé
 * par Mobile Money s'arrête d'elle-même. Sans date de fin, rien n'expire.
 */
export function resolvePlan(
  plan: string | null | undefined,
  status: string | null | undefined = "active",
  currentPeriodEnd: string | null = null,
  now: Date = new Date(),
): Plan {
  if (status !== "active") return "free";
  if (currentPeriodEnd !== null && !(Date.parse(currentPeriodEnd) > now.getTime())) return "free";
  return isPlan(plan) ? plan : "free";
}

/** L'abonnement tel que la couche données le renvoie. */
export type SubscriptionInfo = {
  plan: string;
  status: string;
  /** Fin de la période payée (ISO), `null` = sans échéance. */
  currentPeriodEnd: string | null;
};

export function planOf(subscription: SubscriptionInfo, now: Date = new Date()): Plan {
  return resolvePlan(subscription.plan, subscription.status, subscription.currentPeriodEnd, now);
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

/* ------------------------------------------------------------ Essai */

/**
 * L'offre gratuite est un ESSAI : quinze jours, toujours plafonnés à
 * `FREE_MONTHLY_QUOTA` factures. Passé ce délai, l'émission est refusée et
 * l'application propose le premium ; les données restent consultables.
 *
 * L'essai part de la création de l'organisation — mais jamais avant
 * `TRIAL_LAUNCH`, le jour où l'essai a remplacé le gratuit illimité. Sans ce
 * plancher, les comptes déjà inscrits auraient été bloqués à la mise en ligne,
 * sans avoir jamais été prévenus.
 */
export const TRIAL_DAYS = 15;
export const TRIAL_LAUNCH = "2026-11-09T00:00:00Z";

const DAY_MS = 86_400_000;

export type TrialState = {
  endsAt: Date;
  /** Jours restants, arrondis au jour entamé. 0 une fois terminé. */
  daysLeft: number;
  expired: boolean;
};

export function trialState(orgCreatedAt: string, now: Date = new Date()): TrialState {
  const created = Date.parse(orgCreatedAt);
  const start = Math.max(Number.isNaN(created) ? 0 : created, Date.parse(TRIAL_LAUNCH));
  const endsAt = start + TRIAL_DAYS * DAY_MS;
  const remaining = endsAt - now.getTime();
  return {
    endsAt: new Date(endsAt),
    daysLeft: Math.max(0, Math.ceil(remaining / DAY_MS)),
    expired: remaining <= 0,
  };
}

/* ------------------------------------------------------------ Quota */

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
  /** L'essai est terminé : plus aucune émission sans premium. */
  trialExpired: boolean;
};

export function quotaState(
  plan: Plan,
  issuedThisMonth: number,
  trialExpired = false,
): QuotaState {
  const limit = monthlyQuota(plan);
  const used = Math.max(0, Math.trunc(issuedThisMonth));

  if (limit === null) {
    return {
      plan,
      limit: null,
      used,
      remaining: null,
      allowed: true,
      reached: false,
      trialExpired: false,
    };
  }

  const remaining = Math.max(0, limit - used);

  return {
    plan,
    limit,
    used,
    remaining,
    allowed: remaining > 0 && !trialExpired,
    reached: remaining === 0,
    trialExpired,
  };
}

/** Message affiché à l'utilisateur quand l'émission est refusée. */
export function quotaMessage(state: QuotaState): string {
  if (state.trialExpired) {
    return (
      `Votre essai gratuit de ${TRIAL_DAYS} jours est terminé. ` +
      "Passez au premium pour continuer à émettre des factures — vos clients et documents sont conservés."
    );
  }
  return (
    `Vous avez émis ${state.used} factures ce mois-ci, la limite de l'essai gratuit. ` +
    "Passez au premium pour en émettre sans limite — vos brouillons sont conservés."
  );
}

/* ------------------------------------------------------------ Rappel */

/** Jours avant la fin de l'essai où l'application commence à prévenir. */
export const TRIAL_REMINDER_DAYS = 3;
/** Jours avant la fin d'une période premium payée où l'on rappelle de renouveler. */
export const PREMIUM_REMINDER_DAYS = 5;

export type PlanReminder = {
  kind: "trial" | "premium";
  /** Jours restants, arrondis au jour entamé — jamais 0 : à 0, c'est la fenêtre de fin qui parle. */
  daysLeft: number;
  endsAt: Date;
};

/**
 * Faut-il prévenir que l'accès va bientôt s'arrêter ?
 *
 * Le pendant, AVANT l'échéance, de la fenêtre « essai terminé » : sans lui, le
 * premier signe d'une fin d'essai ou d'un mois payé écoulé serait un refus
 * d'émettre en plein comptoir. Un premium sans date de fin ne s'arrête jamais,
 * il n'y a donc rien à rappeler.
 */
export function planReminder(
  subscription: SubscriptionInfo,
  orgCreatedAt: string,
  now: Date = new Date(),
): PlanReminder | null {
  const plan = planOf(subscription, now);

  if (plan === "premium") {
    if (subscription.currentPeriodEnd === null) return null;
    const endsAt = Date.parse(subscription.currentPeriodEnd);
    const daysLeft = Math.ceil((endsAt - now.getTime()) / DAY_MS);
    return daysLeft <= PREMIUM_REMINDER_DAYS
      ? { kind: "premium", daysLeft, endsAt: new Date(endsAt) }
      : null;
  }

  const trial = trialState(orgCreatedAt, now);
  if (trial.expired || trial.daysLeft > TRIAL_REMINDER_DAYS) return null;
  return { kind: "trial", daysLeft: trial.daysLeft, endsAt: trial.endsAt };
}
