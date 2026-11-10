import { formatDateLong, toIsoDate } from "@/lib/dates";
import {
  planReminder,
  PREMIUM_REMINDER_DAYS,
  TRIAL_REMINDER_DAYS,
  type PlanReminder,
} from "@/lib/plan";
import type { ReminderTarget } from "@/lib/data/repository";

/**
 * Rappels par email avant la fin de l'essai ou du Premium.
 *
 * UN SEUL EMAIL par échéance : la tâche tourne une fois par jour, et l'on
 * n'écrit que le jour où il reste EXACTEMENT 5 jours (Premium) ou 3 jours
 * (essai) — les mêmes seuils que le bandeau de l'application. Pas de table
 * d'envois à tenir : le calendrier suffit à ne jamais écrire deux fois.
 */

export type ReminderEmail = { to: string; subject: string; html: string; text: string };

export function dueReminder(target: ReminderTarget, now: Date = new Date()): PlanReminder | null {
  const reminder = planReminder(target.subscription, target.orgCreatedAt, now);
  if (!reminder) return null;
  const seuil = reminder.kind === "premium" ? PREMIUM_REMINDER_DAYS : TRIAL_REMINDER_DAYS;
  return reminder.daysLeft === seuil ? reminder : null;
}

const echapper = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reminderEmail(
  target: ReminderTarget,
  reminder: PlanReminder,
  siteUrl: string,
): ReminderEmail {
  const premium = reminder.kind === "premium";
  const jours = `${reminder.daysLeft} jour${reminder.daysLeft > 1 ? "s" : ""}`;
  const date = formatDateLong(toIsoDate(reminder.endsAt));
  const lien = `${siteUrl}/abonnement?payer=1`;
  const salut = target.ownerName ? `Bonjour ${target.ownerName},` : "Bonjour,";

  const subject = premium
    ? `Votre Premium MaMaFacture se termine dans ${jours}`
    : `Votre essai MaMaFacture se termine dans ${jours}`;
  const corps = premium
    ? `Le Premium de ${target.orgName} se termine le ${date}. Renouvelez-le pour continuer à émettre vos factures sans interruption.`
    : `L'essai gratuit de ${target.orgName} se termine le ${date}. Passez au Premium pour continuer à émettre vos factures : vos clients et documents sont conservés.`;
  const bouton = premium ? "Renouveler mon abonnement" : "Choisir mon abonnement";

  const text = [salut, "", corps, "", `${bouton} : ${lien}`, "", "L'équipe MaMaFacture"].join("\n");

  // Styles en ligne : la plupart des messageries ignorent les feuilles de
  // style. Couleurs de la vitrine (brun, or) — un email ne lit pas les jetons.
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3EEE6;font-family:Arial,sans-serif;color:#2A2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF9;border:1px solid #E4DCCF;border-radius:12px;overflow:hidden">
<tr><td style="background:#2A2118;padding:22px 28px">
<span style="display:inline-block;background:#D99C3F;color:#2A2118;font-weight:800;padding:6px 9px;border-radius:6px">MF</span>
<span style="color:#FDF6EA;font-weight:700;font-size:17px;margin-left:8px;vertical-align:middle">MaMaFacture</span>
</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 14px;font-size:20px;font-weight:700">${echapper(subject)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${echapper(salut)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${echapper(corps)}</p>
<a href="${lien}" style="display:inline-block;background:#D99C3F;color:#2A2118;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px">${bouton}</a>
<p style="margin:24px 0 0;font-size:13px;color:#7A6D5E;line-height:1.5">Paiement par Mobile Money. Une question ? Répondez simplement à cet email.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { to: target.ownerEmail, subject, html, text };
}
