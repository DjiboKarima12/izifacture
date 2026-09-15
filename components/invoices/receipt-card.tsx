"use client";

import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DocumentType } from "@/lib/domain/types";

/**
 * Le reçu tel qu'il sera remis au client, visible à l'écran.
 *
 * POURQUOI IL FALLAIT LE MONTRER — le ticket existait déjà, mais uniquement au
 * moment de l'impression : dans le flux, écrasé à zéro de hauteur. On ne pouvait
 * donc pas vérifier ce qu'on allait tendre au client sans lancer une impression
 * pour voir.
 *
 * Il se régénère à chaque affichage depuis les encaissements enregistrés : après
 * un versement, ce reçu porte le nouveau reste dû sans qu'il y ait rien à
 * refabriquer. C'est ce qu'on redonne au client à chaque passage.
 *
 * `print:hidden` — à l'impression, c'est la copie dédiée de la page qui sort,
 * calibrée au format 80 mm. Sans ça, le ticket sortirait en double.
 */
/**
 * Un devis n'est pas un reçu : il ne constate aucun paiement, il en propose un.
 * L'intitulé et la phrase suivent donc le type, sinon la carte annoncerait un
 * encaissement là où il n'y en a pas.
 */
const MOTS = {
  invoice: { titre: "Reçu", phrase: "À jour des encaissements. À remettre au client." },
  quote: { titre: "Devis", phrase: "À télécharger ou imprimer pour l'envoyer au client." },
  credit_note: { titre: "Avoir", phrase: "À remettre au client en justificatif de la correction." },
} as const;

export function ReceiptCard({
  invoiceId,
  documentType = "invoice",
  children,
}: {
  invoiceId: string;
  documentType?: DocumentType;
  children: ReactNode;
}) {
  const mots = MOTS[documentType];

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{mots.titre}</h2>
        <p className="text-sm text-muted-foreground">{mots.phrase}</p>
      </CardHeader>

      <CardContent className="pb-6">
        {children}

        <div className="mt-4 flex flex-wrap gap-2">
          {/*
            Ancre nue, pas un `Link` : le serveur renvoie un PDF en pièce jointe,
            au format ticket 80 mm, sans passer par la boîte d'impression.
          */}
          <Button asChild variant="outline" size="sm">
            <a href={`/invoices/${invoiceId}/pdf`} download>
              <Download aria-hidden />
              Télécharger
            </a>
          </Button>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            Imprimer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
