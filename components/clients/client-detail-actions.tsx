"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { archiveClient, restoreClient } from "@/lib/actions/clients";
import type { Client } from "@/lib/domain/types";

export function ClientDetailActions({
  client,
  invoiceCount,
}: {
  client: Client;
  invoiceCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const isArchived = client.archivedAt !== null;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, redirectTo?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <ClientFormDialog
          client={client}
          trigger={
            <Button variant="outline" size="sm" disabled={pending}>
              <Pencil aria-hidden />
              Modifier
            </Button>
          }
        />

        {isArchived ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => restoreClient(client.id))}>
            <ArchiveRestore aria-hidden />
            Réactiver
          </Button>
        ) : (
          <ConfirmDialog
            title={`Supprimer ${client.name} ?`}
            description={
              invoiceCount > 0
                ? `Ce client a ${invoiceCount} document${invoiceCount > 1 ? "s" : ""}. Il sera retiré de vos listes, mais ses factures restent intactes et consultables — une facture émise ne peut pas perdre son client.`
                : "Le client sera retiré de vos listes. Vous pourrez le réactiver depuis les clients archivés."
            }
            confirmLabel="Supprimer"
            pending={pending}
            onConfirm={() => run(() => archiveClient(client.id), "/clients")}
            trigger={
              <Button variant="outline" size="sm" disabled={pending}>
                <Trash2 aria-hidden />
                Supprimer
              </Button>
            }
          />
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
