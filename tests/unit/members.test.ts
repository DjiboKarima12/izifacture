import { describe, expect, it } from "vitest";

import {
  adresseDeConnexion,
  completerIdentifiant,
  identifiantDepuisAdresse,
  identifiantValide,
  LONGUEUR_MIN_MOT_DE_PASSE,
} from "@/lib/members";

describe("identifiantValide", () => {
  it("accepte ce qu'un responsable tapera vraiment", () => {
    for (const bon of ["awa", "awa.diallo", "caisse-2", "ibrahim99"]) {
      expect(identifiantValide(bon), bon).toBe(true);
    }
  });

  it("refuse ce qui casserait une adresse", () => {
    for (const mauvais of ["aw", "awa diallo", "awa@boutique", "Awa!", ".awa", "awa-"]) {
      expect(identifiantValide(mauvais), mauvais).toBe(false);
    }
  });

  it("tolère les majuscules et les espaces autour : on normalise", () => {
    expect(identifiantValide("  AWA  ")).toBe(true);
  });
});

describe("adresseDeConnexion", () => {
  it("compose une adresse courte, dictable au téléphone", () => {
    expect(adresseDeConnexion("awa")).toBe("awa@caisse.mamafacture.app");
  });

  it("normalise la casse : « Awa » et « awa » sont le même compte", () => {
    expect(adresseDeConnexion("Awa")).toBe(adresseDeConnexion("awa"));
  });
});

describe("completerIdentifiant", () => {
  it("complète ce que le caissier tape vraiment : son seul identifiant", () => {
    expect(completerIdentifiant("majida")).toBe("majida@caisse.mamafacture.app");
    expect(completerIdentifiant("  MAJIDA  ")).toBe("majida@caisse.mamafacture.app");
  });

  it("laisse intacte une vraie adresse : le responsable garde la sienne", () => {
    expect(completerIdentifiant("karimadjibo65@gmail.com")).toBe("karimadjibo65@gmail.com");
    expect(completerIdentifiant("Karima@Gmail.com")).toBe("karima@gmail.com");
  });

  it("ne fabrique rien à partir d'une saisie qui n'est pas un identifiant valable", () => {
    // Sans ça, « aw » deviendrait « aw@caisse… » et l'erreur parlerait d'un
    // compte inexistant plutôt que d'une saisie trop courte.
    expect(completerIdentifiant("aw")).toBe("aw");
  });
});

describe("identifiantDepuisAdresse", () => {
  it("retrouve ce que le responsable a tapé", () => {
    expect(identifiantDepuisAdresse("awa@99df371f.mamafacture.app")).toBe("awa");
  });
});

describe("mot de passe", () => {
  it("huit caractères au minimum, comme Supabase l'exige", () => {
    expect(LONGUEUR_MIN_MOT_DE_PASSE).toBeGreaterThanOrEqual(8);
  });
});
