import { formatDateLong, toIsoDate } from "@/lib/dates";
import {
  FREE_MONTHLY_QUOTA,
  planOf,
  planReminder,
  PREMIUM_REMINDER_DAYS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
  trialState,
} from "@/lib/plan";
import type { ReminderTarget } from "@/lib/data/repository";

/**
 * Emails de cycle de vie : bienvenue, approche de la fin, fin.
 *
 * UN SEUL EMAIL par moment : la tâche tourne une fois par jour, et chaque
 * moment n'est vrai qu'un seul de ces jours — « il reste exactement 5 jours »,
 * « c'est fini depuis moins de 24 h ». Pas de table d'envois à tenir : le
 * calendrier suffit à ne jamais écrire deux fois.
 *
 * Volontairement peu nombreux. Essai : bienvenue, J-3, fin. Premium : J-5,
 * veille, fin. Au-delà, on lasse — et un commerçant lassé désactive les emails
 * qui comptent.
 */

export type ReminderKind =
  | "welcome"
  | "trial-soon"
  | "trial-ended"
  | "premium-soon"
  | "premium-last"
  | "premium-ended";

export type DueReminder = { kind: ReminderKind; daysLeft: number; endsAt: Date };

export type ReminderEmail = { to: string; subject: string; html: string; text: string };

const DAY_MS = 86_400_000;

/** `instant` est-il tombé dans les dernières 24 h — la période d'un passage du cron ? */
const depuisHier = (instant: number, now: Date) =>
  instant <= now.getTime() && instant > now.getTime() - DAY_MS;

export function dueReminder(target: ReminderTarget, now: Date = new Date()): DueReminder | null {
  const trial = trialState(target.orgCreatedAt, now);

  // Inscrit depuis moins de 24 h : la bienvenue, et rien d'autre ce jour-là.
  if (depuisHier(Date.parse(target.orgCreatedAt), now)) {
    return { kind: "welcome", daysLeft: trial.daysLeft, endsAt: trial.endsAt };
  }

  const plan = planOf(target.subscription, now);
  const finPremium = target.subscription.currentPeriodEnd
    ? Date.parse(target.subscription.currentPeriodEnd)
    : null;

  // Le Premium vient d'expirer : planOf() le voit déjà gratuit, d'où le test
  // sur le plan BRUT, avant tout le reste.
  if (plan === "free" && target.subscription.plan === "premium" && finPremium !== null && depuisHier(finPremium, now)) {
    return { kind: "premium-ended", daysLeft: 0, endsAt: new Date(finPremium) };
  }
  if (plan === "free" && target.subscription.plan !== "premium" && depuisHier(trial.endsAt.getTime(), now)) {
    return { kind: "trial-ended", daysLeft: 0, endsAt: trial.endsAt };
  }

  const reminder = planReminder(target.subscription, target.orgCreatedAt, now);
  if (!reminder) return null;
  if (reminder.kind === "premium") {
    if (reminder.daysLeft === PREMIUM_REMINDER_DAYS) return { ...reminder, kind: "premium-soon" };
    if (reminder.daysLeft === 1) return { ...reminder, kind: "premium-last" };
    return null;
  }
  return reminder.daysLeft === TRIAL_REMINDER_DAYS ? { ...reminder, kind: "trial-soon" } : null;
}

const echapper = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Contenu = { subject: string; corps: string[]; bouton: string; chemin: string };

function contenu(target: ReminderTarget, reminder: DueReminder): Contenu {
  const boutique = target.orgName;
  const date = formatDateLong(toIsoDate(reminder.endsAt));
  const jours = `${reminder.daysLeft} jour${reminder.daysLeft > 1 ? "s" : ""}`;
  const payer = "/abonnement?payer=1";

  switch (reminder.kind) {
    case "welcome":
      return {
        subject: "Bienvenue sur MaMaFacture",
        corps: [
          `${boutique} est prête. Votre essai gratuit de ${TRIAL_DAYS} jours court jusqu'au ${date}, avec jusqu'à ${FREE_MONTHLY_QUOTA} factures.`,
          "Pour bien démarrer : ajoutez vos produits, puis créez votre première facture. Vous pouvez l'imprimer en ticket ou l'envoyer au client par WhatsApp.",
        ],
        bouton: "Créer ma première facture",
        chemin: "/invoices/new",
      };
    case "trial-soon":
      return {
        subject: `Votre essai MaMaFacture se termine dans ${jours}`,
        corps: [
          `L'essai gratuit de ${boutique} se termine le ${date}.`,
          "Passez au Premium pour continuer à émettre vos factures : vos clients et documents sont conservés.",
        ],
        bouton: "Choisir mon abonnement",
        chemin: payer,
      };
    case "trial-ended":
      return {
        subject: "Votre essai MaMaFacture est terminé",
        corps: [
          `L'essai gratuit de ${boutique} s'est terminé le ${date}. L'émission de factures est suspendue.`,
          "Rien n'est perdu : vos clients, factures et encaissements vous attendent. Passez au Premium pour reprendre là où vous en étiez.",
        ],
        bouton: "Passer au Premium",
        chemin: payer,
      };
    case "premium-soon":
      return {
        subject: `Votre Premium MaMaFacture se termine dans ${jours}`,
        corps: [
          `Le Premium de ${boutique} se termine le ${date}.`,
          "Renouvelez-le pour continuer à émettre vos factures sans interruption.",
        ],
        bouton: "Renouveler mon abonnement",
        chemin: payer,
      };
    case "premium-last":
      return {
        subject: "Votre Premium MaMaFacture se termine demain",
        corps: [
          `Dernier rappel : le Premium de ${boutique} se termine le ${date}.`,
          "Sans renouvellement, l'émission de factures sera suspendue. Le paiement par Mobile Money prend deux minutes.",
        ],
        bouton: "Renouveler maintenant",
        chemin: payer,
      };
    case "premium-ended":
      return {
        subject: "Votre Premium MaMaFacture a expiré",
        corps: [
          `Le Premium de ${boutique} a pris fin le ${date}. L'émission de factures est suspendue.`,
          "Vos données sont conservées. Renouvelez pour reprendre immédiatement.",
        ],
        bouton: "Renouveler mon abonnement",
        chemin: payer,
      };
  }
}

export function reminderEmail(
  target: ReminderTarget,
  reminder: DueReminder,
  siteUrl: string,
): ReminderEmail {
  const { subject, corps, bouton, chemin } = contenu(target, reminder);
  const lien = `${siteUrl}${chemin}`;
  const salut = target.ownerName ? `Bonjour ${target.ownerName},` : "Bonjour,";

  const text = [salut, "", ...corps, "", `${bouton} : ${lien}`, "", "L'équipe MaMaFacture"].join("\n");

  const paragraphes = corps
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${echapper(p)}</p>`)
    .join("\n");

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
${paragraphes}
<a href="${lien}" style="display:inline-block;margin-top:12px;background:#D99C3F;color:#2A2118;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px">${bouton}</a>
<p style="margin:24px 0 0;font-size:13px;color:#7A6D5E;line-height:1.5">Paiement par Mobile Money. Une question ? Répondez simplement à cet email.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { to: target.ownerEmail, subject, html, text };
}
