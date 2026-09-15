"use client";

import * as React from "react";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { cn } from "@/lib/utils";
import { formatAmount, type Currency } from "@/lib/money";

/**
 * Le ticket se fabrique tout seul, en boucle.
 *
 * POURQUOI UNE BOUCLE, alors que le design system les interdit hors indicateur
 * de chargement (§2) : la règle vise l'APPLICATION, où un mouvement répété
 * distrait quelqu'un qui travaille. Ici, personne ne travaille — on regarde une
 * vitrine, et il faut trois secondes pour comprendre ce que fait le produit. Un
 * texte le raconterait ; le voir se faire le démontre.
 *
 * L'amendement est consigné dans docs/design-system.md, avec ses garde-fous :
 * page d'accueil uniquement, et arrêt complet sous `prefers-reduced-motion`.
 *
 * C'est le VRAI composant du produit à chaque étape, pas une vidéo : ce que le
 * visiteur voit se construire est exactement ce que son client recevra.
 */

const LIGNES = [
  { id: "1", description: "Attiéké poisson", quantity: 2, unitPrice: 1_500, taxRate: 19 },
  { id: "2", description: "Jus de bissap", quantity: 2, unitPrice: 500, taxRate: 19 },
] as const;

const REMIS = 5_000;

/** Ce que la caisse annonce à chaque étape. La dernière tient plus longtemps. */
const ETAPES = [
  { legende: "Nouvelle vente", duree: 1_100 },
  { legende: "Scan · Attiéké poisson", duree: 1_300 },
  { legende: "Scan · Jus de bissap", duree: 1_300 },
  { legende: "Espèces · reçu 5 000", duree: 1_500 },
  { legende: "Monnaie rendue", duree: 3_200 },
] as const;

export function ReceiptDemo({ currency }: { currency: Currency }) {
  /**
   * On part du ticket TERMINÉ, pas du ticket vide.
   *
   * C'est ce que rend le serveur, et donc ce que voit quelqu'un dont le
   * JavaScript n'a pas chargé : un reçu complet, qui montre le produit. Partir
   * de l'étape zéro lui aurait affiché un ticket sans une seule ligne.
   */
  const [etape, setEtape] = React.useState(ETAPES.length - 1);
  const [anime, setAnime] = React.useState(false);

  React.useEffect(() => {
    // Mouvement réduit : on montre le ticket TERMINÉ et on s'arrête là. Une
    // boucle déclenche des nausées chez certaines personnes ; ce n'est pas une
    // préférence esthétique.
    const reduit =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Mouvement réduit : on reste sur le ticket terminé, sans boucle.
    if (reduit) return;

    // Le JavaScript est là : on repart du début pour dérouler la vente.
    setEtape(0);
    setAnime(true);
  }, []);

  React.useEffect(() => {
    if (!anime) return;
    const minuteur = window.setTimeout(
      () => setEtape((courante) => (courante + 1) % ETAPES.length),
      ETAPES[etape]!.duree,
    );
    return () => window.clearTimeout(minuteur);
  }, [anime, etape]);

  const visibles = LIGNES.slice(0, Math.min(etape, 2));
  const sousTotal = visibles.reduce((somme, l) => somme + l.quantity * l.unitPrice, 0);
  const tva = Math.round(sousTotal * 0.19);
  const total = sousTotal + tva;

  // L'encaissement n'apparaît qu'aux deux dernières étapes, la monnaie à la dernière.
  const encaisse = etape >= 3;
  const rendMonnaie = etape >= 4;

  return (
    <div className="space-y-3">
      <div className="rotate-2 shadow-raised transition-transform duration-500 hover:rotate-0">
        {/*
          `key` sur l'étape : React remonte le ticket à chaque changement, donc
          l'animation d'entrée rejoue. Sans elle, seul le contenu changerait —
          et le mouvement passerait inaperçu, ce qui était exactement le défaut
          de la version précédente.
        */}
        <div key={etape} className="animate-rise-in">
          <InvoicePreview
            issuer={{
              name: "MaMa'S Food",
              legalName: null,
              email: null,
              phone: "+227 89 35 35 00",
              addressLine: null,
              city: "Niamey",
              country: "Niger",
              taxId: null,
              invoiceFooter: "Merci Karima !",
              logoUrl: null,
            }}
            client={null}
            currency={currency}
            number="FAC-2026-0128"
            issueDate="2026-09-15"
            dueDate="2026-09-15"
            lines={visibles.map((ligne) => ({
              ...ligne,
              lineSubtotal: ligne.quantity * ligne.unitPrice,
              lineTotal: Math.round(ligne.quantity * ligne.unitPrice * 1.19),
            }))}
            totals={{
              subtotal: sousTotal,
              discountTotal: 0,
              taxTotal: tva,
              total,
              taxBreakdown: tva > 0 ? [{ rate: 19, base: sousTotal, tax: tva }] : [],
            }}
            notes=""
            amountPaid={encaisse ? total : 0}
            payments={
              encaisse
                ? [{ method: "cash", amount: total, tendered: rendMonnaie ? REMIS : null }]
                : []
            }
          />
        </div>
      </div>

      {/* Le bandeau de la caisse : ce qui vient de se passer, en toutes lettres. */}
      <p
        role="status"
        aria-live="off"
        className="flex items-center justify-center gap-2 text-xs font-medium text-sidebar-muted"
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-sidebar-mark",
            anime && "animate-pulse",
          )}
          aria-hidden
        />
        {ETAPES[etape]!.legende}
        {rendMonnaie ? ` · ${formatAmount(REMIS - total, currency)}` : ""}
      </p>
    </div>
  );
}
