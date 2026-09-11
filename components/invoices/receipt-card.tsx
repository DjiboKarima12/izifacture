"use client";

import type { ReactNode } from "react";
import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
export function ReceiptCard({ invoiceId, children }: { invoiceId: string; children: ReactNode }) {
  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">Reçu</h2>
        <p className="text-sm text-muted-foreground">
          À jour des encaissements. À remettre au client.
        </p>
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
