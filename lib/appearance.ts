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

/**
 * Couleur d'action, indépendante du fond.
 *
 * Séparée de la palette pour multiplier les combinaisons sans multiplier les
 * jeux de couleurs à maintenir : cinq fonds × huit accents font quarante
 * apparences, avec treize blocs de CSS au lieu de quarante.
 *
 * PAS DE ROUGE. Il est pris par `destructive` et par le statut « en retard » :
 * un bouton d'action rouge ferait hésiter avant chaque clic, et c'est exactement
 * ce qu'une couleur d'alerte doit provoquer — ailleurs.
 */
export const ACCENTS = [
  "vert",
  "teal",
  "bleu",
  "indigo",
  "violet",
  "rose",
  "ambre",
  "ardoise",
] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_LABELS: Record<Accent, string> = {
  vert: "Vert",
  teal: "Turquoise",
  bleu: "Bleu",
  indigo: "Indigo",
  violet: "Violet",
  rose: "Rose",
  ambre: "Ambre",
  ardoise: "Ardoise",
};

/**
 * Police de l'interface.
 *
 * Quatre familles, chacune pour une raison :
 *  - Inter : neutre, la référence d'origine ;
 *  - Outfit : plus ronde, plus chaleureuse ;
 *  - Source Serif : empattements, pour qui trouve les sans-serif froides ;
 *  - Atkinson Hyperlegible : dessinée pour la basse vision — lettres rendues
 *    dissemblables exprès, ce qui la rend précieuse sur un écran au soleil.
 *
 * La police du REÇU ne change pas : il reste en chasse fixe, parce que c'est
 * ce qui aligne les montants et ce que l'œil reconnaît comme un ticket.
 */
export const FONTS = ["inter", "outfit", "serif", "lisible"] as const;
export type Font = (typeof FONTS)[number];

export const FONT_LABELS: Record<Font, string> = {
  inter: "Neutre",
  outfit: "Ronde",
  serif: "Classique",
  lisible: "Lisibilité renforcée",
};

export const FONT_DESCRIPTIONS: Record<Font, string> = {
  inter: "La police d'origine. Sobre et dense.",
  outfit: "Plus ronde, plus chaleureuse.",
  serif: "Avec empattements, comme un document imprimé.",
  lisible: "Conçue pour la basse vision et la lecture en plein soleil.",
};

export type Appearance = {
  theme: Theme;
  accent: Accent;
  font: Font;
  textScale: TextScale;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "sable",
  accent: "vert",
  font: "inter",
  textScale: 100,
};

/** Clé de stockage local. Nommée d'après le produit, pas d'après la marque. */
export const APPEARANCE_KEY = "mamafacture-appearance";

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isScale(value: unknown): value is TextScale {
  return typeof value === "number" && (TEXT_SCALES as readonly number[]).includes(value);
}

function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

function isFont(value: unknown): value is Font {
  return typeof value === "string" && (FONTS as readonly string[]).includes(value);
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

    const { theme, accent, font, textScale } = parsed as Record<string, unknown>;
    return {
      theme: isTheme(theme) ? theme : DEFAULT_APPEARANCE.theme,
      accent: isAccent(accent) ? accent : DEFAULT_APPEARANCE.accent,
      font: isFont(font) ? font : DEFAULT_APPEARANCE.font,
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
