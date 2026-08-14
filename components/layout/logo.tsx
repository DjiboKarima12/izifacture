import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        aria-hidden
      >
        iF
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight">IziFacture</span>
    </span>
  );
}
