import { describe, expect, it } from "vitest";

import {
  ACCENTS,
  ACCENT_LABELS,
  DEFAULT_APPEARANCE,
  FONTS,
  FONT_LABELS,
  parseAppearance,
  serializeAppearance,
  TEXT_SCALES,
  THEMES,
  THEME_LABELS,
  SCALE_LABELS,
} from "@/lib/appearance";

describe("parseAppearance", () => {
  it("rien d'enregistré : les valeurs par défaut", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("")).toEqual(DEFAULT_APPEARANCE);
  });

  it("relit ce qui a été écrit", () => {
    const voulu = {
      theme: "indigo" as const,
      accent: "ambre" as const,
      font: "serif" as const,
      textScale: 125 as const,
    };
    expect(parseAppearance(serializeAppearance(voulu))).toEqual(voulu);
  });

  it("une préférence partielle complète le reste par les défauts", () => {
    const lu = parseAppearance('{"accent":"violet"}');
    expect(lu.accent).toBe("violet");
    expect(lu.theme).toBe(DEFAULT_APPEARANCE.theme);
    expect(lu.font).toBe(DEFAULT_APPEARANCE.font);
  });

  it("un accent ou une police inconnus sont ignorés isolément", () => {
    const lu = parseAppearance('{"accent":"fuchsia","font":"comic","theme":"papier"}');
    expect(lu.accent).toBe(DEFAULT_APPEARANCE.accent);
    expect(lu.font).toBe(DEFAULT_APPEARANCE.font);
    expect(lu.theme).toBe("papier");
  });

  it("un JSON illisible ne laisse pas l'écran sans couleurs", () => {
    expect(parseAppearance("{pas du json")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("[]")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("null")).toEqual(DEFAULT_APPEARANCE);
  });

  it("un thème inconnu — version antérieure ou valeur bidouillée — est ignoré", () => {
    const lu = parseAppearance('{"theme":"fuchsia","textScale":112}');
    expect(lu.theme).toBe(DEFAULT_APPEARANCE.theme);
    // Le reste de la préférence est conservé : une valeur fausse n'en invalide
    // pas une autre.
    expect(lu.textScale).toBe(112);
  });

  it("une taille hors échelle est ignorée, thème conservé", () => {
    const lu = parseAppearance('{"theme":"papier","textScale":400}');
    expect(lu.theme).toBe("papier");
    expect(lu.textScale).toBe(DEFAULT_APPEARANCE.textScale);
  });

  it("refuse une taille passée en chaîne plutôt que de la convertir en silence", () => {
    expect(parseAppearance('{"textScale":"125"}').textScale).toBe(DEFAULT_APPEARANCE.textScale);
  });
});

describe("catalogue des réglages", () => {
  it("chaque thème a un libellé", () => {
    for (const theme of THEMES) expect(THEME_LABELS[theme]).toBeTruthy();
  });

  it("chaque taille a un libellé", () => {
    for (const scale of TEXT_SCALES) expect(SCALE_LABELS[scale]).toBeTruthy();
  });

  it("chaque accent et chaque police ont un libellé", () => {
    for (const accent of ACCENTS) expect(ACCENT_LABELS[accent]).toBeTruthy();
    for (const font of FONTS) expect(FONT_LABELS[font]).toBeTruthy();
  });

  it("le défaut fait partie des choix proposés", () => {
    expect(THEMES).toContain(DEFAULT_APPEARANCE.theme);
    expect(ACCENTS).toContain(DEFAULT_APPEARANCE.accent);
    expect(FONTS).toContain(DEFAULT_APPEARANCE.font);
    expect(TEXT_SCALES).toContain(DEFAULT_APPEARANCE.textScale);
  });

  it("aucun accent rouge : la couleur est prise par « en retard »", () => {
    expect(ACCENTS).not.toContain("rouge");
  });

  it("aucune taille sous 90 % : le reçu deviendrait illisible au téléphone", () => {
    expect(Math.min(...TEXT_SCALES)).toBeGreaterThanOrEqual(90);
  });
});
