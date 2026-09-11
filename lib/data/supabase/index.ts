import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import {
  DomainError,
  NotFoundError,
  type ClientListFilters,
  type ClientRepo,
  type InvoiceListFilters,
  type InvoiceRepo,
  type OrganizationRepo,
  type PaymentListFilters,
  type PaymentRepo,
  type ProductListFilters,
  type ProductRepo,
  type RecurringRepo,
  type Repositories,
} from "@/lib/data/repository";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";
import {
  INVOICE_ITEM_COLUMNS,
  toClient,
  toProduct,
  toInvoice,
  toInvoiceEvent,
  toInvoiceItem,
  toOrganization,
  toPayment,
  toRecurringSchedule,
  type ClientRow,
  type ProductRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type OrganizationRow,
  type PaymentRow,
  type RecurringScheduleRow,
} from "@/lib/data/supabase/rows";
import type { DashboardStats, InvoiceWithItems, UUID } from "@/lib/domain/types";
import type {
  ClientInput,
  InvoiceInput,
  OrganizationSettingsInput,
  PaymentInput,
  ProductInput,
  RecurringScheduleInput,
} from "@/lib/domain/schemas";

/**
 * Implémentation Supabase des repositories.
 *
 * Même contrat que l'implémentation en mémoire : aucun composant ne change.
 *
 * Deux principes gouvernent ce fichier :
 *
 * 1. **`org_id` est borné explicitement dans chaque requête**, alors même que la
 *    RLS le ferait. La redondance est voulue : une fuite devient visible à la
 *    lecture du code, et non seulement au test.
 *
 * 2. **Les montants ne sont jamais calculés ici.** Les triggers de la base
 *    recalculent les totaux de chaque ligne et de chaque document. On n'envoie
 *    que les valeurs saisies — quantité, prix unitaire, taux, remise.
 */

const DEFAULT_PAGE_SIZE = 20;

/** Codes SQL dont le message est rédigé pour l'utilisateur (voir les migrations). */
const DOMAIN_ERROR_CODES = new Set([
  "23001", // restrict_violation — document figé
  "23514", // check_violation — précondition métier
  "42501", // insufficient_privilege — RLS ou rôle
  "P0002", // no_data_found
]);

function raise(error: PostgrestError, context: string): never {
  if (DOMAIN_ERROR_CODES.has(error.code)) {
    throw new DomainError(error.message);
  }
  console.error(`[supabase] ${context}`, error);
  throw new Error(`${context} : ${error.message}`);
}

function range(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/* --------------------------------------------------------- Organisations */

const organizations: OrganizationRepo = {
  async get(orgId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (error) raise(error, "lecture de l'organisation");
    return data ? toOrganization(data as OrganizationRow) : null;
  },

  async listForUser(userId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("memberships")
      .select("organization:organizations(*)")
      .eq("user_id", userId);

    if (error) raise(error, "lecture des organisations");
    // PostgREST type les relations imbriquées comme des tableaux : il ne peut
    // pas déduire la cardinalité depuis la requête. La conversion est sûre ici,
    // `memberships.org_id` étant une clé étrangère simple.
    return (data ?? [])
      .map((row) => (row as unknown as { organization: OrganizationRow | null }).organization)
      .filter((row): row is OrganizationRow => row !== null)
      .map(toOrganization);
  },

  async update(orgId, input: OrganizationSettingsInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("organizations")
      .update({
        name: input.name,
        legal_name: input.legalName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address_line: input.addressLine ?? null,
        city: input.city ?? null,
        country: input.country,
        tax_id: input.taxId ?? null,
        currency: input.currency,
        default_tax_rate: input.defaultTaxRate,
        default_payment_terms: input.defaultPaymentTerms,
        invoice_prefix: input.invoicePrefix.toUpperCase(),
        quote_prefix: input.quotePrefix.toUpperCase(),
        credit_note_prefix: input.creditNotePrefix.toUpperCase(),
        invoice_footer: input.invoiceFooter ?? null,
        logo_url: input.logoUrl ?? null,
      })
      .eq("id", orgId)
      .select("*")
      .maybeSingle();

    if (error) raise(error, "mise à jour de l'organisation");
    if (!data) throw new NotFoundError("Organisation");
    return toOrganization(data as OrganizationRow);
  },

  async listMembers(orgId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("memberships")
      .select("id, org_id, user_id, role, created_at")
      .eq("org_id", orgId);

    if (error) raise(error, "lecture des membres");

    const members = (data ?? []) as Array<{
      id: string;
      org_id: string;
      user_id: string;
      role: "owner" | "admin" | "member";
      created_at: string;
    }>;

    // Le profil est chargé à part, pas embarqué : `memberships.user_id` et
    // `profiles.id` référencent tous deux `auth.users` sans clé étrangère entre
    // eux, et PostgREST n'embarque qu'à travers une contrainte déclarée. Une
    // seule requête supplémentaire pour tout le lot, jamais une par membre.
    // `20260814090000_memberships_profiles_fk.sql` pose la contrainte manquante ;
    // une fois passée, `profile:profiles(full_name)` redevient possible ici.
    const fullNames = new Map<string, string | null>();

    if (members.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          members.map((member) => member.user_id),
        );

      if (profilesError) raise(profilesError, "lecture des profils");

      for (const profile of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
        fullNames.set(profile.id, profile.full_name);
      }
    }

    return members.map((member) => ({
      id: member.id,
      orgId: member.org_id,
      userId: member.user_id,
      role: member.role,
      createdAt: member.created_at,
      // L'email vit dans `auth.users`, inaccessible depuis PostgREST. Il
      // faudra l'exposer via `profiles` pour l'afficher ici.
      email: "",
      fullName: fullNames.get(member.user_id) ?? null,
    }));
  },

  async getSubscription(orgId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("org_id", orgId)
      .maybeSingle();

    if (error) raise(error, "lecture de l'abonnement");

    // Ligne absente = plan gratuit. La table est en lecture seule pour
    // l'application (cf. RLS) : seul le service role y écrit, donc un
    // utilisateur ne peut pas s'attribuer un plan payant.
    const row = (data ?? null) as { plan: string; status: string } | null;
    return row ?? { plan: "free", status: "active" };
  },
};

/* --------------------------------------------------------------- Clients */

const products: ProductRepo = {
  async list(orgId, filters: ProductListFilters = {}) {
    const supabase = createSupabaseServerClient();
    const { from, to } = range(filters.page, filters.pageSize);

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .range(from, to);

    if (!filters.includeArchived) query = query.is("archived_at", null);
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      query = query.or(`name.ilike.${pattern},barcode.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) raise(error, "lecture des produits");

    return { rows: (data ?? []).map((row) => toProduct(row as ProductRow)), total: count ?? 0 };
  },

  async get(orgId, productId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", productId)
      .maybeSingle();

    if (error) raise(error, "lecture du produit");
    return data ? toProduct(data as ProductRow) : null;
  },

  async findByBarcode(orgId, barcode) {
    const code = barcode.trim();
    if (!code) return null;

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("org_id", orgId)
      .eq("barcode", code)
      // Les archivés sont exclus : on retire un article du catalogue pour qu'il
      // cesse d'être vendu, un scan ne doit pas le ressusciter.
      .is("archived_at", null)
      .maybeSingle();

    if (error) raise(error, "recherche par code-barres");
    return data ? toProduct(data as ProductRow) : null;
  },

  async create(orgId, input: ProductInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .insert({
        org_id: orgId,
        name: input.name,
        unit_price: input.unitPrice,
        tax_rate: input.taxRate,
        barcode: input.barcode ?? null,
        unit: input.unit ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) raise(error, "création du produit");
    return toProduct(data as ProductRow);
  },

  async update(orgId, productId, input: ProductInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .update({
        name: input.name,
        unit_price: input.unitPrice,
        tax_rate: input.taxRate,
        barcode: input.barcode ?? null,
        unit: input.unit ?? null,
        notes: input.notes ?? null,
      })
      .eq("org_id", orgId)
      .eq("id", productId)
      .select("*")
      .single();

    if (error) raise(error, "modification du produit");
    return toProduct(data as ProductRow);
  },

  async archive(orgId, productId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("products")
      .update({ archived_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", productId);

    if (error) raise(error, "archivage du produit");
  },

  async restore(orgId, productId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("products")
      .update({ archived_at: null })
      .eq("org_id", orgId)
      .eq("id", productId);

    if (error) raise(error, "restauration du produit");
  },
};

const clients: ClientRepo = {
  async list(orgId, filters: ClientListFilters = {}) {
    const supabase = createSupabaseServerClient();
    const { from, to } = range(filters.page, filters.pageSize);

    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .range(from, to);

    if (!filters.includeArchived) query = query.is("archived_at", null);
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) raise(error, "lecture des clients");

    return { rows: (data ?? []).map((row) => toClient(row as ClientRow)), total: count ?? 0 };
  },

  async get(orgId, clientId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", clientId)
      .maybeSingle();

    if (error) raise(error, "lecture du client");
    return data ? toClient(data as ClientRow) : null;
  },

  async create(orgId, input: ClientInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clients")
      .insert({
        org_id: orgId,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address_line: input.addressLine ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        tax_id: input.taxId ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) raise(error, "création du client");
    return toClient(data as ClientRow);
  },

  async update(orgId, clientId, input: ClientInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address_line: input.addressLine ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        tax_id: input.taxId ?? null,
        notes: input.notes ?? null,
      })
      .eq("org_id", orgId)
      .eq("id", clientId)
      .select("*")
      .maybeSingle();

    if (error) raise(error, "mise à jour du client");
    if (!data) throw new NotFoundError("Client");
    return toClient(data as ClientRow);
  },

  async archive(orgId, clientId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", clientId);

    if (error) raise(error, "archivage du client");
  },

  async restore(orgId, clientId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: null })
      .eq("org_id", orgId)
      .eq("id", clientId);

    if (error) raise(error, "réactivation du client");
  },
};

/* -------------------------------------------------------------- Factures */

const INVOICE_SELECT = `*, items:invoice_items(${INVOICE_ITEM_COLUMNS}), client:clients(*)`;

type InvoiceJoinRow = InvoiceRow & {
  items: InvoiceItemRow[] | null;
  client: ClientRow | null;
};

function toInvoiceWithItems(row: InvoiceJoinRow): InvoiceWithItems {
  return {
    ...toInvoice(row),
    items: (row.items ?? []).map(toInvoiceItem).sort((a, b) => a.position - b.position),
    client: row.client ? toClient(row.client) : null,
  };
}

/** Lignes prêtes à insérer. Les colonnes calculées sont omises : le trigger les remplit. */
function itemRows(invoiceId: UUID, input: InvoiceInput) {
  return input.items.map((line, position) => ({
    invoice_id: invoiceId,
    position,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    tax_rate: line.taxRate,
    discount_type: line.discount?.type ?? null,
    discount_value: line.discount?.value ?? null,
  }));
}

const invoices: InvoiceRepo = {
  async list(orgId, filters: InvoiceListFilters = {}) {
    const supabase = createSupabaseServerClient();
    const { from, to } = range(filters.page, filters.pageSize);

    let query = supabase
      .from("invoices")
      .select(INVOICE_SELECT, { count: "exact" })
      .eq("org_id", orgId)
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.type) query = query.eq("type", filters.type);
    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.from) query = query.gte("issue_date", filters.from);
    if (filters.to) query = query.lte("issue_date", filters.to);

    if (filters.status === "overdue") {
      // `overdue` n'est pas stocké : on rejoue sa dérivation en SQL.
      query = query.in("status", ["sent", "partially_paid"]).lt("due_date", todayIso());
    } else if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      query = query.or(`number.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) raise(error, "lecture des factures");

    return {
      rows: (data ?? []).map((row) => toInvoiceWithItems(row as unknown as InvoiceJoinRow)),
      total: count ?? 0,
    };
  },

  async get(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_SELECT)
      .eq("org_id", orgId)
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) raise(error, "lecture de la facture");
    return data ? toInvoiceWithItems(data as unknown as InvoiceJoinRow) : null;
  },

  /**
   * Consultation publique par jeton — hors session, donc hors RLS.
   * On utilise le client administrateur, mais l'accès reste borné au jeton
   * (32 octets aléatoires) ET au statut : un brouillon n'a jamais été communiqué.
   */
  async getByPublicToken(token) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_SELECT)
      .eq("public_token", token)
      .neq("status", "draft")
      .maybeSingle();

    if (error) raise(error, "lecture du lien public");
    return data ? toInvoiceWithItems(data as unknown as InvoiceJoinRow) : null;
  },

  async createDraft(orgId, input: InvoiceInput, userId) {
    const supabase = createSupabaseServerClient();

    const { data: created, error } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id: input.clientId ?? null,
        type: input.type,
        status: "draft",
        issue_date: input.issueDate,
        due_date: input.dueDate,
        currency: input.currency,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) raise(error, "création du brouillon");

    const invoiceId = (created as { id: string }).id;
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemRows(invoiceId, input));

    if (itemsError) raise(itemsError, "création des lignes");

    await supabase.from("invoice_events").insert({
      org_id: orgId,
      invoice_id: invoiceId,
      type: "created",
    });

    const invoice = await invoices.get(orgId, invoiceId);
    if (!invoice) throw new NotFoundError("Facture");
    return invoice;
  },

  async updateDraft(orgId, invoiceId, input: InvoiceInput) {
    const supabase = createSupabaseServerClient();

    // Le trigger `enforce_invoice_items_immutability` refusera ces écritures si
    // le document n'est plus un brouillon : la garantie est en base, pas ici.
    const { error: deleteError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);
    if (deleteError) raise(deleteError, "modification des lignes");

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemRows(invoiceId, input));
    if (itemsError) raise(itemsError, "modification des lignes");

    const { error } = await supabase
      .from("invoices")
      .update({
        client_id: input.clientId ?? null,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        currency: input.currency,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
      })
      .eq("org_id", orgId)
      .eq("id", invoiceId);
    if (error) raise(error, "modification du document");

    const invoice = await invoices.get(orgId, invoiceId);
    if (!invoice) throw new NotFoundError("Facture");
    return invoice;
  },

  async deleteDraft(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { error, count } = await supabase
      .from("invoices")
      .delete({ count: "exact" })
      .eq("org_id", orgId)
      .eq("id", invoiceId)
      .eq("status", "draft");

    if (error) raise(error, "suppression du brouillon");
    if (!count) throw new DomainError("Seul un brouillon peut être supprimé.");
  },

  async countIssuedBetween(orgId, from, to) {
    const supabase = createSupabaseServerClient();
    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("type", "invoice")
      .not("sent_at", "is", null)
      .gte("sent_at", from)
      // Borne haute EXCLUE : `to` est le 1er du mois suivant, donc une facture
      // émise le dernier jour à 23 h 59 reste comptée dans son mois.
      .lt("sent_at", to);

    if (error) raise(error, "comptage des factures émises");
    return count ?? 0;
  },

  /** Numérotation, snapshot et statut : une seule transaction, côté base. */
  async issue(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.rpc("issue_invoice", { p_invoice: invoiceId });
    if (error) raise(error, "émission du document");

    const invoice = await invoices.get(orgId, invoiceId);
    if (!invoice) throw new NotFoundError("Facture");
    return invoice;
  },

  async cancel(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", invoiceId)
      .in("status", ["draft", "sent", "partially_paid"]);

    if (error) raise(error, "annulation du document");

    const invoice = await invoices.get(orgId, invoiceId);
    if (!invoice) throw new NotFoundError("Facture");
    return invoice;
  },

  async createCreditNote(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_credit_note", { p_invoice: invoiceId });
    if (error) raise(error, "création de l'avoir");

    const creditNote = await invoices.get(orgId, (data as InvoiceRow).id);
    if (!creditNote) throw new NotFoundError("Avoir");
    return creditNote;
  },

  async convertQuoteToInvoice(orgId, quoteId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("convert_quote_to_invoice", { p_quote: quoteId });
    if (error) raise(error, "conversion du devis");

    const invoice = await invoices.get(orgId, (data as InvoiceRow).id);
    if (!invoice) throw new NotFoundError("Facture");
    return invoice;
  },

  async listEvents(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("invoice_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });

    if (error) raise(error, "lecture de l'historique");
    return (data ?? []).map((row) => toInvoiceEvent(row as never));
  },

  async stats(orgId): Promise<DashboardStats> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("dashboard_stats", { p_org: orgId });
    if (error) raise(error, "calcul des statistiques");

    // Agrégats calculés en base : une organisation à plusieurs milliers de
    // factures ne doit pas les télécharger pour afficher quatre chiffres.
    const stats = data as Partial<DashboardStats> | null;
    return {
      invoiceCount: Number(stats?.invoiceCount ?? 0),
      totalInvoiced: Number(stats?.totalInvoiced ?? 0),
      totalPaid: Number(stats?.totalPaid ?? 0),
      totalOutstanding: Number(stats?.totalOutstanding ?? 0),
      totalOverdue: Number(stats?.totalOverdue ?? 0),
      overdueCount: Number(stats?.overdueCount ?? 0),
    };
  },

  async monthlyTotals(orgId, months) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("monthly_totals", {
      p_org: orgId,
      p_months: months,
    });
    if (error) raise(error, "calcul de la série mensuelle");

    return ((data ?? []) as Array<{ month: string; invoiced: number; paid: number }>).map(
      (row) => ({
        // La fonction renvoie le premier jour du mois ; l'interface attend AAAA-MM.
        month: row.month.slice(0, 7),
        invoiced: Number(row.invoiced),
        paid: Number(row.paid),
      }),
    );
  },
};

/* ------------------------------------------------------------ Paiements */

const payments: PaymentRepo = {
  async listForInvoice(orgId, invoiceId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("org_id", orgId)
      .eq("invoice_id", invoiceId)
      .order("paid_at", { ascending: false });

    if (error) raise(error, "lecture des encaissements");
    return (data ?? []).map((row) => toPayment(row as PaymentRow));
  },

  /**
   * Passe par `payments_view` : la recherche porte sur le numéro de facture et
   * le nom du client, qui vivent dans d'autres tables. Sans la vue, il faudrait
   * tout charger pour filtrer côté application — donc plus de pagination.
   */
  async list(orgId, filters: PaymentListFilters = {}) {
    const supabase = createSupabaseServerClient();
    const { from, to } = range(filters.page, filters.pageSize);

    const build = () => {
      let query = supabase.from("payments_view").select("*", { count: "exact" }).eq("org_id", orgId);

      if (filters.method) query = query.eq("method", filters.method);
      if (filters.from) query = query.gte("paid_at", filters.from);
      if (filters.to) query = query.lte("paid_at", filters.to);
      if (filters.minAmount !== undefined) query = query.gte("amount", filters.minAmount);
      if (filters.maxAmount !== undefined) query = query.lte("amount", filters.maxAmount);
      if (filters.search) {
        const pattern = `%${filters.search}%`;
        query = query.or(
          `invoice_number.ilike.${pattern},client_name.ilike.${pattern},reference.ilike.${pattern}`,
        );
      }
      return query;
    };

    const { data, error, count } = await build()
      .order("paid_at", { ascending: false })
      .range(from, to);
    if (error) raise(error, "lecture des encaissements");

    // Le total du bandeau porte sur TOUTES les lignes filtrées, pas seulement
    // celles de la page : il faut donc une seconde requête sur les montants.
    const { data: amounts, error: amountError } = await build().select("amount");
    if (amountError) raise(amountError, "somme des encaissements");

    type ViewRow = PaymentRow & {
      invoice_number: string | null;
      invoice_type: InvoiceRow["type"];
      invoice_status: InvoiceRow["status"];
      invoice_currency: string;
      client_id: string | null;
      client_name: string | null;
      client_email: string | null;
    };

    return {
      rows: (data ?? []).map((raw) => {
        const row = raw as ViewRow;
        return {
          ...toPayment(row),
          invoice: {
            id: row.invoice_id,
            number: row.invoice_number,
            type: row.invoice_type,
            status: row.invoice_status,
          } as InvoiceWithItems,
          client: row.client_id
            ? ({ id: row.client_id, name: row.client_name ?? "", email: row.client_email } as never)
            : null,
        };
      }),
      total: count ?? 0,
      totalAmount: ((amounts ?? []) as Array<{ amount: number }>).reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      ),
    };
  },

  async record(orgId, input: PaymentInput, userId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payments")
      .insert({
        org_id: orgId,
        invoice_id: input.invoiceId,
        amount: input.amount,
        paid_at: input.paidAt,
        method: input.method,
        tendered: input.tendered ?? null,
        reference: input.reference ?? null,
        note: input.note ?? null,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) raise(error, "enregistrement de l'encaissement");
    return toPayment(data as PaymentRow);
  },

  async remove(orgId, paymentId) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("org_id", orgId)
      .eq("id", paymentId);

    if (error) raise(error, "suppression de l'encaissement");
  },
};

/* ----------------------------------------------------------- Récurrence */

const recurring: RecurringRepo = {
  async list(orgId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) raise(error, "lecture des échéanciers");
    return (data ?? []).map((row) => toRecurringSchedule(row as RecurringScheduleRow));
  },

  async get(orgId, scheduleId) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", scheduleId)
      .maybeSingle();

    if (error) raise(error, "lecture de l'échéancier");
    return data ? toRecurringSchedule(data as RecurringScheduleRow) : null;
  },

  async create(orgId, input: RecurringScheduleInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("recurring_schedules")
      .insert({
        org_id: orgId,
        client_id: input.clientId,
        label: input.label,
        frequency: input.frequency,
        interval_count: input.interval,
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        next_run_on: input.startDate,
        payment_terms: input.paymentTerms,
        template: input.template,
      })
      .select("*")
      .single();

    if (error) raise(error, "création de l'échéancier");
    return toRecurringSchedule(data as RecurringScheduleRow);
  },

  async update(orgId, scheduleId, input: RecurringScheduleInput) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("recurring_schedules")
      .update({
        client_id: input.clientId,
        label: input.label,
        frequency: input.frequency,
        interval_count: input.interval,
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        payment_terms: input.paymentTerms,
        template: input.template,
      })
      .eq("org_id", orgId)
      .eq("id", scheduleId)
      .select("*")
      .maybeSingle();

    if (error) raise(error, "mise à jour de l'échéancier");
    if (!data) throw new NotFoundError("Échéancier");
    return toRecurringSchedule(data as RecurringScheduleRow);
  },

  async setActive(orgId, scheduleId, active) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("recurring_schedules")
      .update({ active })
      .eq("org_id", orgId)
      .eq("id", scheduleId);

    if (error) raise(error, "activation de l'échéancier");
  },
};

export const supabaseRepositories: Repositories = {
  organizations,
  clients,
  products,
  invoices,
  payments,
  recurring,
};
