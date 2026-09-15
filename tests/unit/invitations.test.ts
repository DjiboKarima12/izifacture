import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";

import {
  ALPHABET_CODE,
  codeValide,
  formaterCode,
  genererCode,
  LONGUEUR_CODE,
  normaliserCode,
} from "@/lib/invitations";

const aleatoire = (n: number) => webcrypto.getRandomValues(new Uint8Array(n));

describe("genererCode", () => {
  it("produit toujours la bonne longueur", () => {
    for (let i = 0; i < 200; i += 1) expect(genererCode(aleatoire)).toHaveLength(LONGUEUR_CODE);
  });

  it("n'utilise que l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 200; i += 1) {
      for (const caractere of genererCode(aleatoire)) {
        expect(ALPHABET_CODE).toContain(caractere);
      }
    }
  });

  it("n'emploie jamais les caractères qui se confondent à l'oral", () => {
    for (const interdit of ["O", "0", "I", "1", "L"]) {
      expect(ALPHABET_CODE).not.toContain(interdit);
    }
  });

  it("ne répète pas le même code d'un tirage à l'autre", () => {
    const tirages = new Set(Array.from({ length: 500 }, () => genererCode(aleatoire)));
    expect(tirages.size).toBe(500);
  });

  it("tolère un générateur qui renvoie des octets hors bornes", () => {
    // Que des 255 : au-delà de la limite, donc tous rejetés. Le générateur doit
    // redemander des octets plutôt que boucler indéfiniment ou produire un
    // caractère biaisé.
    let appels = 0;
    const toujours255 = (n: number) => {
      appels += 1;
      // Après quelques tours, on débloque : on vérifie le rejet, pas l'infini.
      return appels > 3 ? new Uint8Array(n).fill(0) : new Uint8Array(n).fill(255);
    };
    expect(genererCode(toujours255)).toBe("A".repeat(LONGUEUR_CODE));
  });
});

describe("normaliserCode", () => {
  it("accepte ce qu'on recopie d'un papier : minuscules, tirets, espaces", () => {
    expect(normaliserCode(" qk4m-8rtp ")).toBe("QK4M8RTP");
    expect(normaliserCode("QK4M 8RTP")).toBe("QK4M8RTP");
  });
});

describe("codeValide", () => {
  it("accepte un code bien formé, quelle que soit sa présentation", () => {
    expect(codeValide("QK4M8RTP")).toBe(true);
    expect(codeValide("qk4m-8rtp")).toBe(true);
  });

  it("refuse une longueur fausse", () => {
    expect(codeValide("QK4M")).toBe(false);
    expect(codeValide("QK4M8RTPX")).toBe(false);
  });

  it("refuse les caractères ambigus, qui ne peuvent pas venir d'un vrai code", () => {
    expect(codeValide("QK4M8RT0")).toBe(false);
    expect(codeValide("QK4M8RTI")).toBe(false);
  });
});

describe("formaterCode", () => {
  it("coupe en deux groupes de quatre pour la lecture à voix haute", () => {
    expect(formaterCode("QK4M8RTP")).toBe("QK4M-8RTP");
  });

  it("laisse tel quel ce qui n'a pas la bonne longueur", () => {
    expect(formaterCode("QK4M")).toBe("QK4M");
  });
});
