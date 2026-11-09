"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Clock, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/money";
import { TRIAL_DAYS } from "@/lib/plan";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/pricing";

const LIGNES = [
  "Vos clients, factures et encaissements sont conservés",
  "Factures sans limite, devis, catalogue et plusieurs utilisateurs avec le Premium",
  `Paiement par Mobile Money, à partir de ${formatAmount(PREMIUM_MONTHLY_PRICE)} par mois`,
];

/**
 * Fenêtre affichée à l'entrée dans l'application quand l'essai — ou le premium
 * payé — est terminé.
 *
 * FERMABLE, par décision du propriétaire du produit : « Plus tard » laisse
 * consulter ses données. Ce n'est pas elle qui bloque : l'émission est refusée
 * par la Server Action (`assertCanIssue`). Une fenêtre qu'on pourrait retirer
 * du DOM ne protégerait rien ; elle informe.
 *
 * Elle s'ouvre au montage du layout, donc une fois par entrée dans
 * l'application et non à chaque changement de page. Jamais sur /abonnement :
 * c'est là que mène son bouton.
 */
export function TrialEndedDialog({ reason }: { reason: "trial" | "premium" }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(!pathname.startsWith("/abonnement"));

  const titre =
    reason === "premium" ? "Votre Premium est terminé" : "Votre essai gratuit est terminé";
  const sousTitre =
    reason === "premium"
      ? "Renouvelez votre abonnement pour continuer à émettre des factures."
      : `Vos ${TRIAL_DAYS} jours d'essai sont écoulés. Choisissez un abonnement pour continuer.`;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-raised animate-fade-in">
          <div className="bg-sidebar px-6 pb-7 pt-8 text-center text-sidebar-foreground">
            <span
              className="mx-auto flex size-14 items-center justify-center rounded-md bg-sidebar-mark text-sidebar-mark-foreground"
              aria-hidden
            >
              <Clock className="size-7" />
            </span>
            <Dialog.Title className="mt-5 text-xl font-bold tracking-tight">{titre}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-sidebar-muted">
              {sousTitre}
            </Dialog.Description>
          </div>

          <div className="px-6 pb-6 pt-5">
            <ul className="space-y-3 text-sm">
              {LIGNES.map((ligne) => (
                <li key={ligne} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                    aria-hidden
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {ligne}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2">
              <Button asChild size="lg" className="w-full">
                <Link href="/abonnement?payer=1" onClick={() => setOpen(false)}>
                  <CreditCard aria-hidden />
                  Choisir mon abonnement
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/support" onClick={() => setOpen(false)}>
                  Contacter le support
                </Link>
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" className="w-full text-muted-foreground">
                  Plus tard
                </Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
