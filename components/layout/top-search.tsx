"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Recherche globale de la barre supérieure.
 *
 * La cible dépend de la page courante : depuis Clients on cherche un client,
 * pas une facture. Le formulaire est un GET vers la page elle-même, donc il
 * fonctionne sans JavaScript — ce qui compte sur les connexions visées.
 */
const TARGETS = [
  { prefix: "/clients", action: "/clients", placeholder: "Rechercher un client…", label: "Rechercher un client" },
  { prefix: "/quotes", action: "/quotes", placeholder: "Rechercher un devis…", label: "Rechercher un devis" },
  {
    prefix: "/payments",
    action: "/payments",
    placeholder: "Rechercher un encaissement…",
    label: "Rechercher un encaissement",
  },
] as const;

const DEFAULT_TARGET = {
  action: "/invoices",
  placeholder: "Rechercher une facture…",
  label: "Rechercher une facture",
};

export function TopSearch() {
  const pathname = usePathname();
  const target =
    TARGETS.find((entry) => pathname.startsWith(entry.prefix)) ?? DEFAULT_TARGET;

  return (
    <form action={target.action} className="relative w-full max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        // Remonte le champ à chaque changement de page : une recherche de
        // facture ne doit pas rester affichée sur la page Clients.
        key={target.action}
        name="q"
        type="search"
        placeholder={target.placeholder}
        aria-label={target.label}
        className="h-9 rounded-lg pl-9"
      />
    </form>
  );
}
