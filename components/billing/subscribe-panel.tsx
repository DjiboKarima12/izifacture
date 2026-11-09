"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, MessageCircle, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOBILE_MONEY_COUNTRIES,
  mobileMoneyCountry,
  subscriptionRequestUrl,
  type SubscriptionRequestContext,
} from "@/lib/billing";
import { subscriptionRequestSchema } from "@/lib/domain/schemas";
import { formatAmount } from "@/lib/money";
import { ANNUAL_MONTHS_FREE, premiumPrice, type BillingPeriod } from "@/lib/pricing";

const PERIODES = [
  { value: "monthly", label: "Mensuel" },
  { value: "annual", label: "Annuel" },
] as const satisfies ReadonlyArray<{ value: BillingPeriod; label: string }>;

const AVANTAGES = [
  "Factures sans limite",
  "Devis et avoirs",
  "Catalogue produits et douchette",
  "Plusieurs utilisateurs sur la même boutique",
  "Support par WhatsApp",
];

/**
 * Passage au premium : choix de la période, puis numéro Mobile Money.
 *
 * AUCUN PAIEMENT NE PASSE ENCORE PAR ICI — aucun prestataire n'est branché. Le
 * bouton le dit (« Continuer sur WhatsApp ») plutôt que de promettre un
 * paiement : la demande part au support, qui envoie la demande de paiement et
 * active l'abonnement à la main. Annoncer « Payer » et ouvrir WhatsApp serait
 * feindre un succès.
 *
 * Le formulaire est validé par `subscriptionRequestSchema`, le même qui
 * validera l'entrée serveur quand le paiement sera automatisé.
 */
export function SubscribePanel({
  context,
  isRenewal,
  initialPeriod = "monthly",
  openPayment = false,
}: {
  context: SubscriptionRequestContext;
  /** Déjà premium : on prolonge plutôt qu'on ne souscrit. */
  isRenewal: boolean;
  /** Période choisie sur la vitrine, reprise ici. */
  initialPeriod?: BillingPeriod;
  /** Arrivée depuis le bouton premium : la fenêtre de paiement s'ouvre d'emblée. */
  openPayment?: boolean;
}) {
  const [periode, setPeriode] = React.useState<BillingPeriod>(initialPeriod);
  const montant = premiumPrice(periode);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {isRenewal ? "Prolonger le Premium" : "Passer au Premium"}
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {AVANTAGES.map((avantage) => (
              <li key={avantage} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {avantage}
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full shrink-0 md:w-[280px]">
          <Segmented
            label="Période"
            options={PERIODES}
            value={periode}
            onValueChange={setPeriode}
          />
          <p className="tabular mt-5 text-right text-3xl font-bold tracking-tight">
            {formatAmount(montant)}
          </p>
          <p className="mt-1 text-right text-sm text-muted-foreground">
            {periode === "annual"
              ? `pour 12 mois, dont ${ANNUAL_MONTHS_FREE} offerts`
              : "pour 1 mois"}
          </p>

          <PaiementMobileMoney periode={periode} context={context} defaultOpen={openPayment} />
        </div>
      </div>
    </Card>
  );
}

type Erreurs = Partial<Record<"country" | "phone", string>>;

function PaiementMobileMoney({
  periode,
  context,
  defaultOpen,
}: {
  periode: BillingPeriod;
  context: SubscriptionRequestContext;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [country, setCountry] = React.useState(MOBILE_MONEY_COUNTRIES[0]?.code ?? "NE");
  const [phone, setPhone] = React.useState("");
  const [erreurs, setErreurs] = React.useState<Erreurs>({});
  const [envoye, setEnvoye] = React.useState(false);

  const pays = mobileMoneyCountry(country);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setErreurs({});
      setEnvoye(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = subscriptionRequestSchema.safeParse({ period: periode, country, phone });
    if (!parsed.success) {
      const next: Erreurs = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "country" || key === "phone") && !next[key]) next[key] = issue.message;
      }
      setErreurs(next);
      return;
    }
    setErreurs({});
    window.open(subscriptionRequestUrl(parsed.data, context), "_blank", "noopener,noreferrer");
    setEnvoye(true);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button className="mt-5 w-full">
          <Smartphone aria-hidden />
          Payer par Mobile Money
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <span
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            aria-hidden
          >
            {envoye ? <MessageCircle className="size-5" /> : <Smartphone className="size-5" />}
          </span>

          {envoye ? (
            <>
              <Dialog.Title className="mt-4 text-center text-lg font-semibold">
                Envoyez le message WhatsApp
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-center text-sm text-muted-foreground">
                Votre demande est prête dans WhatsApp. Une fois le message envoyé, nous vous
                adressons la demande de paiement de {formatAmount(premiumPrice(periode))} sur le +
                {pays?.dialCode} {phone.trim()}. Le Premium est activé dès réception du paiement.
              </Dialog.Description>
              <div className="mt-6 flex justify-center">
                <Dialog.Close asChild>
                  <Button variant="outline">Fermer</Button>
                </Dialog.Close>
              </div>
            </>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <Dialog.Title className="mt-4 text-center text-lg font-semibold">
                Paiement Mobile Money
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-center text-sm text-muted-foreground">
                Indiquez le numéro qui paiera {formatAmount(premiumPrice(periode))}. La demande
                part au support sur WhatsApp, qui vous envoie le paiement à valider.
              </Dialog.Description>

              <div className="mt-6 space-y-4">
                <Field label="Pays de l'opérateur" htmlFor="mm-country" error={erreurs.country}>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="mm-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOBILE_MONEY_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} (+{c.dialCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Numéro de téléphone" htmlFor="mm-phone" error={erreurs.phone}>
                  <div className="flex items-center gap-2">
                    <span className="tabular shrink-0 text-sm font-medium text-muted-foreground">
                      +{pays?.dialCode}
                    </span>
                    <Input
                      id="mm-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder={"0".repeat(pays?.digits ?? 8)}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      aria-invalid={erreurs.phone ? true : undefined}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Dialog.Close>
                <Button type="submit">Continuer sur WhatsApp</Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
