"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { CheckCircle2, Download, Printer } from "lucide-react";

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
        <Dialog.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-foreground/25 print:hidden" />
        <Dialog.Content className="shadow-raised fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-xl border border-border bg-popover p-6 print:hidden">
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
                ? `La facture ${number} est enregistrée et figée. Remettez son reçu au client.`
                : "La facture est enregistrée."}
          </Dialog.Description>

          {/*
            Les deux gestes qui suivent une vente : remettre le reçu au client.
            « Retour aux factures » est passé en lien discret plus bas — c'était
            l'action la plus visible, et elle emmenait ailleurs précisément au
            moment où l'on a besoin de rester ici.
          */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            {invoiceId && !isDraft ? (
              <>
                <Button asChild className="sm:flex-1">
                  {/*
                    Ancre nue, pas un `Link` : le PDF est fabriqué par le serveur
                    au format ticket 80 mm et renvoyé en pièce jointe. Aucune boîte
                    d'impression, donc aucun format papier à choisir — et jamais
                    d'A4 aux trois quarts vide.
                  */}
                  <a href={`/invoices/${invoiceId}/pdf`} download>
                    <Download aria-hidden />
                    Télécharger
                  </a>
                </Button>

                <Button
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => {
                    /**
                     * On ferme AVANT d'imprimer. Le contenu de la boîte vit dans
                     * un portail attaché au `body`, hors du bloc mis en
                     * `print:hidden` : imprimer sans la fermer la ferait sortir
                     * par-dessus le ticket.
                     */
                    onOpenChange(false);
                    setTimeout(() => window.print(), 0);
                  }}
                >
                  <Printer aria-hidden />
                  Imprimer
                </Button>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {invoiceId ? (
              <Link
                href={`/invoices/${invoiceId}`}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Voir le détail du document
              </Link>
            ) : null}

            <Link
              href="/invoices"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Retour aux factures
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
