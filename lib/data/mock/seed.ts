/**
 * Jeu de données de démonstration, en mémoire.
 *
 * Déterministe : générateur pseudo-aléatoire à graine fixe et compteur
 * d'identifiants remis à zéro à chaque construction. Deux appels à
 * `resetMockDb()` produisent donc exactement la même base — sans quoi les tests
 * et les captures d'écran deviendraient instables.
 *
 * TOUT est reconstruit par `buildDataset()`, y compris l'organisation et les
 * clients : rien n'est figé au niveau module, sinon une mutation faite par un
 * test survivrait au reset et contaminerait le suivant.
 *
 * Remplacé par Supabase à l'étape 3 — aucun composant d'interface ne doit
 * importer ce fichier directement.
 */

import { computeTotals } from "@/lib/tax";
import { addDays, addMonths, todayIso } from "@/lib/dates";
import { formatDocumentNumber } from "@/lib/numbering";
import type {
  Client,
  Product,
  Invoice,
  InvoiceEvent,
  InvoiceItem,
  InvoiceStatus,
  Membership,
  Organization,
  Payment,
  RecurringSchedule,
  UUID,
} from "@/lib/domain/types";

export type MemberRow = Membership & { email: string; fullName: string | null };

export type MockDb = {
  organizations: Organization[];
  members: MemberRow[];
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  items: InvoiceItem[];
  payments: Payment[];
  events: InvoiceEvent[];
  schedules: RecurringSchedule[];
  /** clé `orgId:type:année` → dernière séquence attribuée */
  counters: Map<string, number>;
  /** clé `orgId` → abonnement. Absent = plan gratuit. */
  subscriptions: Map<string, { plan: string; status: string }>;
};

const SEED = 20260812;

/** PRNG « mulberry32 » : court, sans dépendance, reproductible. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * État partagé, porté par `globalThis`.
 *
 * INDISPENSABLE en App Router : Next.js instancie DEUX graphes de modules
 * serveur — un pour les Server Components, un pour les Server Actions appelées
 * depuis un composant client. Une simple variable de module existerait donc en
 * deux exemplaires : une Server Action écrirait dans la sienne, et la page qui
 * suit lirait dans l'autre — la facture créée serait introuvable (404).
 *
 * `globalThis` est le seul point commun aux deux couches. C'est le même motif
 * que le client Prisma en développement.
 */
type MockStore = { db: MockDb | null; idCounter: number };

const globalRef = globalThis as unknown as { __izifactureMock?: MockStore };
const store: MockStore = (globalRef.__izifactureMock ??= { db: null, idCounter: 0 });

/**
 * Compteur d'identifiants partagé entre le seed et les créations à l'exécution.
 * Remis à zéro par `buildDataset()`, donc les identifiants de démonstration sont
 * stables d'une construction à l'autre.
 */
function nextId(): UUID {
  store.idCounter += 1;
  return `00000000-0000-4000-8000-${store.idCounter.toString(16).padStart(12, "0")}`;
}

/** Identifiants stables, garantis par la remise à zéro du compteur. */
export const DEMO_ORG_ID: UUID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID: UUID = "00000000-0000-4000-8000-000000000002";

const CLIENT_SEEDS = [
  { name: "Niger Telecoms", city: "Niamey", country: "Niger", domain: "nigertelecoms.ne" },
  { name: "Groupe Hama & Frères", city: "Maradi", country: "Niger", domain: "hama-freres.ne" },
  { name: "Coopérative de Tillabéri", city: "Tillabéri", country: "Niger", domain: "coop-tillaberi.ne" },
  { name: "Hôtel Gaweye", city: "Niamey", country: "Niger", domain: "gaweye.ne" },
  { name: "Zinder Logistique", city: "Zinder", country: "Niger", domain: "zinderlog.ne" },
  { name: "Agadez Transit", city: "Agadez", country: "Niger", domain: "agadeztransit.ne" },
  { name: "Clinique Gamkallé", city: "Niamey", country: "Niger", domain: "gamkalle.ne" },
  { name: "Ferme Sahel Bio", city: "Dosso", country: "Niger", domain: "sahelbio.ne" },
] as const;

const SERVICES = [
  { description: "Conception d'identité visuelle", price: 450_000 },
  { description: "Développement site web vitrine", price: 1_200_000 },
  { description: "Maintenance mensuelle", price: 150_000 },
  { description: "Séance photo produit (journée)", price: 275_000 },
  { description: "Formation équipe (par personne)", price: 85_000 },
  { description: "Impression brochures (100 ex.)", price: 62_500 },
  { description: "Community management mensuel", price: 200_000 },
  { description: "Audit technique", price: 333_000 },
] as const;

type InvoicePlan = {
  status: InvoiceStatus;
  type: "invoice" | "quote";
  ageInDays: number;
  paymentTerms: number;
  paidRatio: number;
};

function buildDataset(): MockDb {
  store.idCounter = 0;
  const random = createRandom(SEED);

  const pick = <T,>(values: readonly T[]): T =>
    values[Math.floor(random() * values.length)] as T;
  const randomInt = (min: number, max: number): number =>
    min + Math.floor(random() * (max - min + 1));

  const orgId = nextId();
  const ownerId = nextId();
  const createdAt = new Date().toISOString();
  const today = todayIso();

  const organization: Organization = {
    id: orgId,
    name: "Atelier Sahel",
    legalName: "Atelier Sahel SARL",
    email: "contact@atelier-sahel.ne",
    phone: "+227 90 12 34 56",
    addressLine: "12 avenue de l'Indépendance, Plateau",
    city: "Niamey",
    country: "Niger",
    // Au Niger l'identifiant fiscal est le NIF.
    taxId: "NIF 4512345/P",
    logoUrl: null,
    currency: "XOF",
    defaultTaxRate: 18,
    defaultPaymentTerms: 30,
    invoicePrefix: "FAC",
    quotePrefix: "DEV",
    creditNotePrefix: "AV",
    invoiceFooter:
      "Merci de votre confiance. Paiement en espèces, par virement, Airtel Money ou Zamani Cash.",
    createdAt,
  };

  const members: MemberRow[] = [
    {
      id: nextId(),
      orgId,
      userId: ownerId,
      role: "owner",
      createdAt,
      email: "aissatou@atelier-sahel.ne",
      fullName: "Aïssatou Moussa",
    },
    {
      id: nextId(),
      orgId,
      userId: nextId(),
      role: "admin",
      createdAt,
      email: "ibrahim@atelier-sahel.ne",
      fullName: "Ibrahim Seydou",
    },
    {
      id: nextId(),
      orgId,
      userId: nextId(),
      role: "member",
      createdAt,
      email: "fatouma@atelier-sahel.ne",
      fullName: "Fatouma Amadou",
    },
  ];

  const clients: Client[] = CLIENT_SEEDS.map((seed, index) => ({
    id: nextId(),
    orgId,
    name: seed.name,
    email: `contact@${seed.domain}`,
    phone: `+227 ${randomInt(20, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
    addressLine: `${randomInt(1, 120)} ${pick(["avenue de l'Indépendance", "boulevard de la République", "rue du Sahel", "avenue du Zarmaganda"])}`,
    city: seed.city,
    country: seed.country,
    taxId: index % 3 === 0 ? `NIF ${randomInt(1_000_000, 9_999_999)}/P` : null,
    notes: null,
    archivedAt: null,
    createdAt,
  }));

  const buildItems = (invoiceId: UUID, count: number, taxRate: number): InvoiceItem[] =>
    Array.from({ length: count }, (_, position) => {
      const service = pick(SERVICES);
      const quantity = pick([1, 1, 1, 2, 3, 0.5, 1.5]);
      const discount = random() < 0.2 ? { type: "percent" as const, value: pick([5, 10, 15]) } : null;
      const totals = computeTotals([
        { quantity, unitPrice: service.price, taxRate, discount },
      ]);

      return {
        id: nextId(),
        invoiceId,
        position,
        description: service.description,
        quantity,
        unitPrice: service.price,
        taxRate,
        discount,
        lineSubtotal: totals.subtotal,
        lineDiscount: totals.discountTotal,
        lineTax: totals.taxTotal,
        lineTotal: totals.total,
      } satisfies InvoiceItem;
    });

  // Répartition volontairement variée pour que le dashboard soit parlant.
  const plans: InvoicePlan[] = [
    ...Array.from({ length: 4 }, () => ({
      status: "draft" as const,
      type: "invoice" as const,
      ageInDays: randomInt(0, 6),
      paymentTerms: 30,
      paidRatio: 0,
    })),
    ...Array.from({ length: 6 }, () => ({
      status: "paid" as const,
      type: "invoice" as const,
      ageInDays: randomInt(40, 160),
      paymentTerms: 30,
      paidRatio: 1,
    })),
    ...Array.from({ length: 4 }, () => ({
      status: "sent" as const,
      type: "invoice" as const,
      ageInDays: randomInt(2, 20),
      paymentTerms: 30,
      paidRatio: 0,
    })),
    ...Array.from({ length: 3 }, () => ({
      status: "partially_paid" as const,
      type: "invoice" as const,
      ageInDays: randomInt(10, 40),
      paymentTerms: 60,
      paidRatio: 0.4,
    })),
    // Échéance dépassée : `deriveDisplayStatus` les affichera « en retard ».
    ...Array.from({ length: 4 }, () => ({
      status: "sent" as const,
      type: "invoice" as const,
      ageInDays: randomInt(45, 120),
      paymentTerms: 15,
      paidRatio: 0,
    })),
    ...Array.from({ length: 2 }, () => ({
      status: "cancelled" as const,
      type: "invoice" as const,
      ageInDays: randomInt(60, 200),
      paymentTerms: 30,
      paidRatio: 0,
    })),
    ...Array.from({ length: 3 }, () => ({
      status: "sent" as const,
      type: "quote" as const,
      ageInDays: randomInt(1, 25),
      paymentTerms: 15,
      paidRatio: 0,
    })),
  ];

  const invoices: Invoice[] = [];
  const items: InvoiceItem[] = [];
  const payments: Payment[] = [];
  const events: InvoiceEvent[] = [];
  const counters = new Map<string, number>();

  // Trié du plus ancien au plus récent : la numérotation suit l'ordre chronologique.
  for (const plan of [...plans].sort((a, b) => b.ageInDays - a.ageInDays)) {
    const invoiceId = nextId();
    const client = pick(clients);
    const issueDate = addDays(today, -plan.ageInDays);
    const dueDate = addDays(issueDate, plan.paymentTerms);
    const taxRate = random() < 0.15 ? 0 : 18;
    const lines = buildItems(invoiceId, randomInt(1, 4), taxRate);
    const totals = computeTotals(lines);

    const isDraft = plan.status === "draft";
    const year = Number(issueDate.slice(0, 4));
    const counterKey = `${orgId}:${plan.type}:${year}`;

    let number: string | null = null;
    if (!isDraft) {
      const sequence = (counters.get(counterKey) ?? 0) + 1;
      counters.set(counterKey, sequence);
      number = formatDocumentNumber(plan.type === "quote" ? "DEV" : "FAC", year, sequence);
    }

    const amountPaid = Math.round(totals.total * plan.paidRatio);
    const issuedAt = `${issueDate}T09:00:00.000Z`;

    invoices.push({
      id: invoiceId,
      orgId,
      clientId: client.id,
      type: plan.type,
      number,
      status: plan.status,
      issueDate,
      dueDate,
      currency: "XOF",
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid,
      notes: null,
      terms: plan.type === "quote" ? "Devis valable 30 jours." : null,
      // Dérivé de l'identifiant COMPLET : tronquer collerait le même jeton à
      // toutes les factures, puisque seule la fin de l'UUID varie.
      publicToken: `tok_${invoiceId.replace(/-/g, "")}`,
      snapshot: isDraft
        ? null
        : {
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
          },
      parentInvoiceId: null,
      sentAt: isDraft ? null : issuedAt,
      paidAt:
        plan.status === "paid" ? `${addDays(issueDate, randomInt(5, 28))}T14:30:00.000Z` : null,
      cancelledAt: plan.status === "cancelled" ? `${addDays(issueDate, 10)}T10:00:00.000Z` : null,
      createdBy: ownerId,
      createdAt: issuedAt,
      updatedAt: issuedAt,
    });

    items.push(...lines);
    events.push({
      id: nextId(),
      orgId,
      invoiceId,
      type: "created",
      meta: null,
      createdAt: issuedAt,
    });

    if (amountPaid > 0) {
      const method = pick(["my_nita", "wave", "cash", "airtel_money"] as const);

      payments.push({
        id: nextId(),
        orgId,
        invoiceId,
        amount: amountPaid,
        paidAt: addDays(issueDate, randomInt(3, 25)),
        method,
        /**
         * En espèces on tend rarement le compte juste : on arrondit au billet
         * de 500 supérieur, ce qui donne au jeu de démonstration des monnaies
         * rendues plausibles — et parfois nulles, quand le compte tombe juste.
         * Les autres moyens ne rendent pas de monnaie, d'où `null`.
         */
        tendered: method === "cash" ? Math.ceil(amountPaid / 500) * 500 : null,
        reference: null,
        note: null,
        createdBy: ownerId,
        createdAt: issuedAt,
      });
    }
  }

  const schedules: RecurringSchedule[] = [
    {
      id: nextId(),
      orgId,
      clientId: clients[0]!.id,
      label: "Maintenance mensuelle — Niger Telecoms",
      frequency: "monthly",
      interval: 1,
      startDate: addMonths(today, -6),
      endDate: null,
      nextRunOn: addMonths(today, 1),
      paymentTerms: 30,
      active: true,
      template: [
        {
          description: "Maintenance mensuelle",
          quantity: 1,
          unitPrice: 150_000,
          taxRate: 18,
          discount: null,
        },
      ],
      createdAt,
    },
    {
      id: nextId(),
      orgId,
      clientId: clients[3]!.id,
      label: "Community management — Hôtel Gaweye",
      frequency: "monthly",
      interval: 1,
      startDate: addMonths(today, -3),
      endDate: null,
      nextRunOn: addMonths(today, 1),
      paymentTerms: 15,
      active: true,
      template: [
        {
          description: "Community management mensuel",
          quantity: 1,
          unitPrice: 200_000,
          taxRate: 18,
          discount: null,
        },
      ],
      createdAt,
    },
  ];

  /**
   * Catalogue de démonstration, dérivé des mêmes prestations que les factures :
   * un jeu d'essai où le catalogue et l'historique se contredisent serait pire
   * que pas de catalogue du tout.
   *
   * Les codes-barres ne sont posés que sur une partie — c'est le cas réel, une
   * prestation n'en a pas.
   */
  const products: Product[] = SERVICES.map((service, index) => ({
    id: nextId(),
    orgId,
    name: service.description,
    unitPrice: service.price,
    taxRate: 18,
    barcode: index % 3 === 0 ? `600${String(index + 1).padStart(10, "0")}` : null,
    unit: null,
    notes: null,
    archivedAt: null,
    createdAt,
  }));

  return {
    organizations: [organization],
    members,
    clients,
    products,
    invoices,
    items,
    payments,
    events,
    schedules,
    counters,
    // L'organisation de démonstration démarre au plan gratuit : c'est le
    // parcours qu'on veut pouvoir essayer, quota et blocage compris.
    subscriptions: new Map([[organization.id, { plan: "free", status: "active" }]]),
  };
}

/** Instance partagée par les deux couches serveur. */
export function getMockDb(): MockDb {
  store.db ??= buildDataset();
  return store.db;
}

/** Reconstruit une base neuve — à appeler entre deux tests. */
export function resetMockDb(): MockDb {
  store.db = buildDataset();
  return store.db;
}

export { nextId as mockId };
