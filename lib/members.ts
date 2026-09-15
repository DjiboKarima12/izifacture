/**
 * Comptes de caisse créés par le responsable, sans inscription.
 *
 * POURQUOI UN IDENTIFIANT ET PAS UN EMAIL — un caissier n'a pas toujours
 * d'adresse, et en exiger une pour ouvrir la caisse du matin est un obstacle
 * absurde. Le responsable choisit « awa », on en dérive une adresse interne.
 *
 * L'adresse porte le PRÉFIXE DE L'ORGANISATION, et c'est indispensable : deux
 * boutiques auront toutes les deux une Awa. Sans ce préfixe, la seconde création
 * échouerait sur un compte déjà pris, dans une boutique dont on ne sait rien.
 */

/** Domaine interne. Ces adresses ne reçoivent rien : elles servent à se connecter. */
export const DOMAINE_CAISSE = "mamafacture.app";

/** Lettres, chiffres, point et tiret. Rien qui demande une touche exotique. */
export const MOTIF_IDENTIFIANT = /^[a-z0-9]([a-z0-9._-]{1,28})[a-z0-9]$/;

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export function identifiantValide(saisi: string): boolean {
  return MOTIF_IDENTIFIANT.test(saisi.trim().toLowerCase());
}

/**
 * Compose l'adresse de connexion.
 *
 * Huit caractères de l'identifiant d'organisation suffisent : ils viennent d'un
 * UUID, donc la collision entre deux boutiques est hors de portée, et l'adresse
 * reste assez courte pour être dictée.
 */
export function adresseDeConnexion(identifiant: string, orgId: string): string {
  const prefixe = orgId.replace(/-/g, "").slice(0, 8);
  return `${identifiant.trim().toLowerCase()}@${prefixe}.${DOMAINE_CAISSE}`;
}

/** Retrouve l'identifiant lisible depuis l'adresse, pour l'afficher. */
export function identifiantDepuisAdresse(adresse: string): string {
  return adresse.split("@")[0] ?? adresse;
}
