import { describe, expect, it } from "vitest";

import { addScannedProduct, type ScannableLine } from "@/lib/catalogue";

let compteur = 0;
const nextId = () => `line-${(compteur += 1)}`;

const vierge: ScannableLine = {
  id: "line-0",
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRate: "19",
};

const attieke = { id: "p1", name: "Attiéké poisson", unitPrice: 1500, taxRate: 19 };
const riz = { id: "p2", name: "Riz 5 kg", unitPrice: 9000, taxRate: 19 };

describe("scan d'un article", () => {
  it("remplit la ligne vierge d'ouverture au lieu d'en ajouter une", () => {
    const lignes = addScannedProduct([vierge], attieke, nextId);

    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.description).toBe("Attiéké poisson");
    expect(lignes[0]!.unitPrice).toBe("1500");
    // Même identifiant : React réutilise la rangée, le focus ne saute pas.
    expect(lignes[0]!.id).toBe("line-0");
  });

  it("deux articles DIFFÉRENTS font deux lignes", () => {
    const lignes = addScannedProduct(addScannedProduct([vierge], attieke, nextId), riz, nextId);

    expect(lignes).toHaveLength(2);
    expect(lignes.map((l) => l.description)).toEqual(["Attiéké poisson", "Riz 5 kg"]);
  });

  it("le MÊME article scanné trois fois donne 3 × une ligne, pas trois lignes", () => {
    let lignes = addScannedProduct([vierge], attieke, nextId);
    lignes = addScannedProduct(lignes, attieke, nextId);
    lignes = addScannedProduct(lignes, attieke, nextId);

    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.quantity).toBe("3");
  });

  it("n'écrase pas une ligne déjà saisie à la main", () => {
    const manuelle: ScannableLine = { ...vierge, description: "Sauce", unitPrice: "500" };
    const lignes = addScannedProduct([manuelle], attieke, nextId);

    expect(lignes).toHaveLength(2);
    expect(lignes[0]!.description).toBe("Sauce");
  });

  it("recopie le taux du produit, qui peut différer de celui de la ligne", () => {
    const lignes = addScannedProduct([vierge], { ...riz, taxRate: 0 }, nextId);
    expect(lignes[0]!.taxRate).toBe("0");
  });

  it("repart de 1 quand la quantité saisie est illisible", () => {
    const cassee: ScannableLine = {
      ...vierge,
      description: "Attiéké poisson",
      unitPrice: "1500",
      quantity: "abc",
      productId: "p1",
    };

    expect(addScannedProduct([cassee], attieke, nextId)[0]!.quantity).toBe("1");
  });

  it("compte la virgule décimale comme un nombre", () => {
    const demi: ScannableLine = { ...vierge, description: "Riz", unitPrice: "9000", quantity: "1,5", productId: "p2" };
    expect(addScannedProduct([demi], riz, nextId)[0]!.quantity).toBe("2.5");
  });
});
