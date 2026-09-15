/**
 * Comptes de caisse créés par le responsable, sans inscription.
 *
 * POURQUOI UN IDENTIFIANT ET PAS UN EMAIL — un caissier n'a pas toujours
 * d'adresse, et en exiger une pour ouvrir la caisse du matin est un obstacle
 * absurde. Le responsable choisit « awa », on en dérive une adresse interne.
 *
 * L'IDENTIFIANT EST GLOBAL, et c'est un choix assumé. Une première version le
 * préfixait par l'organisation — « awa@99df371f.mamafacture.app » — pour que deux
 * boutiques puissent chacune avoir leur Awa. Résultat : une adresse impossible à
 * dicter et impossible à retaper, que le caissier ne pouvait pas saisir seul.
 *
 * Un identifiant unique pour tout le monde coûte une collision de temps en temps
 * — « awa » sera pris, il faudra « awa2 » — et c'est exactement ce que fait
 * n'importe quel service qui demande un pseudonyme. Le message d'erreur le dit.
 */

/** Domaine interne. Ces adresses ne reçoivent rien : elles servent à se connecter. */
export const DOMAINE_CAISSE = "caisse.mamafacture.app";

/** Lettres, chiffres, point et tiret. Rien qui demande une touche exotique. */
export const MOTIF_IDENTIFIANT = /^[a-z0-9]([a-z0-9._-]{1,28})[a-z0-9]$/;

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export function identifiantValide(saisi: string): boolean {
  return MOTIF_IDENTIFIANT.test(saisi.trim().toLowerCase());
}

/** Compose l'adresse de connexion à partir de l'identifiant. */
export function adresseDeConnexion(identifiant: string): string {
  return `${identifiant.trim().toLowerCase()}@${DOMAINE_CAISSE}`;
}

/**
 * Complète une saisie de connexion.
 *
 * Le caissier tape « majida », pas une adresse. Sans ce complément, le champ le
 * refusait avant même d'atteindre le serveur — et c'était la seule chose qu'on
 * lui avait apprise à taper.
 *
 * Une vraie adresse email est laissée intacte : le responsable, lui, se connecte
 * avec la sienne.
 */
export function completerIdentifiant(saisi: string): string {
  const net = saisi.trim();
  if (net.includes("@")) return net.toLowerCase();
  return identifiantValide(net) ? adresseDeConnexion(net) : net;
}

/** Retrouve l'identifiant lisible depuis l'adresse, pour l'afficher. */
export function identifiantDepuisAdresse(adresse: string): string {
  return adresse.split("@")[0] ?? adresse;
}
