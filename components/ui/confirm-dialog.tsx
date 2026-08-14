"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";

/**
 * Confirmation d'une action irréversible.
 *
 * Le bouton de confirmation nomme l'action (« Supprimer ») plutôt qu'un « OK » :
 * un utilisateur qui lit vite doit voir ce qu'il déclenche, pas seulement qu'il
 * valide quelque chose.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  /** `destructive` par défaut ; `primary` pour une action engageante non destructrice. */
  confirmVariant = "destructive",
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  confirmVariant?: "destructive" | "primary";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Annuler
              </Button>
            </Dialog.Close>
            <Button
              variant={confirmVariant}
              size="sm"
              disabled={pending}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
