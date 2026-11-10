"use client";

import * as React from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isInstalled, rememberInstalled } from "@/lib/install-state";

/**
 * Propose d'installer MaMaFacture sur l'ordinateur ou le téléphone.
 *
 * Aucun navigateur ne laisse un site s'installer TOUT SEUL : il faut un clic
 * de l'utilisateur. Chrome et Edge émettent `beforeinstallprompt` quand le site
 * est installable (manifeste + icônes) ; on le retient, et notre bouton
 * déclenche la vraie fenêtre d'installation du navigateur. Firefox et Safari
 * n'émettent pas cet événement : la carte n'y apparaît simplement pas.
 *
 * « Plus tard » est retenu une semaine dans `localStorage` — confort propre à
 * ce navigateur, rien de plus. Inaccessible (navigation privée), la carte
 * revient à la visite suivante, ce qui n'empêche rien.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLE = "mamafacture-install-dismissed";
const UNE_SEMAINE = 7 * 86_400_000;

function recemmentRefuse(): boolean {
  try {
    const at = Number(localStorage.getItem(CLE));
    return Number.isFinite(at) && Date.now() - at < UNE_SEMAINE;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [evenement, setEvenement] = React.useState<InstallEvent | null>(null);

  React.useEffect(() => {
    const surInstallable = (event: Event) => {
      // Sans `preventDefault`, Chrome affiche sa propre mini-barre et
      // l'événement ne peut plus être rejoué depuis notre bouton.
      event.preventDefault();
      if (!recemmentRefuse() && !isInstalled()) setEvenement(event as InstallEvent);
    };
    const surInstalle = () => {
      rememberInstalled();
      setEvenement(null);
    };

    window.addEventListener("beforeinstallprompt", surInstallable);
    window.addEventListener("appinstalled", surInstalle);
    return () => {
      window.removeEventListener("beforeinstallprompt", surInstallable);
      window.removeEventListener("appinstalled", surInstalle);
    };
  }, []);

  if (!evenement) return null;

  const installer = async () => {
    await evenement.prompt();
    await evenement.userChoice;
    // L'événement ne sert qu'une fois, accepté ou non.
    setEvenement(null);
  };

  const plusTard = () => {
    try {
      localStorage.setItem(CLE, String(Date.now()));
    } catch {
      // Stockage indisponible : la carte reviendra, c'est sans gravité.
    }
    setEvenement(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Installer MaMaFacture"
      // Masquée derrière une fenêtre modale (nouveautés, fin d'essai) : Radix
      // pose `data-scroll-locked` sur <body> tant qu'elle est ouverte. Deux
      // invitations à la fois, c'est une de trop.
      className="fixed inset-x-4 bottom-4 z-50 overflow-hidden [body[data-scroll-locked]_&]:hidden rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-raised animate-fade-in sm:left-auto sm:right-6 sm:w-[380px] print:hidden"
    >
      <button
        type="button"
        onClick={plusTard}
        aria-label="Fermer"
        className="absolute right-3 top-3 rounded-md p-1 text-sidebar-muted transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="flex items-center gap-4 p-5 pr-10">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-md bg-sidebar-mark text-xl font-bold text-sidebar-mark-foreground shadow-card"
          aria-hidden
        >
          MF
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Installer MaMaFacture</p>
          <p className="mt-1 text-sm text-sidebar-muted">
            Sur votre bureau, à un clic. L&apos;application demande toujours votre mot de passe
            en s&apos;ouvrant.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-sidebar-border bg-sidebar-active px-5 py-3">
        <Button variant="sidebar" size="sm" className="flex-1" onClick={plusTard}>
          Plus tard
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-sidebar-mark text-sidebar-mark-foreground hover:bg-sidebar-mark/90 focus-visible:ring-offset-sidebar"
          onClick={installer}
        >
          <Download className="size-4" aria-hidden />
          Installer
        </Button>
      </div>
    </div>
  );
}
