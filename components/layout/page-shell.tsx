import { cn } from "@/lib/utils";

/** Gouttières et largeur maximale communes à toutes les pages hors éditeur. */
export function PageShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 lg:py-8", className)}>
      {children}
    </div>
  );
}
