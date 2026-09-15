/**
 * Codes d'invitation : la logique pure, hors base et hors interface.
 */

/**
 * Alphabet sans ambiguïté : ni O/0, ni I/1/L, ni U/V à l'oral.
 *
 * Un code se dicte au téléphone et se recopie à la main sur un bout de papier.
 * Chaque paire de caractères confondables est une invitation refusée sans que
 * personne ne comprenne pourquoi.
 */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const LONGUEUR_CODE = 8;

/**
 * Tire un code au hasard.
 *
 * `crypto.getRandomValues` et non `Math.random` : un code devinable ouvrirait
 * la boutique à qui prend la peine d'essayer. 31^8 ≈ 850 milliards de
 * combinaisons, et chaque code expire en sept jours.
 *
 * Le modulo introduit un biais négligeable ici (256 % 31 = 8), mais on l'écarte
 * quand même en rejetant les octets au-delà du plus grand multiple : un
 * générateur biaisé est une faiblesse qu'on ne remarque jamais à temps.
 */
export function genererCode(aleatoire: (n: number) => Uint8Array): string {
  const limite = Math.floor(256 / ALPHABET_CODE.length) * ALPHABET_CODE.length;
  let code = "";

  while (code.length < LONGUEUR_CODE) {
    for (const octet of aleatoire(LONGUEUR_CODE)) {
      if (octet >= limite) continue;
      code += ALPHABET_CODE[octet % ALPHABET_CODE.length];
      if (code.length === LONGUEUR_CODE) break;
    }
  }

  return code;
}

/**
 * Normalise ce que l'utilisateur a saisi.
 *
 * On accepte les minuscules, les espaces et les tirets : quelqu'un qui recopie
 * « qk4m-8rtp » depuis un papier ne doit pas être refusé pour la forme.
 */
export function normaliserCode(saisi: string): string {
  return saisi.trim().toUpperCase().replace(/[\s-]/g, "");
}

/** Le code a-t-il la forme attendue ? Vérifié avant d'interroger la base. */
export function codeValide(saisi: string): boolean {
  const code = normaliserCode(saisi);
  if (code.length !== LONGUEUR_CODE) return false;
  return [...code].every((caractere) => ALPHABET_CODE.includes(caractere));
}

/** Découpe en deux groupes de quatre : plus facile à lire et à dicter. */
export function formaterCode(code: string): string {
  const net = normaliserCode(code);
  return net.length === LONGUEUR_CODE ? `${net.slice(0, 4)}-${net.slice(4)}` : net;
}
