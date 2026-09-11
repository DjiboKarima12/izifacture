/**
 * Frontière d'accès aux données.
 *
 * Les pages et composants ne connaissent QUE ces interfaces. L'étape 2 les
 * implémente en mémoire (`./mock`), l'étape 3 sur Supabase (`./supabase`) —
 * et le basculement ne doit toucher aucun composant d'interface.
 *
 * Conventions :
 *  - `orgId` est un paramètre explicite partout. Aucune méthode ne « devine »
 *    l'organisation courante : c'est ce qui rend une fuite inter-organisation
 *    visible à la lecture du code, en plus de la RLS qui la bloque en base.
 *  - Les montants entrants sont toujours recalculés par l'implémentation ; les
 *    totaux fournis par l'appelant sont ignorés.
 */

import type {
  Client,
  DashboardStats,
  DocumentType,
  Invoice,
  InvoiceEvent,
  InvoiceStatus,
  InvoiceWithItems,
  IsoDate,
  Membership,
  Organization,
  Payment,
  PaymentMethod,
  Product,
  RecurringSchedule,
  UUID,
} from "@/lib/domain/types";
import type {
  ClientInput,
  InvoiceInput,
  OrganizationSettingsInput,
  PaymentInput,
  ProductInput,
  RecurringScheduleInput,
} from "@/lib/domain/schemas";

export type Paginated<T> = {
  rows: T[];
  total: number;
};

export type InvoiceListFilters = {
  /** `overdue` est un filtre dérivé, pas un statut persisté. */
  status?: InvoiceStatus | "overdue";
  type?: DocumentType;
  clientId?: UUID;
  search?: string;
  from?: IsoDate;
  to?: IsoDate;
  page?: number;
  pageSize?: number;
};

export type ClientListFilters = {
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export type ProductListFilters = {
  /** Nom ou code-barres. */
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

export type PaymentListFilters = {
  /** Numéro de facture ou nom du client. */
  search?: string;
  method?: PaymentMethod;
  from?: IsoDate;
  to?: IsoDate;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
};

/** Un encaissement accompagné de son contexte : sans eux la ligne est illisible. */
export type PaymentWithContext = Payment & { invoice: Invoice; client: Client | null };

export type PaymentListResult = {
  rows: PaymentWithContext[];
  /** Nombre d'encaissements correspondant aux filtres, toutes pages confondues. */
  total: number;
  /** Somme des montants filtrés — le chiffre du bandeau doit suivre les filtres. */
  totalAmount: number;
};

export interface OrganizationRepo {
  get(orgId: UUID): Promise<Organization | null>;
  listForUser(userId: UUID): Promise<Organization[]>;
  update(orgId: UUID, input: OrganizationSettingsInput): Promise<Organization>;
  listMembers(orgId: UUID): Promise<Array<Membership & { email: string; fullName: string | null }>>;

  /**
   * Abonnement de l'organisation, tel qu'il est stocké.
   *
   * Renvoie les valeurs brutes : c'est `resolvePlan()` qui décide ce qu'elles
   * valent, et lui seul. Une organisation sans ligne d'abonnement est traitée
   * comme gratuite plutôt que comme une erreur.
   */
  getSubscription(orgId: UUID): Promise<{ plan: string; status: string }>;
}

export interface ClientRepo {
  list(orgId: UUID, filters?: ClientListFilters): Promise<Paginated<Client>>;
  get(orgId: UUID, clientId: UUID): Promise<Client | null>;
  create(orgId: UUID, input: ClientInput): Promise<Client>;
  update(orgId: UUID, clientId: UUID, input: ClientInput): Promise<Client>;
  /** Archivage logique : un client facturé ne doit jamais disparaître. */
  archive(orgId: UUID, clientId: UUID): Promise<void>;
  restore(orgId: UUID, clientId: UUID): Promise<void>;
}

export interface ProductRepo {
  list(orgId: UUID, filters?: ProductListFilters): Promise<Paginated<Product>>;
  get(orgId: UUID, productId: UUID): Promise<Product | null>;

  /**
   * Recherche par code-barres, pour le scan en caisse.
   *
   * Ne renvoie JAMAIS un produit archivé : on retire un article du catalogue
   * précisément pour qu'il cesse d'être vendu, et un scan ne doit pas le
   * ressusciter.
   */
  findByBarcode(orgId: UUID, barcode: string): Promise<Product | null>;

  create(orgId: UUID, input: ProductInput): Promise<Product>;
  update(orgId: UUID, productId: UUID, input: ProductInput): Promise<Product>;
  /** Archivage logique : un produit déjà facturé ne doit jamais disparaître. */
  archive(orgId: UUID, productId: UUID): Promise<void>;
  restore(orgId: UUID, productId: UUID): Promise<void>;
}

export interface InvoiceRepo {
  list(orgId: UUID, filters?: InvoiceListFilters): Promise<Paginated<InvoiceWithItems>>;
  get(orgId: UUID, invoiceId: UUID): Promise<InvoiceWithItems | null>;
  /** Consultation publique par jeton — hors organisation, donc sans `orgId`. */
  getByPublicToken(token: string): Promise<InvoiceWithItems | null>;

  createDraft(orgId: UUID, input: InvoiceInput, userId: UUID | null): Promise<InvoiceWithItems>;
  /** Échoue si le document n'est plus un brouillon. */
  updateDraft(orgId: UUID, invoiceId: UUID, input: InvoiceInput): Promise<InvoiceWithItems>;
  deleteDraft(orgId: UUID, invoiceId: UUID): Promise<void>;

  /** Attribue le numéro, fige le snapshot et passe le statut à `sent`. */
  issue(orgId: UUID, invoiceId: UUID): Promise<InvoiceWithItems>;
  cancel(orgId: UUID, invoiceId: UUID): Promise<InvoiceWithItems>;
  /** Crée un avoir rattaché à une facture émise. */
  createCreditNote(orgId: UUID, invoiceId: UUID, userId: UUID | null): Promise<InvoiceWithItems>;
  /** Transforme un devis accepté en facture. */
  convertQuoteToInvoice(orgId: UUID, quoteId: UUID, userId: UUID | null): Promise<InvoiceWithItems>;

  /**
   * Nombre de FACTURES émises dans `[from, to[`, pour le quota du plan gratuit.
   *
   * Compte l'horodatage d'émission posé par le serveur, jamais la date
   * d'émission saisie : celle-ci se choisit, et pourrait être antidatée pour
   * repasser sous le quota. Les devis et les avoirs sont exclus (cf. `lib/plan`).
   */
  countIssuedBetween(orgId: UUID, from: IsoDate, to: IsoDate): Promise<number>;

  listEvents(orgId: UUID, invoiceId: UUID): Promise<InvoiceEvent[]>;
  stats(orgId: UUID, reference?: IsoDate): Promise<DashboardStats>;
  /** Série mensuelle facturé/encaissé pour le graphique du dashboard. */
  monthlyTotals(
    orgId: UUID,
    months: number,
  ): Promise<Array<{ month: string; invoiced: number; paid: number }>>;
}

export interface PaymentRepo {
  listForInvoice(orgId: UUID, invoiceId: UUID): Promise<Payment[]>;
  list(orgId: UUID, filters?: PaymentListFilters): Promise<PaymentListResult>;
  /** Met à jour `amountPaid` et le statut de la facture dans la même transaction. */
  record(orgId: UUID, input: PaymentInput, userId: UUID | null): Promise<Payment>;
  remove(orgId: UUID, paymentId: UUID): Promise<void>;
}

export interface RecurringRepo {
  list(orgId: UUID): Promise<RecurringSchedule[]>;
  get(orgId: UUID, scheduleId: UUID): Promise<RecurringSchedule | null>;
  create(orgId: UUID, input: RecurringScheduleInput): Promise<RecurringSchedule>;
  update(orgId: UUID, scheduleId: UUID, input: RecurringScheduleInput): Promise<RecurringSchedule>;
  setActive(orgId: UUID, scheduleId: UUID, active: boolean): Promise<void>;
}

export type Repositories = {
  organizations: OrganizationRepo;
  clients: ClientRepo;
  products: ProductRepo;
  invoices: InvoiceRepo;
  payments: PaymentRepo;
  recurring: RecurringRepo;
};

/** Erreurs de domaine, distinguées des pannes techniques par les Server Actions. */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} introuvable`);
    this.name = "NotFoundError";
  }
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
