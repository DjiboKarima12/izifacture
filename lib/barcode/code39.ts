/**
 * Code 39 — le code-barres du bas de ticket.
 *
 * POURQUOI CODE 39 et pas Code 128, plus compact : son alphabet couvre
 * exactement ce qu'on encode, un numéro de document (`FAC-2026-0003`), et sa
 * table tient en quarante-quatre motifs vérifiables un par un. Le Code 128
 * demande cent sept motifs et une somme de contrôle : une seule erreur de
 * recopie donnerait un code-barres d'apparence normale mais illisible au
 * scanner — pire que pas de code-barres du tout.
 *
 * Chaque caractère s'écrit en neuf éléments alternés, barre puis espace, dont
 * exactement trois larges. Les caractères se séparent par un espace étroit, et
 * la séquence est délimitée par `*` à chaque bout.
 *
 * Ces invariants sont vérifiés par les tests : ils suffisent à détecter une
 * table abîmée, puisqu'une entrée fausse casserait presque à coup sûr le compte
 * de trois larges, la répartition barres/espaces, ou l'unicité des motifs.
 */

/** Largeur d'un élément large, en modules étroits. */
export const WIDE_RATIO = 3;

/**
 * `n` = élément étroit, `w` = élément large. Position paire = barre sombre,
 * position impaire = espace clair.
 */
const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

/** Table exposée pour que les tests puissent en vérifier les invariants. */
export const CODE39_PATTERNS: Readonly<Record<string, string>> = PATTERNS;

/** Le délimiteur `*` encadre la séquence ; il n'est jamais dans les données. */
const DELIMITER = "*";

/**
 * Ramène la valeur à l'alphabet du Code 39.
 *
 * Un numéro de document n'en sort jamais, mais on ne veut pas qu'un caractère
 * inattendu fasse échouer la génération du PDF entier : il est remplacé par un
 * tiret, qui reste encodable.
 */
export function sanitizeCode39(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .map((character) =>
      character !== DELIMITER && PATTERNS[character] !== undefined ? character : "-",
    )
    .join("");
}

/**
 * Suite de modules étroits : `true` = sombre, `false` = clair.
 *
 * C'est la représentation la plus bête possible, et c'est voulu : le PDF comme
 * le HTML n'ont plus qu'à dessiner des rectangles, chacun à son échelle.
 */
export function code39Modules(value: string): boolean[] {
  const encoded = `${DELIMITER}${sanitizeCode39(value)}${DELIMITER}`;
  const modules: boolean[] = [];

  encoded.split("").forEach((character, index) => {
    // Espace étroit de séparation entre deux caractères.
    if (index > 0) modules.push(false);

    const pattern = PATTERNS[character] ?? PATTERNS["-"]!;
    pattern.split("").forEach((element, position) => {
      const dark = position % 2 === 0;
      const width = element === "w" ? WIDE_RATIO : 1;
      for (let step = 0; step < width; step += 1) modules.push(dark);
    });
  });

  return modules;
}

export type BarcodeRun = { dark: boolean; width: number };

/**
 * Regroupe les modules identiques consécutifs.
 *
 * Deux cents rectangles d'un module deviennent une soixantaine de barres : le
 * PDF est plus léger et le DOM de l'aperçu reste raisonnable.
 */
export function code39Runs(value: string): BarcodeRun[] {
  const runs: BarcodeRun[] = [];

  for (const dark of code39Modules(value)) {
    const last = runs[runs.length - 1];
    if (last && last.dark === dark) last.width += 1;
    else runs.push({ dark, width: 1 });
  }

  return runs;
}

/** Nombre total de modules étroits — sert à calculer l'échelle de dessin. */
export function code39Width(value: string): number {
  return code39Modules(value).length;
}
