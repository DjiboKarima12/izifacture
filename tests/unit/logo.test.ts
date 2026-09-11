import { describe, expect, it } from "vitest";

import {
  LOGO_MAX_BYTES,
  isValidLogo,
  logoByteLength,
  logoBytes,
  parseLogoDataUri,
} from "@/lib/domain/logo";

/** Un PNG minuscule mais valide, pour les cas passants. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseLogoDataUri", () => {
  it("accepte les trois formats d'image retenus", () => {
    expect(parseLogoDataUri(PNG)?.mimeType).toBe("image/png");
    expect(parseLogoDataUri("data:image/jpeg;base64,AAAA")?.mimeType).toBe("image/jpeg");
    expect(parseLogoDataUri("data:image/webp;base64,AAAA")?.mimeType).toBe("image/webp");
  });

  it("ne renvoie rien pour une valeur absente", () => {
    expect(parseLogoDataUri(null)).toBeNull();
    expect(parseLogoDataUri(undefined)).toBeNull();
    expect(parseLogoDataUri("")).toBeNull();
    expect(parseLogoDataUri("   ")).toBeNull();
  });

  /**
   * Le point central de ce module. Le générateur de PDF tourne sur le serveur :
   * accepter une adresse fournie par l'utilisateur reviendrait à lui laisser
   * choisir la destination d'une requête émise par notre machine — une SSRF
   * déclenchée en téléchargeant une facture.
   */
  it("refuse toute adresse distante", () => {
    expect(parseLogoDataUri("https://exemple.ne/logo.png")).toBeNull();
    expect(parseLogoDataUri("http://localhost:54321/secret")).toBeNull();
    expect(parseLogoDataUri("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(parseLogoDataUri("//exemple.ne/logo.png")).toBeNull();
    expect(parseLogoDataUri("file:///etc/passwd")).toBeNull();
  });

  /** Un SVG peut porter du script : il n'entre pas dans la liste. */
  it("refuse le SVG et les types non prévus", () => {
    expect(parseLogoDataUri("data:image/svg+xml;base64,AAAA")).toBeNull();
    expect(parseLogoDataUri("data:image/gif;base64,AAAA")).toBeNull();
    expect(parseLogoDataUri("data:text/html;base64,AAAA")).toBeNull();
    expect(parseLogoDataUri("data:application/pdf;base64,AAAA")).toBeNull();
  });

  it("refuse une base64 malformée", () => {
    expect(parseLogoDataUri("data:image/png;base64,AAA")).toBeNull();
    expect(parseLogoDataUri("data:image/png;base64,")).toBeNull();
    expect(parseLogoDataUri("data:image/png;base64,!!!!")).toBeNull();
    expect(parseLogoDataUri("data:image/png,AAAA")).toBeNull();
  });

  it("refuse une image au-dessus du plafond", () => {
    const enorme = `data:image/png;base64,${"A".repeat(LOGO_MAX_BYTES)}`;

    expect(enorme.length).toBeGreaterThan(LOGO_MAX_BYTES);
    expect(parseLogoDataUri(enorme)).toBeNull();
    expect(isValidLogo(enorme)).toBe(false);
  });
});

describe("logoBytes", () => {
  it("rend une image décodable", () => {
    const bytes = logoBytes(PNG);

    expect(bytes).toBeInstanceOf(Uint8Array);
    // Signature PNG : 137 P N G.
    expect(Array.from(bytes!.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("ne rend rien pour une valeur refusée", () => {
    expect(logoBytes("https://exemple.ne/logo.png")).toBeNull();
    expect(logoBytes(null)).toBeNull();
  });
});

describe("logoByteLength", () => {
  it("mesure l'image décodée, pas la chaîne", () => {
    const length = logoByteLength(PNG);

    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(PNG.length);
    expect(length).toBe(logoBytes(PNG)!.byteLength);
  });

  it("vaut zéro sans logo", () => {
    expect(logoByteLength(null)).toBe(0);
  });
});
