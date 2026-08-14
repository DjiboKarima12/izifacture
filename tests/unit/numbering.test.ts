import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFIXES,
  formatDocumentNumber,
  normalisePrefix,
  parseDocumentNumber,
  prefixFor,
  previewNextNumber,
} from "@/lib/numbering";
import type { Organization } from "@/lib/domain/types";

const organization = {
  invoicePrefix: "FAC",
  quotePrefix: "DEV",
  creditNotePrefix: "AV",
} as Organization;

describe("normalisePrefix", () => {
  it("met en majuscules et retire les caractères interdits", () => {
    expect(normalisePrefix("fac")).toBe("FAC");
    expect(normalisePrefix("Fa c/2026")).toBe("FAC2026");
    expect(normalisePrefix("FAC-")).toBe("FAC-");
  });

  it("tronque à 8 caractères", () => {
    expect(normalisePrefix("ABCDEFGHIJ")).toBe("ABCDEFGH");
  });

  it("renvoie une chaîne vide pour une entrée absente", () => {
    expect(normalisePrefix(null)).toBe("");
    expect(normalisePrefix(undefined)).toBe("");
    expect(normalisePrefix("///")).toBe("");
  });
});

describe("prefixFor", () => {
  it("utilise le préfixe configuré par l'organisation", () => {
    expect(prefixFor(organization, "invoice")).toBe("FAC");
    expect(prefixFor(organization, "quote")).toBe("DEV");
    expect(prefixFor(organization, "credit_note")).toBe("AV");
  });

  it("retombe sur le préfixe par défaut si la configuration est vide", () => {
    const withoutPrefixes = { invoicePrefix: "", quotePrefix: "", creditNotePrefix: "" } as Organization;
    expect(prefixFor(withoutPrefixes, "invoice")).toBe(DEFAULT_PREFIXES.invoice);
    expect(prefixFor(withoutPrefixes, "quote")).toBe(DEFAULT_PREFIXES.quote);
  });
});

describe("formatDocumentNumber", () => {
  it("formate avec une séquence sur 4 chiffres", () => {
    expect(formatDocumentNumber("FAC", 2026, 1)).toBe("FAC-2026-0001");
    expect(formatDocumentNumber("FAC", 2026, 42)).toBe("FAC-2026-0042");
    expect(formatDocumentNumber("DEV", 2026, 1234)).toBe("DEV-2026-1234");
  });

  it("ne tronque pas au-delà de 9999", () => {
    expect(formatDocumentNumber("FAC", 2026, 12_345)).toBe("FAC-2026-12345");
  });

  it("rejette les entrées invalides", () => {
    expect(() => formatDocumentNumber("FAC", 2026, 0)).toThrow(/séquence/);
    expect(() => formatDocumentNumber("FAC", 2026, -1)).toThrow(/séquence/);
    expect(() => formatDocumentNumber("FAC", 12_345, 1)).toThrow(/année/);
  });
});

describe("parseDocumentNumber", () => {
  it("relit un numéro formaté", () => {
    expect(parseDocumentNumber("FAC-2026-0001")).toEqual({
      prefix: "FAC",
      year: 2026,
      sequence: 1,
    });
  });

  it("fait l'aller-retour avec formatDocumentNumber", () => {
    const formatted = formatDocumentNumber("DEV", 2026, 137);
    expect(parseDocumentNumber(formatted)).toEqual({ prefix: "DEV", year: 2026, sequence: 137 });
  });

  it("renvoie null sur un numéro non conforme", () => {
    expect(parseDocumentNumber("FAC2026")).toBeNull();
    expect(parseDocumentNumber("FAC-26-0001")).toBeNull();
    expect(parseDocumentNumber("")).toBeNull();
  });
});

describe("previewNextNumber", () => {
  it("affiche le numéro suivant à titre indicatif", () => {
    expect(previewNextNumber(organization, "invoice", 41, 2026)).toBe("FAC-2026-0042");
    expect(previewNextNumber(organization, "quote", 0, 2026)).toBe("DEV-2026-0001");
  });
});
