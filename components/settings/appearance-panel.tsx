"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  parseAppearance,
  SCALE_LABELS,
  serializeAppearance,
  TEXT_SCALES,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEMES,
  type Appearance,
} from "@/lib/appearance";

/**
 * Réglages d'affichage : palette et taille de texte.
 *
 * TOUT S'APPLIQUE IMMÉDIATEMENT, sans bouton « Enregistrer ». On choisit une
 * apparence en la regardant ; demander une validation obligerait à valider pour
 * voir, puis à revenir en arrière si ça ne plaît pas.
 *
 * Le réglage est PAR APPAREIL — stocké localement, pas sur le compte. C'est un
 * confort de lecture qui dépend de l'écran : le même utilisateur veut souvent du
 * plus gros sur son téléphone au soleil que sur son ordinateur.
 */
export function AppearancePanel() {
  const [appearance, setAppearance] = React.useState<Appearance>(DEFAULT_APPEARANCE);

  // Lu après le montage : `localStorage` n'existe pas au rendu serveur. Le
  // script du layout racine a déjà posé le bon affichage — on se contente ici
  // de refléter ce qui est en place.
  React.useEffect(() => {
    try {
      setAppearance(parseAppearance(window.localStorage.getItem(APPEARANCE_KEY)));
    } catch {
      // Stockage refusé : les réglages valent pour la session, sans persister.
    }
  }, []);

  const appliquer = (patch: Partial<Appearance>) => {
    const suivant = { ...appearance, ...patch };
    setAppearance(suivant);

    const racine = document.documentElement;

    /**
     * « Sable » est la palette de base : elle vit dans `:root`, sans attribut.
     * Poser `data-theme="sable"` ne correspondrait à aucune règle et laisserait
     * l'écran sur les couleurs précédentes.
     */
    if (suivant.theme === "sable") delete racine.dataset.theme;
    else racine.dataset.theme = suivant.theme;

    // 100 % = pas de style du tout : on laisse la feuille décider plutôt que de
    // figer une valeur qui deviendrait fausse si la base changeait.
    racine.style.fontSize = suivant.textScale === 100 ? "" : `${suivant.textScale}%`;

    try {
      window.localStorage.setItem(APPEARANCE_KEY, serializeAppearance(suivant));
    } catch {
      // Navigation privée : le réglage tient jusqu'à la fermeture, et c'est tout
      // ce qu'on peut promettre.
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <h2 className="text-base font-semibold">Apparence</h2>
        <p className="text-sm text-muted-foreground">
          Réglages de cet appareil. Ils ne changent rien pour vos collègues ni sur vos factures.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 pb-6">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Couleurs
          </legend>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {THEMES.map((theme) => {
              const actif = appearance.theme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => appliquer({ theme })}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    actif ? "border-interactive bg-accent" : "border-border hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      actif ? "border-interactive bg-interactive" : "border-input",
                    )}
                    aria-hidden
                  >
                    {actif ? <Check className="size-3 text-interactive-foreground" /> : null}
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{THEME_LABELS[theme]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {THEME_DESCRIPTIONS[theme]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Taille du texte
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {TEXT_SCALES.map((scale) => {
              const actif = appearance.textScale === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => appliquer({ textScale: scale })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    actif
                      ? "border-interactive bg-accent text-accent-foreground"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {SCALE_LABELS[scale]}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Agrandit aussi les champs et les boutons : un texte plus grand dans des boîtes
            inchangées déborderait.
          </p>
        </fieldset>
      </CardContent>
    </Card>
  );
}
