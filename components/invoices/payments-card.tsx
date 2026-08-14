"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { deletePayment } from "@/lib/actions/payments";
import { formatAmount, type Currency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { InvoiceStatus, Payment, PaymentMethod } from "@/lib/domain/types";

/**
 * Encaissements d'une facture.
 *
 * Le contenu d'une facture émise est figé, mais ses règlements ne le sont pas :
 * un client revient compléter le solde, ou une saisie est à corriger. C'est donc
 * ici que se fait la gestion, sans jamais toucher aux lignes du document.
 */
const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  cheque: "Chèque",
  card: "Carte",
  other: "Autre",
};

export function PaymentsCard({
  invoiceId,
  status,
  payments,
  remaining,
  currency,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  payments: Payment[];
  remaining: number;
  currency: Currency;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const canRecord = status === "sent" || status === "partially_paid";

  const remove = (paymentId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deletePayment(paymentId, invoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <h2 className="text-base font-semibold">Encaissements</h2>
        {canRecord && remaining > 0 ? (
          <RecordPaymentDialog
            invoiceId={invoiceId}
            remaining={remaining}
            currency={currency}
            label="Ajouter"
          />
        ) : null}
      </CardHeader>

      <CardContent className="pb-6 text-sm">
        {payments.length === 0 ? (
          <p className="text-muted-foreground">Aucun encaissement enregistré.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center gap-2 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="tabular font-medium">
                    {formatAmount(payment.amount, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.paidAt)} · {METHOD_LABELS[payment.method]}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>

                <ConfirmDialog
                  title="Supprimer cet encaissement ?"
                  description={`Le règlement de ${formatAmount(payment.amount, currency)} sera retiré, et le statut de la facture recalculé en conséquence.`}
                  confirmLabel="Supprimer"
                  pending={pending}
                  onConfirm={() => remove(payment.id)}
                  trigger={
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Supprimer l'encaissement de ${formatAmount(payment.amount, currency)}`}
                      className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {remaining > 0 && payments.length > 0 ? (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Reste dû :{" "}
            <span className="tabular font-medium text-foreground">
              {formatAmount(remaining, currency)}
            </span>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
