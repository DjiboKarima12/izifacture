/**
 * Nouveautés annoncées aux abonnés Premium, de la plus récente à la plus
 * ancienne.
 *
 * POUR ANNONCER UNE NOUVEAUTÉ : ajouter une entrée EN TÊTE, avec un `id` neuf
 * (la date suffit). La fenêtre s'ouvre une fois, à la prochaine entrée dans
 * l'application, chez les abonnés qui ne l'ont pas encore vue.
 *
 * Ce qui se signale de soi-même au bon moment — le rappel de fin d'abonnement,
 * par exemple — n'a pas sa place ici : on n'annonce pas un message par un autre.
 */

export type NewsItem = {
  text: string;
  /** À taire chez qui a déjà installé l'application : ce serait lui proposer ce qu'il a. */
  unlessInstalled?: boolean;
};

export type NewsEntry = {
  /** Identifiant unique ; la date du jour, suffixée au besoin (« 2026-11-10b »). */
  id: string;
  /** Date de publication, ISO. Ne s'annonce qu'aux comptes créés AVANT. */
  date: string;
  title: string;
  items: NewsItem[];
};

export const CHANGELOG: NewsEntry[] = [
  {
    id: "2026-11-10b",
    date: "2026-11-10T12:00:00Z",
    title: "Envoyez vos factures par WhatsApp",
    items: [
      { text: "Sur une facture, le bouton WhatsApp prépare le message avec le montant et un lien : votre client ouvre sa facture sans créer de compte." },
      { text: "Une facture pas encore réglée ? Le bouton Relancer envoie un rappel poli avec le reste à payer." },
      { text: "Pour votre comptable : exportez les factures et les encaissements du mois en fichier Excel." },
      {
        text: "Installez MaMaFacture sur votre ordinateur : elle s'ouvre d'un clic et demande toujours votre mot de passe.",
        unlessInstalled: true,
      },
    ],
  },
  {
    id: "2026-11-10",
    date: "2026-11-10T00:00:00Z",
    title: "MaMaFacture s'installe sur votre ordinateur",
    items: [
      {
        text: "Installez l'application sur votre bureau ou votre téléphone : elle s'ouvre d'un clic, dans sa propre fenêtre, et demande toujours votre mot de passe.",
        unlessInstalled: true,
      },
    ],
  },
];

export type NewsReader = {
  premium: boolean;
  /** L'application tourne installée, ou ce navigateur l'a installée. */
  installed: boolean;
};

/**
 * La nouveauté à montrer, ou `null`.
 *
 *  - Réservée au PREMIUM : c'est l'abonnement qui donne droit aux évolutions.
 *  - Seulement la PLUS RÉCENTE : après une longue absence, on n'empile pas cinq
 *    fenêtres.
 *  - Seulement aux comptes créés avant sa publication : un inscrit du jour
 *    découvre l'application telle qu'elle est.
 *  - Les lignes qui ne concernent pas le lecteur sont retirées ; s'il n'en
 *    reste aucune, rien ne s'ouvre.
 */
export function pendingNews(
  lastSeenId: string | null,
  orgCreatedAt: string,
  reader: NewsReader,
  changelog: NewsEntry[] = CHANGELOG,
): NewsEntry | null {
  if (!reader.premium) return null;

  const latest = changelog[0];
  if (!latest || latest.id === lastSeenId) return null;

  const created = Date.parse(orgCreatedAt);
  if (Number.isNaN(created) || created >= Date.parse(latest.date)) return null;

  const items = latest.items.filter((item) => !(item.unlessInstalled && reader.installed));
  return items.length > 0 ? { ...latest, items } : null;
}
