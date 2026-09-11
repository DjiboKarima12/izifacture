"use client";

import * as React from "react";
import { Moon } from "lucide-react";

import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "izifacture-theme";

/**
 * Bascule clair / sombre. La classe est posée sur <html> avant le premier rendu
 * par le script inline du layout racine, donc ce composant ne fait que
 * synchroniser son affichage avec l'état déjà appliqué — sans quoi la page
 * clignoterait en clair à chaque chargement.
 */
export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Navigation privée ou stockage refusé : le thème reste valable pour la session.
    }
  };

  return (
    // Vit dans la barre latérale, sur fond vert sombre : les jetons généraux y
    // donneraient du gris foncé sur vert foncé.
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-muted">
      <Moon className="size-[18px] shrink-0" aria-hidden />
      <span>Mode sombre</span>
      <Switch checked={dark} onCheckedChange={toggle} label="Activer le mode sombre" className="ml-auto" />
    </div>
  );
}
