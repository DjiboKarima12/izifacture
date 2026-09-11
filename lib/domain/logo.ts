/**
 * Logo de l'entreprise, stocké en clair dans la colonne `logo_url`.
 *
 * POURQUOI UNE DATA URI ET PAS UNE URL — la Server Action et le générateur de
 * PDF tournent sur le serveur. Si `logo_url` contenait une adresse fournie par
 * l'utilisateur, générer un PDF ferait faire à NOTRE serveur une requête vers
 * l'adresse de son choix : `http://localhost:54321`, une IP interne, un service
 * de métadonnées cloud. C'est une SSRF, et elle serait déclenchée par une
 * fonctionnalité aussi anodine que « télécharger ma facture ».
 *
 * Une image encodée dans la valeur elle-même supprime la question : il n'y a
 * plus rien à aller chercher, donc plus rien à atteindre. Elle évite aussi un
 * aller-retour réseau au moment de fabriquer le PDF, ce qui compte ici où la
 * latence est déjà le premier poste de lenteur.
 *
 * LE PRIX À PAYER — le snapshot figé de chaque facture recopie le logo (c'est ce
 * qui garantit qu'une facture émise garde l'apparence qu'elle avait). Le poids
 * est donc multiplié par le nombre de documents, d'où le plafond ci-dessous :
 * assez pour un logo net sur 80 mm, trop peu pour qu'une photo passe.
 *
 * Le jour où un bucket Supabase Storage sera en place, ce module devient le
 * point unique à changer — et il faudra alors une allowlist d'hôtes côté PDF.
 */

/** Formats acceptés. Le SVG est exclu : il peut porter du script. */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMimeType = (typeof LOGO_MIME_TYPES)[number];

/** Côté le plus long, en pixels, après redimensionnement. */
export const LOGO_MAX_DIMENSION = 480;

/** Plafond de la valeur stockée, data URI comprise. */
export const LOGO_MAX_BYTES = 48 * 1024;

const DATA_URI = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedLogo = { mimeType: LogoMimeType; base64: string };

/**
 * Valide et découpe une data URI d'image.
 *
 * Renvoie `null` sur tout ce qui n'est pas exactement une image encodée en
 * base64 — une URL distante comprise, qui est refusée volontairement.
 */
export function parseLogoDataUri(value: string | null | undefined): ParsedLogo | null {
  if (!value) return null;

  const match = DATA_URI.exec(value.trim());
  if (!match) return null;

  const [, mimeType, base64] = match as unknown as [string, LogoMimeType, string];

  // La longueur base64 est toujours un multiple de 4 ; autre chose est tronqué.
  if (base64.length % 4 !== 0) return null;
  if (value.length > LOGO_MAX_BYTES) return null;

  return { mimeType, base64 };
}

export function isValidLogo(value: string | null | undefined): boolean {
  return parseLogoDataUri(value) !== null;
}

/**
 * Octets de l'image, pour l'embarquer dans le PDF.
 *
 * `atob` et non `Buffer` : ce module est importé par l'aperçu, donc il part
 * aussi dans le navigateur. `Buffer` n'y existe pas et Next ne le comble plus.
 */
export function logoBytes(value: string | null | undefined): Uint8Array | null {
  const parsed = parseLogoDataUri(value);
  if (!parsed) return null;

  try {
    const binary = atob(parsed.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

/** Poids approximatif de l'image décodée — 3 octets pour 4 caractères base64. */
export function logoByteLength(value: string | null | undefined): number {
  const parsed = parseLogoDataUri(value);
  if (!parsed) return 0;

  const padding = parsed.base64.endsWith("==") ? 2 : parsed.base64.endsWith("=") ? 1 : 0;
  return (parsed.base64.length * 3) / 4 - padding;
}
