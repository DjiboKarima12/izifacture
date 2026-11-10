import "server-only";

import type { ReminderEmail } from "@/lib/email/reminders";

/**
 * Envoi par l'API HTTP de Resend — un `fetch`, sans SDK de plus.
 *
 * `EMAIL_FROM` doit appartenir à un domaine VÉRIFIÉ dans Resend
 * (ex. « MaMaFacture <facture@barketechnologie.com> ») ; sinon Resend refuse.
 * `EMAIL_REPLY_TO`, facultative, reçoit les réponses des clients.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(email: ReminderEmail): Promise<void> {
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }),
  });
  if (!reponse.ok) {
    throw new Error(`Resend ${reponse.status} : ${await reponse.text()}`);
  }
}
