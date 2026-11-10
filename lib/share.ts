import { MOBILE_MONEY_COUNTRIES, normalizePhoneDigits } from "@/lib/billing";
import { formatAmount, type Currency } from "@/lib/money";
import type { DocumentType } from "@/lib/domain/types";

/**
 * Envoi d'un document au client par WhatsApp : numéro, messages, lien.
 *
 * Logique pure : la page calcule les liens côté serveur, le bouton se contente
 * de les ouvrir. Rien n'est envoyé par l'application elle-même — WhatsApp
 * s'ouvre avec le message prêt, et c'est le commerçant qui appuie sur Envoyer.
 */

const sansAccents = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** « Niger », « niger » ou « NE » → le pays connu, sinon `undefined`. */
function paysDe(country: string | null | undefined) {
  if (!country) return undefined;
  const cle = sansAccents(country);
  return MOBILE_MONEY_COUNTRIES.find(
    (pays) => pays.code.toLowerCase() === cle || sansAccents(pays.name) === cle,
  );
}

/**
 * Numéro au format attendu par `wa.me` : chiffres seuls, indicatif compris.
 *
 * Un numéro saisi « à la locale » (« 90 12 34 56 ») reçoit l'indicatif du pays
 * — celui du client, sinon celui de la boutique. Un numéro qu'on ne sait pas
 * compléter sans deviner renvoie `null` : WhatsApp s'ouvrira alors sur le choix
 * du contact, plutôt que sur un inconnu.
 */
export function whatsappPhone(
  raw: string | null | undefined,
  ...countries: (string | null | undefined)[]
): string | null {
  if (!raw) return null;
  const international = /^\s*(\+|00)/.test(raw);
  let chiffres = normalizePhoneDigits(raw);
  if (international) return chiffres.replace(/^00/, "") || null;

  for (const pays of countries.map(paysDe)) {
    if (!pays) continue;
    if (chiffres.length === pays.digits) return `${pays.dialCode}${chiffres}`;
    if (chiffres.startsWith(pays.dialCode) && chiffres.length === pays.dialCode.length + pays.digits) {
      return chiffres;
    }
  }
  chiffres = chiffres.replace(/^0+/, "");
  return chiffres.length >= 11 ? chiffres : null;
}

export function whatsappUrl(phone: string | null, text: string): string {
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}

const NOMS: Record<DocumentType, string> = {
  invoice: "votre facture",
  quote: "votre devis",
  credit_note: "votre avoir",
};

export type ShareDocument = {
  type: DocumentType;
  number: string;
  total: number;
  remaining: number;
  currency: Currency;
  clientName: string | null;
  issuerName: string;
  url: string;
};

const bonjour = (nom: string | null) => (nom ? `Bonjour ${nom},` : "Bonjour,");

/** Le message d'envoi du document. */
export function shareMessage(doc: ShareDocument): string {
  return [
    bonjour(doc.clientName),
    `voici ${NOMS[doc.type]} ${doc.number} d'un montant de ${formatAmount(doc.total, doc.currency)} :`,
    doc.url,
    "",
    `Merci pour votre confiance.`,
    doc.issuerName,
  ].join("\n");
}

/** La relance d'une facture qui n'est pas entièrement réglée. */
export function reminderMessage(doc: ShareDocument & { overdue: boolean }): string {
  return [
    bonjour(doc.clientName),
    doc.overdue
      ? `sauf erreur de notre part, la facture ${doc.number} est arrivée à échéance.`
      : `petit rappel concernant la facture ${doc.number}.`,
    `Reste à régler : ${formatAmount(doc.remaining, doc.currency)}.`,
    `Vous pouvez la consulter ici : ${doc.url}`,
    "",
    "Si le paiement a déjà été fait, merci de ne pas tenir compte de ce message.",
    doc.issuerName,
  ].join("\n");
}

/** Adresse publique du document : le PDF, lisible sans compte. */
export function publicDocumentUrl(base: string, token: string): string {
  return `${base}/f/${token}`;
}
