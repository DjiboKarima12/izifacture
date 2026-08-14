/**
 * Numérotation des documents.
 *
 * Le compteur lui-même vit dans Postgres (`invoice_counters` + fonction
 * `next_document_number`, verrou de ligne) : c'est le seul endroit où la
 * séquence peut être incrémentée sans trou ni doublon sous concurrence.
 * Ce module ne fait que le FORMATAGE, partagé entre serveur, PDF et aperçu UI.
 *
 * Le numéro est attribué à l'ÉMISSION, pas à la création : un brouillon
 * abandonné ne doit pas consommer un numéro et laisser un trou dans la séquence
 * — ce qui serait relevé au premier contrôle fiscal.
 */

import type { DocumentType, Organization } from "@/lib/domain/types";

export const DEFAULT_PREFIXES: Record<DocumentType, string> = {
  invoice: "FAC",
  quote: "DEV",
  credit_note: "AV",
};

const SEQUENCE_PADDING = 4;

export function prefixFor(organization: Organization, type: DocumentType): string {
  const configured = {
    invoice: organization.invoicePrefix,
    quote: organization.quotePrefix,
    credit_note: organization.creditNotePrefix,
  }[type];

  return normalisePrefix(configured) || DEFAULT_PREFIXES[type];
}

/** Majuscules, lettres/chiffres/tirets uniquement, 8 caractères max. */
export function normalisePrefix(prefix: string | null | undefined): string {
  if (!prefix) return "";
  return prefix
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

/** `FAC-2026-0001` */
export function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new RangeError(`année invalide : ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`séquence invalide : ${sequence}`);
  }

  const safePrefix = normalisePrefix(prefix) || DEFAULT_PREFIXES.invoice;
  return `${safePrefix}-${year}-${String(sequence).padStart(SEQUENCE_PADDING, "0")}`;
}

export type ParsedDocumentNumber = {
  prefix: string;
  year: number;
  sequence: number;
};

export function parseDocumentNumber(value: string): ParsedDocumentNumber | null {
  const match = /^([A-Z0-9-]+)-(\d{4})-(\d+)$/.exec(value.trim().toUpperCase());
  if (!match) return null;

  const [, prefix, year, sequence] = match as unknown as [string, string, string, string];
  return {
    prefix,
    year: Number(year),
    sequence: Number(sequence),
  };
}

/** Prochain numéro à afficher en aperçu. Purement indicatif : seule la base fait foi. */
export function previewNextNumber(
  organization: Organization,
  type: DocumentType,
  lastSequence: number,
  year: number = new Date().getFullYear(),
): string {
  return formatDocumentNumber(prefixFor(organization, type), year, lastSequence + 1);
}
