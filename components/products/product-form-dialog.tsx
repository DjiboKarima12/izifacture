"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { formatAmount, parseAmountInput, type Currency } from "@/lib/money";
import type { Product } from "@/lib/domain/types";

/**
 * Formulaire produit, en création comme en modification.
 *
 * Un seul composant pour les deux : les champs et leur validation doivent
 * rester identiques, sinon les deux écrans divergent au premier ajout de champ.
 */
export function ProductFormDialog({
  product,
  currency,
  defaultTaxRate,
  trigger,
}: {
  product?: Product;
  currency: Currency;
  /** Celui de l'organisation : le cas courant, qu'on peut corriger par produit. */
  defaultTaxRate: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEditing = product !== undefined;

  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    unitPrice: "",
    taxRate: String(defaultTaxRate),
    barcode: "",
    unit: "",
    notes: "",
  });

  // Recharge les valeurs à chaque ouverture : rouvrir après un abandon ne doit
  // pas ressortir une saisie à moitié modifiée.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: product?.name ?? "",
      unitPrice: product ? String(product.unitPrice) : "",
      taxRate: String(product?.taxRate ?? defaultTaxRate),
      barcode: product?.barcode ?? "",
      unit: product?.unit ?? "",
      notes: product?.notes ?? "",
    });
  }, [open, product, defaultTaxRate]);

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const prix = parseAmountInput(form.unitPrice, currency);
  const prixInvalide = form.unitPrice.trim() !== "" && prix === null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        name: form.name,
        // Le montant est converti ICI, une seule fois : le reste de la chaîne ne
        // manipule que des entiers, jamais la chaîne saisie.
        unitPrice: prix ?? 0,
        taxRate: Number(form.taxRate.replace(",", ".")),
        barcode: form.barcode.trim() || null,
        unit: form.unit.trim() || null,
        notes: form.notes.trim() || null,
      };

      const result = isEditing
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);

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
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-popover p-6 shadow-raised animate-fade-in">
          <Dialog.Title className="text-base font-semibold">
            {isEditing ? "Modifier le produit" : "Nouveau produit"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Enregistré une fois, il se saisit ensuite en deux gestes sur une facture.
          </Dialog.Description>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="product-name" required className="sm:col-span-2">
              <Input
                id="product-name"
                value={form.name}
                onChange={set("name")}
                placeholder="Attiéké poisson, sachet de riz 5 kg…"
                autoFocus
              />
            </Field>

            <Field
              label="Prix unitaire"
              htmlFor="product-price"
              hint={prix !== null && prix > 0 ? formatAmount(prix, currency) : undefined}
              error={prixInvalide ? "Montant invalide." : undefined}
            >
              <Input
                id="product-price"
                inputMode="numeric"
                className="tabular"
                value={form.unitPrice}
                onChange={set("unitPrice")}
                placeholder="0"
              />
            </Field>

            <Field label="TVA %" htmlFor="product-tax">
              <Input
                id="product-tax"
                inputMode="decimal"
                className="tabular"
                value={form.taxRate}
                onChange={set("taxRate")}
              />
            </Field>

            <Field
              label="Code-barres"
              htmlFor="product-barcode"
              hint="Scannez-le ici pour le retrouver ensuite au scan. Facultatif."
              className="sm:col-span-2"
            >
              <Input
                id="product-barcode"
                className="tabular"
                value={form.barcode}
                onChange={set("barcode")}
                placeholder="6001234567890"
              />
            </Field>

            <Field label="Unité" htmlFor="product-unit" hint="plat, kg, sachet… Facultatif.">
              <Input id="product-unit" value={form.unit} onChange={set("unit")} />
            </Field>

            <Field label="Notes internes" htmlFor="product-notes" className="sm:col-span-2">
              <Textarea
                id="product-notes"
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
            <Button
              size="sm"
              disabled={pending || form.name.trim().length < 1 || prixInvalide}
              onClick={submit}
            >
              {pending ? "Enregistrement…" : isEditing ? "Enregistrer" : "Créer le produit"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
