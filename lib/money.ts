/**
 * Arithmétique monétaire — aucune valeur flottante ne doit franchir ce module.
 *
 * Règles du projet :
 *  - Tous les montants sont des ENTIERS en unités mineures.
 *  - XOF et XAF (franc CFA) ont 0 décimale : 1 unité = 1 franc. Pas de centimes.
 *  - Aucun `parseFloat` / `toFixed` sur un montant ailleurs dans le code.
 *  - Les arrondis passent tous par `divideRound` (moitié à l'écart de zéro),
 *    pour que les avoirs (montants négatifs) soient symétriques des factures.
 */

export const CURRENCIES = ["XOF", "XAF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Nombre de décimales par devise. Le franc CFA n'en a aucune. */
export const CURRENCY_DECIMALS: Record<Currency, number> = {
  XOF: 0,
  XAF: 0,
};

export const DEFAULT_CURRENCY: Currency = "XOF";

/**
 * Borne haute volontairement plus basse que Number.MAX_SAFE_INTEGER : elle laisse
 * la marge nécessaire aux produits intermédiaires (montant × taux en points de
 * base) sans jamais quitter la plage des entiers exacts.
 */
export const MAX_AMOUNT = 1_000_000_000_000; // 1 000 milliards FCFA
export const MIN_AMOUNT = -MAX_AMOUNT;

export function isValidAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_AMOUNT &&
    value <= MAX_AMOUNT
  );
}

export function assertAmount(value: unknown, label = "montant"): number {
  if (!isValidAmount(value)) {
    throw new RangeError(`${label} invalide : ${String(value)} (entier attendu, hors bornes ou NaN)`);
  }
  return value;
}

/**
 * Division entière arrondie à la moitié à l'écart de zéro.
 * 5/2 → 3, -5/2 → -3 (Math.round donnerait -2, ce qui casse la symétrie des avoirs).
 */
export function divideRound(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new RangeError("divideRound: opérandes non finis");
  }
  if (denominator === 0) {
    throw new RangeError("divideRound: division par zéro");
  }
  if (!Number.isSafeInteger(numerator)) {
    throw new RangeError(`divideRound: numérateur hors plage entière exacte (${numerator})`);
  }

  const sign = Math.sign(numerator) * Math.sign(denominator);
  const absNum = Math.abs(numerator);
  const absDen = Math.abs(denominator);
  const quotient = Math.floor(absNum / absDen);
  const remainder = absNum - quotient * absDen;
  // `remainder * 2 >= absDen` : la moitié pile bascule vers le haut.
  const rounded = remainder * 2 >= absDen ? quotient + 1 : quotient;

  // `rounded !== 0` évite de renvoyer -0, qui s'afficherait « -0 FCFA » et
  // ferait échouer toute comparaison stricte avec 0.
  return sign < 0 && rounded !== 0 ? -rounded : rounded;
}

/** Applique un pourcentage exprimé en points de base (18% → 1800 bp). */
export function applyBasisPoints(amount: number, basisPoints: number): number {
  assertAmount(amount);
  if (!Number.isInteger(basisPoints)) {
    throw new RangeError(`points de base non entiers : ${basisPoints}`);
  }
  return divideRound(amount * basisPoints, 10_000);
}

/** Convertit un taux en pourcentage (18, 18.5) en points de base entiers. */
export function toBasisPoints(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new RangeError(`taux non fini : ${percent}`);
  }
  return Math.round(percent * 100);
}

export function sumAmounts(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += assertAmount(amount);
  }
  return assertAmount(total, "somme");
}

/**
 * Formate un montant pour affichage : « 1 250 000 F CFA ».
 * XOF comme XAF s'affichent « F CFA » : on fixe le sigle plutôt que de laisser
 * Intl décider, car il rend « F CFA » pour XOF mais « FCFA » pour XAF — deux
 * graphies différentes pour la même monnaie à l'écran.
 */
export function formatAmount(
  amount: number,
  currency: Currency = DEFAULT_CURRENCY,
  options: { withSymbol?: boolean } = {},
): string {
  assertAmount(amount);
  const { withSymbol = true } = options;
  const decimals = CURRENCY_DECIMALS[currency];

  const value = decimals === 0 ? amount : amount / 10 ** decimals;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return withSymbol ? `${formatted} F CFA` : formatted;
}

/**
 * Format compact pour les axes de graphique : « 1,2 M », « 850 k ».
 * Les montants en FCFA atteignent vite 7 chiffres, illisibles sur un axe.
 */
export function formatAmountCompact(amount: number): string {
  assertAmount(amount);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  const format = (value: number, suffix: string) => {
    const rounded = Math.round(value * 10) / 10;
    const text = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(rounded);
    return `${sign}${text}${suffix}`;
  };

  if (abs >= 1_000_000_000) return format(abs / 1_000_000_000, " Md");
  if (abs >= 1_000_000) return format(abs / 1_000_000, " M");
  if (abs >= 1_000) return format(abs / 1_000, " k");
  return `${sign}${abs}`;
}

/** Formate une quantité (jusqu'à 3 décimales, sans zéros inutiles). */
export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(quantity);
}

/**
 * Convertit une saisie utilisateur en montant entier.
 * Tolère les espaces (y compris insécables), le point et la virgule décimale.
 * Renvoie `null` si la saisie n'est pas un nombre exploitable.
 */
export function parseAmountInput(
  input: string,
  currency: Currency = DEFAULT_CURRENCY,
): number | null {
  const cleaned = input
    .replace(/[\s  ]/g, "")
    .replace(/FCFA|XOF|XAF/gi, "")
    .trim();

  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;

  const normalised = normaliseDecimalSeparators(cleaned);
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null;

  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return null;

  const decimals = CURRENCY_DECIMALS[currency];
  const scaled = Math.round(parsed * 10 ** decimals);

  return isValidAmount(scaled) ? scaled : null;
}

/**
 * Lève l'ambiguïté « . et , sont-ils décimaux ou séparateurs de milliers ? ».
 *
 * Un groupe de milliers compte toujours exactement 3 chiffres. Donc :
 *  - dernier séparateur suivi de 1 ou 2 chiffres  → c'est un séparateur décimal ;
 *  - tout autre cas (3 chiffres, ou rien)         → ce sont des milliers, on les retire.
 *
 * « 1.250.000 » → 1250000, « 1 250 000 » → 1250000, « 1250,75 » → 1250.75.
 * En FCFA (0 décimale) la partie décimale finit de toute façon arrondie — mais on
 * ne veut pas transformer silencieusement 1250,75 en 125075.
 */
function normaliseDecimalSeparators(value: string): string {
  const lastSeparator = Math.max(value.lastIndexOf(","), value.lastIndexOf("."));
  if (lastSeparator === -1) return value;

  const fractionPart = value.slice(lastSeparator + 1);
  const stripped = value.replace(/[.,]/g, "");

  if (fractionPart.length === 1 || fractionPart.length === 2) {
    const integerPart = value.slice(0, lastSeparator).replace(/[.,]/g, "");
    return `${integerPart}.${fractionPart}`;
  }

  return stripped;
}
