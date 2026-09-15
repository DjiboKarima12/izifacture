"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Révèle son contenu quand il entre dans l'écran.
 *
 * VISIBLE PAR DÉFAUT, et c'est la précaution qui compte. Le rendu serveur et
 * l'absence de JavaScript laissent le contenu affiché : une vitrine dont le
 * texte dépendrait d'un script serait blanche pour qui arrive avec une
 * connexion coupée en cours de route — le cas courant sur les réseaux visés.
 *
 * Le masquage n'a lieu qu'APRÈS le montage, et seulement pour ce qui est encore
 * hors de vue. Ce qui est déjà à l'écran au chargement s'anime sans jamais
 * disparaître, donc sans clignotement.
 *
 * `prefers-reduced-motion` neutralise l'animation globalement (globals.css) :
 * le contenu apparaît alors d'un coup, ce qui reste correct.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Décalage en millisecondes, pour faire entrer une rangée en cascade. */
  delay?: number;
  className?: string;
}) {
  const bloc = React.useRef<HTMLDivElement>(null);
  const [etat, setEtat] = React.useState<"initial" | "cache" | "vu">("initial");

  React.useEffect(() => {
    const element = bloc.current;
    if (!element) return;

    // Navigateur sans IntersectionObserver : on montre, sans animation.
    if (typeof IntersectionObserver === "undefined") {
      setEtat("vu");
      return;
    }

    // Déjà dans l'écran au chargement : on anime tout de suite plutôt que de le
    // cacher pour le remontrer aussitôt.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setEtat("vu");
      return;
    }

    setEtat("cache");
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees[0]?.isIntersecting) return;
        setEtat("vu");
        observateur.disconnect();
      },
      // Déclenché un peu avant le bord : le bloc est entièrement visible quand
      // l'animation se termine, pas au moment où elle commence.
      { rootMargin: "0px 0px -12% 0px" },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={bloc}
      className={cn(etat === "cache" && "opacity-0", etat === "vu" && "animate-rise-in-lg", className)}
      style={etat === "vu" && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
