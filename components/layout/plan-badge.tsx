import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plan";

const LABELS: Record<Plan, string> = {
  free: "Gratuit",
  premium: "Premium",
};

/**
 * Le plan de l'organisation, à côté de la marque.
 *
 * Il est là parce qu'une limite qu'on ne voit pas est une limite qu'on découvre
 * en la heurtant : le plafond mensuel du plan gratuit refuse une émission au
 * moment le plus mal choisi, face au client. L'afficher en permanence ne
 * l'empêche pas, mais il ne surprend plus.
 *
 * Pastille discrète et jamais colorée en marque : c'est une information d'état,
 * pas une réclame. Le premium se distingue par un fond plus appuyé, ce qui
 * suffit à le lire d'un coup d'œil sans attirer l'attention à chaque écran.
 */
export function PlanBadge({
  plan,
  onSidebar = false,
  className,
}: {
  plan: Plan;
  /** Sur le fond sombre de la barre latérale, où les jetons clairs ne tiennent pas. */
  onSidebar?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        onSidebar
          ? "bg-sidebar-active text-sidebar-muted"
          : plan === "premium"
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {LABELS[plan]}
    </span>
  );
}
