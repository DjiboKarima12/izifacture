"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createClient, updateClient } from "@/lib/actions/clients";
import type { Client } from "@/lib/domain/types";

/**
 * Formulaire client, en création comme en modification.
 *
 * Un seul composant pour les deux : les champs, leur validation et leur
 * disposition doivent rester identiques, sinon les deux écrans divergent au
 * premier ajout de champ.
 */
export function ClientFormDialog({
  client,
  trigger,
  onSaved,
}: {
  client?: Client;
  trigger: React.ReactNode;
  /** Appelé après enregistrement, avec l'identifiant du client. */
  onSaved?: (clientId: string) => void;
}) {
  const router = useRouter();
  const isEditing = client !== undefined;

  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    country: "Niger",
    taxId: "",
    notes: "",
  });

  // Recharge les valeurs à chaque ouverture : rouvrir après un abandon ne doit
  // pas ressortir une saisie à moitié modifiée.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: client?.name ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      addressLine: client?.addressLine ?? "",
      city: client?.city ?? "",
      country: client?.country ?? "Niger",
      taxId: client?.taxId ?? "",
      notes: client?.notes ?? "",
    });
  }, [open, client]);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = isEditing ? await updateClient(client.id, form) : await createClient(form);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onSaved?.(result.data.id);
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <Dialog.Title className="text-base font-semibold">
            {isEditing ? "Modifier le client" : "Nouveau client"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Ces coordonnées seront reprises sur les factures adressées à ce client.
          </Dialog.Description>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="client-name" required className="sm:col-span-2">
              <Input
                id="client-name"
                value={form.name}
                onChange={set("name")}
                placeholder="Raison sociale ou nom complet"
                autoFocus
              />
            </Field>

            <Field label="Email" htmlFor="client-email">
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="contact@exemple.ne"
              />
            </Field>

            <Field label="Téléphone" htmlFor="client-phone">
              <Input
                id="client-phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+227 90 00 00 00"
              />
            </Field>

            <Field label="Adresse" htmlFor="client-address" className="sm:col-span-2">
              <Input
                id="client-address"
                value={form.addressLine}
                onChange={set("addressLine")}
                placeholder="Rue, quartier"
              />
            </Field>

            <Field label="Ville" htmlFor="client-city">
              <Input id="client-city" value={form.city} onChange={set("city")} />
            </Field>

            <Field label="Pays" htmlFor="client-country">
              <Input id="client-country" value={form.country} onChange={set("country")} />
            </Field>

            <Field
              label="Identifiant fiscal"
              htmlFor="client-tax"
              hint="NIF, RCCM… Facultatif."
              className="sm:col-span-2"
            >
              <Input id="client-tax" value={form.taxId} onChange={set("taxId")} />
            </Field>

            <Field label="Notes internes" htmlFor="client-notes" className="sm:col-span-2">
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Visible par votre équipe uniquement."
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
            <Button size="sm" disabled={pending || form.name.trim().length < 2} onClick={submit}>
              {pending ? "Enregistrement…" : isEditing ? "Enregistrer" : "Créer le client"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
