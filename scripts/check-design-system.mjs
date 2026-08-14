#!/usr/bin/env node
/**
 * Vérificateur du design system — la « règle anti-gravité ».
 *
 * Une convention écrite dans un document finit toujours par dériver. Ce script
 * la rend CONTRAIGNANTE : il échoue (code de sortie 1) dès qu'un composant
 * contourne les tokens. Il tourne dans `npm test`, et à chaque édition de
 * fichier via le hook Claude Code (.claude/settings.json).
 *
 * Spécification complète : docs/design-system.md
 *
 * Usage :
 *   node scripts/check-design-system.mjs              # tout app/ et components/
 *   node scripts/check-design-system.mjs <fichier...>  # fichiers ciblés
 *
 * Ajouter une règle : compléter LINE_RULES ou CLASS_RULES, puis vérifier que le
 * dépôt reste vert — une règle qui produit des faux positifs sera désactivée par
 * le premier développeur qu'elle gêne, donc elle ne protège plus rien.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const SCAN_EXTENSIONS = [".ts", ".tsx"];

/** Palette Tailwind par défaut — interdite : elle court-circuite les tokens. */
const TAILWIND_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const COLOR_PREFIXES =
  "bg|text|border|ring|fill|stroke|divide|from|via|to|placeholder|caret|outline|decoration|accent|shadow";

/**
 * Tokens de couleur réellement déclarés, lus dans `:root` de globals.css.
 *
 * Source de vérité auto-entretenue : chaque couleur de tailwind.config.ts
 * correspond à une variable de même nom (`surface-strong` → `--surface-strong`).
 * Une classe qui vise un token supprimé ne génère AUCUNE règle CSS et échoue en
 * silence — c'est exactement comme ça que `bg-sidebar` a rendu le tiroir mobile
 * transparent après le nettoyage des tokens morts.
 */
const NON_COLOR_TOKENS = /^(radius|shadow-|font-)/;
const BUILTIN_COLORS = new Set(["transparent", "current", "inherit", "white", "black"]);

function declaredColorTokens() {
  const tokens = new Set(BUILTIN_COLORS);
  try {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    for (const match of css.matchAll(/--([a-z0-9-]+)\s*:/g)) {
      const name = match[1];
      if (!NON_COLOR_TOKENS.test(name)) tokens.add(name);
    }
  } catch {
    // Sans globals.css la règle ne peut rien affirmer : elle se désactive
    // plutôt que de signaler tout le fichier comme fautif.
    return null;
  }
  return tokens;
}

const COLOR_TOKENS = declaredColorTokens();

/** Valeurs non colorées admises après chaque préfixe. */
const NON_COLOR_SUFFIXES = {
  text: /^(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|opacity-.+)$/,
  bg: /^(none|cover|contain|auto|fixed|local|scroll|repeat.*|no-repeat|center|top|bottom|left|right|clip-.+|origin-.+|blend-.+|gradient-.+|opacity-.+)$/,
  border: /^([xytblrse]|[0-8]|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing.*|[xytblrse]-[0-8])$/,
  ring: /^([0-8]|inset|offset-.+|opacity-.+)$/,
  divide: /^([xy](-reverse)?|[0-8]|solid|dashed|dotted|double|none)$/,
  fill: /^(none|[0-9]+)$/,
  stroke: /^(none|[0-9]+)$/,
  outline: /^(none|dashed|dotted|double|[0-8]|offset-.+)$/,
  decoration: /^(solid|double|dotted|dashed|wavy|auto|from-font|[0-8]|slice|clone)$/,
  from: /^\d+%$/,
  via: /^\d+%$/,
  to: /^\d+%$/,
};

/* ------------------------------------------------------------------ Règles */

/** Règles appliquées à la ligne brute. */
const LINE_RULES = [
  {
    id: "no-color-literal",
    test: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\(|\bhsla?\(|\boklch\(/,
    message: "Couleur codée en dur.",
    fix: "Les couleurs vivent dans app/globals.css. Utilisez un token (bg-primary, text-muted-foreground…).",
  },
  {
    id: "no-inline-style-color",
    test: /style=\{\{[^}]*(?:background|[a-zA-Z]*[Cc]olor|\bfill)\s*:/,
    message: "Couleur posée en style inline.",
    fix: "Passez par une classe Tailwind adossée à un token. Le style inline est réservé au positionnement calculé.",
  },
  {
    id: "no-tofixed",
    test: /\.toFixed\s*\(/,
    message: "`toFixed()` sur une valeur potentiellement monétaire.",
    fix: "Les montants sont des entiers : formatez-les avec formatAmount() de lib/money.ts.",
  },
  {
    id: "no-hardcoded-currency",
    test: /(?<!\/\/.*)\bF\s?CFA\b/,
    message: "Sigle monétaire codé en dur.",
    fix: "Le sigle est rendu par formatAmount() (lib/money.ts), seul endroit qui le connaît.",
  },
  {
    id: "no-raw-anchor",
    test: /<a\s[^>]*href=["']\//,
    message: "Lien interne en <a>.",
    fix: "Utilisez <Link> de next/link : navigation client et préchargement.",
  },
  {
    id: "img-needs-alt",
    test: /<img(?![^>]*\balt=)[^>]*>/,
    message: "<img> sans attribut alt.",
    fix: 'Ajoutez alt="" si l\'image est décorative, sinon une description.',
  },
];

/**
 * Règles appliquées aux jetons de classe trouvés dans les chaînes de caractères.
 * On ne teste QUE le contenu des chaînes : une variable nommée `rounded` dans du
 * code JavaScript ne doit pas déclencher la règle sur `rounded-*`.
 */
const CLASS_RULES = [
  {
    id: "no-tailwind-palette",
    test: (token) =>
      new RegExp(`(?:^|:)(?:${COLOR_PREFIXES})-(?:${TAILWIND_PALETTE})-(?:50|\\d{3})$`).test(token),
    message: "Couleur de la palette Tailwind par défaut.",
    fix: "Utilisez un token sémantique : bg-surface, text-muted-foreground, border-border, text-destructive…",
  },
  {
    id: "no-dark-variant",
    test: (token) => /(?:^|:)dark:/.test(token),
    message: "Variante `dark:` dans un composant.",
    fix: "Le mode sombre se fait UNIQUEMENT en redéfinissant les tokens dans .dark (app/globals.css). Un composant s'écrit une seule fois.",
  },
  {
    id: "no-arbitrary-color",
    test: (token) =>
      new RegExp(`(?:^|:)(?:${COLOR_PREFIXES})-\\[(?:#|rgb|hsl|oklch|color-mix)`).test(token),
    message: "Couleur arbitraire entre crochets.",
    fix: "Ajoutez un token dans app/globals.css plutôt qu'une valeur à usage unique.",
  },
  {
    id: "shadow-scale",
    test: (token) => /(?:^|:)shadow(?:-(?:sm|md|lg|xl|2xl|inner))?$/.test(token),
    message: "Ombre hors de l'échelle du système.",
    fix: "Deux ombres seulement : shadow-card (cartes au repos) et shadow-raised (éléments flottants).",
  },
  {
    id: "unknown-color-token",
    test: (token) => {
      if (!COLOR_TOKENS || token.includes("[")) return false;

      const utility = token.replace(/^.*:/, "");
      const match = /^(text|bg|border|ring|fill|stroke|divide|outline|decoration|from|via|to)-(.+)$/.exec(
        utility,
      );
      if (!match) return false;

      const [, prefix, rawSuffix] = match;
      // `bg-foreground/20` : le modificateur d'opacité ne fait pas partie du token.
      const suffix = rawSuffix.replace(/\/[\w.]+$/, "");

      if (COLOR_TOKENS.has(suffix)) return false;
      return !NON_COLOR_SUFFIXES[prefix]?.test(suffix);
    },
    message: "Classe de couleur visant un token inexistant.",
    fix: "Ce token n'est pas déclaré dans app/globals.css : la classe ne génère AUCUNE CSS et l'élément reste transparent. Corrigez le nom, ou déclarez le token.",
  },
  {
    id: "radius-scale",
    test: (token) => {
      const utility = token.replace(/^.*:/, "");
      if (!/^rounded(?:-|$)/.test(utility)) return false;
      if (/^rounded-\[/.test(utility)) return true;
      return !/^rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?:sm|md|lg|xl|full|none)$/.test(
        utility,
      );
    },
    message: "Rayon hors de l'échelle du système.",
    fix: "Échelle dérivée de --radius : rounded-sm | rounded-md | rounded-lg | rounded-xl | rounded-full. `rounded` nu et rounded-2xl/3xl sont exclus.",
  },
];

/* --------------------------------------------------------------- Analyse */

/** Extrait le contenu des chaînes littérales d'une ligne. */
function stringLiterals(line) {
  const found = [];
  const pattern = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let match;
  while ((match = pattern.exec(line)) !== null) found.push(match[2]);
  return found;
}

function checkFile(absolutePath) {
  const relativePath = relative(ROOT, absolutePath).split(sep).join("/");
  const violations = [];
  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    for (const rule of LINE_RULES) {
      if (rule.test.test(line)) {
        violations.push({ file: relativePath, line: lineNumber, rule, snippet: line.trim() });
      }
    }

    for (const literal of stringLiterals(line)) {
      for (const token of literal.split(/\s+/)) {
        if (!token) continue;
        for (const rule of CLASS_RULES) {
          if (rule.test(token)) {
            violations.push({
              file: relativePath,
              line: lineNumber,
              rule,
              snippet: token,
            });
          }
        }
      }
    }
  });

  return violations;
}

function walk(directory, collected = []) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return collected;
  }

  for (const entry of entries) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, collected);
    } else if (SCAN_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      collected.push(full);
    }
  }

  return collected;
}

/* ---------------------------------------------------------------- Sortie */

/** Ne garde que les fichiers réellement couverts par le système. */
function inScope(file) {
  const absolute = file.startsWith(ROOT) ? file : join(ROOT, file);
  if (!SCAN_EXTENSIONS.some((extension) => absolute.endsWith(extension))) return null;
  const normalised = relative(ROOT, absolute).split(sep).join("/");
  if (normalised.startsWith("..")) return null;
  return SCAN_DIRS.some((directory) => normalised.startsWith(`${directory}/`)) ? absolute : null;
}

function formatReport(violations) {
  const byRule = new Map();
  for (const violation of violations) {
    const list = byRule.get(violation.rule.id) ?? [];
    list.push(violation);
    byRule.set(violation.rule.id, list);
  }

  const lines = ["", "✗ Violations du design system", ""];
  for (const [ruleId, list] of byRule) {
    const { message, fix } = list[0].rule;
    lines.push(`  ${ruleId} — ${message}`, `  → ${fix}`, "");
    for (const violation of list) {
      lines.push(`      ${violation.file}:${violation.line}  ${violation.snippet.slice(0, 100)}`);
    }
    lines.push("");
  }
  lines.push(`${violations.length} violation(s). Référence : docs/design-system.md`, "");
  return lines.join("\n");
}

const argv = process.argv.slice(2);

/**
 * Mode hook Claude Code : lit le JSON du hook sur l'entrée standard et ne
 * vérifie que le fichier qui vient d'être écrit. Le JSON est parsé par Node
 * plutôt que par `jq`, qui n'est pas garanti présent sous Windows.
 *
 * Code de sortie 2 = les violations sont renvoyées à Claude pour correction.
 * Tout le reste sort en 0 : un hook qui échoue sur un imprévu bloquerait le
 * travail au lieu de le guider.
 */
if (argv.includes("--hook")) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const edited = payload?.tool_input?.file_path ?? payload?.tool_response?.filePath;
  const target = typeof edited === "string" ? inScope(edited) : null;
  if (!target) process.exit(0);

  let violations = [];
  try {
    violations = checkFile(target);
  } catch {
    process.exit(0);
  }

  if (violations.length === 0) process.exit(0);

  console.error(formatReport(violations));
  process.exit(2);
}

const files = argv.length
  ? argv.map(inScope).filter(Boolean)
  : SCAN_DIRS.flatMap((directory) => walk(join(ROOT, directory)));

const violations = files.flatMap(checkFile);

if (violations.length === 0) {
  if (!argv.length) {
    console.log(`✓ Design system respecté (${files.length} fichiers vérifiés)`);
  }
  process.exit(0);
}

console.error(formatReport(violations));
process.exit(1);
