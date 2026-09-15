"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { CheckCircle2, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DocumentType } from "@/lib/domain/types";

/**
 * Ce que chaque type de document appelle le retour et l'invite à agir.
 *
 * Écrit en toutes lettres plutôt que dérivé du type : « Devis créé » et
 * « Facture créée » ne s'accordent pas pareil, et une phrase construite par
 * morceaux finit par produire du mauvais français.
 */
const MOTS = {
  invoice: {
    titre: "Facture créée",
    phrase: (numero: string) =>
      `La facture ${numero} est enregistrée et figée. Remettez son reçu au client.`,
    retour: "Retour aux factures",
    liste: "/invoices",
  },
  quote: {
    titre: "Devis créé",
    phrase: (numero: string) =>
      `Le devis ${numero} est enregistré. Téléchargez-le ou imprimez-le pour l'envoyer au client.`,
    retour: "Retour aux devis",
    liste: "/quotes",
  },
  credit_note: {
    titre: "Avoir créé",
    phrase: (numero: string) => `L'avoir ${numero} est enregistré et figé.`,
    retour: "Retour aux factures",
    liste: "/invoices",
  },
} as const;

/**
 * Confirmation après création d'un document.
 *
 * Le document est enregistré avant que cette boîte n'apparaisse : elle ne
 * propose donc que la suite, jamais d'annuler. Fermer la boîte laisse
 * l'utilisateur sur le formulaire, la facture reste créée.
 */
export function InvoiceCreatedDialog({
  invoiceId,
  number,
  isDraft,
  documentType = "invoice",
  onOpenChange,
}: {
  invoiceId: string | null;
  number: string | null;
  isDraft: boolean;
  /** Décide des mots et de la liste vers laquelle on revient. */
  documentType?: DocumentType;
  onOpenChange: (open: boolean) => void;
}) {
  const mots = MOTS[documentType];

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
            {isDraft ? "Brouillon enregistré" : mots.titre}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {isDraft
              ? "Le brouillon est enregistré. Il ne porte pas encore de numéro — celui-ci sera attribué à la création définitive."
              : number
                ? mots.phrase(number)
                : "Le document est enregistré."}
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
              href={mots.liste}
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {mots.retour}
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
