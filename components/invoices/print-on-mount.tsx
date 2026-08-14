"use client";

import * as React from "react";

/**
 * Ouvre la boîte d'impression du navigateur à l'arrivée sur la page.
 *
 * C'est le « téléchargement » de la facture tant que la génération de PDF n'est
 * pas branchée (étape 6) : tous les navigateurs proposent « Enregistrer au
 * format PDF » dans cette boîte, et la feuille d'impression ne garde que le
 * document — ni menu, ni boutons.
 */
export function PrintOnMount() {
  React.useEffect(() => {
    // Laisse le temps aux polices et au rendu de se stabiliser : imprimer trop
    // tôt produit une page à moitié composée.
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
