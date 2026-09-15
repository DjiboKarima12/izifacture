import type { ReactNode } from "react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * Les atouts du produit.
 *
 * POURQUOI PAS SIX BLOCS « ICÔNE + TITRE + PARAGRAPHE » — c'est le motif le plus
 * générique d'Internet, et il ne dit rien. L'œil n'a aucune raison de s'arrêter,
 * et le lecteur ne retient rien.
 *
 * Ici, chaque atout MONTRE son mécanisme. « La monnaie » affiche la soustraction
 * elle-même ; « la numérotation » aligne trois numéros qui se suivent ; « le
 * devis » montre le document qui en devient un autre. Une démonstration, même
 * minuscule, se retient mieux qu'une promesse.
 */

type Atout = {
  teinte: string;
  titre: string;
  texte: string;
  visuel: ReactNode;
};

/** Barres factices d'un code-barres. Largeurs fixes : c'est un décor, pas un code. */
const BARRES = [3, 1, 1, 2, 1, 3, 2, 1, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1];

function CodeBarres() {
  return (
    <span className="flex h-9 items-stretch gap-[2px]" aria-hidden>
      {BARRES.map((largeur, index) => (
        <span key={index} className="bg-foreground" style={{ width: `${largeur * 2}px` }} />
      ))}
    </span>
  );
}

/** Pastille de document : un numéro dans sa boîte. */
function Numero({ children, fort }: { children: string; fort?: boolean }) {
  return (
    <span
      className={cn(
        "tabular rounded-md px-2.5 py-1 text-xs font-semibold",
        fort ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {children}
    </span>
  );
}

const ATOUTS: Atout[] = [
  {
    teinte: "teal",
    titre: "Scannez, ne tapez plus",
    texte:
      "Vos articles enregistrés une fois, avec leur prix. Ensuite un bip suffit. Sans douchette, le nom se complète à la frappe.",
    visuel: (
      <div className="flex flex-wrap items-center gap-4">
        <CodeBarres />
        <span className="text-xl text-muted-foreground" aria-hidden>
          →
        </span>
        <span className="rounded-lg border border-border bg-surface px-3 py-2">
          <span className="block text-sm font-medium">Attiéké poisson</span>
          <span className="tabular block text-xs text-muted-foreground">2 × 1 500 · TVA 19 %</span>
        </span>
      </div>
    ),
  },
  {
    teinte: "ambre",
    titre: "La monnaie, avant d'ouvrir la caisse",
    texte:
      "Le client donne 5 000 sur 2 950 ? Vous lisez 2 050 à rendre avant même d'ouvrir la caisse. Il ne donne qu'une partie ? C'est un acompte, et le reçu qu'il emporte porte le reste dû.",
    visuel: (
      <dl className="tabular space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Le client donne</dt>
          <dd className="font-medium">5 000</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Il doit</dt>
          <dd className="font-medium">2 950</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base">
          <dt className="font-semibold">À rendre</dt>
          <dd className="font-bold">2 050</dd>
        </div>
      </dl>
    ),
  },
  {
    teinte: "bleu",
    titre: "Le ticket qu'on reconnaît",
    texte:
      "Un reçu de 80 mm, à imprimer ou à télécharger, avec le code-barres du numéro. Jamais une feuille A4 aux trois quarts vide qu'on plie en quatre.",
    visuel: (
      // Un ticket miniature : assez pour qu'on reconnaisse la forme d'un reçu.
      <div className="w-[128px] space-y-1 rounded-lg border border-border bg-card p-2.5 shadow-card">
        <div className="h-1.5 w-2/3 rounded-sm bg-foreground" aria-hidden />
        <div className="h-1 w-full rounded-sm bg-border" aria-hidden />
        <div className="h-1 w-5/6 rounded-sm bg-border" aria-hidden />
        <div className="h-1 w-full rounded-sm bg-border" aria-hidden />
        <div className="h-1.5 w-1/2 rounded-sm bg-foreground" aria-hidden />
        <div className="flex gap-[2px] pt-1" aria-hidden>
          {BARRES.slice(0, 14).map((largeur, index) => (
            <span key={index} className="h-4 bg-foreground" style={{ width: `${largeur}px` }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    teinte: "violet",
    titre: "Du devis à la facture",
    texte:
      "Proposez un montant sans rien réclamer. Le devis accepté devient une facture en un clic, avec son propre numéro, sans ressaisir une seule ligne.",
    visuel: (
      <div className="flex flex-wrap items-center gap-2">
        <Numero>DEV-2026-0007</Numero>
        <span className="text-muted-foreground" aria-hidden>
          →
        </span>
        <Numero fort>FAC-2026-0128</Numero>
      </div>
    ),
  },
  {
    teinte: "ardoise",
    titre: "Une numérotation qui tient",
    texte:
      "Le numéro est attribué à l'émission et le document se fige. Une erreur se corrige par un avoir, jamais en réécrivant.",
    visuel: (
      <div className="flex flex-wrap items-center gap-2">
        <Numero>FAC-2026-0126</Numero>
        <Numero>FAC-2026-0127</Numero>
        <Numero fort>FAC-2026-0128</Numero>
        <span className="text-xs text-muted-foreground">aucun trou, jamais</span>
      </div>
    ),
  },
  {
    teinte: "rose",
    titre: "Vos chiffres sans cahier",
    texte:
      "Encaissé du mois, factures en attente, retards. Vous savez qui vous doit quoi sans feuilleter un cahier.",
    visuel: (
      <dl className="tabular flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {[
          ["Encaissé", "45 774"],
          ["En attente", "586"],
          ["En retard", "0"],
        ].map(([libelle, valeur]) => (
          <div key={libelle}>
            <dt className="text-xs text-muted-foreground">{libelle}</dt>
            <dd className="font-bold">{valeur}</dd>
          </div>
        ))}
      </dl>
    ),
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
      {ATOUTS.map((atout, index) => (
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
              {atout.visuel}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
