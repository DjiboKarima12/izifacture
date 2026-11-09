/**
 * Destination après connexion ou inscription (`?next=`).
 *
 * Seul un chemin INTERNE est accepté. Sans ce contrôle, un lien piégé
 * `/login?next=https://faux-site.example` renverrait l'utilisateur, juste
 * connecté et en confiance, vers une page qui imite la nôtre. `//hôte` et
 * `/\hôte` sont refusés aussi : les navigateurs les lisent comme une adresse
 * externe.
 */
export function safeNextPath(raw: string | string[] | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}
