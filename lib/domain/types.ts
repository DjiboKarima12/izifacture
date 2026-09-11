import type { Currency } from "@/lib/money";

export type UUID = string;
/** Date calendaire au format ISO `YYYY-MM-DD` (pas d'heure, pas de fuseau). */
export type IsoDate = string;
/** Horodatage ISO 8601 complet. */
export type IsoTimestamp = string;

/* ------------------------------------------------------------------ Rôles */

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/* --------------------------------------------------------------- Documents */

export const DOCUMENT_TYPES = ["invoice", "quote", "credit_note"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Statuts persistés. `overdue` n'en fait volontairement pas partie : il se
 * déduit de `status` + `dueDate`, donc aucun job planifié n'est nécessaire pour
 * qu'une facture en retard soit affichée comme telle.
 */
export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Statut affiché à l'utilisateur.
 *
 * Deux états dérivés s'ajoutent aux statuts persistés, et ils dépendent du type
 * de document : une facture échue est `overdue` (elle doit de l'argent), un
 * devis dont la validité est passée est `expired` (il n'engage plus personne).
 */
export type DisplayStatus = InvoiceStatus | "overdue" | "expired";

/**
 * Les moyens par lesquels l'argent circule réellement au Niger.
 *
 * Nommés par leur service — MyNita, Amanata, Wave, Airtel Money — et non par des
 * catégories génériques : personne ne dit « mobile money » au comptoir, et un
 * libellé qu'il faut traduire mentalement finit mal choisi.
 *
 * L'ordre est celui du terrain : les espèces d'abord, de loin le cas courant.
 * Il pilote la liste déroulante, donc il compte.
 */
export const PAYMENT_METHODS = [
  "cash",
  "my_nita",
  "amanata",
  "wave",
  "airtel_money",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ["amount", "percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type Discount = {
  type: DiscountType;
  /** Montant entier en unités mineures si `amount`, pourcentage (ex. 12.5) si `percent`. */
  value: number;
};

/* ------------------------------------------------------------- Entités */

export type Organization = {
  id: UUID;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string;
  /** NINEA, RCCM, IFU… selon le pays. */
  taxId: string | null;
  logoUrl: string | null;
  currency: Currency;
  /** Taux de TVA par défaut, en pourcentage (18 pour 18%). */
  defaultTaxRate: number;
  /** Délai de paiement par défaut, en jours. */
  defaultPaymentTerms: number;
  invoicePrefix: string;
  quotePrefix: string;
  creditNotePrefix: string;
  invoiceFooter: string | null;
  createdAt: IsoTimestamp;
};

export type Membership = {
  id: UUID;
  orgId: UUID;
  userId: UUID;
  role: MemberRole;
  createdAt: IsoTimestamp;
};

export type Profile = {
  id: UUID;
  fullName: string | null;
  avatarUrl: string | null;
};

export type Client = {
  id: UUID;
  orgId: UUID;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
};

export type InvoiceItem = {
  id: UUID;
  invoiceId: UUID;
  position: number;
  description: string;
  /** Jusqu'à 3 décimales (demi-journées, kilos…). */
  quantity: number;
  /** Prix unitaire HT, entier en unités mineures. */
  unitPrice: number;
  /** Taux de TVA de la ligne, en pourcentage. */
  taxRate: number;
  discount: Discount | null;
  /* Champs calculés — recalculés côté serveur, jamais acceptés du client. */
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
};

/**
 * Copie figée des données au moment de l'émission. Une facture émise ne doit
 * plus bouger : si le client déménage ou si l'entreprise change de logo, le
 * document déjà envoyé doit rester identique à ce que le client a reçu.
 */
export type InvoiceSnapshot = {
  organization: Pick<
    Organization,
    | "name"
    | "legalName"
    | "email"
    | "phone"
    | "addressLine"
    | "city"
    | "country"
    | "taxId"
    | "logoUrl"
    | "invoiceFooter"
  >;
  /** `null` sur une vente au comptoir : il n'y avait personne à figer. */
  client: Pick<
    Client,
    "name" | "email" | "phone" | "addressLine" | "city" | "country" | "taxId"
  > | null;
};

export type Invoice = {
  id: UUID;
  orgId: UUID;
  /**
   * `null` sur une vente au comptoir.
   *
   * Toutes les boutiques ne notent pas à qui elles vendent. Forcer un client
   * poussait à réutiliser une fiche fourre-tout, ce qui faussait ensuite toutes
   * les statistiques par client — le contraire du but recherché.
   */
  clientId: UUID | null;
  type: DocumentType;
  /** `null` tant que le document est un brouillon : le numéro s'attribue à l'émission. */
  number: string | null;
  status: InvoiceStatus;
  issueDate: IsoDate;
  dueDate: IsoDate;
  currency: Currency;
  /* Totaux — entiers, recalculés côté serveur depuis les lignes. */
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  notes: string | null;
  terms: string | null;
  /** Jeton du lien public de consultation. Jamais exposé dans les listes. */
  publicToken: string;
  snapshot: InvoiceSnapshot | null;
  /** Facture d'origine, pour un avoir. */
  parentInvoiceId: UUID | null;
  sentAt: IsoTimestamp | null;
  paidAt: IsoTimestamp | null;
  cancelledAt: IsoTimestamp | null;
  createdBy: UUID | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
  client: Client | null;
};

export type Payment = {
  id: UUID;
  orgId: UUID;
  invoiceId: UUID;
  amount: number;
  paidAt: IsoDate;
  method: PaymentMethod;
  /**
   * Montant remis par le client, espèces uniquement.
   *
   * `null` signifie « la question ne se pose pas » — un virement ou une carte
   * ne rend pas de monnaie. Un zéro se lirait « le client n'a rien tendu », ce
   * qui n'est pas la même chose.
   *
   * La monnaie rendue n'est pas stockée : elle vaut `tendered - amount`.
   */
  tendered: number | null;
  reference: string | null;
  note: string | null;
  createdBy: UUID | null;
  createdAt: IsoTimestamp;
};

/* ---------------------------------------------------------- Récurrence */

export const RECURRENCE_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurringSchedule = {
  id: UUID;
  orgId: UUID;
  clientId: UUID;
  label: string;
  frequency: RecurrenceFrequency;
  /** Tous les N pas de `frequency` (ex. `monthly` + 3 = trimestriel). */
  interval: number;
  startDate: IsoDate;
  endDate: IsoDate | null;
  nextRunOn: IsoDate | null;
  paymentTerms: number;
  active: boolean;
  /** Lignes modèles, sans identifiants ni champs calculés. */
  template: Array<
    Pick<InvoiceItem, "description" | "quantity" | "unitPrice" | "taxRate"> & {
      discount: Discount | null;
    }
  >;
  createdAt: IsoTimestamp;
};

/* ------------------------------------------------------------- Journal */

export const INVOICE_EVENT_TYPES = [
  "created",
  "issued",
  "sent",
  "viewed",
  "payment_recorded",
  "paid",
  "cancelled",
  "reminder_sent",
] as const;
export type InvoiceEventType = (typeof INVOICE_EVENT_TYPES)[number];

export type InvoiceEvent = {
  id: UUID;
  orgId: UUID;
  invoiceId: UUID;
  type: InvoiceEventType;
  meta: Record<string, unknown> | null;
  createdAt: IsoTimestamp;
};

/* -------------------------------------------------------- Statistiques */

export type DashboardStats = {
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
};
