"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Hash,
  Package,
  Plus,
  Printer,
  Save,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";

import { saveInvoice, updateInvoice } from "@/lib/actions/invoices";

import { Button } from "@/components/ui/button";
import { FloatingField, bareInputClasses } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { ClientCombobox } from "@/components/invoices/client-combobox";
import { InvoicePreview, type PreviewLine } from "@/components/invoices/invoice-preview";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { ProductScanner } from "@/components/invoices/product-scanner";
import { addScannedProduct, type ScannableLine } from "@/lib/catalogue";
import { InvoiceCreatedDialog } from "@/components/invoices/invoice-created-dialog";
import { PrintPageSize } from "@/components/invoices/print-page-size";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { computeLine, computeTotals } from "@/lib/tax";
import { formatAmount, parseAmountInput } from "@/lib/money";
import { computeDueDate, todayIso } from "@/lib/dates";
import { previewNextNumber } from "@/lib/numbering";
import { PAYMENT_METHOD_LABELS, settleAtCounter } from "@/lib/payments";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type Client,
  type DocumentType,
  type InvoiceWithItems,
  type Organization,
  type PaymentMethod,
  type Product,
} from "@/lib/domain/types";

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

type LineState = ScannableLine;

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
  products,
  nextSequence,
  invoice,
  documentType: requestedType = "invoice",
}: {
  organization: Organization;
  clients: Client[];
  /**
   * Catalogue, pour la suggestion à la frappe dans Désignation.
   *
   * Chargé en entier côté serveur plutôt que cherché à chaque touche : une
   * boutique a des dizaines d'articles, pas des dizaines de milliers, et un
   * aller-retour réseau par caractère rendrait la saisie poussive au comptoir.
   */
  products: Product[];
  nextSequence: number;
  /**
   * Type du document à CRÉER. Ignoré en modification : on ne transforme pas un
   * devis en facture en rouvrant son brouillon — c'est le rôle d'« Accepter et
   * facturer », qui crée un second document et conserve les deux.
   */
  documentType?: DocumentType;
  /** Présent en modification : le formulaire est alors pré-rempli. */
  invoice?: InvoiceWithItems;
}) {
  const isEditing = invoice !== undefined;

  const [mode, setMode] = React.useState<Mode>("standard");
  const [showPreview, setShowPreview] = React.useState(true);
  /**
   * Vide par défaut — et non le premier client de la liste.
   *
   * Pré-remplir désignait un client au hasard : dans la précipitation du
   * comptoir, la facture partait au nom de quelqu'un qui n'avait rien acheté.
   * Mieux vaut n'accuser personne que de se tromper de client.
   */
  const [clientId, setClientId] = React.useState(invoice?.clientId ?? "");
  const [issueDate, setIssueDate] = React.useState(invoice?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = React.useState(
    invoice?.dueDate ?? computeDueDate(todayIso(), organization.defaultPaymentTerms),
  );
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");

  /**
   * Règlement encaissé au comptoir, saisi ICI plutôt que sur la page de la
   * facture : celui qui vend encaisse dans le même geste. L'obliger à créer le
   * document, à l'ouvrir, puis à rouvrir une fenêtre pour dire « payé en
   * espèces » lui fait faire trois écrans pour une seule opération.
   *
   * Ne part qu'avec la création. Un brouillon n'a pas de numéro, donc rien à
   * encaisser — la base le refuserait.
   */
  const [settled, setSettled] = React.useState(false);
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [received, setReceived] = React.useState("");
  const [lines, setLines] = React.useState<LineState[]>(() =>
    invoice ? linesFromInvoice(invoice) : [newLine(organization.defaultTaxRate)],
  );

  // En modification, le type du document existant l'emporte toujours.
  const documentType = invoice?.type ?? requestedType;
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

  /**
   * Un seul chiffre saisi — ce que le client donne — et tout se déduit : ce qui
   * est encaissé, la monnaie à rendre, le reste dû.
   *
   * Donner moins que le total est un ACOMPTE, pas une erreur : le client règle
   * ce qu'il a, repart avec un reçu portant le reste, et complète plus tard.
   * Champ vide = le compte juste, qui est le cas courant.
   *
   * Le même calcul tourne côté serveur (`settleAtCounter`) : ce que l'aperçu
   * annonce est très exactement ce qui sera enregistré.
   */
  const parsedReceived = received.trim() ? parseAmountInput(received, organization.currency) : null;
  const receivedInvalid = received.trim() !== "" && parsedReceived === null;
  const settlement = settleAtCounter(totals.total, method, parsedReceived);

  // Un devis ne s'encaisse pas, un avoir non plus : ni l'un ni l'autre n'appelle
  // de paiement. Le bloc n'a de sens que sur une facture.
  const settleable = documentType === "invoice" && !isEditing;

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
  /**
   * Le numéro est FIGÉ ici, au moment du succès, et non relu depuis les props.
   *
   * `router.refresh()` juste avant fait revenir du serveur une séquence déjà
   * incrémentée : `numberPreview` vaut alors le numéro de la PROCHAINE facture.
   * La boîte annonçait donc « FAC-2026-0011 enregistrée » pour une facture
   * numérotée 0010. Sur un document comptable, c'est le genre d'erreur qu'on ne
   * remarque qu'en cherchant une facture qui n'existe pas.
   */
  const [saved, setSaved] = React.useState<{
    id: string;
    draft: boolean;
    number: string;
  } | null>(null);

  /**
   * Construit l'entrée à partir de l'état du formulaire et délègue au serveur.
   * Les totaux ne sont PAS transmis : le dépôt les recalcule depuis les lignes,
   * donc rien de ce qui vient du navigateur ne peut fausser un montant.
   */
  const submit = (issue: boolean) => {
    setError(null);

    const payload = {
      clientId: clientId || null,
      // On conserve le type du document existant : modifier un brouillon d'avoir
      // ne doit pas le transformer en facture.
      type: documentType,
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
      /**
       * Ni montant ni total : le serveur encaisse `invoice.total`, qu'il vient
       * de recalculer depuis les lignes. On ne lui envoie que ce qu'il ne peut
       * pas déduire — le moyen employé et le billet tendu.
       */
      const payment =
        issue && settleable && settled ? { method, received: parsedReceived } : undefined;

      const result = invoice
        ? await updateInvoice(invoice.id, payload, { issue })
        : await saveInvoice(payload, { issue, settlement: payment });
      if (!result.ok) {
        // Les erreurs de champ sont remontées telles quelles : « Une erreur est
        // survenue » n'aiderait personne à corriger sa saisie.
        const details = result.fieldErrors
          ? Object.values(result.fieldErrors).flat().slice(0, 3).join(" · ")
          : null;
        setError(details ? `${result.error} ${details}` : result.error);
        return;
      }

      /**
       * Le document existe, mais son encaissement a pu échouer après coup. On
       * le dit sans ambiguïté ET on ouvre quand même la boîte de confirmation :
       * elle mène à la facture, qui est justement l'endroit où rattraper le
       * règlement. Laisser croire à un échec ferait recréer la facture.
       */
      const failed = "settlementFailed" in result.data ? result.data.settlementFailed : undefined;
      setError(
        failed
          ? `La facture a bien été créée, mais le règlement n'a pas été enregistré : ${failed} Ouvrez-la et utilisez « Encaisser ».`
          : null,
      );

      // On rafraîchit avant d'ouvrir la boîte : la liste et le tableau de bord
      // doivent déjà refléter le nouveau document quand l'utilisateur y va.
      router.refresh();
      setSaved({ id: result.data.id, draft: !issue, number: numberPreview });
    });
  };

  /**
   * Remet le formulaire à blanc pour la vente suivante.
   *
   * C'est le geste du comptoir : on encaisse, on tend le reçu, et le client
   * d'après est déjà là. Obliger à cliquer sur « Nouvelle facture » ajoutait une
   * étape à l'opération la plus répétée de la journée.
   *
   * Appelé à la FERMETURE de la boîte de confirmation, pas au succès : tant
   * qu'elle est ouverte, le formulaire porte encore la facture qu'on vient de
   * créer, donc « Imprimer » sort le bon ticket. Vider avant aurait imprimé un
   * ticket vide.
   */
  const resetForm = () => {
    setClientId("");
    setIssueDate(todayIso());
    setDueDate(computeDueDate(todayIso(), organization.defaultPaymentTerms));
    setNotes("");
    setLines([newLine(organization.defaultTaxRate)]);
    setSettled(false);
    setMethod("cash");
    setReceived("");
    setError(null);
  };

  /**
   * Ajoute l'article scanné, ou augmente sa quantité s'il est déjà sur la vente.
   *
   * Scanner trois fois la même boîte doit donner « 3 × boîte », pas trois lignes
   * identiques : c'est ce que fait une caisse, et c'est ce qui se lit sur le
   * ticket. Les articles DIFFÉRENTS ajoutent bien une ligne chacun.
   *
   * Cas particulier de la première ligne : le formulaire s'ouvre avec une ligne
   * vide. La remplir plutôt que d'en ajouter une évite de laisser une ligne
   * fantôme en tête de facture, qui bloquerait l'émission faute de désignation.
   */
  const addFromProduct = (product: Product) => {
    setLines((current) =>
      addScannedProduct(current, product, () => `line-${(lineCounter += 1)}`),
    );
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

  /**
   * Le ticket, construit UNE fois et rendu deux fois : dans la colonne d'aperçu
   * et dans la copie d'impression. Deux blocs JSX finiraient par diverger, et le
   * client recevrait autre chose que ce qu'on lui a montré à l'écran.
   */
  const receipt = (
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
      /*
        L'aperçu suit la saisie du règlement en direct : c'est là qu'on voit
        « PAYÉE », la monnaie rendue, ou le reste à payer — avant de figer le
        document, pas après.
      */
      amountPaid={settled ? settlement.amount : 0}
      payments={
        settled && settlement.amount > 0
          ? [{ method, amount: settlement.amount, tendered: settlement.tendered }]
          : []
      }
    />
  );

  /**
   * Télécharger et imprimer n'apparaissent qu'une fois le document CRÉÉ.
   *
   * Avant, le numéro affiché n'est qu'une prévision : il ne sera attribué qu'à
   * l'émission (règle métier 4). Remettre au client un reçu portant un numéro
   * qui n'existe pas encore — et qui pourrait finir différent — serait pire que
   * de ne rien imprimer.
   */
  const issued = saved !== null && !saved.draft;

  return (
    <>
      {/*
        Feuille imprimée : le ticket seul, au format 80 mm. Il reste dans le flux,
        écrasé par `h-0 overflow-hidden` — masqué par `hidden`, sa hauteur
        vaudrait zéro et la page imprimée retomberait en A4, faute de mesure.
      */}
      <PrintPageSize targetId="invoice-document" />
      <div
        id="invoice-document"
        aria-hidden
        className="h-0 overflow-hidden print:h-auto print:overflow-visible"
      >
        {receipt}
      </div>

      <div className="flex flex-col lg:h-screen lg:flex-row print:hidden">
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
              {/* Plus d'astérisque : une vente au comptoir se passe de client. */}
              <FloatingField label="Client" htmlFor="client" icon={UserRound}>
                <ClientCombobox
                  id="client"
                  clients={clients}
                  value={clientId}
                  onChange={setClientId}
                />
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

            {/*
              Le scan vient AVANT les lignes : c'est le geste le plus fréquent,
              et il doit être le premier sous la main. La saisie manuelle reste
              juste en dessous, pour ce qui n'est pas au catalogue.
            */}
            <div className="mt-4">
              <ProductScanner
                currency={organization.currency}
                onScanned={addFromProduct}
                disabled={pending || issued}
              />
            </div>

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
                    {/*
                      Texte libre, avec le catalogue en suggestion. Choisir un
                      article recopie son prix et son taux — exactement ce que
                      fait la douchette, pour ceux qui n'en ont pas.
                    */}
                    <ProductCombobox
                      id={`${line.id}-description`}
                      products={products}
                      currency={organization.currency}
                      value={line.description}
                      disabled={issued}
                      placeholder="Prestation, produit…"
                      onChange={(description) =>
                        // La frappe libre détache la ligne du catalogue : ce
                        // n'est plus l'article, c'est ce que l'utilisateur écrit.
                        updateLine(line.id, { description, productId: undefined })
                      }
                      onPick={(product) =>
                        updateLine(line.id, {
                          description: product.name,
                          unitPrice: String(product.unitPrice),
                          taxRate: String(product.taxRate),
                          productId: product.id,
                        })
                      }
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
              onClick={() =>
                setLines((current) => [...current, newLine(organization.defaultTaxRate)])
              }
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

          {/*
          Règlement. Placé APRÈS les totaux : on ne dit pas comment on est payé
          avant de savoir combien. Et avant les boutons, parce que c'est la
          dernière décision avant de figer le document.
        */}
          {settleable ? (
            <section className="mt-6 rounded-xl border border-border bg-surface/60 p-4">
              <h2 className="text-sm font-semibold">Règlement</h2>

              <Segmented
                className="mt-3"
                label="État du règlement"
                value={settled ? "paid" : "unpaid"}
                onValueChange={(value) => setSettled(value === "paid")}
                options={[
                  { value: "unpaid", label: "Non payée" },
                  { value: "paid", label: "Payée" },
                ]}
              />

              {settled ? (
                <div className="mt-4 space-y-4">
                  <FloatingField
                    label="Moyen de paiement"
                    htmlFor="settlement-method"
                    icon={Wallet}
                  >
                    <select
                      id="settlement-method"
                      value={method}
                      onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                      className={cn(bareInputClasses, "cursor-pointer")}
                    >
                      {PAYMENT_METHODS.map((value) => (
                        <option key={value} value={value}>
                          {PAYMENT_METHOD_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </FloatingField>

                  {/*
                  Le seul montant à saisir. Laissé vide, il vaut le total — le
                  client a donné le compte juste, cas de loin le plus fréquent.
                */}
                  <FloatingField label="Montant donné par le client" htmlFor="settlement-received">
                    <input
                      id="settlement-received"
                      inputMode="numeric"
                      value={received}
                      onChange={(event) => setReceived(event.target.value)}
                      placeholder={formatAmount(totals.total, organization.currency)}
                      className={cn(bareInputClasses, "tabular")}
                    />
                  </FloatingField>

                  {receivedInvalid ? (
                    <p role="alert" className="text-xs text-destructive">
                      Montant invalide.
                    </p>
                  ) : null}

                  {/*
                  Les deux conséquences possibles, jamais les deux à la fois :
                  soit on rend la monnaie, soit il reste à payer.
                */}
                  {settlement.change > 0 ? (
                    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Monnaie à rendre</span>
                      <span className="tabular font-semibold">
                        {formatAmount(settlement.change, organization.currency)}
                      </span>
                    </div>
                  ) : null}

                  {settlement.remaining > 0 ? (
                    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Reste à payer</span>
                      <span className="tabular font-semibold">
                        {formatAmount(settlement.remaining, organization.currency)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-3 text-xs text-muted-foreground">
                {!settled
                  ? "La facture partira avec la mention « non payée » et le reste à payer."
                  : settlement.remaining > 0
                    ? "Acompte : le reçu portera le reste à payer. Le client complétera depuis la facture, avec « Encaisser »."
                    : "L'encaissement est enregistré à la création de la facture, pas sur un brouillon."}
              </p>
            </section>
          ) : null}

          {/*
            Une fois le document créé, le formulaire est VERROUILLÉ.

            Sans ça, il reste entièrement actif : un second clic sur « Créer la
            facture » émettrait un deuxième document numéroté avec le même
            contenu. Le risque devient concret depuis qu'on reste sur la page
            pour imprimer le reçu au lieu d'être renvoyé vers la liste.

            La saisie, elle, reste affichée : c'est ce qui figure sur le ticket
            qu'on est en train de remettre au client.
          */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pb-6">
            <Button variant="outline" disabled={pending || issued} onClick={() => submit(false)}>
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
                <Button disabled={pending || issued || (settled && receivedInvalid)}>
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
              Créer le document lui attribue son numéro et le fige. L&apos;envoi au client par email
              viendra plus tard.
            </p>
          </div>
        </div>

        <InvoiceCreatedDialog
          invoiceId={saved?.id ?? null}
          number={saved && !saved.draft ? saved.number : null}
          isDraft={saved?.draft ?? false}
          documentType={documentType}
          onOpenChange={(open) => {
            if (open) return;

            // Un BROUILLON n'est pas vidé : on le rouvre pour le compléter, il
            // n'y a pas de « vente suivante » derrière.
            const creee = saved !== null && !saved.draft;
            setSaved(null);
            if (creee && !isEditing) resetForm();
          }}
        />

        {/* Colonne aperçu */}
        {showPreview ? (
          <aside className="w-full shrink-0 border-t border-border bg-surface px-4 py-6 lg:w-[460px] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-6">
            <p className="mb-4 text-sm font-medium">Aperçu</p>
            {receipt}

            <div className="mt-4 flex flex-wrap gap-2">
              {issued ? (
                <>
                  {/*
                  Ancre nue, pas un `Link` : le serveur renvoie un PDF en pièce
                  jointe, au format ticket 80 mm, sans boîte d'impression.
                */}
                  <Button asChild variant="outline" size="sm">
                    <a href={`/invoices/${saved.id}/pdf`} download>
                      <Download aria-hidden />
                      Télécharger
                    </a>
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer aria-hidden />
                    Imprimer
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Télécharger et imprimer seront disponibles une fois le document créé : le numéro
                  ci-dessus n&apos;est attribué qu&apos;à ce moment-là.
                </p>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
