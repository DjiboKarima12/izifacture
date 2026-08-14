"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { updateOrganization } from "@/lib/actions/organization";
import type { Organization } from "@/lib/domain/types";

export type SettingsTab = "profil" | "regional" | "modeles";

/**
 * Paramètres de l'entreprise.
 *
 * Ce composant porte AUSSI l'en-tête de page, parce que le bouton
 * « Enregistrer » y vit et dépend de l'état du formulaire : un bouton rendu
 * côté serveur ne pourrait pas savoir si quelque chose a changé. La navigation
 * par onglets reste rendue côté serveur et lui est passée en prop.
 *
 * Un seul état porte les TROIS onglets, même s'il n'en affiche qu'un : le schéma
 * valide l'organisation entière, donc un envoi partiel effacerait les champs des
 * autres onglets. Seul l'affichage est découpé.
 */
export function OrganizationForm({
  organization,
  tab,
  nav,
}: {
  organization: Organization;
  tab: SettingsTab;
  nav: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  const initial = React.useMemo(
    () => ({
      name: organization.name,
      legalName: organization.legalName ?? "",
      email: organization.email ?? "",
      phone: organization.phone ?? "",
      addressLine: organization.addressLine ?? "",
      city: organization.city ?? "",
      country: organization.country,
      taxId: organization.taxId ?? "",
      currency: organization.currency,
      defaultTaxRate: String(organization.defaultTaxRate),
      defaultPaymentTerms: String(organization.defaultPaymentTerms),
      invoicePrefix: organization.invoicePrefix,
      quotePrefix: organization.quotePrefix,
      creditNotePrefix: organization.creditNotePrefix,
      invoiceFooter: organization.invoiceFooter ?? "",
    }),
    [organization],
  );

  const [form, setForm] = React.useState(initial);

  // Se recale sur le serveur après un enregistrement réussi.
  React.useEffect(() => setForm(initial), [initial]);

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const isDirty = React.useMemo(
    () =>
      (Object.keys(initial) as Array<keyof typeof form>).some((key) => form[key] !== initial[key]),
    [form, initial],
  );

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateOrganization({
        ...form,
        defaultTaxRate: Number(form.defaultTaxRate.replace(",", ".")),
        defaultPaymentTerms: Number(form.defaultPaymentTerms),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmed(true);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les configurations générales de votre espace de travail.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDirty ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                setForm(initial);
                setError(null);
              }}
            >
              Annuler
            </Button>
          ) : null}
          <Button size="sm" disabled={pending || !isDirty} onClick={submit}>
            <Save aria-hidden />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {nav}

        <div className="min-w-0 space-y-5">
          {tab === "profil" ? (
            <>
              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-base font-semibold">Identité de l&apos;entreprise</h2>
                  <p className="text-sm text-muted-foreground">
                    Les informations officielles de votre société.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 pb-6 sm:grid-cols-2">
                  <Field label="Nom commercial" htmlFor="org-name" required>
                    <Input id="org-name" value={form.name} onChange={set("name")} />
                  </Field>
                  <Field label="Nom légal" htmlFor="org-legal">
                    <Input id="org-legal" value={form.legalName} onChange={set("legalName")} />
                  </Field>
                  <Field label="RC ou NIF" htmlFor="org-tax" hint="Identifiant fiscal officiel.">
                    <Input id="org-tax" value={form.taxId} onChange={set("taxId")} />
                  </Field>
                  <Field label="Ville" htmlFor="org-city">
                    <Input id="org-city" value={form.city} onChange={set("city")} />
                  </Field>
                  <Field label="Adresse du siège" htmlFor="org-address" className="sm:col-span-2">
                    <Input
                      id="org-address"
                      value={form.addressLine}
                      onChange={set("addressLine")}
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-base font-semibold">Coordonnées</h2>
                  <p className="text-sm text-muted-foreground">
                    Visibles publiquement sur vos documents.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 pb-6 sm:grid-cols-2">
                  <Field label="Email de contact" htmlFor="org-email">
                    <Input id="org-email" type="email" value={form.email} onChange={set("email")} />
                  </Field>
                  <Field label="Téléphone" htmlFor="org-phone">
                    <Input id="org-phone" value={form.phone} onChange={set("phone")} />
                  </Field>
                </CardContent>
              </Card>
            </>
          ) : null}

          {tab === "regional" ? (
            <Card>
              <CardHeader className="pb-4">
                <h2 className="text-base font-semibold">Régional &amp; Devise</h2>
                <p className="text-sm text-muted-foreground">
                  Valeurs appliquées par défaut à chaque nouveau document.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 pb-6 sm:grid-cols-3">
                <Field label="Pays" htmlFor="org-country" required>
                  <Input id="org-country" value={form.country} onChange={set("country")} />
                </Field>
                <Field label="Devise" htmlFor="org-currency" hint="Le franc CFA n'a pas de décimale.">
                  <Input id="org-currency" value={form.currency} readOnly />
                </Field>
                <Field
                  label="TVA par défaut (%)"
                  htmlFor="org-tax-rate"
                  hint="19 % au Niger, 18 % au Sénégal."
                >
                  <Input
                    id="org-tax-rate"
                    inputMode="decimal"
                    className="tabular"
                    value={form.defaultTaxRate}
                    onChange={set("defaultTaxRate")}
                  />
                </Field>
                <Field
                  label="Délai de paiement (jours)"
                  htmlFor="org-terms"
                  className="sm:col-span-3"
                  hint="Sert à calculer l'échéance à partir de la date d'émission."
                >
                  <Input
                    id="org-terms"
                    inputMode="numeric"
                    className="tabular"
                    value={form.defaultPaymentTerms}
                    onChange={set("defaultPaymentTerms")}
                  />
                </Field>
              </CardContent>
            </Card>
          ) : null}

          {tab === "modeles" ? (
            <Card>
              <CardHeader className="pb-4">
                <h2 className="text-base font-semibold">Modèles de facturation</h2>
                <p className="text-sm text-muted-foreground">
                  Le numéro est attribué à la création définitive, jamais au brouillon : la
                  séquence reste sans trou.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 pb-6 sm:grid-cols-3">
                <Field label="Préfixe facture" htmlFor="prefix-invoice" hint="Ex. FAC-2026-0001">
                  <Input
                    id="prefix-invoice"
                    value={form.invoicePrefix}
                    onChange={set("invoicePrefix")}
                  />
                </Field>
                <Field label="Préfixe devis" htmlFor="prefix-quote">
                  <Input id="prefix-quote" value={form.quotePrefix} onChange={set("quotePrefix")} />
                </Field>
                <Field label="Préfixe avoir" htmlFor="prefix-credit">
                  <Input
                    id="prefix-credit"
                    value={form.creditNotePrefix}
                    onChange={set("creditNotePrefix")}
                  />
                </Field>
                <Field label="Mention de bas de page" htmlFor="org-footer" className="sm:col-span-3">
                  <Textarea
                    id="org-footer"
                    value={form.invoiceFooter}
                    onChange={set("invoiceFooter")}
                  />
                </Field>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={confirmed} onOpenChange={setConfirmed}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 animate-overlay-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-6 text-center shadow-raised animate-fade-in">
            <span
              className="mx-auto flex size-11 items-center justify-center rounded-full bg-status-paid-bg text-status-paid"
              aria-hidden
            >
              <CheckCircle2 className="size-5" />
            </span>

            <Dialog.Title className="mt-4 text-base font-semibold">
              Paramètres mis à jour
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Vos nouvelles informations d&apos;entreprise ont bien été enregistrées. Elles
              apparaîtront sur vos prochaines factures — les documents déjà émis restent
              inchangés.
            </Dialog.Description>

            <Dialog.Close asChild>
              <Button className="mt-6 w-full">Fermer</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
