"use client";

import * as React from "react";

/** Le CSS compte 96 px par pouce, quel que soit l'écran réel. */
const PX_PER_MM = 96 / 25.4;

/** Deux millimètres de battement pour qu'un arrondi ne pousse pas une page vide. */
const SAFETY_MM = 2;

/**
 * Donne à la page imprimée la hauteur exacte du document.
 *
 * `@page` ne sait pas dire « 80 mm de large, hauteur libre » : la propriété
 * `size` accepte soit `auto`, soit des longueurs — jamais les deux. Écrire
 * `size: 80mm auto` produit une déclaration invalide, que le navigateur jette
 * entièrement, et l'impression repart sur le format papier par défaut, A4.
 *
 * La hauteur doit donc être un nombre, et seul le navigateur peut le connaître :
 * il dépend du nombre de lignes, de la longueur du pied de page, de la police
 * réellement chargée. On mesure le document et on écrit la règle.
 *
 * La mesure est refaite sur `beforeprint`, donc elle vaut aussi quand
 * l'utilisateur fait Ctrl+P lui-même, sans passer par notre bouton.
 *
 * Le document doit rester MESURABLE hors impression : masqué par `hidden`, sa
 * hauteur vaudrait zéro. Il est donc dans le flux, écrasé par `h-0` et
 * `overflow-hidden` — invisible, mais bel et bien mis en page.
 */
export function PrintPageSize({ targetId, widthMm = 80 }: { targetId: string; widthMm?: number }) {
  React.useEffect(() => {
    const style = document.createElement("style");
    // Ajouté en dernier dans <head> : cette règle l'emporte sur le repli de
    // `globals.css`, à égalité de spécificité.
    document.head.appendChild(style);

    const apply = () => {
      const target = document.getElementById(targetId);
      if (!target) return;

      // `scrollHeight` et non `getBoundingClientRect()` : la boîte est écrasée à
      // zéro, seul le contenu qu'elle déborde a la hauteur du document.
      const heightMm = Math.ceil(target.scrollHeight / PX_PER_MM) + SAFETY_MM;
      if (heightMm <= SAFETY_MM) return; // Pas encore mis en page — on garde le repli.

      style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
    };

    apply();
    window.addEventListener("beforeprint", apply);

    return () => {
      window.removeEventListener("beforeprint", apply);
      style.remove();
    };
  }, [targetId, widthMm]);

  return null;
}
