import { assertAmount, divideRound, formatAmount } from "@/lib/money";

/**
 * Grille tarifaire de l'abonnement, et son affichage en plusieurs devises.
 *
 * Le paiement se fait TOUJOURS en FCFA, par Mobile Money. L'euro et le dollar
 * ne servent qu'à l'affichage, pour le visiteur qui raisonne dans une autre
 * monnaie : aucun montant converti n'est jamais encaissé ni stocké.
 *
 * Logique pure, comme `lib/plan.ts` : testable entièrement, appelable depuis la
 * vitrine comme depuis la page d'abonnement.
 */

export const BILLING_PERIODS = ["monthly", "annual"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Prix du premium au mois, en FCFA. */
export const PREMIUM_MONTHLY_PRICE = 2_000;

/** L'annuel se paie en une fois : douze mois pour le prix de dix. */
export const ANNUAL_MONTHS_CHARGED = 10;
export const ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_CHARGED;

export function premiumPrice(period: BillingPeriod): number {
  return period === "annual"
    ? PREMIUM_MONTHLY_PRICE * ANNUAL_MONTHS_CHARGED
    : PREMIUM_MONTHLY_PRICE;
}

export const DISPLAY_CURRENCIES = ["XOF", "EUR", "USD"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Libellés du sélecteur de devise. */
export const DISPLAY_CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  XOF: "F CFA",
  EUR: "€ EUR",
  USD: "$ USD",
};

/** Rappel affiché sous les prix quand la devise n'est pas celle du paiement. */
export function paymentCurrencyNote(currency: DisplayCurrency): string | null {
  if (currency === "XOF") return null;
  const paiement = "Le paiement se fait en F CFA, par Mobile Money.";
  return currency === "USD" ? `Prix en dollars indicatif. ${paiement}` : paiement;
}

/**
 * Parité FIXE du franc CFA : 1 € = 655,957 FCFA, garantie par le Trésor
 * français. Exprimée en millièmes pour rester entière.
 */
const FCFA_PER_EUR_MILLI = 655_957;

/**
 * Taux INDICATIF : le dollar flotte face à l'euro, donc face au franc CFA.
 * Le prix en dollars est toujours présenté comme une approximation (« ≈ »).
 */
export const FCFA_PER_USD = 560;

/** Montant FCFA → centimes de la devise d'affichage, arrondi à l'entier. */
export function toDisplayCents(amountFcfa: number, currency: "EUR" | "USD"): number {
  assertAmount(amountFcfa);
  return currency === "EUR"
    ? divideRound(amountFcfa * 100_000, FCFA_PER_EUR_MILLI)
    : divideRound(amountFcfa * 100, FCFA_PER_USD);
}

/** « 3,05 » — centimes entiers mis en forme sans passer par un flottant. */
function formatCents(cents: number): string {
  const units = (cents - (cents % 100)) / 100;
  const rest = String(cents % 100).padStart(2, "0");
  return `${new Intl.NumberFormat("fr-FR").format(units)},${rest}`;
}

export type DisplayPrice = {
  /** Le nombre seul, prêt à être mis en valeur : « 2 000 », « 3,05 ». */
  amount: string;
  /** Le sigle, affiché plus petit : « F CFA », « € », « $ ». */
  symbol: string;
  /** Vrai quand le taux n'est pas fixe : l'affichage le dit. */
  approximate: boolean;
};

export function displayPrice(amountFcfa: number, currency: DisplayCurrency): DisplayPrice {
  if (currency === "XOF") {
    return {
      amount: formatAmount(amountFcfa, "XOF", { withSymbol: false }),
      symbol: "F CFA",
      approximate: false,
    };
  }
  return {
    amount: formatCents(toDisplayCents(amountFcfa, currency)),
    symbol: currency === "EUR" ? "€" : "$",
    approximate: currency === "USD",
  };
}
