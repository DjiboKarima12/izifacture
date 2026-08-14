import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookies à écrire, tels que `@supabase/ssr` les transmet.
 *
 * Annoté à la main : le type de l'option `cookies` est une union entre
 * l'ancienne API (`get`/`set`/`remove`) et la nouvelle (`getAll`/`setAll`), et
 * TypeScript n'arrive pas à en inférer le paramètre.
 */
export type CookiesToSet = Array<{ name: string; value: string; options: CookieOptions }>;

/**
 * Accès aux variables d'environnement Supabase.
 *
 * Elles sont lues ici et nulle part ailleurs, avec un message explicite quand
 * elles manquent : sans ça, l'erreur remonte sous la forme d'un « Invalid URL »
 * du client Supabase, qui ne dit rien de ce qu'il faut corriger.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Renseignez-la dans .env.local (voir .env.example).`,
    );
  }
  return value;
}

/** Publiques : elles sont incluses dans le bundle navigateur, c'est prévu. */
export function publicSupabaseConfig() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

/**
 * Clé de service — contourne la RLS.
 *
 * Réservée aux webhooks et aux tâches planifiées. Ne JAMAIS l'importer depuis un
 * composant client : elle donne un accès total à toutes les organisations.
 */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("La clé de service ne doit jamais être lue côté navigateur.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Permet de basculer entre le mock et Supabase sans toucher au code.
 *
 * Surtout pas de préfixe `use` : ESLint prendrait cette fonction pour un hook
 * React et interdirait ses appels hors composant — ce qui faisait échouer
 * `next build`, alors que le serveur de développement, lui, ne lint pas.
 *
 * La vraie base est le défaut, et le mock doit être demandé explicitement.
 * L'inverse — ce qui était le cas — fait qu'une variable oubliée sur
 * l'hébergeur sert des factures inventées avec l'aplomb des vraies. Pour une
 * application qui tient la comptabilité de quelqu'un, se tromper de sens est
 * pire que ne pas démarrer : sans les variables Supabase, `required()` lève une
 * erreur explicite, et c'est ce qu'on veut voir.
 *
 * Une valeur inconnue est refusée plutôt qu'interprétée : une faute de frappe
 * dans le tableau de bord de l'hébergeur ne doit pas décider silencieusement de
 * la source des données.
 */
export function supabaseDataEnabled(): boolean {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "supabase";

  if (source !== "supabase" && source !== "mock") {
    throw new Error(
      `NEXT_PUBLIC_DATA_SOURCE vaut « ${source} » — les seules valeurs admises ` +
        `sont « supabase » et « mock ».`,
    );
  }

  return source === "supabase";
}
