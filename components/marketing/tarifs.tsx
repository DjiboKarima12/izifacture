"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { FREE_MONTHLY_QUOTA } from "@/lib/plan";
import {
  ANNUAL_MONTHS_FREE,
  DISPLAY_CURRENCIES,
  DISPLAY_CURRENCY_LABELS,
  displayPrice,
  paymentCurrencyNote,
  premiumPrice,
  type BillingPeriod,
  type DisplayCurrency,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Grille tarifaire de la vitrine : sélecteurs de période et de devise, puis les
 * deux formules.
 *
 * PILULES ET GRANDS ARRONDIS — exception propre à la vitrine (design system
 * §4, « Rayons »). Une page qu'on ne voit qu'une fois peut se permettre une
 * forme plus douce que l'application, où l'on travaille toute la journée.
 *
 * Le premium est la carte SOMBRE : elle reprend le brun de la barre latérale,
 * comme le haut de la page, et c'est elle qu'on regarde en premier. Le gratuit
 * reste une carte claire ordinaire — discrète, pas escamotée.
 */

const LIGNES_GRATUIT = [
  `${FREE_MONTHLY_QUOTA} factures par mois`,
  "Reçus imprimés et PDF",
  "Clients et encaissements",
  "Tableau de bord",
];

const LIGNES_PREMIUM = [
  "Factures sans limite",
  "Devis et avoirs",
  "Catalogue produits et douchette",
  "Plusieurs utilisateurs sur la même boutique",
  "Support par WhatsApp",
  "Tout ce que contient le plan gratuit",
];

const PERIODES: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Mensuel" },
  { value: "annual", label: "Annuel" },
];

const DEVISES = DISPLAY_CURRENCIES.map((value) => ({
  value,
  label: DISPLAY_CURRENCY_LABELS[value],
}));

export function Tarifs() {
  const [periode, setPeriode] = React.useState<BillingPeriod>("monthly");
  const [devise, setDevise] = React.useState<DisplayCurrency>("XOF");

  return (
    <>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Selecteur label="Période de facturation" options={PERIODES} value={periode} onChange={setPeriode} />
        <Selecteur label="Devise" options={DEVISES} value={devise} onChange={setDevise} showLabel />
      </div>

      <p className="mt-4 min-h-5 text-center text-xs text-muted-foreground">
        {paymentCurrencyNote(devise)}
      </p>

      <div className="mx-auto mt-10 grid max-w-[880px] gap-8 md:grid-cols-2 md:items-start">
        {/* ---------------------------------------------------- Premium */}
        <Reveal>
          <div className="relative rounded-3xl bg-sidebar px-7 pb-8 pt-11 text-sidebar-foreground shadow-raised sm:px-9">
            <span className="absolute -top-4 left-7 inline-flex items-center gap-1.5 rounded-full bg-sidebar-mark px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-sidebar-mark-foreground shadow-card sm:left-9">
              <Sparkles className="size-3.5" aria-hidden />
              Formule recommandée
            </span>

            <h3 className="text-sm font-semibold uppercase tracking-wider">Premium</h3>
            <p className="mt-2 text-sidebar-muted">Pour la boutique qui vend tous les jours.</p>

            <Prix
              montant={premiumPrice(periode)}
              devise={devise}
              suffixe={periode === "annual" ? "/ an" : "/ mois"}
              mutedClassName="text-sidebar-muted"
            />
            <p className="mt-2 min-h-5 text-sm font-medium text-sidebar-mark">
              {periode === "annual" ? `${ANNUAL_MONTHS_FREE} mois offerts` : null}
            </p>

            <Separation className="border-sidebar-border" />

            <Lignes lignes={LIGNES_PREMIUM} pastilleClassName="bg-sidebar-active text-sidebar-mark" />

            <Button
              asChild
              size="lg"
              className="mt-9 w-full rounded-full bg-sidebar-mark text-sidebar-mark-foreground hover:bg-sidebar-mark/90 focus-visible:ring-offset-sidebar"
            >
              <Link href="/signup">Créer mon compte</Link>
            </Button>
          </div>
        </Reveal>

        {/* ---------------------------------------------------- Gratuit */}
        <Reveal delay={80}>
          <div className="rounded-3xl border border-border bg-card px-7 pb-8 pt-11 shadow-card sm:px-9">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Gratuit</h3>
            <p className="mt-2 text-muted-foreground">Pour démarrer sans rien payer.</p>

            <Prix montant={0} devise={devise} suffixe="pour toujours" mutedClassName="text-muted-foreground" />
            <p className="mt-2 min-h-5" aria-hidden />

            <Separation className="border-border" />

            <Lignes lignes={LIGNES_GRATUIT} pastilleClassName="bg-accent text-accent-foreground" />

            <Button asChild size="lg" variant="outline" className="mt-9 w-full rounded-full">
              <Link href="/signup">Commencer gratuitement</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </>
  );
}

/**
 * Groupe de boutons en pilule. `aria-pressed` plutôt qu'un groupe radio : on
 * bascule un affichage, on ne remplit pas un formulaire.
 */
function Selecteur<T extends string>({
  label,
  options,
  value,
  onChange,
  showLabel = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  showLabel?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-card"
    >
      {showLabel ? (
        <span className="pl-3 pr-1 text-sm font-medium text-muted-foreground" aria-hidden>
          {label} :
        </span>
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            option.value === value
              ? "bg-sidebar text-sidebar-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Prix({
  montant,
  devise,
  suffixe,
  mutedClassName,
}: {
  montant: number;
  devise: DisplayCurrency;
  suffixe: string;
  mutedClassName: string;
}) {
  const prix = displayPrice(montant, devise);
  return (
    <p className="mt-7 flex flex-wrap items-baseline gap-x-2">
      <span className="tabular text-5xl font-bold tracking-tight">
        {prix.approximate ? "≈ " : null}
        {prix.amount}
      </span>
      <span className="text-base font-semibold">{prix.symbol}</span>
      <span className={cn("text-base", mutedClassName)}>{suffixe}</span>
    </p>
  );
}

function Separation({ className }: { className: string }) {
  return <hr className={cn("my-7 border-t", className)} />;
}

function Lignes({ lignes, pastilleClassName }: { lignes: string[]; pastilleClassName: string }) {
  return (
    <ul className="space-y-3.5">
      {lignes.map((ligne) => (
        <li key={ligne} className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
              pastilleClassName,
            )}
            aria-hidden
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
          {ligne}
        </li>
      ))}
    </ul>
  );
}
