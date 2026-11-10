import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { repositories } from "@/lib/data";
import { dueReminder, reminderEmail } from "@/lib/email/reminders";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Rappels par email, appelés une fois par jour par le cron du VPS :
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/reminders
 *
 * `?essai=1` : liste ce qui PARTIRAIT aujourd'hui, sans rien envoyer.
 *
 * Le secret est comparé en temps constant ; absent de l'environnement, la
 * route reste fermée plutôt qu'ouverte à tous.
 */
function autorise(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const recu = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || recu.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!autorise(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const essai = new URL(request.url).searchParams.get("essai") === "1";
  if (!essai && !emailConfigured()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY et EMAIL_FROM sont requises." },
      { status: 500 },
    );
  }

  const now = new Date();
  const envois: Array<{ org: string; kind: string; to: string; ok: boolean; error?: string }> = [];

  for (const target of await repositories.organizations.listForReminders()) {
    const reminder = dueReminder(target, now);
    if (!reminder) continue;
    const email = reminderEmail(target, reminder, siteUrl());
    if (essai) {
      envois.push({ org: target.orgName, kind: reminder.kind, to: email.to, ok: true });
      continue;
    }
    // Un échec n'arrête pas les autres : chaque boutique est prévenue
    // indépendamment, et l'échec est rapporté dans le journal du cron.
    try {
      await sendEmail(email);
      envois.push({ org: target.orgName, kind: reminder.kind, to: email.to, ok: true });
    } catch (error) {
      envois.push({
        org: target.orgName,
        kind: reminder.kind,
        to: email.to,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ date: now.toISOString(), essai, envois });
}
