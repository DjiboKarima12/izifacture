import { beforeEach, describe, expect, it } from "vitest";

import { mockRepositories } from "@/lib/data/mock";
import { DEMO_ORG_ID, DEMO_USER_ID, getMockDb, resetMockDb } from "@/lib/data/mock/seed";
import { DomainError } from "@/lib/data/repository";
import { computeTotals } from "@/lib/tax";
import { todayIso } from "@/lib/dates";
import { deriveDisplayStatus } from "@/lib/status";
import type { InvoiceInput } from "@/lib/domain/schemas";

const { clients, invoices, payments } = mockRepositories;

beforeEach(() => {
  resetMockDb();
});

function draftInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  const clientId = getMockDb().clients[0]!.id;
  return {
    clientId,
    type: "invoice",
    issueDate: todayIso(),
    dueDate: todayIso(),
    currency: "XOF",
    notes: null,
    terms: null,
    items: [{ description: "Prestation", quantity: 2, unitPrice: 100_000, taxRate: 18, discount: null }],
    ...overrides,
  } as InvoiceInput;
}

describe("isolation du jeu de données", () => {
  it("repart d'une base identique entre deux tests", () => {
    const before = getMockDb().clients.length;
    void clients.create(DEMO_ORG_ID, { name: "Client jetable" } as never);
    resetMockDb();
    expect(getMockDb().clients.length).toBe(before);
  });

  it("expose des identifiants de démonstration stables", () => {
    expect(getMockDb().organizations[0]!.id).toBe(DEMO_ORG_ID);
    expect(getMockDb().members[0]!.userId).toBe(DEMO_USER_ID);
  });
});

describe("createDraft", () => {
  it("recalcule les totaux au lieu de faire confiance à l'appelant", async () => {
    const invoice = await invoices.createDraft(DEMO_ORG_ID, draftInput(), DEMO_USER_ID);
    const expected = computeTotals(draftInput().items);

    expect(invoice.subtotal).toBe(expected.subtotal);
    expect(invoice.taxTotal).toBe(expected.taxTotal);
    expect(invoice.total).toBe(expected.total);
    expect(invoice.total).toBe(236_000);
  });

  it("ne consomme aucun numéro tant que le document est un brouillon", async () => {
    const invoice = await invoices.createDraft(DEMO_ORG_ID, draftInput(), DEMO_USER_ID);
    expect(invoice.number).toBeNull();
    expect(invoice.status).toBe("draft");
    expect(invoice.snapshot).toBeNull();
  });

  it("refuse un client d'une autre organisation", async () => {
    await expect(
      invoices.createDraft(DEMO_ORG_ID, draftInput({ clientId: crypto.randomUUID() }), null),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("issue", () => {
  it("attribue un numéro et fige le snapshot", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), DEMO_USER_ID);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    expect(issued.number).toMatch(/^FAC-\d{4}-\d{4}$/);
    expect(issued.status).toBe("sent");
    expect(issued.snapshot?.organization.name).toBe("Atelier Sahel");
    expect(issued.snapshot?.client.name).toBe(getMockDb().clients[0]!.name);
    expect(issued.sentAt).not.toBeNull();
  });

  it("attribue des numéros consécutifs et sans trou", async () => {
    const first = await invoices.issue(
      DEMO_ORG_ID,
      (await invoices.createDraft(DEMO_ORG_ID, draftInput(), null)).id,
    );
    // Un brouillon abandonné entre les deux ne doit pas créer de trou.
    await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const second = await invoices.issue(
      DEMO_ORG_ID,
      (await invoices.createDraft(DEMO_ORG_ID, draftInput(), null)).id,
    );

    const sequenceOf = (number: string | null) => Number(number!.split("-")[2]);
    expect(sequenceOf(second.number)).toBe(sequenceOf(first.number) + 1);
  });

  it("gèle le snapshot : modifier le client après émission ne change pas la facture", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);
    const originalName = issued.snapshot!.client.name;

    await clients.update(DEMO_ORG_ID, draft.clientId, {
      name: "Nouvelle raison sociale",
    } as never);

    const reloaded = await invoices.get(DEMO_ORG_ID, draft.id);
    expect(reloaded!.snapshot!.client.name).toBe(originalName);
  });

  it("refuse d'émettre deux fois", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    await invoices.issue(DEMO_ORG_ID, draft.id);
    await expect(invoices.issue(DEMO_ORG_ID, draft.id)).rejects.toThrow(/Transition/);
  });
});

describe("immuabilité des documents émis", () => {
  it("refuse de modifier une facture émise", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    await invoices.issue(DEMO_ORG_ID, draft.id);

    await expect(invoices.updateDraft(DEMO_ORG_ID, draft.id, draftInput())).rejects.toThrow(
      DomainError,
    );
  });

  it("refuse de supprimer une facture émise", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    await invoices.issue(DEMO_ORG_ID, draft.id);

    await expect(invoices.deleteDraft(DEMO_ORG_ID, draft.id)).rejects.toThrow(/brouillon/);
  });

  it("autorise la modification d'un brouillon", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const updated = await invoices.updateDraft(
      DEMO_ORG_ID,
      draft.id,
      draftInput({
        items: [
          { description: "Autre", quantity: 1, unitPrice: 50_000, taxRate: 18, discount: null },
        ],
      }),
    );

    expect(updated.items).toHaveLength(1);
    expect(updated.total).toBe(59_000);
  });

  it("propose un avoir pour corriger une facture émise", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    const creditNote = await invoices.createCreditNote(DEMO_ORG_ID, issued.id, DEMO_USER_ID);
    expect(creditNote.type).toBe("credit_note");
    expect(creditNote.parentInvoiceId).toBe(issued.id);
    expect(creditNote.status).toBe("draft");
    expect(creditNote.items).toHaveLength(issued.items.length);
  });
});

describe("encaissements", () => {
  it("passe la facture en partiellement payée", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    await payments.record(
      DEMO_ORG_ID,
      { invoiceId: issued.id, amount: 100_000, paidAt: todayIso(), method: "mobile_money", reference: null, note: null },
      DEMO_USER_ID,
    );

    const reloaded = await invoices.get(DEMO_ORG_ID, issued.id);
    expect(reloaded!.amountPaid).toBe(100_000);
    expect(reloaded!.status).toBe("partially_paid");
  });

  it("passe la facture en payée au solde", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    for (const amount of [136_000, 100_000]) {
      await payments.record(
        DEMO_ORG_ID,
        { invoiceId: issued.id, amount, paidAt: todayIso(), method: "cash", reference: null, note: null },
        null,
      );
    }

    const reloaded = await invoices.get(DEMO_ORG_ID, issued.id);
    expect(reloaded!.amountPaid).toBe(236_000);
    expect(reloaded!.status).toBe("paid");
    expect(reloaded!.paidAt).not.toBeNull();
  });

  it("revient en arrière si l'encaissement est supprimé", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    const payment = await payments.record(
      DEMO_ORG_ID,
      { invoiceId: issued.id, amount: 236_000, paidAt: todayIso(), method: "cash", reference: null, note: null },
      null,
    );
    expect((await invoices.get(DEMO_ORG_ID, issued.id))!.status).toBe("paid");

    await payments.remove(DEMO_ORG_ID, payment.id);
    const reloaded = await invoices.get(DEMO_ORG_ID, issued.id);
    expect(reloaded!.amountPaid).toBe(0);
    expect(reloaded!.status).toBe("sent");
    expect(reloaded!.paidAt).toBeNull();
  });

  it("refuse d'encaisser sur un brouillon", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);

    await expect(
      payments.record(
        DEMO_ORG_ID,
        { invoiceId: draft.id, amount: 1000, paidAt: todayIso(), method: "cash", reference: null, note: null },
        null,
      ),
    ).rejects.toThrow(/Émettez la facture/);
  });
});

describe("lien public", () => {
  it("expose une facture émise par son jeton", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    const issued = await invoices.issue(DEMO_ORG_ID, draft.id);

    const fetched = await invoices.getByPublicToken(issued.publicToken);
    expect(fetched?.id).toBe(issued.id);
  });

  it("n'expose jamais un brouillon", async () => {
    const draft = await invoices.createDraft(DEMO_ORG_ID, draftInput(), null);
    expect(await invoices.getByPublicToken(draft.publicToken)).toBeNull();
  });

  it("renvoie null sur un jeton inconnu", async () => {
    expect(await invoices.getByPublicToken("tok_inexistant")).toBeNull();
  });
});

describe("statistiques du dashboard", () => {
  it("exclut brouillons, devis et documents annulés", async () => {
    const stats = await invoices.stats(DEMO_ORG_ID);
    const db = getMockDb();

    const counted = db.invoices.filter(
      (invoice) =>
        invoice.type === "invoice" && invoice.status !== "draft" && invoice.status !== "cancelled",
    );

    expect(stats.invoiceCount).toBe(counted.length);
    expect(stats.totalInvoiced).toBe(counted.reduce((sum, row) => sum + row.total, 0));
    expect(stats.totalPaid).toBe(counted.reduce((sum, row) => sum + row.amountPaid, 0));
    expect(stats.totalOutstanding).toBe(stats.totalInvoiced - stats.totalPaid);
  });

  it("compte les factures en retard sur la date d'échéance", async () => {
    const today = todayIso();
    const stats = await invoices.stats(DEMO_ORG_ID, today);

    const expected = getMockDb().invoices.filter(
      (invoice) =>
        invoice.type === "invoice" && deriveDisplayStatus(invoice, today) === "overdue",
    );

    expect(stats.overdueCount).toBe(expected.length);
    expect(stats.overdueCount).toBeGreaterThan(0);
  });

  it("produit des totaux entiers", async () => {
    const stats = await invoices.stats(DEMO_ORG_ID);
    for (const value of Object.values(stats)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("filtres de liste", () => {
  it("filtre sur le statut dérivé « en retard »", async () => {
    const { rows } = await invoices.list(DEMO_ORG_ID, { status: "overdue", pageSize: 100 });
    expect(rows.length).toBeGreaterThan(0);
    for (const invoice of rows) {
      expect(deriveDisplayStatus(invoice)).toBe("overdue");
    }
  });

  it("filtre par type de document", async () => {
    const { rows } = await invoices.list(DEMO_ORG_ID, { type: "quote", pageSize: 100 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((invoice) => invoice.type === "quote")).toBe(true);
  });

  it("ne renvoie rien pour une organisation inconnue", async () => {
    const { rows, total } = await invoices.list(crypto.randomUUID());
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe("clients", () => {
  it("archive au lieu de supprimer", async () => {
    const target = getMockDb().clients[1]!;
    await clients.archive(DEMO_ORG_ID, target.id);

    const active = await clients.list(DEMO_ORG_ID, { pageSize: 100 });
    expect(active.rows.some((client) => client.id === target.id)).toBe(false);

    const all = await clients.list(DEMO_ORG_ID, { includeArchived: true, pageSize: 100 });
    expect(all.rows.some((client) => client.id === target.id)).toBe(true);
  });

  it("recherche par nom", async () => {
    const { rows } = await clients.list(DEMO_ORG_ID, { search: "telecoms" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Niger Telecoms");
  });
});
