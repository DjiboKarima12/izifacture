import { formatAmount } from "@/lib/money";
import { premiumPrice, type BillingPeriod } from "@/lib/pricing";

/**
 * Demande d'abonnement par Mobile Money.
 *
 * TANT QU'AUCUN PRESTATAIRE N'EST BRANCHÉ, le paiement ne passe pas par
 * l'application : le formulaire compose une demande et l'ouvre dans WhatsApp,
 * vers le support. Le support envoie la demande de paiement sur le numéro
 * indiqué, puis active l'abonnement à la main (docs/abonnement-manuel.md).
 *
 * Le jour où un prestataire est choisi, seul l'envoi change : le pays, le
 * numéro et la période sont déjà ceux qu'une API de paiement demandera.
 */

/** Numéro WhatsApp du support, sans « + » ni espaces : le format de wa.me. */
export const BILLING_WHATSAPP = "22789353500";

export type MobileMoneyCountry = {
  code: string;
  name: string;
  /** Indicatif sans le « + ». */
  dialCode: string;
  /** Longueur du numéro national, sans l'indicatif. */
  digits: number;
};

/** Le Niger d'abord : c'est le marché de départ. */
export const MOBILE_MONEY_COUNTRIES: readonly MobileMoneyCountry[] = [
  { code: "NE", name: "Niger", dialCode: "227", digits: 8 },
  { code: "SN", name: "Sénégal", dialCode: "221", digits: 9 },
  { code: "ML", name: "Mali", dialCode: "223", digits: 8 },
  { code: "BF", name: "Burkina Faso", dialCode: "226", digits: 8 },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "225", digits: 10 },
  { code: "BJ", name: "Bénin", dialCode: "229", digits: 10 },
  { code: "TG", name: "Togo", dialCode: "228", digits: 8 },
];

export const MOBILE_MONEY_COUNTRY_CODES = MOBILE_MONEY_COUNTRIES.map((c) => c.code) as [
  string,
  ...string[],
];

export function mobileMoneyCountry(code: string): MobileMoneyCountry | undefined {
  return MOBILE_MONEY_COUNTRIES.find((country) => country.code === code);
}

/** Ne garde que les chiffres : « 89 35-35 00 » → « 89353500 ». */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Page d'abonnement avec la fenêtre de paiement déjà ouverte sur la période
 * choisie : c'est là qu'arrive le visiteur qui a cliqué sur le premium.
 */
export function premiumCheckoutPath(period: BillingPeriod): string {
  return `/abonnement?periode=${period}&payer=1`;
}

/** Inscription, puis paiement : le bouton premium de la vitrine. */
export function premiumSignupPath(period: BillingPeriod): string {
  return `/signup?next=${encodeURIComponent(premiumCheckoutPath(period))}`;
}

export type SubscriptionRequest = {
  period: BillingPeriod;
  country: string;
  phone: string;
};

export type SubscriptionRequestContext = {
  orgId: string;
  orgName: string;
};

export function subscriptionRequestMessage(
  request: SubscriptionRequest,
  context: SubscriptionRequestContext,
): string {
  const country = mobileMoneyCountry(request.country);
  const phone = normalizePhoneDigits(request.phone);
  const periode = request.period === "annual" ? "Annuel (12 mois)" : "Mensuel (1 mois)";

  return [
    "Bonjour, je souhaite passer au Premium.",
    "",
    `Boutique : ${context.orgName}`,
    `Formule : ${periode}`,
    `Montant : ${formatAmount(premiumPrice(request.period))}`,
    `Mobile Money : +${country?.dialCode ?? ""} ${phone} (${country?.name ?? request.country})`,
    "",
    `Réf. : ${context.orgId}`,
  ].join("\n");
}

export function subscriptionRequestUrl(
  request: SubscriptionRequest,
  context: SubscriptionRequestContext,
): string {
  const text = encodeURIComponent(subscriptionRequestMessage(request, context));
  return `https://wa.me/${BILLING_WHATSAPP}?text=${text}`;
}
