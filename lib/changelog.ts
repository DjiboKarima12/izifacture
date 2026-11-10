/**
 * Nouveautés annoncées aux utilisateurs, de la plus récente à la plus ancienne.
 *
 * POUR ANNONCER UNE NOUVEAUTÉ : ajouter une entrée EN TÊTE, avec un `id` neuf
 * (la date suffit). La fenêtre s'ouvre une fois, à la prochaine entrée dans
 * l'application, chez ceux qui ne l'ont pas encore vue.
 */

export type NewsEntry = {
  /** Identifiant unique ; la date du jour, suffixée au besoin (« 2026-11-10b »). */
  id: string;
  /** Date de publication, ISO. Ne s'annonce qu'aux comptes créés AVANT. */
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: NewsEntry[] = [
  {
    id: "2026-11-10",
    date: "2026-11-10T00:00:00Z",
    title: "MaMaFacture s'installe sur votre ordinateur",
    items: [
      "Installez l'application sur votre bureau ou votre téléphone : elle s'ouvre d'un clic, dans sa propre fenêtre, et demande toujours votre mot de passe.",
      "Un rappel s'affiche quelques jours avant la fin de votre essai ou de votre abonnement.",
      "Passez au Premium depuis la page Abonnement, et payez par Mobile Money.",
    ],
  },
];

/**
 * La nouveauté à montrer, ou `null`.
 *
 * Seulement la PLUS RÉCENTE : après une longue absence, on n'empile pas cinq
 * fenêtres. Et seulement aux comptes créés avant sa publication — un inscrit
 * du jour découvre l'application telle qu'elle est, sans « nouveauté » à
 * comparer à rien.
 */
export function pendingNews(
  lastSeenId: string | null,
  orgCreatedAt: string,
  changelog: NewsEntry[] = CHANGELOG,
): NewsEntry | null {
  const latest = changelog[0];
  if (!latest || latest.id === lastSeenId) return null;
  const created = Date.parse(orgCreatedAt);
  if (Number.isNaN(created) || created >= Date.parse(latest.date)) return null;
  return latest;
}
