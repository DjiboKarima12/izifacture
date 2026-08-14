"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Hash, Package, Plus, Save, Trash2, UserRound, Wallet } from "lucide-react";

import { saveInvoice, updateInvoice } from "@/lib/actions/invoices";

import { Button } from "@/components/ui/button";
import { FloatingField, bareInputClasses } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { InvoicePreview, type PreviewLine } from "@/components/invoices/invoice-preview";
import { InvoiceCreatedDialog } from "@/components/invoices/invoice-created-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { computeLine, computeTotals } from "@/lib/tax";
import { formatAmount, parseAmountInput } from "@/lib/money";
import { computeDueDate, todayIso } from "@/lib/dates";
import { previewNextNumber } from "@/lib/numbering";
import { cn } from "@/lib/utils";
import type { Client, InvoiceWithItems, Organization } from "@/lib/domain/types";

/**
 * Éditeur de facture.
 *
 * L'état est géré en `useState` plutôt qu'avec react-hook-form : chaque frappe
 * doit reparcourir le calcul des totaux pour alimenter l'aperçu, donc le
 * formulaire est entièrement contrôlé de toute façon. Les montants restent des
 * CHAÎNES tant que l'utilisateur saisit — on ne convertit qu'au calcul — sinon
 * effacer un champ pour le retaper ferait sauter le curseur.
 *
 * La validation Zod (`invoiceInputSchema`) s'appliquera à la soumission, à
 * l'étape où les Server Actions seront branchées.
 */

type LineState = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type Mode = "standard" | "recurring";

let lineCounter = 0;
const newLine = (taxRate: number): LineState => ({
  id: `line-${(lineCounter += 1)}`,
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: String(taxRate),
});

/** Saisie libre → nombre exploitable. Une saisie vide vaut zéro, jamais NaN. */
function toQuantity(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toRate(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
}

/** Reconstruit l'état du formulaire à partir d'un brouillon existant. */
function linesFromInvoice(invoice: InvoiceWithItems): LineState[] {
  if (invoice.items.length === 0) return [];
  return invoice.items.map((item) => ({
    id: `line-${(lineCounter += 1)}`,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    taxRate: String(item.taxRate),
  }));
}

export function InvoiceEditor({
  organization,
  clients,
  nextSequence,
  invoice,
}: {
  organization: Organization;
  clients: Client[];
  nextSequence: number;
  /** Présent en modification : le formulaire est alors pré-rempli. */
  invoice?: InvoiceWithItems;
}) {
  const isEditing = invoice !== undefined;

  const [mode, setMode] = React.useState<Mode>("standard");
  const [showPreview, setShowPreview] = React.useState(true);
  const [clientId, setClientId] = React.useState(invoice?.clientId ?? clients[0]?.id ?? "");
  const [issueDate, setIssueDate] = React.useState(invoice?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = React.useState(
    invoice?.dueDate ?? computeDueDate(todayIso(), organization.defaultPaymentTerms),
  );
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");
  const [lines, setLines] = React.useState<LineState[]>(() =>
    invoice ? linesFromInvoice(invoice) : [newLine(organization.defaultTaxRate)],
  );

  const documentType = invoice?.type ?? "invoice";
  const client = clients.find((row) => row.id === clientId) ?? null;
  // Un brouillon n'a pas encore de numéro : on montre celui qu'il recevra, avec
  // le préfixe de SON type — un avoir ne prend pas un numéro de facture.
  const numberPreview =
    invoice?.number ??
    previewNextNumber(organization, documentType, nextSequence - 1, Number(issueDate.slice(0, 4)));

  const documentLabel = { invoice: "facture", quote: "devis", credit_note: "avoir" }[documentType];

  // Un seul calcul par rendu, partagé par le formulaire ET l'aperçu.
  const computable = lines.map((line) => ({
    quantity: toQuantity(line.quantity),
    unitPrice: parseAmountInput(line.unitPrice, organization.currency) ?? 0,
    taxRate: toRate(line.taxRate),
    discount: null,
  }));
  const totals = computeTotals(computable);

  const previewLines: PreviewLine[] = lines.map((line, index) => {
    const input = computable[index]!;
    const computed = computeLine(input);
    return {
      id: line.id,
      description: line.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      taxRate: input.taxRate,
      lineSubtotal: computed.lineSubtotal,
      lineTotal: computed.lineTotal,
    };
  });

  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  /** Renseigné après enregistrement : déclenche la boîte de confirmation. */
  const [saved, setSaved] = React.useState<{ id: string; draft: boolean } | null>(null);

  /**
   * Construit l'entrée à partir de l'état du formulaire et délègue au serveur.
   * Les totaux ne sont PAS transmis : le dépôt les recalcule depuis les lignes,
   * donc rien de ce qui vient du navigateur ne peut fausser un montant.
   */
  const submit = (issue: boolean) => {
    setError(null);

    const payload = {
      clientId,
      // On conserve le type du document existant : modifier un brouillon d'avoir
      // ne doit pas le transformer en facture.
      type: invoice?.type ?? ("invoice" as const),
      issueDate,
      dueDate,
      currency: organization.currency,
      notes: notes.trim() || null,
      terms: null,
      items: lines.map((line) => ({
        description: line.description.trim(),
        quantity: toQuantity(line.quantity),
        unitPrice: parseAmountInput(line.unitPrice, organization.currency) ?? 0,
        taxRate: toRate(line.taxRate),
        discount: null,
      })),
    };

    startTransition(async () => {
      const result = invoice
        ? await updateInvoice(invoice.id, payload, { issue })
        : await saveInvoice(payload, { issue });
      if (!result.ok) {
        // Les erreurs de champ sont remontées telles quelles : « Une erreur est
        // survenue » n'aiderait personne à corriger sa saisie.
        const details = result.fieldErrors
          ? Object.values(result.fieldErrors).flat().slice(0, 3).join(" · ")
          : null;
        setError(details ? `${result.error} ${details}` : result.error);
        return;
      }

      // On rafraîchit avant d'ouvrir la boîte : la liste et le tableau de bord
      // doivent déjà refléter le nouveau document quand l'utilisateur y va.
      router.refresh();
      setSaved({ id: result.data.id, draft: !issue });
    });
  };

  const updateLine = (id: string, patch: Partial<LineState>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  const duplicateLine = (id: string) =>
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id);
      if (index === -1) return current;
      const copy = { ...current[index]!, id: `line-${(lineCounter += 1)}` };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });

  // Une facture garde toujours au moins une ligne : un formulaire vide n'aurait
  // aucun sens et bloquerait l'émission.
  const removeLine = (id: string) =>
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id),
    );

  return (
    <div className="flex flex-col lg:h-screen lg:flex-row">
      {/* Colonne formulaire */}
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <nav className="text-xs text-muted-foreground" aria-label="Fil d'Ariane">
          Factures <span className="px-1">›</span>
          <span className="text-foreground">
            {isEditing ? `Modifier l'${documentLabel}` : "Nouvelle facture"}
          </span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isEditing ? `Modifier l'${documentLabel}` : "Nouvelle facture"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {documentType === "credit_note"
                ? "Ajustez les lignes au montant à annuler, puis émettez l'avoir."
                : isEditing
                  ? "Un brouillon se modifie librement. Une fois émis, le document est figé."
                  : "Créez une facture et voyez le rendu final en direct."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Aperçu
            <Switch
              checked={showPreview}
              onCheckedChange={setShowPreview}
              label="Afficher l'aperçu"
            />
          </label>
        </div>

        <Segmented
          className="mt-5 max-w-md"
          label="Type de facturation"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "standard", label: "Standard" },
            { value: "recurring", label: "Récurrente" },
          ]}
        />

        {mode === "recurring" ? (
          <p className="mt-3 rounded-lg bg-accent px-3 py-2.5 text-xs text-accent-foreground">
            La facturation récurrente sera activée à l&apos;étape 6 (génération planifiée).
          </p>
        ) : null}

        <section className="mt-7">
          <h2 className="text-sm font-semibold">Informations</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FloatingField label="Client" htmlFor="client" icon={UserRound} required>
              <select
                id="client"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className={cn(bareInputClasses, "cursor-pointer")}
              >
                {clients.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </FloatingField>

            <FloatingField label="Numéro" htmlFor="number" icon={Hash}>
              <input
                id="number"
                readOnly
                value={numberPreview}
                className={cn(bareInputClasses, "tabular text-muted-foreground")}
              />
            </FloatingField>

            {/*
              Les deux dates se lisent ensemble : elles restent côte à côte même
              sur mobile. `sm:contents` dissout ce conteneur à partir de `sm`,
              pour qu'elles redeviennent des cellules de la grille parente.
              Les icônes sont omises ici : sur un écran de 320 px, un champ date
              natif a besoin de toute la largeur disponible, et le libellé encoché
              dit déjà de quelle date il s'agit.
            */}
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <FloatingField label="Date d'émission" htmlFor="issue-date" required>
                <input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className={bareInputClasses}
                />
              </FloatingField>

              <FloatingField
                label="Échéance"
                htmlFor="due-date"
                required
                error={dueDate < issueDate ? "L'échéance précède la date d'émission." : undefined}
              >
                <input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={bareInputClasses}
                />
              </FloatingField>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Lignes de facturation</h2>

          <div className="mt-4 space-y-3">
            {lines.map((line, index) => (
              <div key={line.id} className="rounded-xl border border-border bg-surface/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Ligne {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateLine(line.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={`Dupliquer la ligne ${index + 1}`}
                    >
                      <Copy className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                      aria-label={`Supprimer la ligne ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <FloatingField
                  label="Désignation"
                  htmlFor={`${line.id}-description`}
                  icon={Package}
                  required
                >
                  <input
                    id={`${line.id}-description`}
                    value={line.description}
                    onChange={(event) =>
                      updateLine(line.id, { description: event.target.value })
                    }
                    placeholder="Prestation, produit…"
                    className={bareInputClasses}
                  />
                </FloatingField>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <FloatingField label="Qté" htmlFor={`${line.id}-quantity`}>
                    <input
                      id={`${line.id}-quantity`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                      className={cn(bareInputClasses, "tabular")}
                    />
                  </FloatingField>

                  <FloatingField label="TVA %" htmlFor={`${line.id}-tax`}>
                    <input
                      id={`${line.id}-tax`}
                      inputMode="decimal"
                      value={line.taxRate}
                      onChange={(event) => updateLine(line.id, { taxRate: event.target.value })}
                      className={cn(bareInputClasses, "tabular")}
                    />
                  </FloatingField>

                  <FloatingField label="Prix unitaire" htmlFor={`${line.id}-price`}>
                    <input
                      id={`${line.id}-price`}
                      inputMode="numeric"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })}
                      placeholder="0"
                      className={cn(bareInputClasses, "tabular")}
                    />
                  </FloatingField>
                </div>

                <p className="tabular mt-2 text-right text-xs text-muted-foreground">
                  Total ligne&nbsp;:{" "}
                  <span className="font-medium text-foreground">
                    {formatAmount(previewLines[index]?.lineTotal ?? 0, organization.currency)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLines((current) => [...current, newLine(organization.defaultTaxRate)])}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-interactive hover:text-interactive"
          >
            <Plus className="size-4" aria-hidden />
            Ajouter une ligne
          </button>
        </section>

        <section className="mt-8">
          <FloatingField label="Note affichée sur la facture" htmlFor="notes" icon={Wallet}>
            <input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Conditions de règlement, mention particulière…"
              className={bareInputClasses}
            />
          </FloatingField>
        </section>

        <div className="mt-8 rounded-xl border border-border bg-surface/60 p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total HT</dt>
              <dd className="tabular font-medium">
                {formatAmount(totals.subtotal, organization.currency)}
              </dd>
            </div>
            {totals.taxBreakdown
              .filter((bucket) => bucket.rate > 0)
              .map((bucket) => (
                <div key={bucket.rate} className="flex justify-between">
                  <dt className="text-muted-foreground">TVA {bucket.rate} %</dt>
                  <dd className="tabular font-medium">
                    {formatAmount(bucket.tax, organization.currency)}
                  </dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <dt className="font-semibold">Total TTC</dt>
              <dd className="tabular font-bold">
                {formatAmount(totals.total, organization.currency)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 pb-6">
          <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
            <Save aria-hidden />
            {isEditing ? "Enregistrer les modifications" : "Enregistrer le brouillon"}
          </Button>
          {/*
            Création = attribution du numéro et gel du document. C'est
            irréversible : on demande confirmation, en rappelant le montant pour
            que la validation soit consciente et pas machinale.
          */}
          <ConfirmDialog
            confirmVariant="primary"
            title={documentType === "quote" ? "Créer ce devis ?" : "Créer cette facture ?"}
            description={`Le document recevra le numéro ${numberPreview} pour un total de ${formatAmount(totals.total, organization.currency)}. Il sera alors figé : ses lignes ne pourront plus être modifiées, seulement corrigées par un avoir.`}
            confirmLabel={documentType === "quote" ? "Créer le devis" : "Créer la facture"}
            pending={pending}
            onConfirm={() => submit(true)}
            trigger={
              <Button disabled={pending}>
                <Check aria-hidden />
                {documentType === "quote" ? "Créer le devis" : "Créer la facture"}
              </Button>
            }
          />

          {pending ? (
            <span className="text-xs text-muted-foreground">Enregistrement…</span>
          ) : null}

          {error ? (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <p className="w-full text-xs text-muted-foreground">
            Créer le document lui attribue son numéro et le fige. L&apos;envoi au client par
            email viendra plus tard.
          </p>
        </div>
      </div>

      <InvoiceCreatedDialog
        invoiceId={saved?.id ?? null}
        number={saved && !saved.draft ? numberPreview : null}
        isDraft={saved?.draft ?? false}
        onOpenChange={(open) => {
          if (!open) setSaved(null);
        }}
      />

      {/* Colonne aperçu */}
      {showPreview ? (
        <aside className="w-full shrink-0 border-t border-border bg-surface px-4 py-6 lg:w-[460px] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-6">
          <p className="mb-4 text-sm font-medium">Aperçu</p>
          <InvoicePreview
            issuer={organization}
            client={client}
            currency={organization.currency}
            type={documentType}
            number={numberPreview}
            issueDate={issueDate}
            dueDate={dueDate < issueDate ? issueDate : dueDate}
            lines={previewLines}
            totals={totals}
            notes={notes}
          />
        </aside>
      ) : null}
    </div>
  );
}
