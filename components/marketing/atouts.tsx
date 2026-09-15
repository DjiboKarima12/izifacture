import type { ComponentType } from "react";

import {
  DemoChiffres,
  DemoDevis,
  DemoMonnaie,
  DemoNumerotation,
  DemoScanner,
  DemoTicket,
} from "@/components/marketing/atout-demos";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * Les atouts du produit.
 *
 * POURQUOI PAS SIX BLOCS « ICÔNE + TITRE + PARAGRAPHE » — c'est le motif le plus
 * générique d'Internet, et il ne dit rien. L'œil n'a aucune raison de s'arrêter,
 * et le lecteur ne retient rien.
 *
 * Ici, chaque atout MONTRE son mécanisme, et depuis le 15 septembre 2026 il le
 * montre en train de se faire : le code-barres se scanne, la monnaie se calcule,
 * le ticket s'imprime ligne à ligne. Les démonstrations vivent dans
 * `atout-demos.tsx`, qui est le seul morceau client de cette section.
 */

type Atout = {
  teinte: string;
  titre: string;
  texte: string;
  Visuel: ComponentType;
};

const ATOUTS: Atout[] = [
  {
    teinte: "teal",
    titre: "Scannez, ne tapez plus",
    texte:
      "Vos articles enregistrés une fois, avec leur prix. Ensuite un bip suffit. Sans douchette, le nom se complète à la frappe.",
    Visuel: DemoScanner,
  },
  {
    teinte: "ambre",
    titre: "La monnaie, avant d'ouvrir la caisse",
    texte:
      "Le client donne 5 000 sur 2 950 ? Vous lisez 2 050 à rendre avant même d'ouvrir la caisse. Il ne donne qu'une partie ? C'est un acompte, et le reçu qu'il emporte porte le reste dû.",
    Visuel: DemoMonnaie,
  },
  {
    teinte: "bleu",
    titre: "Le ticket qu'on reconnaît",
    texte:
      "Un reçu de 80 mm, à imprimer ou à télécharger, avec le code-barres du numéro. Jamais une feuille A4 aux trois quarts vide qu'on plie en quatre.",
    Visuel: DemoTicket,
  },
  {
    teinte: "violet",
    titre: "Du devis à la facture",
    texte:
      "Proposez un montant sans rien réclamer. Le devis accepté devient une facture en un clic, avec son propre numéro, sans ressaisir une seule ligne.",
    Visuel: DemoDevis,
  },
  {
    teinte: "ardoise",
    titre: "Une numérotation qui tient",
    texte:
      "Le numéro est attribué à l'émission et le document se fige. Une erreur se corrige par un avoir, jamais en réécrivant.",
    Visuel: DemoNumerotation,
  },
  {
    teinte: "rose",
    titre: "Vos chiffres sans cahier",
    texte:
      "Encaissé du mois, factures en attente, retards. Vous savez qui vous doit quoi sans feuilleter un cahier.",
    Visuel: DemoChiffres,
  },
];

/**
 * Une idée par rangée, pleine largeur, le visuel alternant gauche et droite.
 *
 * PLUS DE CARTES. Quatre versions successives ont empilé des boîtes dans des
 * boîtes — bento, couleurs, animations — et aucune n'a accroché. Le problème
 * était l'encadrement lui-même : six cartes dans une grille se regardent comme
 * un tableau, pas comme un argument.
 *
 * Ici, chaque atout occupe toute la largeur et respire. L'alternance gauche /
 * droite donne au regard un mouvement de balancier en descendant la page, là où
 * une grille l'immobilise.
 *
 * Le prix est une page plus longue. C'est accepté : on fait défiler une vitrine,
 * on ne la lit pas d'un coup d'œil.
 */
export function Atouts() {
  return (
    <div className="mt-12">
      {ATOUTS.map(({ Visuel, ...atout }, index) => (
        <Reveal key={atout.titre}>
          <div
            className={cn(
              "grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16",
              // Pas de trait au-dessus de la première : il flotterait sous le titre.
              index > 0 && "border-t border-border",
            )}
          >
            <div>
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{atout.titre}</h3>
              <p className="mt-3 max-w-[46ch] leading-relaxed text-muted-foreground">
                {atout.texte}
              </p>
            </div>

            {/*
              `lg:order-first` une rangée sur deux : l'alternance n'a lieu qu'en
              grand écran. Empilé sur téléphone, un visuel qui passerait tantôt
              avant tantôt après son titre casserait l'ordre de lecture.
            */}
            <div
              data-accent={atout.teinte}
              className={cn(
                "flex min-h-[116px] items-center rounded-xl bg-accent px-6 py-5 text-accent-foreground",
                index % 2 === 1 && "lg:order-first",
              )}
            >
              <Visuel />
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
