/**
 * Vérifie les variables d'environnement avant de construire.
 *
 * Pourquoi au build et pas seulement à l'exécution : les variables
 * `NEXT_PUBLIC_*` sont incrustées dans le bundle au moment de la construction.
 * Une variable oubliée chez l'hébergeur produit donc un site publié mais cassé
 * — un 500 sur chaque page, avec un code opaque côté Vercel et le vrai message
 * enfoui dans les journaux d'exécution. Mieux vaut que le déploiement échoue,
 * en nommant ce qui manque.
 *
 * `loadEnvConfig` est le chargeur de Next lui-même : il lit `.env.local` et ses
 * variantes exactement comme `next build` le fera. Sans lui, ce script ne
 * verrait rien en local et échouerait alors que tout est correctement
 * configuré.
 */

// `@next/env` est un module CommonJS : l'import nommé échoue, il faut passer
// par l'export par défaut.
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

const REQUISES = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Settings → API → Project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Settings → API → clé publiable (sb_publishable_…)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Settings → API → clé secrète (sb_secret_…)"],
];

function echouer(lignes) {
  console.error("");
  console.error("  Construction interrompue : configuration incomplète.");
  console.error("");
  for (const ligne of lignes) console.error(`  ${ligne}`);
  console.error("");
  console.error("  En local  : renseignez-les dans .env.local (modèle : .env.example).");
  console.error("  Sur Vercel : Settings → Environment Variables, puis redéployez —");
  console.error("               les NEXT_PUBLIC_* sont figées à la construction, les");
  console.error("               ajouter sans reconstruire ne change rien.");
  console.error("");
  process.exit(1);
}

const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "supabase";

if (source !== "supabase" && source !== "mock") {
  echouer([
    `NEXT_PUBLIC_DATA_SOURCE vaut « ${source} ».`,
    "Les seules valeurs admises sont « supabase » et « mock ».",
  ]);
}

if (source === "mock") {
  console.log("");
  console.log("  ⚠ NEXT_PUBLIC_DATA_SOURCE=mock — cette construction servira le jeu de");
  console.log("    démonstration, pas la base. À ne jamais déployer en production.");
  console.log("");
  process.exit(0);
}

const manquantes = REQUISES.filter(([nom]) => !process.env[nom]);

if (manquantes.length > 0) {
  echouer([
    `${manquantes.length} variable${manquantes.length > 1 ? "s" : ""} manquante${manquantes.length > 1 ? "s" : ""} :`,
    "",
    ...manquantes.map(([nom, ou]) => `  • ${nom}\n      → tableau de bord Supabase, ${ou}`),
  ]);
}

/**
 * Présence ne vaut pas validité.
 *
 * Coller une valeur dans le tableau de bord d'un hébergeur y ajoute facilement
 * des guillemets, une espace ou un retour à la ligne. La variable est alors bien
 * « présente », le build passe, et c'est `createServerClient` qui casse à
 * l'exécution sur un « Invalid URL » — dans le middleware, donc sur toutes les
 * pages à la fois, avec un code opaque côté hébergeur. Autant le voir ici.
 */
const defauts = [];

for (const [nom] of REQUISES) {
  const brut = process.env[nom];

  if (brut !== brut.trim()) {
    defauts.push(`${nom} commence ou finit par une espace ou un retour à la ligne.`);
    continue;
  }
  if (/^["']|["']$/.test(brut)) {
    defauts.push(`${nom} est entourée de guillemets — l'hébergeur les garde tels quels.`);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();

try {
  const analysee = new URL(url);
  if (analysee.protocol !== "https:") {
    defauts.push(`NEXT_PUBLIC_SUPABASE_URL n'est pas en https (${analysee.protocol}).`);
  }
  if (url.endsWith("/")) {
    defauts.push("NEXT_PUBLIC_SUPABASE_URL finit par une barre oblique — la retirer.");
  }
} catch {
  defauts.push(`NEXT_PUBLIC_SUPABASE_URL n'est pas une URL valide : « ${url} ».`);
}

if (defauts.length > 0) {
  echouer(["Valeurs mal formées :", "", ...defauts.map((defaut) => `  • ${defaut}`)]);
}

console.log(`✓ Variables d'environnement valides (source : ${source})`);
