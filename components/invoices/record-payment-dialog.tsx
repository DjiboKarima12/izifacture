"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { recordPayment } from "@/lib/actions/payments";
import { formatAmount, parseAmountInput, type Currency } from "@/lib/money";
import { todayIso } from "@/lib/dates";
import { changeGiven, PAYMENT_METHOD_LABELS } from "@/lib/payments";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/types";

/**
 * Enregistrement d'un encaissement.
 *
 * Les espèces sont le moyen par défaut : c'est de loin le plus courant chez les
 * utilisateurs visés, et un règlement en liquide doit se saisir sans détour.
 */
export function RecordPaymentDialog({
  invoiceId,
  remaining,
  currency,
  label = "Encaisser",
  variant = "primary",
  open: openProp,
  onOpenChange,
}: {
  invoiceId: string;
  remaining: number;
  currency: Currency;
  label?: string;
  variant?: "primary" | "outline";
  /**
   * Ouverture pilotée de l'extérieur. Sert à déclencher la saisie depuis une
   * entrée de menu, qui ne peut pas être un déclencheur de dialogue : le menu
   * se ferme au clic et emporterait le dialogue avec lui.
   *
   * En mode contrôlé, le bouton intégré n'est PAS rendu — c'est l'appelant qui
   * fournit le sien, sinon deux commandes ouvriraient la même fenêtre.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!controlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [controlled, onOpenChange],
  );
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState(String(remaining));
  const [paidAt, setPaidAt] = React.useState(todayIso());
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [tendered, setTendered] = React.useState("");
  const [reference, setReference] = React.useState("");

  // Remet le formulaire à l'état initial à chaque ouverture : rouvrir après un
  // échec ne doit pas ressortir une saisie à moitié corrigée.
  React.useEffect(() => {
    if (!open) return;
    setAmount(String(remaining));
    setPaidAt(todayIso());
    setMethod("cash");
    setTendered("");
    setReference("");
    setError(null);
  }, [open, remaining]);

  const parsedAmount = parseAmountInput(amount, currency);
  const overpaying = parsedAmount !== null && parsedAmount > remaining;

  /**
   * Le billet tendu ne se demande qu'en espèces : c'est le seul moyen qui rend
   * de la monnaie. Changer de moyen efface la saisie plutôt que de la garder
   * cachée — un montant invisible qui part quand même en base est un piège.
   */
  const cash = method === "cash";
  const parsedTendered = tendered.trim() ? parseAmountInput(tendered, currency) : null;
  const tenderedTooLow =
    parsedTendered !== null && parsedAmount !== null && parsedTendered < parsedAmount;
  const change = tenderedTooLow ? null : changeGiven(parsedAmount ?? 0, parsedTendered);
  const tenderedInvalid = tendered.trim() !== "" && parsedTendered === null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment({
        invoiceId,
        amount: parsedAmount ?? 0,
        paidAt,
        method,
        // Jamais de billet tendu sur autre chose que des espèces, même si le
        // champ a été rempli avant de changer de moyen.
        tendered: cash ? parsedTendered : null,
        reference: reference.trim() || null,
        note: null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {controlled ? null : (
        <Dialog.Trigger asChild>
          <Button size="sm" variant={variant}>
            <Wallet aria-hidden />
            {label}
          </Button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <Dialog.Title className="text-base font-semibold">Enregistrer un encaissement</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Reste dû : {formatAmount(remaining, currency)}
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <Field
              label="Montant encaissé"
              htmlFor="payment-amount"
              hint={overpaying ? undefined : "Modifiable pour un règlement partiel."}
              error={
                parsedAmount === null
                  ? "Montant invalide."
                  : overpaying
                    ? `Supérieur au reste dû (${formatAmount(remaining, currency)}).`
                    : undefined
              }
            >
              <Input
                id="payment-amount"
                inputMode="numeric"
                className="tabular"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>

            <Field label="Moyen de paiement" htmlFor="payment-method">
              <select
                id="payment-method"
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                className="flex h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:border-interactive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-interactive"
              >
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {PAYMENT_METHOD_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            {/*
              Billet tendu et monnaie rendue. Le champ suit le moyen de paiement :
              une carte ou un virement ne rend rien, l'afficher là inviterait à
              saisir une donnée qui n'a pas de sens.

              La monnaie n'est pas un champ mais un calcul montré en direct :
              elle vaut `tendu - encaissé`, et un second champ à remplir serait
              un second chiffre à contredire.
            */}
            {cash ? (
              <Field
                label="Montant remis par le client"
                htmlFor="payment-tendered"
                hint="Facultatif. Sert à imprimer la monnaie rendue sur le reçu."
                error={
                  tenderedInvalid
                    ? "Montant invalide."
                    : tenderedTooLow
                      ? "Inférieur au montant encaissé."
                      : undefined
                }
              >
                <Input
                  id="payment-tendered"
                  inputMode="numeric"
                  className="tabular"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                  placeholder="Facultatif"
                />
              </Field>
            ) : null}

            {cash && change !== null ? (
              <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-muted-foreground">Monnaie à rendre</span>
                <span className="tabular font-semibold">{formatAmount(change, currency)}</span>
              </div>
            ) : null}

            <Field label="Date du règlement" htmlFor="payment-date">
              <Input
                id="payment-date"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </Field>

            <Field
              label="Référence"
              htmlFor="payment-reference"
              hint="Numéro de transaction, de chèque… Facultatif."
            >
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Facultatif"
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="mt-4 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Annuler
              </Button>
            </Dialog.Close>
            <Button
              size="sm"
              disabled={
                pending ||
                parsedAmount === null ||
                parsedAmount <= 0 ||
                tenderedInvalid ||
                tenderedTooLow
              }
              onClick={submit}
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
