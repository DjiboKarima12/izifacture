/**
 * Lignes telles que PostgREST les renvoie, et traduction vers le domaine.
 *
 * La base est en `snake_case`, le domaine en `camelCase` : la conversion est
 * regroupée ici, jamais éparpillée dans les repositories.
 *
 * PROVISOIRE — ces types sont écrits à la main d'après les migrations. Dès que
 * la base est en ligne, les remplacer par la sortie de :
 *   supabase gen types typescript --linked > lib/data/supabase/database.types.ts
 * Les mappeurs, eux, restent : c'est eux qui portent la traduction.
 *
 * Les montants sont des BIGINT côté base. PostgREST les sérialise en nombres
 * JSON, ce qui est exact tant qu'on reste sous 2^53 — la borne MAX_AMOUNT de
 * `lib/money.ts` (10^12) laisse une marge confortable.
 */

import type {
  Client,
  Discount,
  DocumentType,
  Invoice,
  InvoiceEvent,
  InvoiceEventType,
  InvoiceItem,
  InvoiceSnapshot,
  InvoiceStatus,
  Organization,
  Payment,
  PaymentMethod,
  RecurrenceFrequency,
  RecurringSchedule,
} from "@/lib/domain/types";
import type { Currency } from "@/lib/money";

/* ------------------------------------------------------------ Lignes SQL */

export type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  country: string;
  tax_id: string | null;
  logo_url: string | null;
  currency: string;
  default_tax_rate: number | string;
  default_payment_terms: number;
  invoice_prefix: string;
  quote_prefix: string;
  credit_note_prefix: string;
  invoice_footer: string | null;
  created_at: string;
};

export type ClientRow = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number | string;
  unit_price: number;
  tax_rate: number | string;
  discount_type: "amount" | "percent" | null;
  discount_value: number | string | null;
  line_subtotal: number;
  line_discount: number;
  line_tax: number;
  line_total: number;
};

export type InvoiceRow = {
  id: string;
  org_id: string;
  client_id: string;
  type: DocumentType;
  number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  terms: string | null;
  public_token: string;
  snapshot: InvoiceSnapshot | null;
  parent_invoice_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  org_id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  tendered: number | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type InvoiceEventRow = {
  id: string;
  org_id: string;
  invoice_id: string;
  type: InvoiceEventType;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type RecurringScheduleRow = {
  id: string;
  org_id: string;
  client_id: string;
  label: string;
  frequency: RecurrenceFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_on: string | null;
  payment_terms: number;
  active: boolean;
  template: RecurringSchedule["template"];
  created_at: string;
};

/* -------------------------------------------------------------- Mappeurs */

/**
 * `numeric` revient en CHAÎNE depuis PostgREST — il préserve ainsi la précision
 * exacte, que le flottant JavaScript perdrait. Les colonnes concernées ici
 * (quantité, taux) restent dans une plage où `Number` est sûr.
 */
function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toDiscount(
  type: "amount" | "percent" | null,
  value: number | string | null,
): Discount | null {
  if (!type || value === null) return null;
  return { type, value: toNumber(value) };
}

export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    email: row.email,
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    country: row.country,
    taxId: row.tax_id,
    logoUrl: row.logo_url,
    currency: row.currency as Currency,
    defaultTaxRate: toNumber(row.default_tax_rate),
    defaultPaymentTerms: row.default_payment_terms,
    invoicePrefix: row.invoice_prefix,
    quotePrefix: row.quote_prefix,
    creditNotePrefix: row.credit_note_prefix,
    invoiceFooter: row.invoice_footer,
    createdAt: row.created_at,
  };
}

export function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    country: row.country,
    taxId: row.tax_id,
    notes: row.notes,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    position: row.position,
    description: row.description,
    quantity: toNumber(row.quantity),
    unitPrice: row.unit_price,
    taxRate: toNumber(row.tax_rate),
    discount: toDiscount(row.discount_type, row.discount_value),
    lineSubtotal: row.line_subtotal,
    lineDiscount: row.line_discount,
    lineTax: row.line_tax,
    lineTotal: row.line_total,
  };
}

export function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    type: row.type,
    number: row.number,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency as Currency,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    taxTotal: row.tax_total,
    total: row.total,
    amountPaid: row.amount_paid,
    notes: row.notes,
    terms: row.terms,
    publicToken: row.public_token,
    snapshot: row.snapshot,
    parentInvoiceId: row.parent_invoice_id,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orgId: row.org_id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    paidAt: row.paid_at,
    method: row.method,
    // `bigint` peut revenir en chaîne selon le pilote ; `null` doit rester `null`.
    tendered: row.tendered == null ? null : Number(row.tendered),
    reference: row.reference,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toInvoiceEvent(row: InvoiceEventRow): InvoiceEvent {
  return {
    id: row.id,
    orgId: row.org_id,
    invoiceId: row.invoice_id,
    type: row.type,
    meta: row.meta,
    createdAt: row.created_at,
  };
}

export function toRecurringSchedule(row: RecurringScheduleRow): RecurringSchedule {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    label: row.label,
    frequency: row.frequency,
    interval: row.interval_count,
    startDate: row.start_date,
    endDate: row.end_date,
    nextRunOn: row.next_run_on,
    paymentTerms: row.payment_terms,
    active: row.active,
    template: row.template,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------- Constantes */

/** Colonnes des lignes de facture, dans l'ordre attendu par les mappeurs. */
export const INVOICE_ITEM_COLUMNS =
  "id, invoice_id, position, description, quantity, unit_price, tax_rate, discount_type, discount_value, line_subtotal, line_discount, line_tax, line_total";
