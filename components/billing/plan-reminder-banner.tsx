import Link from "next/link";
import { Clock } from "lucide-react";

import { formatDateLong, toIsoDate } from "@/lib/dates";
import type { PlanReminder } from "@/lib/plan";

/**
 * Bandeau qui prévient, quelques jours AVANT l'échéance, que l'essai ou le
 * premium va s'arrêter. Il se place sous l'en-tête, sur toutes les pages : on ne
 * peut pas le manquer, mais il ne bloque rien et ne s'ouvre pas par-dessus le
 * travail en cours.
 */
export function PlanReminderBanner({ reminder }: { reminder: PlanReminder }) {
  const jours = `${reminder.daysLeft} jour${reminder.daysLeft > 1 ? "s" : ""}`;
  const date = formatDateLong(toIsoDate(reminder.endsAt));
  const message =
    reminder.kind === "premium"
      ? `Votre Premium se termine dans ${jours}, le ${date}.`
      : `Votre essai gratuit se termine dans ${jours}, le ${date}.`;

  return (
    <div className="border-b border-border bg-status-partial-bg print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm sm:px-6">
        <Clock className="size-4 shrink-0 text-status-partial" aria-hidden />
        <p className="font-medium text-foreground">{message}</p>
        <Link
          href="/abonnement?payer=1"
          className="rounded-md font-semibold text-status-partial underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {reminder.kind === "premium" ? "Renouveler" : "Choisir mon abonnement"}
        </Link>
      </div>
    </div>
  );
}
