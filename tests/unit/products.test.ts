import { beforeEach, describe, expect, it } from "vitest";

import { mockRepositories } from "@/lib/data/mock";
import { DEMO_ORG_ID, resetMockDb } from "@/lib/data/mock/seed";
import { productInputSchema } from "@/lib/domain/schemas";

const { products } = mockRepositories;

const saisie = (patch: Record<string, unknown> = {}) => ({
  name: "Attiéké poisson",
  unitPrice: 1500,
  taxRate: 19,
  barcode: null,
  unit: "plat",
  notes: null,
  ...patch,
});

beforeEach(() => {
  resetMockDb();
});

describe("catalogue", () => {
  it("enregistre un produit avec son prix", async () => {
    const cree = await products.create(DEMO_ORG_ID, saisie() as never);
    expect(cree.name).toBe("Attiéké poisson");
    expect(cree.unitPrice).toBe(1500);
    expect(cree.archivedAt).toBeNull();
  });

  it("retrouve un produit par son code-barres", async () => {
    await products.create(DEMO_ORG_ID, saisie({ barcode: "6001234567890" }) as never);
    const trouve = await products.findByBarcode(DEMO_ORG_ID, "6001234567890");
    expect(trouve?.name).toBe("Attiéké poisson");
  });

  it("tolère les blancs que les lecteurs ajoutent autour du code", async () => {
    await products.create(DEMO_ORG_ID, saisie({ barcode: "6001234567890" }) as never);
    expect(await products.findByBarcode(DEMO_ORG_ID, "  6001234567890  ")).not.toBeNull();
  });

  it("ne ressuscite PAS un produit archivé au scan", async () => {
    const cree = await products.create(DEMO_ORG_ID, saisie({ barcode: "6009999999999" }) as never);
    await products.archive(DEMO_ORG_ID, cree.id);

    expect(await products.findByBarcode(DEMO_ORG_ID, "6009999999999")).toBeNull();
  });

  it("un code inconnu ne renvoie rien plutôt que le premier venu", async () => {
    await products.create(DEMO_ORG_ID, saisie({ barcode: "6001234567890" }) as never);
    expect(await products.findByBarcode(DEMO_ORG_ID, "0000000000000")).toBeNull();
  });

  it("un code vide ne renvoie rien", async () => {
    expect(await products.findByBarcode(DEMO_ORG_ID, "   ")).toBeNull();
  });

  it("cache les archivés de la liste, sauf demande explicite", async () => {
    const cree = await products.create(DEMO_ORG_ID, saisie() as never);
    await products.archive(DEMO_ORG_ID, cree.id);

    const actifs = await products.list(DEMO_ORG_ID);
    const tous = await products.list(DEMO_ORG_ID, { includeArchived: true });

    expect(actifs.rows.some((p) => p.id === cree.id)).toBe(false);
    expect(tous.rows.some((p) => p.id === cree.id)).toBe(true);
  });

  it("cherche sur le nom ET sur le code-barres", async () => {
    await products.create(DEMO_ORG_ID, saisie({ barcode: "6001234567890" }) as never);

    expect((await products.list(DEMO_ORG_ID, { search: "attiéké" })).rows).toHaveLength(1);
    expect((await products.list(DEMO_ORG_ID, { search: "600123" })).rows).toHaveLength(1);
  });
});

describe("productInputSchema", () => {
  it("refuse un prix à virgule : les montants sont des entiers", () => {
    expect(productInputSchema.safeParse(saisie({ unitPrice: 1500.5 })).success).toBe(false);
  });

  it("refuse un prix négatif", () => {
    expect(productInputSchema.safeParse(saisie({ unitPrice: -1 })).success).toBe(false);
  });

  it("accepte un prix nul — un article offert reste un article", () => {
    expect(productInputSchema.safeParse(saisie({ unitPrice: 0 })).success).toBe(true);
  });

  it("traduit un code-barres vide en null plutôt que de le refuser", () => {
    const parsed = productInputSchema.safeParse(saisie({ barcode: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.barcode).toBeNull();
  });

  it("refuse un code-barres contenant un espace", () => {
    expect(productInputSchema.safeParse(saisie({ barcode: "600 123" })).success).toBe(false);
  });
});
