import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : libellé à gauche, icône encadrée à droite, chiffre en
 * héros, contexte dessous.
 *
 * `tone="critical"` colore la VALEUR, pas l'icône : c'est le montant en retard
 * qui doit sauter aux yeux. La couleur ne porte jamais l'information seule — le
 * libellé « En retard » et la ligne de contexte la disent aussi.
 */
export function StatCard({
  label,
  value,
  context,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  context?: string;
  icon: LucideIcon;
  tone?: "neutral" | "critical";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </div>

      <p
        className={cn(
          "tabular mt-4 text-2xl font-bold tracking-tight",
          tone === "critical" && "text-destructive",
        )}
      >
        {value}
      </p>

      {context ? <p className="mt-1.5 text-xs text-muted-foreground">{context}</p> : null}
    </Card>
  );
}
