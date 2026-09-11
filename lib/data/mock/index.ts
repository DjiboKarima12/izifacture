/**
 * Implémentation en mémoire des repositories (étape 2).
 *
 * Elle applique les MÊMES règles métier que l'implémentation Supabase à venir :
 * recalcul systématique des totaux, refus de modifier un document émis,
 * numérotation attribuée à l'émission, statut recalculé après encaissement.
 * C'est ce qui permet de développer et tester l'interface avant la base, sans
 * découvrir à l'étape 3 que le comportement diverge.
 */

import {
  DomainError,
  NotFoundError,
  type ClientListFilters,
  type ClientRepo,
  type InvoiceListFilters,
  type InvoiceRepo,
  type OrganizationRepo,
  type Paginated,
  type PaymentListFilters,
  type PaymentRepo,
  type RecurringRepo,
  type Repositories,
} from "@/lib/data/repository";
import { getMockDb, mockId } from "@/lib/data/mock/seed";
import { computeTotals } from "@/lib/tax";
import { addDays, addMonths, todayIso } from "@/lib/dates";
import { formatDocumentNumber, prefixFor } from "@/lib/numbering";
import { assertTransition, deriveDisplayStatus, isEditable, statusAfterPayment } from "@/lib/status";
import type {
  Client,
  DashboardStats,
  Invoice,
  InvoiceEvent,
  InvoiceEventType,
  InvoiceItem,
  InvoiceWithItems,
  IsoDate,
  Organization,
  Payment,
  RecurringSchedule,
  UUID,
} from "@/lib/domain/types";
import type {
  ClientInput,
  InvoiceInput,
  OrganizationSettingsInput,
  PaymentInput,
  RecurringScheduleInput,
} from "@/lib/domain/schemas";

const DEFAULT_PAGE_SIZE = 20;

function now(): string {
  return new Date().toISOString();
}

function paginate<T>(rows: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const start = (Math.max(1, page) - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length };
}

/** En production le jeton fait 32 octets aléatoires ; ici seule l'unicité compte. */
function publicToken(): string {
  return `tok_${mockId().replace(/-/g, "")}`;
}

function logEvent(invoice: Invoice, type: InvoiceEventType, meta: Record<string, unknown> | null = null) {
  getMockDb().events.push({
    id: mockId(),
    orgId: invoice.orgId,
    invoiceId: invoice.id,
    type,
    meta,
    createdAt: now(),
  });
}

/* ------------------------------------------------------------ Assemblage */

function itemsFor(invoiceId: UUID): InvoiceItem[] {
  return getMockDb()
    .items.filter((item) => item.invoiceId === invoiceId)
    .sort((a, b) => a.position - b.position);
}

function hydrate(invoice: Invoice): InvoiceWithItems {
  const db = getMockDb();
  return {
    ...invoice,
    items: itemsFor(invoice.id),
    client: db.clients.find((client) => client.id === invoice.clientId) ?? null,
  };
}

function findInvoice(orgId: UUID, invoiceId: UUID): Invoice {
  const invoice = getMockDb().invoices.find(
    (row) => row.id === invoiceId && row.orgId === orgId,
  );
  if (!invoice) throw new NotFoundError("Facture");
  return invoice;
}

/**
 * Réécrit les lignes et les totaux depuis l'entrée validée. Les totaux
 * éventuellement fournis par l'appelant ne sont jamais lus.
 */
function replaceItems(invoice: Invoice, input: InvoiceInput): void {
  const db = getMockDb();
  db.items = db.items.filter((item) => item.invoiceId !== invoice.id);

  input.items.forEach((line, position) => {
    const totals = computeTotals([line]);
    db.items.push({
      id: mockId(),
      invoiceId: invoice.id,
      position,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      discount: line.discount ?? null,
      lineSubtotal: totals.subtotal,
      lineDiscount: totals.discountTotal,
      lineTax: totals.taxTotal,
      lineTotal: totals.total,
    });
  });

  const totals = computeTotals(input.items);
  invoice.subtotal = totals.subtotal;
  invoice.discountTotal = totals.discountTotal;
  invoice.taxTotal = totals.taxTotal;
  invoice.total = totals.total;
  invoice.updatedAt = now();
}

function buildSnapshot(organization: Organization, client: Client) {
  return {
    organization: {
      name: organization.name,
      legalName: organization.legalName,
      email: organization.email,
      phone: organization.phone,
      addressLine: organization.addressLine,
      city: organization.city,
      country: organization.country,
      taxId: organization.taxId,
      logoUrl: organization.logoUrl,
      invoiceFooter: organization.invoiceFooter,
    },
    client: {
      name: client.name,
      email: client.email,
      phone: client.phone,
      addressLine: client.addressLine,
      city: client.city,
      country: client.country,
      taxId: client.taxId,
    },
  };
}

/* -------------------------------------------------------- Organisations */

const organizations: OrganizationRepo = {
  async get(orgId) {
    return getMockDb().organizations.find((row) => row.id === orgId) ?? null;
  },

  async listForUser(userId) {
    const db = getMockDb();
    const orgIds = new Set(
      db.members.filter((member) => member.userId === userId).map((member) => member.orgId),
    );
    return db.organizations.filter((row) => orgIds.has(row.id));
  },

  async update(orgId, input: OrganizationSettingsInput) {
    const organization = getMockDb().organizations.find((row) => row.id === orgId);
    if (!organization) throw new NotFoundError("Organisation");
    Object.assign(organization, input);
    return organization;
  },

  async listMembers(orgId) {
    return getMockDb().members.filter((member) => member.orgId === orgId);
  },

  async getSubscription(orgId) {
    // Pas de ligne = plan gratuit, jamais une erreur : une organisation dont
    // l'abonnement n'a pas encore été créé doit pouvoir utiliser l'application.
    return getMockDb().subscriptions.get(orgId) ?? { plan: "free", status: "active" };
  },
};

/* --------------------------------------------------------------- Clients */

const clients: ClientRepo = {
  async list(orgId, filters: ClientListFilters = {}) {
    const search = filters.search?.trim().toLowerCase();

    const rows = getMockDb()
      .clients.filter((client) => client.orgId === orgId)
      .filter((client) => (filters.includeArchived ? true : client.archivedAt === null))
      .filter((client) =>
        search
          ? client.name.toLowerCase().includes(search) ||
            (client.email?.toLowerCase().includes(search) ?? false)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return paginate(rows, filters.page, filters.pageSize);
  },

  async get(orgId, clientId) {
    return (
      getMockDb().clients.find((client) => client.id === clientId && client.orgId === orgId) ?? null
    );
  },

  async create(orgId, input: ClientInput) {
    const client: Client = {
      id: mockId(),
      orgId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      taxId: input.taxId ?? null,
      notes: input.notes ?? null,
      archivedAt: null,
      createdAt: now(),
    };
    getMockDb().clients.push(client);
    return client;
  },

  async update(orgId, clientId, input: ClientInput) {
    const client = await clients.get(orgId, clientId);
    if (!client) throw new NotFoundError("Client");
    Object.assign(client, {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      taxId: input.taxId ?? null,
      notes: input.notes ?? null,
    });
    return client;
  },

  async archive(orgId, clientId) {
    const client = await clients.get(orgId, clientId);
    if (!client) throw new NotFoundError("Client");
    client.archivedAt = now();
  },

  async restore(orgId, clientId) {
    const client = await clients.get(orgId, clientId);
    if (!client) throw new NotFoundError("Client");
    client.archivedAt = null;
  },
};

/* -------------------------------------------------------------- Factures */

const invoices: InvoiceRepo = {
  async list(orgId, filters: InvoiceListFilters = {}) {
    const db = getMockDb();
    const today = todayIso();
    const search = filters.search?.trim().toLowerCase();

    const rows = db.invoices
      .filter((invoice) => invoice.orgId === orgId)
      .filter((invoice) => (filters.type ? invoice.type === filters.type : true))
      .filter((invoice) => (filters.clientId ? invoice.clientId === filters.clientId : true))
      .filter((invoice) => (filters.from ? invoice.issueDate >= filters.from : true))
      .filter((invoice) => (filters.to ? invoice.issueDate <= filters.to : true))
      .filter((invoice) => {
        if (!filters.status) return true;
        // `overdue` se dérive, il n'existe pas en base.
        return deriveDisplayStatus(invoice, today) === filters.status;
      })
      .filter((invoice) => {
        if (!search) return true;
        const client = db.clients.find((row) => row.id === invoice.clientId);
        return (
          (invoice.number?.toLowerCase().includes(search) ?? false) ||
          (client?.name.toLowerCase().includes(search) ?? false)
        );
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt));

    const page = paginate(rows, filters.page, filters.pageSize);
    return { rows: page.rows.map(hydrate), total: page.total };
  },

  async get(orgId, invoiceId) {
    const invoice = getMockDb().invoices.find(
      (row) => row.id === invoiceId && row.orgId === orgId,
    );
    return invoice ? hydrate(invoice) : null;
  },

  async getByPublicToken(token) {
    const invoice = getMockDb().invoices.find((row) => row.publicToken === token);
    // Un brouillon n'a pas de lien public : il n'a jamais été communiqué au client.
    if (!invoice || invoice.status === "draft") return null;
    return hydrate(invoice);
  },

  async createDraft(orgId, input: InvoiceInput, userId) {
    const db = getMockDb();

    // Client facultatif — mais s'il est fourni, il doit exister ET appartenir à
    // l'organisation : un identifiant inventé ne doit pas passer en silence.
    const client = input.clientId
      ? (db.clients.find((row) => row.id === input.clientId && row.orgId === orgId) ?? null)
      : null;
    if (input.clientId && !client) throw new NotFoundError("Client");

    const invoice: Invoice = {
      id: mockId(),
      orgId,
      clientId: input.clientId ?? null,
      type: input.type,
      number: null,
      status: "draft",
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      currency: input.currency,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      amountPaid: 0,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      publicToken: publicToken(),
      snapshot: null,
      parentInvoiceId: null,
      sentAt: null,
      paidAt: null,
      cancelledAt: null,
      createdBy: userId,
      createdAt: now(),
      updatedAt: now(),
    };

    db.invoices.push(invoice);
    replaceItems(invoice, input);
    logEvent(invoice, "created");

    return hydrate(invoice);
  },

  async updateDraft(orgId, invoiceId, input: InvoiceInput) {
    const invoice = findInvoice(orgId, invoiceId);
    if (!isEditable(invoice.status)) {
      throw new DomainError(
        "Un document émis ne peut plus être modifié. Créez un avoir pour le corriger.",
      );
    }

    invoice.clientId = input.clientId ?? null;
    invoice.issueDate = input.issueDate;
    invoice.dueDate = input.dueDate;
    invoice.currency = input.currency;
    invoice.notes = input.notes ?? null;
    invoice.terms = input.terms ?? null;
    replaceItems(invoice, input);

    return hydrate(invoice);
  },

  async deleteDraft(orgId, invoiceId) {
    const db = getMockDb();
    const invoice = findInvoice(orgId, invoiceId);
    if (!isEditable(invoice.status)) {
      throw new DomainError("Seul un brouillon peut être supprimé.");
    }
    db.invoices = db.invoices.filter((row) => row.id !== invoiceId);
    db.items = db.items.filter((item) => item.invoiceId !== invoiceId);
    db.events = db.events.filter((event) => event.invoiceId !== invoiceId);
  },

  async countIssuedBetween(orgId, from, to) {
    return getMockDb().invoices.filter(
      (invoice) =>
        invoice.orgId === orgId &&
        invoice.type === "invoice" &&
        invoice.sentAt !== null &&
        // Borne haute exclue : `to` est le 1er du mois suivant.
        invoice.sentAt.slice(0, 10) >= from &&
        invoice.sentAt.slice(0, 10) < to,
    ).length;
  },

  async issue(orgId, invoiceId) {
    const db = getMockDb();
    const invoice = findInvoice(orgId, invoiceId);
    assertTransition(invoice.status, "sent");

    const organization = db.organizations.find((row) => row.id === orgId);
    const client = db.clients.find((row) => row.id === invoice.clientId);
    if (!organization || !client) throw new NotFoundError("Organisation ou client");

    if (itemsFor(invoice.id).length === 0) {
      throw new DomainError("Impossible d'émettre un document sans ligne.");
    }

    // Le numéro n'est attribué qu'ici : un brouillon abandonné ne consomme
    // aucune séquence, donc la numérotation reste sans trou.
    const year = Number(invoice.issueDate.slice(0, 4));
    const counterKey = `${orgId}:${invoice.type}:${year}`;
    const sequence = (db.counters.get(counterKey) ?? 0) + 1;
    db.counters.set(counterKey, sequence);

    invoice.number = formatDocumentNumber(prefixFor(organization, invoice.type), year, sequence);
    invoice.status = "sent";
    invoice.snapshot = buildSnapshot(organization, client);
    invoice.sentAt = now();
    invoice.updatedAt = now();

    logEvent(invoice, "issued", { number: invoice.number });
    return hydrate(invoice);
  },

  async cancel(orgId, invoiceId) {
    const invoice = findInvoice(orgId, invoiceId);
    assertTransition(invoice.status, "cancelled");
    invoice.status = "cancelled";
    invoice.cancelledAt = now();
    invoice.updatedAt = now();
    logEvent(invoice, "cancelled");
    return hydrate(invoice);
  },

  async createCreditNote(orgId, invoiceId, userId) {
    const db = getMockDb();
    const source = findInvoice(orgId, invoiceId);
    if (source.status === "draft") {
      throw new DomainError("Un brouillon se modifie directement : aucun avoir n'est nécessaire.");
    }
    if (source.type !== "invoice") {
      throw new DomainError("Un avoir ne peut porter que sur une facture.");
    }

    const creditNote: Invoice = {
      ...source,
      id: mockId(),
      type: "credit_note",
      number: null,
      status: "draft",
      issueDate: todayIso(),
      dueDate: todayIso(),
      amountPaid: 0,
      publicToken: publicToken(),
      snapshot: null,
      parentInvoiceId: source.id,
      sentAt: null,
      paidAt: null,
      cancelledAt: null,
      createdBy: userId,
      createdAt: now(),
      updatedAt: now(),
    };

    db.invoices.push(creditNote);
    for (const item of itemsFor(source.id)) {
      db.items.push({ ...item, id: mockId(), invoiceId: creditNote.id });
    }

    logEvent(creditNote, "created", { parentInvoiceId: source.id });
    return hydrate(creditNote);
  },

  async convertQuoteToInvoice(orgId, quoteId, userId) {
    const db = getMockDb();
    const quote = findInvoice(orgId, quoteId);
    if (quote.type !== "quote") throw new DomainError("Ce document n'est pas un devis.");

    const organization = db.organizations.find((row) => row.id === orgId);
    const issueDate = todayIso();

    const invoice: Invoice = {
      ...quote,
      id: mockId(),
      type: "invoice",
      number: null,
      status: "draft",
      issueDate,
      dueDate: addDays(issueDate, organization?.defaultPaymentTerms ?? 30),
      amountPaid: 0,
      publicToken: publicToken(),
      snapshot: null,
      parentInvoiceId: quote.id,
      sentAt: null,
      paidAt: null,
      cancelledAt: null,
      createdBy: userId,
      createdAt: now(),
      updatedAt: now(),
    };

    db.invoices.push(invoice);
    for (const item of itemsFor(quote.id)) {
      db.items.push({ ...item, id: mockId(), invoiceId: invoice.id });
    }

    logEvent(invoice, "created", { convertedFromQuoteId: quote.id });
    return hydrate(invoice);
  },

  async listEvents(orgId, invoiceId): Promise<InvoiceEvent[]> {
    return getMockDb()
      .events.filter((event) => event.orgId === orgId && event.invoiceId === invoiceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async stats(orgId, reference: IsoDate = todayIso()): Promise<DashboardStats> {
    // Brouillons, devis et documents annulés sont exclus : ce ne sont pas des
    // créances, les inclure gonflerait artificiellement le chiffre d'affaires.
    const rows = getMockDb().invoices.filter(
      (invoice) =>
        invoice.orgId === orgId &&
        invoice.type === "invoice" &&
        invoice.status !== "draft" &&
        invoice.status !== "cancelled",
    );

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    for (const invoice of rows) {
      totalInvoiced += invoice.total;
      totalPaid += invoice.amountPaid;

      if (deriveDisplayStatus(invoice, reference) === "overdue") {
        totalOverdue += invoice.total - invoice.amountPaid;
        overdueCount += 1;
      }
    }

    return {
      invoiceCount: rows.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding: totalInvoiced - totalPaid,
      totalOverdue,
      overdueCount,
    };
  },

  async monthlyTotals(orgId, months) {
    const today = todayIso();
    const buckets = Array.from({ length: months }, (_, index) => {
      const month = addMonths(today, -(months - 1 - index)).slice(0, 7);
      return { month, invoiced: 0, paid: 0 };
    });

    const db = getMockDb();
    const index = new Map(buckets.map((bucket) => [bucket.month, bucket]));

    for (const invoice of db.invoices) {
      if (invoice.orgId !== orgId || invoice.type !== "invoice") continue;
      if (invoice.status === "draft" || invoice.status === "cancelled") continue;
      const bucket = index.get(invoice.issueDate.slice(0, 7));
      if (bucket) bucket.invoiced += invoice.total;
    }

    for (const payment of db.payments) {
      if (payment.orgId !== orgId) continue;
      const bucket = index.get(payment.paidAt.slice(0, 7));
      if (bucket) bucket.paid += payment.amount;
    }

    return buckets;
  },
};

/* ------------------------------------------------------------ Paiements */

const payments: PaymentRepo = {
  async listForInvoice(orgId, invoiceId) {
    return getMockDb()
      .payments.filter((row) => row.orgId === orgId && row.invoiceId === invoiceId)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  },

  async list(orgId, filters: PaymentListFilters = {}) {
    const db = getMockDb();
    const search = filters.search?.trim().toLowerCase();

    // On attache d'abord le contexte : la recherche porte sur le numéro de
    // facture et le nom du client, qui ne vivent pas sur l'encaissement.
    const withContext = db.payments
      .filter((row) => row.orgId === orgId)
      .flatMap((payment) => {
        const invoice = db.invoices.find((row) => row.id === payment.invoiceId);
        if (!invoice) return [];
        const client = db.clients.find((row) => row.id === invoice.clientId) ?? null;
        return [{ ...payment, invoice, client }];
      });

    const matching = withContext
      .filter((row) => (filters.method ? row.method === filters.method : true))
      .filter((row) => (filters.from ? row.paidAt >= filters.from : true))
      .filter((row) => (filters.to ? row.paidAt <= filters.to : true))
      .filter((row) => (filters.minAmount === undefined ? true : row.amount >= filters.minAmount))
      .filter((row) => (filters.maxAmount === undefined ? true : row.amount <= filters.maxAmount))
      .filter((row) => {
        if (!search) return true;
        return (
          (row.invoice.number?.toLowerCase().includes(search) ?? false) ||
          (row.client?.name.toLowerCase().includes(search) ?? false) ||
          (row.reference?.toLowerCase().includes(search) ?? false)
        );
      })
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));

    const page = paginate(matching, filters.page, filters.pageSize);

    return {
      rows: page.rows,
      total: page.total,
      // Somme de TOUTES les lignes filtrées, pas seulement de la page affichée.
      totalAmount: matching.reduce((sum, row) => sum + row.amount, 0),
    };
  },

  async record(orgId, input: PaymentInput, userId) {
    const db = getMockDb();
    const invoice = findInvoice(orgId, input.invoiceId);

    if (invoice.status === "draft") {
      throw new DomainError("Émettez la facture avant d'enregistrer un encaissement.");
    }
    if (invoice.status === "cancelled") {
      throw new DomainError("Cette facture est annulée.");
    }

    const payment: Payment = {
      id: mockId(),
      orgId,
      invoiceId: input.invoiceId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      tendered: input.tendered ?? null,
      reference: input.reference ?? null,
      note: input.note ?? null,
      createdBy: userId,
      createdAt: now(),
    };

    db.payments.push(payment);
    recalculateInvoicePayment(invoice);
    logEvent(invoice, "payment_recorded", { amount: payment.amount, method: payment.method });
    if (invoice.status === "paid") logEvent(invoice, "paid");

    return payment;
  },

  async remove(orgId, paymentId) {
    const db = getMockDb();
    const payment = db.payments.find((row) => row.id === paymentId && row.orgId === orgId);
    if (!payment) throw new NotFoundError("Encaissement");

    db.payments = db.payments.filter((row) => row.id !== paymentId);
    const invoice = db.invoices.find((row) => row.id === payment.invoiceId);
    if (invoice) recalculateInvoicePayment(invoice);
  },
};

/** Recalcule `amountPaid` puis le statut. Réplique du trigger Postgres de l'étape 3. */
function recalculateInvoicePayment(invoice: Invoice): void {
  const db = getMockDb();
  const amountPaid = db.payments
    .filter((row) => row.invoiceId === invoice.id)
    .reduce((sum, row) => sum + row.amount, 0);

  invoice.amountPaid = amountPaid;
  invoice.status = statusAfterPayment(invoice.status, invoice.total, amountPaid);
  invoice.paidAt = invoice.status === "paid" ? (invoice.paidAt ?? now()) : null;
  invoice.updatedAt = now();
}

/* ----------------------------------------------------------- Récurrence */

const recurring: RecurringRepo = {
  async list(orgId) {
    return getMockDb().schedules.filter((row) => row.orgId === orgId);
  },

  async get(orgId, scheduleId) {
    return (
      getMockDb().schedules.find((row) => row.id === scheduleId && row.orgId === orgId) ?? null
    );
  },

  async create(orgId, input: RecurringScheduleInput) {
    const schedule: RecurringSchedule = {
      id: mockId(),
      orgId,
      clientId: input.clientId,
      label: input.label,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      nextRunOn: input.startDate,
      paymentTerms: input.paymentTerms,
      active: true,
      template: input.template.map((line) => ({ ...line, discount: line.discount ?? null })),
      createdAt: now(),
    };
    getMockDb().schedules.push(schedule);
    return schedule;
  },

  async update(orgId, scheduleId, input: RecurringScheduleInput) {
    const schedule = await recurring.get(orgId, scheduleId);
    if (!schedule) throw new NotFoundError("Échéancier");
    Object.assign(schedule, {
      clientId: input.clientId,
      label: input.label,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      paymentTerms: input.paymentTerms,
      template: input.template.map((line) => ({ ...line, discount: line.discount ?? null })),
    });
    return schedule;
  },

  async setActive(orgId, scheduleId, active) {
    const schedule = await recurring.get(orgId, scheduleId);
    if (!schedule) throw new NotFoundError("Échéancier");
    schedule.active = active;
  },
};

export const mockRepositories: Repositories = {
  organizations,
  clients,
  invoices,
  payments,
  recurring,
};
