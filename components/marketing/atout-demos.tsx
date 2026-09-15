"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Les six démonstrations de la section « Atouts ».
 *
 * CHAQUE ATOUT SE FAIT SOUS LES YEUX DU VISITEUR. La section disait déjà
 * vouloir montrer ses mécanismes plutôt que les promettre, mais elle en
 * montrait des photographies : une soustraction déjà posée, un ticket déjà
 * imprimé. Le mécanisme se comprend en le voyant s'exécuter, pas en voyant son
 * résultat.
 *
 * DÉMARRENT À L'ÉTAT FINAL, et c'est la précaution qui compte. Le rendu
 * serveur, un navigateur sans JavaScript et `prefers-reduced-motion` montrent
 * la démonstration terminée — la même image qu'avant cet ajout. La boucle
 * explique ce que l'image dit déjà ; elle ne la remplace pas.
 *
 * SIX BOUCLES SUR UNE PAGE ne tournent jamais ensemble : chaque atout occupe
 * une rangée pleine largeur, donc une ou deux sont à l'écran à la fois, et
 * l'observateur arrête les autres. Sans ça la page ressemblerait à une machine
 * à sous.
 */

/* ====================================================================== Socle */

/**
 * Fait défiler les étapes d'une démonstration, en boucle, tant qu'elle est
 * visible.
 *
 * Les durées sont données étape par étape plutôt qu'en cadence unique : la
 * dernière image doit tenir bien plus longtemps que les intermédiaires, sinon
 * la démonstration se conclut sans qu'on ait le temps de lire sa conclusion.
 */
function useDemo<T extends HTMLElement = HTMLDivElement>(durees: readonly number[]) {
  const cible = React.useRef<T>(null);
  const [etape, setEtape] = React.useState(durees.length - 1);

  React.useEffect(() => {
    const element = cible.current;
    if (!element) return;

    // Le mouvement répété déclenche des nausées chez certaines personnes : sans
    // démarrage, l'état final rendu par le serveur reste affiché.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    let minuteur: number | undefined;
    let index = 0;

    const programmer = () => {
      minuteur = window.setTimeout(() => {
        index = (index + 1) % durees.length;
        setEtape(index);
        programmer();
      }, durees[index]);
    };

    const arreter = () => {
      if (minuteur !== undefined) window.clearTimeout(minuteur);
      minuteur = undefined;
    };

    const observateur = new IntersectionObserver(
      (entrees) => {
        arreter();
        if (!entrees[0]?.isIntersecting) return;
        // Reprise depuis le début : qui remonte la page revoit la démonstration
        // entière, pas sa fin.
        index = 0;
        setEtape(0);
        programmer();
      },
      { rootMargin: "0px 0px -15% 0px" },
    );

    observateur.observe(element);
    return () => {
      observateur.disconnect();
      arreter();
    };
  }, [durees]);

  return { cible, etape };
}

/** Apparition d'un élément de démonstration, pilotée par l'étape courante. */
function paraitre(visible: boolean) {
  return cn(
    "transition-[opacity,transform] duration-300 ease-out",
    visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
  );
}

/** Barres factices d'un code-barres. Largeurs fixes : c'est un décor, pas un code. */
const BARRES = [3, 1, 1, 2, 1, 3, 2, 1, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1];

/** Pastille de document : un numéro dans sa boîte. */
function Numero({
  children,
  fort,
  className,
}: {
  children: string;
  fort?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular rounded-md px-2.5 py-1 text-xs font-semibold",
        fort ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ============================================================ 1. La douchette */

const SCAN = [900, 420, 520, 2200] as const;

export function DemoScanner() {
  const { cible, etape } = useDemo(SCAN);

  return (
    <div ref={cible} className="flex flex-wrap items-center gap-4">
      {/* Le faisceau ne court que pendant la première étape ; `key` le relance
          à chaque passage de la boucle, sinon il ne jouerait qu'une fois. */}
      <span className="relative flex h-9 items-stretch gap-[2px] overflow-hidden" aria-hidden>
        {BARRES.map((largeur, index) => (
          <span key={index} className="bg-foreground" style={{ width: `${largeur * 2}px` }} />
        ))}
        {/*
          Le faisceau prend la teinte de SON panneau, pas le rouge des vraies
          douchettes : `--primary` vaut ici le teal de la rangée. Emprunter
          `destructive` pour faire joli userait la seule couleur qui doit
          vouloir dire « attention ».
        */}
        {etape === 0 ? (
          <span key={`faisceau-${etape}`} className="animate-scan bg-primary" />
        ) : null}
      </span>

      <span className={cn("text-xl text-muted-foreground", paraitre(etape >= 1))} aria-hidden>
        →
      </span>

      <span
        className={cn("rounded-lg border border-border bg-surface px-3 py-2", paraitre(etape >= 2))}
      >
        <span className="block text-sm font-medium">Attiéké poisson</span>
        <span className="tabular block text-xs text-muted-foreground">
          {etape >= 3 ? "2" : "1"} × 1 500 · TVA 19 %
        </span>
      </span>
    </div>
  );
}

/* ============================================================== 2. La monnaie */

const MONNAIE = [700, 700, 500, 2400] as const;

export function DemoMonnaie() {
  const { cible, etape } = useDemo<HTMLDListElement>(MONNAIE);

  return (
    <dl ref={cible} className="tabular w-full max-w-[260px] space-y-1.5 text-sm">
      <div className={cn("flex justify-between gap-4", paraitre(etape >= 0))}>
        <dt className="text-muted-foreground">Le client donne</dt>
        <dd className="font-medium">5 000</dd>
      </div>
      <div className={cn("flex justify-between gap-4", paraitre(etape >= 1))}>
        <dt className="text-muted-foreground">Il doit</dt>
        <dd className="font-medium">2 950</dd>
      </div>
      <div
        className={cn(
          "flex justify-between gap-4 border-t border-border pt-1.5 text-base",
          paraitre(etape >= 2),
        )}
      >
        <dt className="font-semibold">À rendre</dt>
        {/* Le résultat arrive APRÈS sa ligne : c'est le temps de calcul que la
            caisse fait disparaître, et le seul moment qui vaille d'être montré. */}
        <dd className={cn("font-bold", paraitre(etape >= 3))}>2 050</dd>
      </div>
    </dl>
  );
}

/* =============================================================== 3. Le ticket */

/** Un ticket miniature : assez pour qu'on reconnaisse la forme d'un reçu. */
const LIGNES_TICKET = [
  "h-1.5 w-2/3 bg-foreground",
  "h-1 w-full bg-border",
  "h-1 w-5/6 bg-border",
  "h-1 w-full bg-border",
  "h-1.5 w-1/2 bg-foreground",
] as const;

const TICKET = [300, 300, 300, 300, 300, 2400] as const;

export function DemoTicket() {
  const { cible, etape } = useDemo(TICKET);

  return (
    <div
      ref={cible}
      className="w-[128px] space-y-1 rounded-lg border border-border bg-card p-2.5 shadow-card"
    >
      {/* Les lignes sortent du haut vers le bas, comme d'une imprimante
          thermique — le rouleau ne recule pas. */}
      {LIGNES_TICKET.map((ligne, index) => (
        <div
          key={ligne}
          className={cn("rounded-sm", ligne, paraitre(etape >= index))}
          aria-hidden
        />
      ))}
      <div className={cn("flex gap-[2px] pt-1", paraitre(etape >= 5))} aria-hidden>
        {BARRES.slice(0, 14).map((largeur, index) => (
          <span key={index} className="h-4 bg-foreground" style={{ width: `${largeur}px` }} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================ 4. Le devis */

const DEVIS = [700, 450, 2400] as const;

export function DemoDevis() {
  const { cible, etape } = useDemo(DEVIS);

  return (
    <div ref={cible} className="flex flex-wrap items-center gap-2">
      <Numero>DEV-2026-0007</Numero>
      <span className={cn("text-muted-foreground", paraitre(etape >= 1))} aria-hidden>
        →
      </span>
      {/* La facture se pose comme un tampon : elle arrive un peu trop grande et
          se cale. C'est le geste que fait le commerçant quand le devis est
          accepté. */}
      <Numero
        fort
        className={cn(
          "transition-[opacity,transform] duration-300 ease-out",
          etape >= 2 ? "scale-100 opacity-100" : "scale-110 opacity-0",
        )}
      >
        FAC-2026-0128
      </Numero>
    </div>
  );
}

/* ======================================================== 5. La numérotation */

const SEQUENCE = ["FAC-2026-0126", "FAC-2026-0127", "FAC-2026-0128"] as const;
const NUMEROTATION = [450, 450, 450, 2400] as const;

export function DemoNumerotation() {
  const { cible, etape } = useDemo(NUMEROTATION);

  return (
    <div ref={cible} className="flex flex-wrap items-center gap-2">
      {SEQUENCE.map((numero, index) => (
        <Numero
          key={numero}
          fort={index === SEQUENCE.length - 1}
          className={paraitre(etape >= index)}
        >
          {numero}
        </Numero>
      ))}
      <span className={cn("text-xs text-muted-foreground", paraitre(etape >= 3))}>
        aucun trou, jamais
      </span>
    </div>
  );
}

/* =============================================================== 6. Les chiffres */

/**
 * Les valeurs intermédiaires sont écrites, pas calculées image par image.
 *
 * Un compteur en `requestAnimationFrame` produirait des nombres plus fluides,
 * au prix d'une boucle de rendu par chiffre et d'un affichage qui change
 * soixante fois par seconde. Quatre paliers suffisent à lire « ça monte », et
 * la dernière valeur est la vraie.
 */
const CHIFFRES = [
  { libelle: "Encaissé", paliers: ["0", "18 200", "36 940", "45 774"] },
  { libelle: "En attente", paliers: ["0", "240", "480", "586"] },
  { libelle: "En retard", paliers: ["0", "0", "0", "0"] },
] as const;

const COMPTEUR = [260, 260, 260, 2600] as const;

export function DemoChiffres() {
  const { cible, etape } = useDemo<HTMLDListElement>(COMPTEUR);

  return (
    <dl ref={cible} className="tabular flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {CHIFFRES.map(({ libelle, paliers }) => (
        <div key={libelle}>
          <dt className="text-xs text-muted-foreground">{libelle}</dt>
          <dd className="font-bold">{paliers[etape] ?? paliers[paliers.length - 1]}</dd>
        </div>
      ))}
    </dl>
  );
}
