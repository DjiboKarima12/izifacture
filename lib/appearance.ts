/**
 * Préférences d'affichage : palette et taille de texte.
 *
 * DES PALETTES CHOISIES, PAS UN SÉLECTEUR DE COULEUR. Un nuancier libre
 * produirait des combinaisons illisibles — texte gris clair sur fond gris, vert
 * de marque indistinguable du vert « payée ». Chaque palette ici est un jeu
 * complet dont les contrastes ont été mesurés (`npm run check:contrast`), en
 * clair comme en sombre.
 *
 * C'est aussi ce qui permet de tenir la règle 1 du design system : aucune
 * couleur ne vit hors de `app/globals.css`. L'application ne fait que poser un
 * attribut sur `<html>`, la feuille de style fait le reste.
 *
 * Le réglage est PAR APPAREIL, pas par compte : c'est une préférence de confort
 * de lecture, qui dépend de l'écran qu'on a sous les yeux. Le même utilisateur
 * veut souvent du plus gros sur son téléphone au soleil que sur son ordinateur.
 */

export const THEMES = ["sable", "ardoise", "papier", "indigo", "comptoir"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  sable: "Sable",
  ardoise: "Ardoise",
  papier: "Papier",
  indigo: "Indigo",
  comptoir: "Comptoir",
};

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  sable: "Crème et brun chaud. Le réglage d'origine.",
  ardoise: "Gris froid et chrome graphite. Sobre.",
  papier: "Blanc cassé et anthracite. Très contrasté.",
  indigo: "Bleu nuit et or. Proche d'une application bancaire.",
  comptoir: "Vert profond. La couleur d'une enseigne alimentaire.",
};

/**
 * Échelle de texte, en pourcentage de la taille racine.
 *
 * Tailwind dimensionne tout en `rem`, donc changer la racine agrandit AUSSI les
 * espacements et les hauteurs de champ. C'est voulu : un texte plus grand dans
 * des boîtes inchangées déborderait.
 *
 * 90 % au minimum, et non 75 : en dessous, les mentions légales du reçu
 * deviennent illisibles sur un téléphone, et personne ne les agrandit pour les
 * lire.
 */
export const TEXT_SCALES = [90, 100, 112, 125] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const SCALE_LABELS: Record<TextScale, string> = {
  90: "Compact",
  100: "Normal",
  112: "Grand",
  125: "Très grand",
};

export type Appearance = {
  theme: Theme;
  textScale: TextScale;
};

export const DEFAULT_APPEARANCE: Appearance = { theme: "sable", textScale: 100 };

/** Clé de stockage local. Nommée d'après le produit, pas d'après la marque. */
export const APPEARANCE_KEY = "mamafacture-appearance";

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isScale(value: unknown): value is TextScale {
  return typeof value === "number" && (TEXT_SCALES as readonly number[]).includes(value);
}

/**
 * Relit une préférence enregistrée, en se rabattant sur les valeurs par défaut.
 *
 * Tolérante par construction : le contenu vient du stockage local, donc d'une
 * version antérieure de l'application ou d'une main qui l'a modifié. Une valeur
 * inconnue ne doit pas laisser l'interface sans couleurs — elle est ignorée.
 */
export function parseAppearance(raw: string | null | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_APPEARANCE;

    const { theme, textScale } = parsed as Record<string, unknown>;
    return {
      theme: isTheme(theme) ? theme : DEFAULT_APPEARANCE.theme,
      textScale: isScale(textScale) ? textScale : DEFAULT_APPEARANCE.textScale,
    };
  } catch {
    // JSON illisible : on repart du défaut plutôt que de laisser l'écran nu.
    return DEFAULT_APPEARANCE;
  }
}

export function serializeAppearance(appearance: Appearance): string {
  return JSON.stringify(appearance);
}
