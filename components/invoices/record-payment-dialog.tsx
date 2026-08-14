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
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/types";

/**
 * Enregistrement d'un encaissement.
 *
 * Les espèces sont le moyen par défaut : c'est de loin le plus courant chez les
 * utilisateurs visés, et un règlement en liquide doit se saisir sans détour.
 */
const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement bancaire",
  cheque: "Chèque",
  card: "Carte bancaire",
  other: "Autre",
};

export function RecordPaymentDialog({
  invoiceId,
  remaining,
  currency,
  label = "Encaisser",
  variant = "primary",
}: {
  invoiceId: string;
  remaining: number;
  currency: Currency;
  label?: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState(String(remaining));
  const [paidAt, setPaidAt] = React.useState(todayIso());
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [reference, setReference] = React.useState("");

  // Remet le formulaire à l'état initial à chaque ouverture : rouvrir après un
  // échec ne doit pas ressortir une saisie à moitié corrigée.
  React.useEffect(() => {
    if (!open) return;
    setAmount(String(remaining));
    setPaidAt(todayIso());
    setMethod("cash");
    setReference("");
    setError(null);
  }, [open, remaining]);

  const parsedAmount = parseAmountInput(amount, currency);
  const overpaying = parsedAmount !== null && parsedAmount > remaining;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment({
        invoiceId,
        amount: parsedAmount ?? 0,
        paidAt,
        method,
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
      <Dialog.Trigger asChild>
        <Button size="sm" variant={variant}>
          <Wallet aria-hidden />
          {label}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <Dialog.Title className="text-base font-semibold">Enregistrer un encaissement</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Reste dû : {formatAmount(remaining, currency)}
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <Field
              label="Montant reçu"
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
                    {METHOD_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

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
              disabled={pending || parsedAmount === null || parsedAmount <= 0}
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
