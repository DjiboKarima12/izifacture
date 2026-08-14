import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Champ nu, destiné à vivre à l'intérieur d'un `FloatingField`. */
export const bareInputClasses =
  "w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50";

/** Champ autonome, bordure comprise (filtres, recherche, écrans denses). */
const inputClasses =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-interactive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-interactive disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClasses, className)} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClasses, "h-auto min-h-20 py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium", className)} {...props} />
  ),
);
Label.displayName = "Label";

/**
 * Champ à libellé encoché dans la bordure — le motif de la maquette.
 *
 * Le libellé reste visible en permanence, contrairement à un placeholder qui
 * disparaît dès la première frappe et laisse l'utilisateur deviner ce qu'il est
 * en train de remplir. Sur un formulaire de facture, où l'on saisit une dizaine
 * de champs d'affilée, ça change la lisibilité.
 */
export function FloatingField({
  label,
  htmlFor,
  icon: Icon,
  required,
  error,
  hint,
  trailing,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: LucideIcon;
  required?: boolean;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "relative rounded-lg border bg-background transition-colors focus-within:border-interactive focus-within:ring-1 focus-within:ring-interactive",
          error ? "border-destructive" : "border-input",
        )}
      >
        <label
          htmlFor={htmlFor}
          className="absolute -top-[0.45rem] left-3 z-10 bg-background px-1 text-[0.7rem] font-medium text-muted-foreground"
        >
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </label>

        <div className="flex items-center gap-2 px-3 py-2.5">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          {children}
          {trailing}
        </div>
      </div>

      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Champ classique libellé au-dessus, pour les écrans de paramètres. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export { Input, Textarea, Label, inputClasses };
