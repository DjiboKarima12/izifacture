import type { PaymentMethod } from "@/lib/domain/types";
import { amountDue } from "@/lib/tax";

/**
 * État de règlement d'une facture.
 *
 * Logique pure : elle reçoit un total et un encaissé, elle répond. Deux
 * appelants la partagent — l'aperçu à l'écran et le générateur de PDF — et
 * c'est précisément le but : le ticket affiché et le ticket téléchargé ne
 * peuvent pas annoncer deux états différents.
 *
 * L'état n'est PAS lu depuis `invoices.status`. Le statut porte aussi
 * `draft`, `sent` et `cancelled`, qui ne disent rien du règlement, et il peut
 * être piloté à la main depuis « Changer statut ». Ce qui fait foi sur un reçu,
 * c'est l'argent réellement encaissé.
 */

/**
 * Libellés des moyens de paiement, en un seul endroit.
 *
 * Ils s'impriment sur le ticket ET s'affichent dans l'application : deux tables
 * séparées finissaient par diverger, ce qui était déjà le cas — « Virement » ici,
 * « Virement bancaire » là.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  my_nita: "MyNita",
  amanata: "Amanata",
  wave: "Wave",
  airtel_money: "Airtel Money",
  other: "Autre",
};

export type PaymentState = "unpaid" | "partial" | "paid";

/** Ce qui s'imprime en toutes lettres au bas du ticket. */
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Non payée",
  partial: "Partiellement payée",
  paid: "Payée",
};

export type PaymentSummary = {
  state: PaymentState;
  label: string;
  paid: number;
  /** Borné à zéro : un trop-perçu ne crée pas un dû négatif. */
  remaining: number;
};

export function paymentSummary(total: number, amountPaid: number): PaymentSummary {
  const paid = Math.max(0, amountPaid);
  const remaining = amountDue(total, paid);

  /**
   * L'ordre des tests compte. « Soldée » se décide sur le RESTE, pas sur une
   * comparaison `paid >= total` : un trop-perçu doit donner « payée », et une
   * facture à zéro ne doit pas passer pour partiellement réglée.
   */
  const state: PaymentState = remaining === 0 ? "paid" : paid > 0 ? "partial" : "unpaid";

  return { state, label: PAYMENT_STATE_LABELS[state], paid, remaining };
}

/**
 * Monnaie rendue sur un encaissement en espèces.
 *
 * `null` quand la question ne se pose pas : rien de tendu (virement, carte,
 * mobile money), ou un montant remis qui n'excède pas ce qui a été encaissé.
 * Zéro n'est PAS null — « le client a donné le compte juste » est une
 * information, et elle mérite de s'imprimer.
 *
 * Jamais négative : la base l'interdit déjà (`tendered >= amount`), mais un
 * ticket ne doit pas pouvoir afficher une monnaie négative parce qu'une donnée
 * ancienne aurait échappé à la contrainte.
 */
export function changeGiven(amount: number, tendered: number | null | undefined): number | null {
  if (tendered == null) return null;
  return Math.max(0, tendered - amount);
}

/**
 * Le bloc de règlement a-t-il un sens sur ce document ?
 *
 * Non sur un devis ni sur un avoir : ni l'un ni l'autre n'appelle de paiement,
 * et « NON PAYÉE » sur un devis serait un contresens.
 *
 * Non non plus sur un total nul — un brouillon vide n'est ni payé ni impayé, et
 * l'annoncer « payée » parce qu'il ne reste rien à devoir serait mensonger. Le
 * cas se produit en permanence : c'est l'état de l'aperçu tant qu'aucune ligne
 * n'est saisie.
 */
export function showsSettlement(documentType: string, total: number): boolean {
  return documentType === "invoice" && total > 0;
}

export type CounterSettlement = {
  /** Ce qui est réellement encaissé, borné au total : on n'encaisse pas plus que dû. */
  amount: number;
  /** Billet tendu à stocker. `null` sauf s'il y a un excédent à rendre. */
  tendered: number | null;
  /** Monnaie à rendre. Toujours zéro hors espèces — un virement ne rend rien. */
  change: number;
  /** Reste à payer APRÈS cet encaissement. */
  remaining: number;
};

/**
 * Encaissement au comptoir, à partir du seul chiffre que l'on connaît vraiment :
 * ce que le client a donné.
 *
 * TOUT EN DÉCOULE, et c'est le point. Donner moins que le total n'est pas une
 * erreur de saisie mais un ACOMPTE : le client règle ce qu'il a, repart avec un
 * reçu qui porte le reste dû, et complète plus tard. Traiter ce cas comme une
 * faute — ce que faisait la première version — interdisait la moitié des ventes
 * réelles.
 *
 * `received` à `null` signifie « le compte juste » : c'est le cas courant, et il
 * ne mérite pas qu'on retape le total.
 *
 * `tendered` n'est renseigné que s'il y a un excédent à rendre. Sans excédent,
 * le montant tendu et le montant encaissé sont le même chiffre, et le stocker
 * deux fois créerait deux vérités à maintenir.
 */
export function settleAtCounter(
  total: number,
  method: PaymentMethod,
  received: number | null | undefined,
): CounterSettlement {
  const handed = Math.max(0, received ?? total);
  const amount = Math.min(handed, total);

  // Seules les espèces rendent la monnaie. Un virement excédentaire n'est pas
  // une monnaie à rendre : c'est un trop-perçu, qui se règle hors du comptoir.
  const change = method === "cash" ? Math.max(0, handed - total) : 0;

  return {
    amount,
    tendered: change > 0 ? handed : null,
    change,
    remaining: Math.max(0, total - amount),
  };
}
