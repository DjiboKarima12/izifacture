"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { bareInputClasses } from "@/components/ui/input";
import { formatAmount, type Currency } from "@/lib/money";
import type { Product } from "@/lib/domain/types";

/**
 * Désignation d'une ligne : texte libre, avec le catalogue en suggestion.
 *
 * TEXTE LIBRE D'ABORD, et c'est le point. Une facture contient souvent une
 * ligne qui n'est pas au catalogue — une remise, une prestation ponctuelle, un
 * article vendu une seule fois. Un sélecteur qui n'accepterait que le catalogue
 * obligerait à créer un produit pour chaque exception.
 *
 * La liste ne s'ouvre donc qu'à la frappe, et ne bloque jamais la saisie : on
 * peut tout ignorer et continuer à taper.
 *
 * COMPLÉMENT DE LA DOUCHETTE, pas son remplaçant. Le scan sert quand les mains
 * sont occupées et que l'article porte un code ; ce champ sert quand il n'y a
 * pas de lecteur, ou qu'on connaît l'article par son nom. Les deux remplissent
 * la même ligne de la même façon.
 */
export function ProductCombobox({
  id,
  products,
  currency,
  value,
  onChange,
  onPick,
  disabled,
  placeholder,
}: {
  id: string;
  products: Product[];
  currency: Currency;
  value: string;
  /** Frappe libre : la ligne garde exactement ce qui est tapé. */
  onChange: (value: string) => void;
  /** Choix dans le catalogue : l'appelant recopie nom, prix et taux. */
  onPick: (product: Product) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [surligne, setSurligne] = React.useState(0);
  const champ = React.useRef<HTMLInputElement>(null);

  const requete = value.trim().toLowerCase();

  const suggestions = React.useMemo(() => {
    if (requete.length < 1) return [];
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(requete) ||
          (product.barcode?.toLowerCase().includes(requete) ?? false),
      )
      // Six au plus : au-delà, la liste couvre le formulaire et on ne voit plus
      // la ligne qu'on est en train de remplir.
      .slice(0, 6);
  }, [products, requete]);

  // Une suggestion identique au texte tapé n'apprend rien : on vient de la
  // choisir, la rouvrir ferait clignoter la liste à chaque frappe suivante.
  const exacte = suggestions.length === 1 && suggestions[0]!.name.toLowerCase() === requete;
  const visible = open && suggestions.length > 0 && !exacte;

  const choisir = (product: Product) => {
    onPick(product);
    setOpen(false);
    champ.current?.focus();
  };

  return (
    <PopoverPrimitive.Root open={visible} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <input
          id={id}
          ref={champ}
          value={value}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls={`${id}-suggestions`}
          placeholder={placeholder}
          className={bareInputClasses}
          onChange={(event) => {
            onChange(event.target.value);
            setSurligne(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!visible) return;

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const pas = event.key === "ArrowDown" ? 1 : -1;
              setSurligne((i) => (i + pas + suggestions.length) % suggestions.length);
              return;
            }

            if (event.key === "Enter") {
              // Sans cette interception, Entrée validerait le formulaire et
              // créerait la facture au lieu de choisir l'article surligné.
              event.preventDefault();
              const choix = suggestions[surligne];
              if (choix) choisir(choix);
              return;
            }

            if (event.key === "Escape") setOpen(false);
          }}
        />
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={`${id}-suggestions`}
          align="start"
          sideOffset={10}
          // Le focus reste dans le champ : la liste assiste la frappe, elle ne
          // l'interrompt pas.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-raised animate-fade-in"
        >
          <ul role="listbox">
            {suggestions.map((product, index) => (
              <li key={product.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === surligne}
                  onMouseEnter={() => setSurligne(index)}
                  onClick={() => choisir(product)}
                  className={`flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    index === surligne ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">{product.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {formatAmount(product.unitPrice, currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
