import { describe, expect, it } from "vitest";

import {
  adresseDeConnexion,
  identifiantDepuisAdresse,
  identifiantValide,
  LONGUEUR_MIN_MOT_DE_PASSE,
} from "@/lib/members";

const ORG = "99df371f-1921-467d-ba8b-6471e7bd28d1";
const AUTRE_ORG = "d5d94848-9773-4b14-87a5-d2de9e554e81";

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
  it("compose une adresse propre à la boutique", () => {
    expect(adresseDeConnexion("awa", ORG)).toBe("awa@99df371f.mamafacture.app");
  });

  it("DEUX BOUTIQUES peuvent chacune avoir leur Awa", () => {
    expect(adresseDeConnexion("awa", ORG)).not.toBe(adresseDeConnexion("awa", AUTRE_ORG));
  });

  it("normalise la casse : « Awa » et « awa » sont le même compte", () => {
    expect(adresseDeConnexion("Awa", ORG)).toBe(adresseDeConnexion("awa", ORG));
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
