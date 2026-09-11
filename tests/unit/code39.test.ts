import { describe, expect, it } from "vitest";

import {
  CODE39_PATTERNS,
  code39Modules,
  code39Runs,
  code39Width,
  sanitizeCode39,
} from "@/lib/barcode/code39";

/**
 * Un code-barres faux ressemble en tout point à un code-barres juste : personne
 * ne s'en aperçoit avant qu'un scanner refuse de le lire, sur une facture déjà
 * partie chez le client. La table est donc vérifiée par ses invariants, qui
 * suffisent à détecter une entrée abîmée.
 */
describe("table Code 39", () => {
  const entries = Object.entries(CODE39_PATTERNS);

  it("couvre les 43 caractères de l'alphabet, plus le délimiteur", () => {
    expect(entries).toHaveLength(44);
  });

  it("décrit chaque caractère en neuf éléments", () => {
    for (const [character, pattern] of entries) {
      expect(pattern, character).toHaveLength(9);
      expect(pattern, character).toMatch(/^[nw]{9}$/);
    }
  });

  it("place exactement trois éléments larges par caractère", () => {
    for (const [character, pattern] of entries) {
      const wide = pattern.split("").filter((element) => element === "w").length;
      expect(wide, character).toBe(3);
    }
  });

  /**
   * Les caractères ordinaires portent deux barres larges et un espace large ;
   * seuls `$ / + %` inversent la règle avec trois espaces larges et aucune
   * barre large. Une entrée recopiée de travers tombe presque toujours ici.
   */
  it("respecte la répartition entre barres et espaces", () => {
    for (const [character, pattern] of entries) {
      const elements = pattern.split("");
      const wideBars = elements.filter((element, index) => index % 2 === 0 && element === "w").length;
      const wideSpaces = elements.filter(
        (element, index) => index % 2 === 1 && element === "w",
      ).length;

      if ("$/+%".includes(character)) {
        expect([wideBars, wideSpaces], character).toEqual([0, 3]);
      } else {
        expect([wideBars, wideSpaces], character).toEqual([2, 1]);
      }
    }
  });

  it("n'attribue jamais le même motif à deux caractères", () => {
    const patterns = entries.map(([, pattern]) => pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});

describe("code39Modules", () => {
  /**
   * Six éléments étroits (1 module) et trois larges (3 modules) : un caractère
   * occupe toujours 6 + 9 = 15 modules, quel qu'il soit.
   */
  const MODULES_PER_CHARACTER = 15;

  it("commence et finit par le motif du délimiteur", () => {
    const modules = code39Modules("A");

    // `*` = nwnnwnwnn : barre étroite, espace large, barre étroite, espace
    // étroit, barre large, espace étroit, barre large, espace étroit, barre.
    const delimiter = [
      true,
      false,
      false,
      false,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      false,
      true,
    ];

    expect(delimiter).toHaveLength(MODULES_PER_CHARACTER);
    expect(modules.slice(0, MODULES_PER_CHARACTER)).toEqual(delimiter);
    expect(modules.slice(-MODULES_PER_CHARACTER)).toEqual(delimiter);
  });

  it("sépare les caractères par un module clair", () => {
    // 3 caractères (* A *) et 2 séparateurs.
    expect(code39Width("A")).toBe(MODULES_PER_CHARACTER * 3 + 2);
  });

  it("encode un numéro de facture réel", () => {
    // 13 caractères, plus les deux délimiteurs, plus 14 séparateurs.
    expect(code39Width("FAC-2026-0003")).toBe(MODULES_PER_CHARACTER * 15 + 14);
  });

  it("commence et finit toujours par une barre sombre", () => {
    const modules = code39Modules("FAC-2026-0003");
    expect(modules[0]).toBe(true);
    expect(modules[modules.length - 1]).toBe(true);
  });
});

describe("sanitizeCode39", () => {
  it("passe un numéro de document sans le modifier", () => {
    expect(sanitizeCode39("FAC-2026-0003")).toBe("FAC-2026-0003");
  });

  it("met en capitales", () => {
    expect(sanitizeCode39("fac-1")).toBe("FAC-1");
  });

  it("remplace ce qui sort de l'alphabet plutôt que d'échouer", () => {
    expect(sanitizeCode39("FAC#2026")).toBe("FAC-2026");
    expect(sanitizeCode39("FAÇ")).toBe("FA-");
  });

  it("refuse le délimiteur dans les données", () => {
    expect(sanitizeCode39("A*B")).toBe("A-B");
  });
});

describe("code39Runs", () => {
  it("regroupe les modules identiques sans rien perdre", () => {
    const value = "FAC-2026-0003";
    const total = code39Runs(value).reduce((sum, run) => sum + run.width, 0);

    expect(total).toBe(code39Width(value));
  });

  it("alterne strictement sombre et clair", () => {
    const runs = code39Runs("FAC-2026-0003");

    for (let index = 1; index < runs.length; index += 1) {
      expect(runs[index]!.dark).not.toBe(runs[index - 1]!.dark);
    }
  });
});
