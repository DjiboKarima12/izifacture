"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  FileMinus,
  FileOutput,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import {
  cancelInvoice,
  convertQuote,
  createCreditNote,
  deleteInvoice,
  issueInvoice,
  markInvoicePaid,
  type ActionResult,
} from "@/lib/actions/invoices";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/money";
import type { DocumentType, InvoiceStatus } from "@/lib/domain/types";

/**
 * Actions d'un document.
 *
 * Les changements d'état passent par un menu unique, mais chaque entrée reste
 * une transition légitime de la machine à états : on ne propose jamais une
 * action que le serveur refuserait ensuite. Les entrées inapplicables sont
 * désactivées plutôt que masquées, pour que la logique reste lisible.
 */
const itemClasses =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-45";

export function InvoiceDetailActions({
  invoiceId,
  type,
  status,
  remaining,
  currency,
  className,
}: {
  invoiceId: string;
  type: DocumentType;
  status: InvoiceStatus;
  remaining: number;
  currency: Currency;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const run = (action: () => Promise<ActionResult<unknown>>, redirectTo?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  /** Les documents créés (avoir, facture issue d'un devis) s'ouvrent en édition. */
  const runAndOpen = (action: () => Promise<ActionResult<{ id: string }>>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/invoices/${result.data.id}/edit`);
    });
  };

  const isQuote = type === "quote";
  const isDraft = status === "draft";
  const isOpen = status === "sent" || status === "partially_paid";
  const isSettled = status === "paid" || status === "cancelled";

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="sm" disabled={pending || isSettled}>
              Changer statut
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-60 rounded-lg border border-border bg-popover p-1 shadow-raised animate-fade-in"
            >
              <DropdownMenu.Label className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Action rapide
              </DropdownMenu.Label>

              <DropdownMenu.Item
                disabled={!isDraft}
                className={itemClasses}
                onSelect={() => run(() => issueInvoice(invoiceId))}
              >
                <Send className="size-4 shrink-0" aria-hidden />
                {isQuote ? "Marquer comme envoyé" : "Marquer comme envoyée"}
              </DropdownMenu.Item>

              {isQuote ? (
                <DropdownMenu.Item
                  disabled={!isOpen}
                  className={itemClasses}
                  onSelect={() => runAndOpen(() => convertQuote(invoiceId))}
                >
                  <FileOutput className="size-4 shrink-0" aria-hidden />
                  Accepter et facturer
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  disabled={!isOpen || remaining === 0}
                  className={itemClasses}
                  onSelect={() => run(() => markInvoicePaid(invoiceId))}
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Marquer comme payée
                </DropdownMenu.Item>
              )}

              {!isQuote ? (
                <DropdownMenu.Item
                  disabled={!isOpen}
                  className={itemClasses}
                  onSelect={() => runAndOpen(() => createCreditNote(invoiceId))}
                >
                  <FileMinus className="size-4 shrink-0" aria-hidden />
                  Créer un avoir
                </DropdownMenu.Item>
              ) : null}

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                disabled={isSettled}
                className={cn(itemClasses, "text-destructive focus:bg-destructive/10")}
                onSelect={() => run(() => cancelInvoice(invoiceId))}
              >
                <Ban className="size-4 shrink-0" aria-hidden />
                {isQuote ? "Refuser le devis" : "Annuler la facture"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {isDraft ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoiceId}/edit`}>
              <Pencil aria-hidden />
              Modifier
            </Link>
          </Button>
        ) : null}

        {isOpen && !isQuote && remaining > 0 ? (
          <RecordPaymentDialog invoiceId={invoiceId} remaining={remaining} currency={currency} />
        ) : null}

        {isDraft ? (
          <ConfirmDialog
            title="Supprimer ce brouillon ?"
            description="Le brouillon sera définitivement supprimé. Aucun numéro n'ayant été attribué, la numérotation reste continue."
            confirmLabel="Supprimer"
            pending={pending}
            onConfirm={() => run(() => deleteInvoice(invoiceId), "/invoices")}
            trigger={
              <Button
                variant="outline"
                size="icon"
                disabled={pending}
                aria-label="Supprimer le brouillon"
                className="size-9 text-destructive hover:bg-destructive/10"
              >
                <Trash2 aria-hidden />
              </Button>
            }
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
