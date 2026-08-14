"use client";

import { cn } from "@/lib/utils";

/**
 * Contrôle segmenté en pilule (Standard / Échelonnée / Récurrente).
 * Implémenté en `radiogroup` : les flèches du clavier naviguent entre les
 * options, ce qu'une rangée de boutons ne permettrait pas.
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-full gap-1 rounded-lg bg-surface p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
