/**
 * Adresse publique du site, sans barre finale.
 *
 * `NEXT_PUBLIC_SITE_URL` prime quand elle est posée. À défaut, l'origine de la
 * requête — pour qu'un lien envoyé depuis le poste de développement ramène au
 * poste de développement —, puis l'adresse de production.
 */
export const PRODUCTION_URL = "https://facture.barketechnologie.com";

export function siteUrl(origin?: string | null): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || origin || PRODUCTION_URL;
  return url.replace(/\/+$/, "");
}
