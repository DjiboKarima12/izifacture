"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Confirmation après création d'une facture.
 *
 * Le document est enregistré avant que cette boîte n'apparaisse : elle ne
 * propose donc que la suite, jamais d'annuler. Fermer la boîte laisse
 * l'utilisateur sur le formulaire, la facture reste créée.
 */
export function InvoiceCreatedDialog({
  invoiceId,
  number,
  isDraft,
  onOpenChange,
}: {
  invoiceId: string | null;
  number: string | null;
  isDraft: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={invoiceId !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <span
            className="flex size-11 items-center justify-center rounded-full bg-status-paid-bg text-status-paid"
            aria-hidden
          >
            <CheckCircle2 className="size-5" />
          </span>

          <Dialog.Title className="mt-4 text-base font-semibold">
            {isDraft ? "Brouillon enregistré" : "Facture créée"}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {isDraft
              ? "Le brouillon est enregistré. Il ne porte pas encore de numéro — celui-ci sera attribué à la création définitive."
              : number
                ? `La facture ${number} est enregistrée et figée. Vous pouvez la télécharger ou revenir à la liste.`
                : "La facture est enregistrée."}
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            {invoiceId ? (
              <Button asChild className="sm:flex-1">
                {/* `print=1` déclenche la boîte d'impression du navigateur, qui
                    propose « Enregistrer au format PDF » sur tous les systèmes. */}
                <Link href={`/invoices/${invoiceId}?print=1`}>
                  <Download aria-hidden />
                  Télécharger la facture
                </Link>
              </Button>
            ) : null}

            <Button asChild variant="outline" className="sm:flex-1">
              <Link href="/invoices">
                Retour aux factures
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          {invoiceId ? (
            <Link
              href={`/invoices/${invoiceId}`}
              className="mt-4 block text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Voir le détail du document
            </Link>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
