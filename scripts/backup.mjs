#!/usr/bin/env node
/**
 * Sauvegarde de toutes les tables métier, à lancer chaque nuit sur le VPS.
 *
 *   node scripts/backup.mjs [dossier]      # défaut : /var/backups/izifacture
 *
 * POURQUOI CE SCRIPT : l'offre gratuite de Supabase ne fournit AUCUNE sauvegarde
 * récupérable. Une suppression par erreur, et les factures des commerçants
 * seraient perdues.
 *
 * POURQUOI PAR L'API et non `pg_dump` : la connexion directe à Postgres est en
 * IPv6 seulement sur l'offre gratuite, et le pooler refuse l'authentification
 * (cf. CLAUDE.md). L'API REST passe partout en HTTPS, avec la clé de service
 * déjà présente dans le `.env` de l'application — aucun secret de plus.
 *
 * Ce qui N'EST PAS sauvegardé : les comptes de connexion (`auth.users`, hors
 * de portée de l'API). Les noms et rôles le sont, via `profiles` et
 * `memberships` ; en cas de perte, chacun recréerait son mot de passe.
 *
 * Résultat : un fichier `izifacture-AAAA-MM-JJ.json.gz` par jour ; les
 * `GARDER` plus récents sont conservés, les autres supprimés.
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const TABLES = [
  "organizations",
  "profiles",
  "memberships",
  "subscriptions",
  "billing_events",
  "clients",
  "products",
  "invoices",
  "invoice_items",
  "invoice_counters",
  "invoice_events",
  "payments",
  "invitations",
  "recurring_schedules",
  "recurring_runs",
];
const PAGE = 1000;
const GARDER = 14;

/** Lit `.env` puis `.env.local` sans dépendance : `CLE=valeur` par ligne. */
function chargerEnv() {
  for (const fichier of [".env", ".env.local"]) {
    if (!existsSync(fichier)) continue;
    for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

async function lireTable(url, cle, table) {
  const entetes = { apikey: cle, Accept: "application/json" };
  // Les anciennes clés sont des JWT et doivent aussi passer en Bearer ; les
  // nouvelles (`sb_secret_…`) se contentent de `apikey`.
  if (cle.startsWith("eyJ")) entetes.Authorization = `Bearer ${cle}`;

  const lignes = [];
  // Trié par `id` quand la table en a un : sans ordre, Postgres peut rendre les
  // pages dans un ordre différent d'un appel à l'autre, et l'on sauterait ou
  // doublerait des lignes.
  let ordre = "&order=id";
  for (let debut = 0; ; debut += PAGE) {
    const reponse = await fetch(
      `${url}/rest/v1/${table}?select=*${ordre}&limit=${PAGE}&offset=${debut}`,
      { headers: entetes },
    );
    if (reponse.status === 400 && ordre && debut === 0) {
      ordre = "";
      debut -= PAGE;
      continue;
    }
    if (!reponse.ok) {
      throw new Error(`${table} : HTTP ${reponse.status} ${await reponse.text()}`);
    }
    const page = await reponse.json();
    lignes.push(...page);
    if (page.length < PAGE) return lignes;
  }
}

async function main() {
  chargerEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !cle) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.");
  }

  const dossier = process.argv[2] ?? "/var/backups/izifacture";
  mkdirSync(dossier, { recursive: true });

  const tables = {};
  for (const table of TABLES) {
    tables[table] = await lireTable(url, cle, table);
  }

  const jour = new Date().toISOString().slice(0, 10);
  const fichier = join(dossier, `izifacture-${jour}.json.gz`);
  const contenu = JSON.stringify({ createdAt: new Date().toISOString(), tables });
  // 0o600 : la sauvegarde contient les données de toutes les boutiques.
  writeFileSync(fichier, gzipSync(contenu), { mode: 0o600 });

  const anciennes = readdirSync(dossier)
    .filter((nom) => /^izifacture-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(nom))
    .sort()
    .reverse()
    .slice(GARDER);
  for (const nom of anciennes) unlinkSync(join(dossier, nom));

  const resume = TABLES.map((t) => `${t} ${tables[t].length}`).join(", ");
  console.log(`✓ Sauvegarde ${fichier}\n  ${resume}`);
}

main().catch((error) => {
  console.error(`✗ Sauvegarde échouée : ${error.message}`);
  process.exit(1);
});
