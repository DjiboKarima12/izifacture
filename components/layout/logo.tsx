import { cn } from "@/lib/utils";

/**
 * La marque, dans ses deux contextes.
 *
 * `onSidebar` n'est pas une variante décorative : la barre latérale est un
 * fond vert sombre, tout le reste de l'interface est clair. Une pastille verte
 * sur du vert disparaîtrait — elle passe donc en or, la couleur du plat sur le
 * logo de l'enseigne, seule touche chaude de l'interface.
 */
export function Logo({
  className,
  onSidebar = false,
}: {
  className?: string;
  onSidebar?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold",
          onSidebar
            ? "bg-sidebar-mark text-sidebar-mark-foreground"
            : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        MF
      </span>
      <span
        className={cn(
          "text-[0.95rem] font-semibold tracking-tight",
          onSidebar && "text-sidebar-foreground",
        )}
      >
        MaMaFacture
      </span>
    </span>
  );
}
