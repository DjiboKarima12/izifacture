"use client";

import * as React from "react";
import { Download, X } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

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
      if (!recemmentRefuse()) setEvenement(event as InstallEvent);
    };
    const surInstalle = () => setEvenement(null);

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
      className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-raised animate-fade-in sm:left-auto sm:right-6 sm:w-[360px] print:hidden"
    >
      <div className="flex items-start gap-3">
        <Logo className="[&>span:last-child]:hidden" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Installer MaMaFacture</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gardez l&apos;application sur votre bureau : elle s&apos;ouvre d&apos;un clic, dans sa
            propre fenêtre.
          </p>
        </div>
        <button
          type="button"
          onClick={plusTard}
          aria-label="Fermer"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={plusTard}>
          Plus tard
        </Button>
        <Button variant="secondary" size="sm" onClick={installer}>
          <Download className="size-4" aria-hidden />
          Installer
        </Button>
      </div>
    </div>
  );
}
