"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Prévient une fenêtre restée ouverte qu'une nouvelle version est en ligne.
 *
 * L'application installée n'est que le site dans sa propre fenêtre : chaque
 * ouverture charge déjà la dernière version. Le seul cas à couvrir est le
 * comptoir où la fenêtre reste ouverte toute la journée pendant une mise à jour
 * — elle continuerait sur l'ancien code, et un bouton pourrait ne plus répondre.
 *
 * On compare l'identifiant figé dans CE code à celui que renvoie le serveur, au
 * retour sur la fenêtre et toutes les cinq minutes. Jamais de rechargement
 * automatique : une vente peut être en cours de saisie.
 */

const VERSION = process.env.NEXT_PUBLIC_BUILD_ID;
const INTERVALLE = 5 * 60_000;

export function UpdateBanner() {
  const [nouvelle, setNouvelle] = React.useState(false);

  React.useEffect(() => {
    if (!VERSION) return;
    let annule = false;

    const verifier = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const reponse = await fetch("/api/version", { cache: "no-store" });
        if (!reponse.ok) return;
        const { version } = (await reponse.json()) as { version: string | null };
        if (!annule && version && version !== VERSION) setNouvelle(true);
      } catch {
        // Hors connexion : on réessaiera au prochain passage.
      }
    };

    const minuterie = window.setInterval(verifier, INTERVALLE);
    document.addEventListener("visibilitychange", verifier);
    window.addEventListener("focus", verifier);
    return () => {
      annule = true;
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", verifier);
      window.removeEventListener("focus", verifier);
    };
  }, []);

  if (!nouvelle) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar px-4 py-3 text-sm text-sidebar-foreground shadow-raised animate-fade-in print:hidden"
    >
      <RefreshCw className="size-4 shrink-0 text-sidebar-mark" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Nouvelle version disponible.</span>{" "}
        <span className="text-sidebar-muted">Enregistrez votre saisie, puis rechargez.</span>
      </p>
      <Button
        size="sm"
        className="shrink-0 bg-sidebar-mark text-sidebar-mark-foreground hover:bg-sidebar-mark/90 focus-visible:ring-offset-sidebar"
        onClick={() => window.location.reload()}
      >
        Recharger
      </Button>
    </div>
  );
}
