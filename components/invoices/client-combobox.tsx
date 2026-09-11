"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command } from "cmdk";

import { cn } from "@/lib/utils";
import { bareInputClasses } from "@/components/ui/input";
import { createClient } from "@/lib/actions/clients";
import type { Client } from "@/lib/domain/types";

/**
 * Sélecteur de client avec création à la volée.
 *
 * Le déclencheur est nu : il vit dans un `FloatingField`, qui porte déjà la
 * bordure, le rayon et l'anneau de focus. C'est le même contrat que les autres
 * champs de l'éditeur de facture.
 *
 * Un client créé ici n'apparaît pas immédiatement dans `clients` — la liste
 * vient du serveur. On garde donc son nom localement le temps que
 * `router.refresh()` ramène la liste à jour, sinon le champ retomberait sur le
 * texte d'invite juste après la création.
 */
interface ClientComboboxProps {
  id: string;
  clients: Client[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientCombobox({ id, clients, value, onChange, disabled }: ClientComboboxProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [justCreated, setJustCreated] = React.useState<{ id: string; name: string } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const query = search.trim();
  const selected =
    clients.find((row) => row.id === value) ??
    (justCreated?.id === value ? justCreated : undefined);

  const matches = React.useMemo(() => {
    if (!query) return clients;
    const needle = query.toLowerCase();
    return clients.filter((row) => row.name.toLowerCase().includes(needle));
  }, [clients, query]);

  const hasExactMatch = clients.some((row) => row.name.toLowerCase() === query.toLowerCase());

  const create = () => {
    if (!query || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await createClient({ name: query });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setJustCreated({ id: result.data.id, name: query });
      onChange(result.data.id);
      setOpen(false);
      setSearch("");
      router.refresh();
    });
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setError(null);
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isPending}
          className={cn(
            bareInputClasses,
            "flex cursor-pointer items-center justify-between gap-2 text-left",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? selected.name : "Sans client"}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-raised animate-fade-in"
        >
          {/* Le filtrage est fait au-dessus pour piloter l'option « Créer ». */}
          <Command shouldFilter={false} className="flex w-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Rechercher ou créer…"
                className={bareInputClasses}
              />
            </div>

            <Command.List className="max-h-72 overflow-y-auto p-1">
              {/*
                « Sans client » EN PREMIER, et toujours présent.

                Une boutique qui sert cinquante couverts par jour ne crée pas une
                fiche par convive. Reléguer cette option au bas d'une liste de
                clients reviendrait à la cacher à ceux qui en ont le plus besoin.
                Elle disparaît en revanche dès qu'on tape une recherche : on
                cherche alors quelqu'un de précis.
              */}
              {!query ? (
                <Command.Item
                  value="__sans_client__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Check
                    className={cn("size-4 shrink-0", value ? "opacity-0" : "opacity-100")}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">Sans client</span>
                </Command.Item>
              ) : null}

              {matches.length === 0 && !query ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Aucun client enregistré. Une vente peut se passer de client.
                </p>
              ) : null}

              {matches.map((row) => (
                <Command.Item
                  key={row.id}
                  value={row.id}
                  onSelect={() => {
                    onChange(row.id);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Check
                    className={cn("size-4 shrink-0", value === row.id ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="truncate">{row.name}</span>
                </Command.Item>
              ))}

              {query && !hasExactMatch ? (
                <Command.Item
                  value={`__create__${query}`}
                  onSelect={create}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {isPending ? "Création…" : `Créer « ${query} »`}
                  </span>
                </Command.Item>
              ) : null}
            </Command.List>

            {error ? (
              <p role="alert" className="border-t border-border px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
