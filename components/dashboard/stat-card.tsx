import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Teinte de la pastille d'icône, une par indicateur.
 *
 * Reprend les couleurs DE STATUT plutôt qu'une palette inventée : le vert est
 * déjà celui de « payée », l'ambre celui de « partiellement payée », le rouge
 * celui de « en retard ». Quatre tuiles apprennent ainsi le code couleur que
 * l'utilisateur retrouvera ensuite sur chaque ligne de facture.
 *
 * La maquette posait un liseré coloré en haut de chaque carte. Le système s'y
 * oppose — bordures de 1 px, jamais de couleur de statut (règle 3) — et la
 * règle a raison : un liseré épais et teinté à quatre endroits transforme la
 * grille en arc-en-ciel, et la couleur cesse de signifier quoi que ce soit.
 * La pastille porte la teinte sans toucher à la structure.
 */
const ACCENTS = {
  none: "bg-secondary text-muted-foreground",
  paid: "bg-status-paid-bg text-status-paid",
  pending: "bg-status-partial-bg text-status-partial",
  overdue: "bg-status-overdue-bg text-status-overdue",
  info: "bg-status-sent-bg text-status-sent",
} as const;

/**
 * Tuile de statistique : libellé à gauche, icône en pastille teintée à droite,
 * chiffre en héros, contexte dessous.
 *
 * `tone="critical"` colore la VALEUR, pas seulement la pastille : c'est le
 * montant en retard qui doit sauter aux yeux. La couleur ne porte jamais
 * l'information seule — le libellé « En retard » et la ligne de contexte la
 * disent aussi, pour qui ne distingue pas les teintes.
 */
export function StatCard({
  label,
  value,
  context,
  icon: Icon,
  tone = "neutral",
  accent = "none",
  order = 0,
}: {
  label: string;
  value: string;
  context?: string;
  icon: LucideIcon;
  tone?: "neutral" | "critical";
  accent?: keyof typeof ACCENTS;
  /** Rang dans la rangée : décale l'entrée de 60 ms par tuile. */
  order?: number;
}) {
  return (
    /*
      Le délai passe par un style inline : c'est une valeur CALCULÉE depuis le
      rang, pas une couleur. Une classe Tailwind par rang aurait figé le nombre
      de tuiles dans la feuille de style.
    */
    <Card
      className="animate-rise-in p-5 transition-shadow hover:shadow-raised"
      style={{ animationDelay: `${order * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {/*
          Pastille pleine plutôt que cerclée : une bordure de 1 px sur 32 px
          disparaissait à côté du chiffre, et la tuile n'avait plus de point
          d'ancrage visuel.
        */}
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            ACCENTS[accent],
          )}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
      </div>

      {/*
        Le chiffre est le seul héros de la tuile : il monte d'un cran et perd son
        interligne, pour qu'il n'y ait aucune hésitation sur ce qu'on doit lire
        en premier.
      */}
      <p
        className={cn(
          "tabular mt-4 text-[1.75rem] font-bold leading-none tracking-tight",
          tone === "critical" && "text-destructive",
        )}
      >
        {value}
      </p>

      {context ? <p className="mt-1.5 text-xs text-muted-foreground">{context}</p> : null}
    </Card>
  );
}
