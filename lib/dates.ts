/**
 * Dates calendaires. Une date de facture est un jour, pas un instant : on la
 * manipule en `YYYY-MM-DD` et on n'y applique jamais de conversion de fuseau,
 * sans quoi une facture émise à Dakar le 31 peut s'afficher le 30 ailleurs.
 */

import type { IsoDate } from "@/lib/domain/types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertIsoDate(value: unknown, label = "date"): IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError(`${label} invalide : ${String(value)} (format YYYY-MM-DD attendu)`);
  }
  return value;
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function toIsoDate(date: Date): IsoDate {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse en UTC pour que l'arithmétique de jours reste exempte d'heure d'été. */
function parseIso(value: IsoDate): Date {
  assertIsoDate(value);
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): IsoDate {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const parsed = parseIso(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return fromUtc(parsed);
}

/**
 * Ajoute des mois en bornant au dernier jour du mois d'arrivée.
 * 31 janvier + 1 mois → 28 (ou 29) février, et non 3 mars.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const parsed = parseIso(date);
  const day = parsed.getUTCDate();
  parsed.setUTCDate(1);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  const lastDayOfMonth = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0),
  ).getUTCDate();
  parsed.setUTCDate(Math.min(day, lastDayOfMonth));
  return fromUtc(parsed);
}

/** Différence en jours entiers (`b - a`). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const millisecondsPerDay = 86_400_000;
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / millisecondsPerDay);
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return parseIso(a).getTime() < parseIso(b).getTime();
}

/** Date d'échéance à partir de la date d'émission et d'un délai en jours. */
export function computeDueDate(issueDate: IsoDate, paymentTermsInDays: number): IsoDate {
  if (!Number.isInteger(paymentTermsInDays) || paymentTermsInDays < 0) {
    throw new RangeError(`délai de paiement invalide : ${paymentTermsInDays}`);
  }
  return addDays(issueDate, paymentTermsInDays);
}

/** Nombre de jours de retard (0 si la facture n'est pas échue). */
export function daysOverdue(dueDate: IsoDate, reference: IsoDate = todayIso()): number {
  return Math.max(0, daysBetween(dueDate, reference));
}

/** Format court pour les tableaux : « 12/03/2026 ». */
export function formatDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIso(date));
}

export function formatDateLong(date: IsoDate): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIso(date));
}
