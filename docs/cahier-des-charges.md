# Cahier des charges — MaMaFacture

**Facturation, encaissement et reçu imprimé pour les commerces d'Afrique de l'Ouest francophone.**

| | |
|---|---|
| Version du document | 1.0 |
| Date | 23 septembre 2026 |
| Dépôt | `izifacture` (le produit s'appelle **MaMaFacture** à l'écran — cf. §11.3) |
| Rédigé à partir de | l'état réel du code au 23 septembre 2026, pas d'un prévisionnel |
| Statut du produit | en service sur base Supabase hébergée ; facturation de l'abonnement non branchée |

Ce document décrit **ce que le produit doit faire, pour qui, et sous quelles contraintes**. Il
distingue systématiquement ce qui est **livré** de ce qui est **spécifié mais non implémenté** (§11).

---

## 1. Contexte et objectifs

### 1.1 Le problème

Un commerçant ou un indépendant à Niamey, Dakar ou Abidjan facture aujourd'hui dans Word, Excel, sur
un carnet à souches — ou pas du tout. Trois faits gouvernent tout le reste du produit :

1. **Il travaille depuis un téléphone**, sur une connexion lente et coûteuse.
2. **Il encaisse en espèces ou en mobile money**, quasiment jamais par carte.
3. **Il doit remettre un papier** au client : au comptoir, le reçu est le produit.

### 1.2 Utilisateur cible

| Profil | Besoin dominant |
|---|---|
| Commerçant de détail, gargote, boutique d'alimentation | Vendre vite, rendre la monnaie juste, imprimer le ticket |
| Artisan, prestataire, indépendant | Devis puis facture, suivi du reste dû |
| Responsable avec employés | Ouvrir des comptes de caisse, voir le chiffre du mois |

Le **marché de départ est le Niger** : les valeurs par défaut (pays, TVA 19 %, moyens de paiement) le
reflètent. Le produit reste utilisable au Sénégal, en Côte d'Ivoire et dans toute la zone CFA
(XOF/XAF).

### 1.3 Objectifs produit

- **O1** — Émettre une facture conforme et un reçu imprimable en moins d'une minute, depuis un téléphone.
- **O2** — Garantir la **justesse comptable** : aucun écart d'un franc, aucune facture émise modifiable.
- **O3** — Tenir la **caisse** : scan d'article, monnaie rendue, acompte, ticket 80 mm.
- **O4** — Rester gratuit pour le très petit volume, payant au-delà (§4.11).
- **O5** — Fonctionner en français, en FCFA, sans carte bancaire.

### 1.4 Hors périmètre (décision explicite)

Comptabilité générale, gestion de stock, paie, déclaration fiscale automatisée, multi-devises hors
zone CFA, application mobile native, mode hors-ligne complet.

---

## 2. Acteurs et rôles

| Acteur | Rôle technique | Droits |
|---|---|---|
| **Propriétaire** | `owner` | Tout, y compris supprimer l'organisation. Ne peut pas être le dernier à se retirer. |
| **Administrateur** | `admin` | Paramètres, équipe, catalogue, suppression de brouillons et d'encaissements. |
| **Caissier / membre** | `member` | Vendre : créer et émettre des documents, encaisser, lire le catalogue et les clients. Ne modifie ni le catalogue, ni les paramètres de l'entreprise. |
| **Visiteur** | `anon` | Vitrine publique, inscription, connexion, consultation d'un document par jeton. |

**Exigence transverse :** l'interface **ne montre pas** une commande que le rôle ne peut pas exécuter.
Un caissier ne voit ni le bouton « Nouveau produit », ni les onglets de paramètres autres
qu'« Apparence ». Ce masquage est **de l'affichage** — le contrôle réel vit dans la RLS Postgres (§6).
Une porte qu'on montre mais qui ne s'ouvre pas est pire qu'une porte absente.

---

## 3. Cycle de vie des documents

```
                           ┌───────────► Annulé
                           │
Brouillon ──émission──► Envoyé ──encaissement partiel──► Partiellement payée
    │  (numéro attribué)     │                                   │
    │                        └───────────encaissement total──────┴──► Payée
    │
    └── supprimable (aucun numéro consommé)

Devis ──« Accepter et facturer » ──► nouvelle Facture (les deux documents coexistent)
Facture émise ── correction ──► Avoir (document distinct, rattaché à sa facture d'origine)
```

Statuts persistés : `draft`, `sent`, `partially_paid`, `paid`, `cancelled`.

Deux statuts **dérivés**, jamais stockés :

- **En retard** (`overdue`) : une facture `sent` ou `partially_paid` dont l'échéance est passée.
- **Expiré** (`expired`) : un devis dont la date de validité est passée. Un devis n'est **jamais**
  « en retard » — il ne doit rien.

Transitions autorisées, toute autre étant refusée côté serveur :

| Depuis | Vers |
|---|---|
| `draft` | `sent`, `cancelled` |
| `sent` | `partially_paid`, `paid`, `cancelled` |
| `partially_paid` | `paid`, `cancelled` |
| `paid`, `cancelled` | — (états terminaux) |

---

## 4. Exigences fonctionnelles

Chaque exigence porte un identifiant stable. L'état est celui du 23 septembre 2026 :
✅ livré · ⚠️ partiel · ❌ non implémenté.

### 4.1 Compte et organisation

| # | Exigence | État |
|---|---|---|
| EF-1.1 | Inscription par email + mot de passe (8 caractères minimum), avec nom complet et nom d'entreprise | ✅ |
| EF-1.2 | La création de compte crée **atomiquement** l'organisation, l'appartenance `owner` et l'abonnement gratuit | ✅ |
| EF-1.3 | Connexion par email **ou par identifiant nu** (un caissier tape « majida », pas une adresse) | ✅ |
| EF-1.4 | Message d'erreur identique pour un email inconnu et un mot de passe faux (pas d'énumération de comptes) | ✅ |
| EF-1.5 | Mot de passe oublié : envoi d'un lien, page de réinitialisation | ✅ |
| EF-1.6 | Un compte sans organisation est redirigé vers l'onboarding, pas vers des écrans vides | ✅ |
| EF-1.7 | Déconnexion | ✅ |
| EF-1.8 | Rejoindre une boutique existante par **code d'invitation**, au lieu de créer la sienne | ✅ |

### 4.2 Tableau de bord — `/dashboard`

| # | Exigence | État |
|---|---|---|
| EF-2.1 | Quatre indicateurs : total encaissé, factures en attente, en retard, nouveaux clients | ✅ |
| EF-2.2 | Variation par rapport au mois précédent, calculée sur les données réelles | ✅ |
| EF-2.3 | Les cinq derniers documents, cliquables | ✅ |
| EF-2.4 | Graphique 12 mois facturé / encaissé, **en SVG écrit à la main** — aucune librairie de graphique (~100 ko économisés sur une connexion lente), avec repli en tableau de données | ✅ |
| EF-2.5 | Brouillons, devis et documents annulés **exclus** des chiffres : ce ne sont pas des créances | ✅ |
| EF-2.6 | Statistiques calculées **en base** (`dashboard_stats`, `monthly_totals`), jamais en téléchargeant toutes les factures | ✅ |

### 4.3 Factures — `/invoices`

| # | Exigence | État |
|---|---|---|
| EF-3.1 | Liste filtrable : toutes, brouillon, envoyée, partiellement payée, **en retard**, payée | ✅ |
| EF-3.2 | Recherche par numéro ou par client | ✅ |
| EF-3.3 | Création à lignes dynamiques : ajout, duplication, suppression | ✅ |
| EF-3.4 | Totaux et TVA recalculés **à chaque frappe**, avec aperçu du document en direct | ✅ |
| EF-3.5 | Remise par ligne, en montant ou en pourcentage | ✅ |
| EF-3.6 | Client **facultatif** : une vente au comptoir n'a pas de client nommé | ✅ |
| EF-3.7 | Saisie assistée par le catalogue (suggestion à la frappe) et par **douchette** (§4.6) | ✅ |
| EF-3.8 | Règlement immédiat à l'émission : moyen + montant reçu, monnaie calculée | ✅ |
| EF-3.9 | Confirmation avant émission, rappelant le montant et le numéro prévisionnel | ✅ |
| EF-3.10 | Modale après création : télécharger le reçu ou revenir à la liste | ✅ |
| EF-3.11 | Détail : lignes, totaux, ventilation de TVA, client, encaissements, journal | ✅ |
| EF-3.12 | Modification **des brouillons uniquement** ; un document émis redirige vers son détail | ✅ |
| EF-3.13 | Annulation d'un document émis (statut `cancelled`, jamais de suppression) | ✅ |
| EF-3.14 | Suppression d'un brouillon (administrateur uniquement) | ✅ |
| EF-3.15 | Création d'un **avoir** depuis une facture émise | ⚠️ création faite ; les avoirs ne sont **listés nulle part** (§11.2) |
| EF-3.16 | Téléchargement du reçu PDF 80 mm (§4.8) | ✅ |
| EF-3.17 | Impression du document seul, interface masquée | ✅ |
| EF-3.18 | Pagination des listes | ⚠️ supportée par la couche données, non exposée dans l'UI |

### 4.4 Devis — `/quotes`

| # | Exigence | État |
|---|---|---|
| EF-4.1 | Même éditeur que les factures, séquence de numérotation **indépendante** (`DEV-2026-0001`) | ✅ |
| EF-4.2 | Vocabulaire propre : Envoyé, Accepté, Refusé, **Expiré** — jamais « en retard », accords au masculin | ✅ |
| EF-4.3 | Colonne « Valable jusqu'au » et non « Échéance » | ✅ |
| EF-4.4 | Aucun bloc de règlement : un devis ne s'encaisse pas | ✅ |
| EF-4.5 | « Accepter et facturer » : crée une facture depuis les lignes ; **les deux documents coexistent** (le client a accepté un devis précis, il faut pouvoir y revenir) | ✅ |

### 4.5 Clients — `/clients`

| # | Exigence | État |
|---|---|---|
| EF-5.1 | Liste avec chiffre d'affaires par client, recherche | ✅ |
| EF-5.2 | Création et modification en modale | ✅ |
| EF-5.3 | Fiche client : coordonnées, encours (facturé / encaissé / reste dû), tous ses documents | ✅ |
| EF-5.4 | « Supprimer » = **archiver** ; un client facturé ne disparaît jamais. Réactivable | ✅ |
| EF-5.5 | Les ventes au comptoir (sans client) ne s'imputent à personne dans les statistiques | ✅ |

### 4.6 Catalogue produits — `/products`

| # | Exigence | État |
|---|---|---|
| EF-6.1 | Article = nom, prix unitaire, taux de TVA, unité facultative, code-barres facultatif | ✅ |
| EF-6.2 | Code-barres **unique par organisation** (deux boutiques peuvent vendre le même EAN) | ✅ |
| EF-6.3 | Recherche par nom ou par code | ✅ |
| EF-6.4 | Archivage logique, comme les clients | ✅ |
| EF-6.5 | Le scan d'un code archivé ne ressuscite **jamais** l'article | ✅ |
| EF-6.6 | Douchette USB traitée comme un clavier : simple champ texte, ni pilote ni caméra, **focus repris après chaque scan** | ✅ |
| EF-6.7 | Scanner deux fois le même article **incrémente la quantité** au lieu de créer une seconde ligne | ✅ |
| EF-6.8 | La ligne de facture **recopie** nom, prix et taux : changer un prix au catalogue ne réécrit aucune facture émise | ✅ |
| EF-6.9 | Le catalogue se **lit** par tous, ne se **modifie** que par `owner`/`admin` — un prix corrigé en caisse ne se retrouverait nulle part | ✅ |

### 4.7 Encaissements — `/payments`

| # | Exigence | État |
|---|---|---|
| EF-7.1 | Cinq filtres combinables : recherche (facture, client, référence), moyen, période, montant minimum, montant maximum | ✅ |
| EF-7.2 | Le total affiché **suit les filtres** | ✅ |
| EF-7.3 | Moyens nommés par leur service : **Espèces, MyNita, Amanata, Wave, Airtel Money, Autre** | ✅ |
| EF-7.4 | Espèces proposées par défaut (le cas le plus fréquent, de loin) | ✅ |
| EF-7.5 | Encaissement **partiel** accepté : c'est un acompte, pas une erreur | ✅ |
| EF-7.6 | Montant tendu saisissable en espèces ; la **monnaie rendue est calculée**, jamais stockée | ✅ |
| EF-7.7 | Suppression d'un encaissement saisi par erreur, avec recalcul du statut de la facture | ✅ |
| EF-7.8 | Un encaissement ne se rattache qu'à un document **émis et non annulé**, de la **même organisation** | ✅ |

### 4.8 Reçu et impression

| # | Exigence | État |
|---|---|---|
| EF-8.1 | Reçu PDF au format **rouleau 80 mm**, hauteur calculée sur le contenu réel | ✅ |
| EF-8.2 | Génération **côté serveur** (pdf-lib) et non via la boîte d'impression : une règle `@page` propose une taille, elle ne l'impose pas — « A4 » resterait à un clic, et le ticket ressortirait au milieu d'une feuille vide | ✅ |
| EF-8.3 | Police **Courier** : présente dans tout lecteur PDF (rien à télécharger) et à chasse fixe, ce qui aligne les montants | ✅ |
| EF-8.4 | Logo de l'entreprise imprimé s'il est renseigné | ✅ |
| EF-8.5 | **Code-barres Code 39** du numéro de document | ✅ |
| EF-8.6 | Le reçu porte : émetteur, client (s'il existe), lignes, ventilation de TVA, total, encaissé, **monnaie rendue**, reste dû et la mention en toutes lettres (Payée / Partiellement payée / Non payée) | ✅ |
| EF-8.7 | Le reçu s'appuie sur le **snapshot** du document émis, pas sur les coordonnées actuelles | ✅ |
| EF-8.8 | Une facture d'une autre organisation renvoie **404**, jamais 403 (403 confirmerait son existence) | ✅ |
| EF-8.9 | Aperçu à l'écran et PDF téléchargé annoncent **le même état de règlement** (logique partagée) | ✅ |

### 4.9 Paramètres — `/settings`

Cinq onglets, l'onglet actif dans l'URL (`?tab=`) : le lien est partageable et la navigation
fonctionne même sans JavaScript — ce qui compte sur les connexions visées.

| # | Exigence | État |
|---|---|---|
| EF-9.1 | **Profil de l'entreprise** : nom, raison sociale, email, téléphone, adresse, ville, pays, identifiant fiscal (NINEA / RCCM / IFU), logo | ✅ |
| EF-9.2 | **Régional & devise** : devise (XOF/XAF), taux de TVA par défaut, délai de paiement par défaut | ✅ |
| EF-9.3 | **Modèles de facturation** : préfixes de numérotation (1 à 8 caractères, A-Z 0-9 -), pied de facture | ✅ |
| EF-9.4 | **Équipe & accès** : membres, création de comptes de caisse, codes d'invitation, retrait d'un membre | ✅ |
| EF-9.5 | **Apparence** : 5 palettes, 8 couleurs d'action, 4 polices, 4 échelles de texte, mode sombre | ✅ |
| EF-9.6 | Modifier les coordonnées **ne change aucune facture déjà émise** | ✅ |
| EF-9.7 | Un caissier ne voit que l'onglet Apparence | ✅ |
| EF-9.8 | Logo : PNG / JPEG / WebP, **48 Ko et 480 px maximum**, encodé dans la valeur — jamais une URL (§6, SEC-7) | ✅ |

**Options d'apparence** — palettes : Sable, Ardoise, Papier, Indigo, Comptoir · accents : vert,
turquoise, bleu, indigo, violet, rose, ambre, ardoise (**pas de rouge** : il est pris par
`destructive` et par « en retard ») · polices : Neutre, Ronde, Classique, Lisibilité renforcée
(Atkinson Hyperlegible, conçue pour la basse vision et l'écran au soleil) · échelles : 90, 100, 112,
125 %. **La police du reçu ne change jamais** : elle reste en chasse fixe, c'est ce que l'œil
reconnaît comme un ticket.

### 4.10 Équipe : deux chemins d'entrée

Ils répondent à deux situations réelles et coexistent volontairement.

| # | Exigence | État |
|---|---|---|
| EF-10.1 | **Compte de caisse** créé par le responsable : nom, identifiant (« awa »), mot de passe. Aucune adresse email nécessaire — un caissier n'en a pas toujours, et en exiger une pour ouvrir la caisse du matin est un obstacle absurde | ✅ |
| EF-10.2 | L'identifiant est **global** et une adresse interne en est dérivée. Une collision se règle par « awa2 », et le message d'erreur le dit. Un préfixe par organisation avait été essayé : l'adresse devenait impossible à dicter et à retaper | ✅ |
| EF-10.3 | **Code d'invitation** à 8 caractères, dictable au téléphone : alphabet sans O/0 ni I/1/L, tiré par `crypto.getRandomValues` avec rejet du biais de modulo | ✅ |
| EF-10.4 | Code valable **7 jours**, **à usage unique**, révocable ; verrou de ligne à l'acceptation | ✅ |
| EF-10.5 | Saisie tolérante : minuscules, espaces et tirets acceptés | ✅ |
| EF-10.6 | Le **dernier propriétaire** ne peut pas être retiré : l'organisation deviendrait administrable par personne | ✅ |
| EF-10.7 | Invitation par email | ❌ aucun service d'envoi configuré — c'est la raison d'être du code |

### 4.11 Abonnement et quota

| # | Exigence | État |
|---|---|---|
| EF-11.1 | Plan **gratuit** : 5 factures émises par mois calendaire | ✅ |
| EF-11.2 | Plan **premium** : 2 000 FCFA par mois ou 20 000 FCFA par an, sans limite | ⚠️ page `/abonnement` faite : la demande part sur WhatsApp et l'activation est **manuelle** (`docs/abonnement-manuel.md`) ; aucun prestataire Mobile Money branché (§11.2) |
| EF-11.9 | Une période payée **échue** retombe sur gratuit d'elle-même, d'après `current_period_end` | ✅ |
| EF-11.3 | Le quota compte les **factures émises** : un brouillon, un devis ou un avoir ne consomment rien. Un devis ne prouve aucune vente ; bloquer la correction d'une erreur derrière un paiement serait indéfendable | ✅ |
| EF-11.4 | Le mois se lit sur l'horodatage serveur d'émission, jamais sur la date saisie — celle-ci se choisit et pourrait être antidatée | ✅ |
| EF-11.5 | La barrière vit dans la **Server Action**, pas dans le composant : un bouton masqué reste appelable, un paywall qui ne tient qu'à l'écran n'est pas un paywall | ✅ |
| EF-11.6 | Quota atteint : les brouillons sont **conservés**, et le message le dit | ✅ |
| EF-11.7 | Un plan inconnu, expiré ou en impayé retombe sur **gratuit** (l'inverse ouvrirait l'application à qui saurait écrire dans la colonne) | ✅ |
| EF-11.8 | Le plan est relu à chaque rendu : un abonnement activé débloque l'émission sans reconnexion | ✅ |

### 4.12 Vitrine publique — `/`

| # | Exigence | État |
|---|---|---|
| EF-12.1 | Page d'accueil accessible **sans session** — elle ne doit jamais appeler `getSession()`, qui redirigerait vers `/login` | ✅ |
| EF-12.2 | Démonstration du reçu qui se fabrique en boucle sous les yeux du visiteur, avec le **vrai composant** du produit et non une vidéo | ✅ |
| EF-12.3 | Moyens de paiement nommés, atouts en rangées, tarifs posés sur la bande sombre | ✅ |
| EF-12.4 | Grille tarifaire — **Gratuit** : 5 factures/mois, reçus imprimés et PDF, clients et encaissements, tableau de bord. **Premium** : factures sans limite, devis et avoirs, catalogue et douchette, plusieurs utilisateurs, support WhatsApp | ⚠️ affichage fait ; la réservation de devis/douchette au premium est **annoncée, pas appliquée** (§11.2) |
| EF-12.5 | La vitrine est le seul endroit où l'animation en boucle est admise (§8) | ✅ |

### 4.13 Aide et support — `/support`

WhatsApp (+227 89 35 35 00, lundi-samedi 9h-20h), email (barketechnologie@gmail.com, réponse sous
24 h ouvrées), téléphone, adresse postale. Chaque canal joignable porte son `href` (`wa.me`, `tel:`,
`mailto:`) : sur téléphone, là où cette page est le plus consultée, recopier un numéro à la main est
le geste le plus pénible qui soit. ✅

### 4.14 Facturation récurrente

Modèle de données, repositories et idempotence de génération (contrainte d'unicité sur
`schedule_id, period_start`, de sorte qu'un cron déclenché deux fois ne produise pas deux factures)
sont **écrits et testés**. **Aucune interface, aucune tâche planifiée.** ❌ (§11.2)

---

## 5. Règles métier — non négociables

Ces règles protègent la justesse comptable : les enfreindre produit des bugs comptables, pas des
défauts d'affichage. Elles ne se modifient que sur décision explicite du propriétaire du produit.
Chacune est tenue **à deux niveaux au moins** : application et base.

| # | Règle | Où elle est tenue |
|---|---|---|
| **RG-1** | **Aucun flottant sur un montant.** Entiers en unités mineures ; le franc CFA n'a pas de décimale, donc 1 unité = 1 franc. `toFixed()` est refusé par le vérificateur | `lib/money.ts`, `bigint` en base, `scripts/check-design-system.mjs` |
| **RG-2** | **Arrondi par ligne**, moitié à l'écart de zéro (pour que les avoirs, négatifs, soient symétriques des factures). Les totaux sont la somme **exacte** des lignes : aucun écart d'un franc entre ce que le client additionne et ce qui est imprimé | `lib/tax.ts` **et** `compute_invoice_item_totals` — les deux doivent rester synchronisées |
| **RG-3** | **Le serveur recalcule toujours les totaux.** Ceux transmis par le client sont ignorés, y compris sur une écriture directe via PostgREST ou un script d'import | Server Actions, repositories, triggers |
| **RG-4** | **Un document émis est figé.** Correction par **avoir** uniquement. Un brouillon se modifie librement | `enforce_invoice_immutability`, `enforce_invoice_items_immutability`, `isEditable()` |
| **RG-5** | **Le numéro est attribué à l'émission**, jamais à la création : la séquence reste sans trou — un brouillon abandonné ne consomme aucun numéro | `next_document_number()` sous verrou de ligne, contrainte `invoices_issued_has_number` |
| **RG-6** | **`overdue` n'est jamais stocké** : il se dérive de `status` + `due_date`. Aucune tâche planifiée n'est nécessaire, et une facture payée ne peut pas rester affichée « en retard » à cause d'un job en échec | `deriveDisplayStatus()`, vue `invoices_view` |
| **RG-7** | **Le statut de paiement ne s'écrit pas à la main** : il se déduit de la somme des encaissements | `statusAfterPayment()`, `refresh_invoice_payment_state` |
| **RG-8** | **Un document émis porte un snapshot figé** de l'entreprise et du client. Un client `null` dit « vente au comptoir » ; un objet aux clés vides dirait « on a perdu le nom » — le reçu n'affiche pas la même chose | `issue_invoice()` |
| **RG-9** | **L'autorisation ne vit pas dans le middleware** (CVE-2025-29927 : un en-tête forgé le contournait). Middleware = rafraîchissement de session ; isolation = **RLS Postgres** ; contrôle d'accès = layouts serveur et Server Actions | `middleware.ts`, `lib/auth/session.ts`, migrations RLS |
| **RG-10** | **Multi-tenant par organisation.** Toute table métier porte `org_id`, toute requête le borne explicitement — une fuite inter-organisation doit être visible à la lecture du code, en plus d'être bloquée en base | `lib/data/repository.ts` (paramètre `orgId` partout) |
| **RG-11** | **Une remise ne rend jamais une ligne négative** ; un trop-perçu ne crée jamais un dû négatif | `lib/tax.ts`, `amountDue()` |
| **RG-12** | **Les transitions de statut interdites sont refusées côté serveur** ; `paid` et `cancelled` sont terminaux | `assertTransition()` |
| **RG-13** | **Rien ne se supprime de l'historique** : clients et produits s'archivent, documents émis s'annulent. Seul un brouillon se supprime | RLS `invoices_delete_draft_admins`, colonnes `archived_at` |
| **RG-14** | **La monnaie rendue ne se stocke pas**, elle vaut `tendered − amount`. Un second chiffre à maintenir cohérent serait un troisième endroit où se tromper | colonne `payments.tendered` nullable, `changeGiven()` |

---

## 6. Exigences de sécurité

| # | Exigence | Mise en œuvre |
|---|---|---|
| **SEC-1** | L'isolation entre organisations est garantie par la **RLS Postgres**, sur toutes les tables métier | `org_id in (select auth_org_ids())` — la sous-requête est intentionnelle : une évaluation par requête, pas par ligne |
| **SEC-2** | `auth_org_ids()` et `auth_has_role()` sont `security definer` (sans quoi les policies récursent) et **révoquées de `public`** | migrations `…120100`, `…20260813180000`, `…20260909110000`, `…20260915130000` |
| **SEC-3** | Le rôle `anon` n'a **aucun accès direct** aux tables | `revoke all … from anon` sur chaque table, y compris les nouvelles |
| **SEC-4** | Toute fonction `security definer` **revérifie l'appartenance** qu'elle contourne, sinon connaître un identifiant suffirait à agir sur l'organisation d'autrui | `issue_invoice`, `create_credit_note`, `convert_quote_to_invoice`, `accept_invitation` |
| **SEC-5** | La session est validée par `getUser()` (revalidation auprès du serveur d'auth), jamais par `getSession()` qui lit un cookie forgeable | `lib/auth/session.ts` |
| **SEC-6** | La **clé de service** contourne la RLS : réservée à la création de comptes de caisse et aux futurs webhooks, jamais importée depuis un composant client. Sa fuite impose une révocation — la retirer du dépôt ne suffit pas, l'historique la garde | `.env.example`, `lib/supabase/server.ts` |
| **SEC-7** | Le logo est **encodé dans la valeur**, jamais une URL : le PDF est fabriqué par le serveur, et une adresse fournie par l'utilisateur lui ferait émettre une requête vers la destination de son choix (SSRF) | `lib/domain/logo.ts`, `organizationSettingsSchema` |
| **SEC-8** | Le lien public passe par une **fonction dédiée** exposant exactement les champs listés, et non par une policy ouverte à `anon` qu'une requête PostgREST pourrait élargir. Un brouillon n'expose rien | `get_public_invoice()` |
| **SEC-9** | Jeton public = 32 octets aléatoires : non énumérable | `encode(gen_random_bytes(32),'hex')`, index unique |
| **SEC-10** | Codes d'invitation : 31⁸ ≈ 850 milliards de combinaisons, générateur **débiaisé**, expiration 7 jours, usage unique, verrou de ligne | `lib/invitations.ts`, `accept_invitation()` |
| **SEC-11** | Mot de passe : **8 caractères minimum** — le défaut Supabase de 6 est trop court pour une application qui donne accès à la comptabilité d'une entreprise | schémas Zod |
| **SEC-12** | Pas d'énumération de comptes : même message pour email inconnu et mot de passe faux | `lib/actions/auth.ts` |
| **SEC-13** | Les erreurs internes ne fuitent pas : seules les erreurs de domaine portent un message destiné à l'utilisateur, le reste est générique et journalisé | `failure()` dans chaque Server Action |
| **SEC-14** | Un document hors organisation renvoie **404**, pas 403 | route PDF, repositories |
| **SEC-15** | Next.js `^14.2.25` est un **plancher imposé** (CVE-2025-29927) | `package.json` |
| **SEC-16** | `invoice_counters` et `billing_events` : RLS active, **aucune policy** — tout accès direct est refusé, seules les fonctions `security definer` y écrivent | migration RLS |
| **SEC-17** | `subscriptions` est en **lecture seule** côté application : seul un webhook en clé de service y écrira, sinon un utilisateur s'attribuerait un plan payant | policy `subscriptions_select_org` |
| **SEC-18** | Les vues sont en `security_invoker = on` : sans cette option, une vue s'exécute avec les droits de son propriétaire et court-circuite l'isolation | `invoices_view`, `payments_view` |

---

## 7. Exigences non fonctionnelles

| # | Exigence | Cible |
|---|---|---|
| **NF-1** | **Poids de page** : aucune librairie lourde pour un besoin léger — le graphique est du SVG manuscrit (~100 ko économisés) | connexion 3G lente |
| **NF-2** | **Rendu serveur** par défaut ; le JavaScript client est réservé aux formulaires et aux surfaces interactives | — |
| **NF-3** | **Aucune page mise en cache statiquement** dans l'espace applicatif (`noStore()` dans `getSession()`), sinon une facture créée n'apparaîtrait jamais | — |
| **NF-4** | **Mobile d'abord** : navigation en tiroir identique au bureau, formulaires utilisables au pouce, tableaux qui dégradent proprement | téléphone Android d'entrée de gamme |
| **NF-5** | **Accessibilité** : focus visible obligatoire, la couleur ne porte jamais seule une information (une pastille de statut écrit son libellé), `prefers-reduced-motion` respecté | WCAG AA |
| **NF-6** | **Couleurs de graphique validées mécaniquement**, pas choisies à l'œil : ΔE 31,5 en protanopie, 36,6 en vision normale ; le mode sombre a son **propre** couple, revalidé contre le fond sombre. Ne pas les changer sans relancer le validateur | `npm run check:contrast` |
| **NF-7** | **Français intégral**, accords compris (« Envoyé » sur un devis, « Envoyée » sur une facture) | — |
| **NF-8** | **Dates sans fuseau** : une facture émise à Niamey le 31 ne s'affiche pas le 30 ailleurs. Type `YYYY-MM-DD`, arithmétique en UTC | `lib/dates.ts` |
| **NF-9** | **Montants** : format `1 250 000 F CFA` fixé explicitement — Intl rend « F CFA » pour XOF mais « FCFA » pour XAF, deux graphies pour la même monnaie | `formatAmount()` |
| **NF-10** | **Saisie tolérante** des montants : espaces insécables, point et virgule décimale ; « 1.250.000 » et « 1 250 000 » donnent le même entier, et « 1250,75 » ne devient jamais 125075 | `parseAmountInput()` |
| **NF-11** | **Impression** : la feuille ne contient que le document, l'interface est en `print:hidden` | — |
| **NF-12** | **Personnalisation de lisibilité** : échelle de texte jusqu'à 125 %, police pour la basse vision, 5 palettes — l'écran d'un commerçant est souvent au soleil. Plancher à 90 % : en dessous, les mentions du reçu deviennent illisibles | `lib/appearance.ts` |
| **NF-13** | Les préférences d'apparence vivent dans le **stockage local**, appliquées avant le premier rendu : aucun clignotement au chargement | `app/layout.tsx` |
| **NF-14** | **Format compact sur les axes** (« 1,2 M », « 850 k ») : en FCFA, les montants atteignent vite sept chiffres, illisibles sur un axe | `formatAmountCompact()` |

---

## 8. Design system — obligation

**Toute page et tout composant suivent [`docs/design-system.md`](design-system.md)**, vérifié
mécaniquement par `npm run lint:design` (12 règles exécutables, bloquantes).

Les huit règles les plus souvent enfreintes :

1. **Aucune couleur en dur** — ni `#hex`, ni `rgb()`, ni palette Tailwind par défaut
   (`bg-gray-100`, `text-blue-600`). Uniquement des tokens sémantiques : `bg-card`,
   `text-muted-foreground`, `border-border`, `text-destructive`.
2. **Jamais de variante `dark:` dans un composant** — le mode sombre s'obtient en redéfinissant les
   tokens dans `.dark`. Un composant s'écrit une seule fois.
3. **Bordures 1 px, toujours** — `border-border` pour la structure, `border-input` pour les champs.
   Aucune bordure ne prend une couleur de marque ou de statut.
4. **Rayons** — `rounded-xl` cartes · `rounded-lg` boutons et champs · `rounded-md` pastilles, icônes
   et nav · `rounded-full` avatars. `rounded` nu et `rounded-2xl` sont refusés.
5. **Ombres** — `shadow-card` au repos, `shadow-raised` en flottant. Rien d'autre.
6. **Animations** — `animate-fade-in` / `animate-overlay-in` (180 ms) pour les surfaces flottantes,
   `transition-colors` pour les états, `animate-rise-in` (240 ms) à l'entrée du contenu **au tableau
   de bord seulement, jamais sur un écran de saisie**. La vitrine publique fait exception et admet
   la boucle.
7. **Focus visible obligatoire** sur tout élément atteignable au clavier
   (`focus-visible:ring-2 focus-visible:ring-ring`).
8. **Nombres à droite avec `tabular`**, texte à gauche. **Une seule action `primary` par écran.**

Règle d'implémentation : **réutiliser les composants de `components/ui/`** — ne pas réécrire une
carte, un tableau ou un bouton à la main dans une page.

Les douze règles du vérificateur : `no-color-literal`, `no-inline-style-color`, `no-tofixed`,
`no-hardcoded-currency`, `no-raw-anchor`, `img-needs-alt`, `no-tailwind-palette`, `no-dark-variant`,
`no-arbitrary-color`, `shadow-scale`, `unknown-color-token`, `radius-scale`.

---

## 9. Architecture technique

### 9.1 Pile

| Couche | Choix | Version |
|---|---|---|
| Framework | Next.js App Router | `^14.2.25` (plancher de sécurité) |
| Langage | TypeScript `strict` + `noUncheckedIndexedAccess` | `^5.5` |
| UI | Tailwind CSS 3 + Radix UI (dialog, dropdown, popover, select, label, slot) | — |
| Icônes | lucide-react | `^0.446` |
| Formulaires | react-hook-form + `@hookform/resolvers` | — |
| Validation | Zod | `^3.23` |
| Base et auth | Supabase (`@supabase/ssr`, `supabase-js`) | — |
| PDF | pdf-lib | `^1.17` |
| Tests | Vitest | `^2.1` |
| Hébergement | Vercel | — |

### 9.2 Arborescence

```
app/
  layout.tsx                    police, script anti-clignotement du thème
  page.tsx                      vitrine publique
  globals.css                   TOUS les tokens de couleur + styles d'impression
  (auth)/                       login, signup, onboarding, mot de passe, callback
  (app)/                        dashboard, invoices, quotes, clients, products,
                                payments, settings, support
  (app)/invoices/[id]/pdf/      génération du reçu 80 mm

components/
  ui/                           primitives du design system
  layout/                       sidebar, nav mobile, recherche, thème, badge de plan
  invoices/ clients/ products/ dashboard/ settings/ auth/ marketing/

lib/
  money.ts tax.ts dates.ts status.ts numbering.ts plan.ts payments.ts
  catalogue.ts invitations.ts members.ts appearance.ts        logique pure, testée
  domain/types.ts  schemas.ts   types + Zod, partagés client ET serveur
  domain/logo.ts                validation du logo
  barcode/code39.ts             code-barres du reçu
  pdf/receipt.ts                reçu 80 mm
  data/repository.ts            interfaces
  data/mock/                    implémentation en mémoire
  data/supabase/                implémentation réelle
  data/index.ts                 POINT DE BASCULE
  actions/                      Server Actions
  auth/session.ts               session + contrôle d'accès

supabase/migrations/            17 fichiers SQL — schéma, triggers, RLS, vues, RPC
scripts/                        check-design-system.mjs, check-contrast.mjs, check-env.mjs
tests/unit/                     18 fichiers, 272 tests
```

### 9.3 Règles d'architecture

- **ARC-1** — Les composants n'accèdent aux données **que** via `repositories` (`lib/data`). C'est ce
  qui a permis de passer du mock à Supabase sans toucher une seule page.
- **ARC-2** — Le **même schéma Zod** valide le formulaire et l'entrée serveur. Aucune Server Action
  ne lit son entrée sans passer par `lib/domain/schemas.ts` : la validation client n'est qu'un
  confort d'affichage, c'est la validation serveur qui protège les données.
- **ARC-3** — `orgId` est un **paramètre explicite** de chaque méthode de repository. Aucune méthode
  ne « devine » l'organisation courante.
- **ARC-4** — La logique pure (`money`, `tax`, `dates`, `status`, `numbering`, `plan`, `payments`,
  `catalogue`, `invitations`, `members`, `appearance`, `code39`, `logo`) ne connaît ni base ni
  interface : elle reçoit des valeurs, elle répond. C'est ce qui la rend testable sans navigateur.
- **ARC-5** — Ce qui **ne peut pas** être fait correctement en plusieurs requêtes depuis le client
  vit dans une fonction Postgres atomique : émission, avoir, conversion de devis, création
  d'organisation, acceptation d'invitation. Créer un avoir, c'est insérer un document puis copier ses
  lignes — en deux requêtes, un échec intermédiaire laisserait un avoir vide.
- **ARC-6** — `NEXT_PUBLIC_DATA_SOURCE` bascule entre `mock` (jeu de démonstration en mémoire, utile
  pour développer l'interface hors ligne) et `supabase`. **Variable absente = `supabase`** : une
  variable oubliée sur l'hébergeur doit faire échouer le démarrage, jamais servir des factures
  inventées.
- **ARC-7** — L'implémentation Supabase est `server-only` et chargée en **import différé** : la
  charger inconditionnellement casserait tout rendu sans requête et exigerait les variables Supabase
  même en mode mock.

### 9.4 Variables d'environnement

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publiable — incluse dans le bundle navigateur, c'est prévu : la RLS protège les données, pas le secret de cette clé |
| `SUPABASE_SERVICE_ROLE_KEY` | **Contourne la RLS.** Serveur uniquement |
| `NEXT_PUBLIC_DATA_SOURCE` | `supabase` (défaut) ou `mock` |

`npm run build` exécute `scripts/check-env.mjs` : un déploiement à variables incomplètes échoue au
build plutôt qu'à la première requête.

### 9.5 Modèle de données

**Tables** — `profiles`, `organizations`, `memberships`, `invitations`, `clients`, `products`,
`invoice_counters`, `invoices`, `invoice_items`, `payments`, `recurring_schedules`,
`recurring_runs`, `invoice_events`, `subscriptions`, `billing_events`.

**Énumérations** — `member_role` (owner, admin, member) · `document_type` (invoice, quote,
credit_note) · `invoice_status` (draft, sent, partially_paid, paid, cancelled) · `discount_type`
(amount, percent) · `payment_method` (cash, my_nita, amanata, wave, airtel_money, other) ·
`recurrence_frequency` (weekly, monthly, quarterly, yearly) · `invoice_event_type` (created, issued,
sent, viewed, payment_recorded, paid, cancelled, reminder_sent).

**Vues** (`security_invoker = on`) — `invoices_view` (ajoute `display_status`, `amount_due`,
`days_overdue`, `client_name`, `client_email` ; **jointure gauche** sur les clients, sans quoi une
vente au comptoir disparaîtrait de toute l'application) et `payments_view` (numéro de facture et nom
du client, pour que la recherche reste paginable en base).

**Fonctions** — `auth_org_ids`, `auth_has_role`, `next_document_number`, `issue_invoice`,
`create_credit_note`, `convert_quote_to_invoice`, `create_organization`, `accept_invitation`,
`get_public_invoice`, `dashboard_stats`, `monthly_totals`, `handle_new_user`.

**Triggers** — `touch_updated_at`, `compute_invoice_item_totals`, `refresh_invoice_totals`,
`enforce_invoice_immutability`, `enforce_invoice_items_immutability`,
`refresh_invoice_payment_state`, `enforce_payment_preconditions`, `protect_last_owner`,
`on_auth_user_created`.

**Contraintes structurantes** — `invoices_total_coherent` (total = HT + TVA) ·
`invoices_issued_has_number` (un brouillon n'a jamais de numéro ni de snapshot ; un document émis a
toujours les deux — l'état incohérent devient impossible à écrire) · `invoices_number_unique`
(org, type, numéro) · `invoices_due_after_issue` · `products_org_barcode_key` (index partiel :
unicité du code-barres par organisation, sur les articles actifs) · `payments.tendered >= amount` ·
`recurring_runs (schedule_id, period_start)` unique.

**Index critiques** — `memberships_user_id_idx` (interrogé à **chaque** évaluation de policy : sans
lui la RLS s'effondre dès quelques milliers de lignes) · `invoices_outstanding_due_idx` (la liste
« en retard », le filtre le plus consulté) · `invoices_public_token_idx`.

**Valeurs par défaut** — pays `Niger`, TVA `19`, délai `30 jours`, devise `XOF`, préfixes
`FAC` / `DEV` / `AV`, format de numéro `FAC-2026-0001`.

### 9.6 Migrations

Pas de Docker dans l'environnement de développement, donc pas de `supabase start` : les migrations
s'appliquent **sur le projet distant**.

```bash
PW=$(cat "$USERPROFILE/.supabase/db-password")
ENC=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$PW")
npx supabase db push --db-url "postgresql://postgres:${ENC}@db.<ref>.supabase.co:5432/postgres"
```

**L'hôte compte, et c'est le piège** — trois chemins existent, un seul fonctionne :

| Chemin | Résultat |
|---|---|
| `db.<ref>.supabase.co:5432` | **fonctionne** — connexion directe, mode session, PL/pgSQL accepté |
| `aws-1-<region>.pooler.supabase.com:5432` | authentification refusée (`28P01`), quel que soit le mot de passe |
| `aws-1-<region>.pooler.supabase.com:6543` | se connecte, mais mode transaction : refuse les fonctions PL/pgSQL |

C'est l'API de gestion qui renvoie l'hôte du pooler ; **ne pas s'y fier pour `db push`**. Une
demi-journée a été perdue à croire à une erreur de mot de passe alors que seul l'hôte était faux.

Règle : **un historique de migrations ne se réécrit pas, il s'allonge.** Retoucher un fichier déjà
appliqué ne change rien à la base réelle et fait diverger silencieusement une base neuve.

**Limite connue** — l'API de gestion Supabase renvoie **403 sur toute écriture** avec ce compte
(`GET /v1/organizations` renvoie `[]`, ce qui pointe vers un droit manquant sur l'organisation). Son
endpoint `/database/query` est en lecture seule : utile pour **vérifier** l'état après une migration,
jamais pour la modifier.

**Mot de passe de la base** : `~/.supabase/db-password`, hors dépôt, lisible par le seul compte de
l'utilisateur. Il n'est **pas** consultable depuis le tableau de bord Supabase — le perdre oblige à
le réinitialiser. L'application ne s'en sert jamais : elle passe entièrement par l'API REST avec les
clés `anon` et `service_role`.

---

## 10. Qualité et vérification

```bash
npm run dev           # serveur de développement
npm test              # tests unitaires + vérification du design system
npm run lint:design   # design system seul (12 règles)
npm run typecheck     # tsc --noEmit
npm run check:contrast
npm run build         # ⚠ arrêter `npm run dev` avant : les deux écrivent dans .next/
```

**État au 23 septembre 2026 : 272 tests dans 18 fichiers, tous au vert** ; typecheck propre ; design
system respecté.

| Domaine couvert | Fichier | Tests |
|---|---|---|
| Repositories : immuabilité, numérotation, encaissements, isolation | `mock-repository.test.ts` | 33 |
| Arrondis, formats, absence de zéro négatif | `money.test.ts` | 26 |
| Machine à états, `overdue` vs `expired` | `status.test.ts` | 24 |
| Encaissement, monnaie rendue, acompte | `payments.test.ts` | 20 |
| Arithmétique calendaire, fuseaux | `dates.test.ts` | 18 |
| TVA, remises, somme exacte des lignes | `tax.test.ts` | 16 |
| Code-barres Code 39 | `code39.test.ts` | 15 |
| Apparence | `appearance.test.ts` | 14 |
| Schémas Zod | `schemas.test.ts` | 13 |
| Quota et plans | `plan.test.ts` | 13 |
| Catalogue produits | `products.test.ts` | 13 |
| Numérotation | `numbering.test.ts` | 12 |
| Reçu PDF | `receipt-pdf.test.ts` | 12 |
| Codes d'invitation | `invitations.test.ts` | 11 |
| Logo | `logo.test.ts` | 10 |
| Comptes de caisse | `members.test.ts` | 10 |
| Ajout d'un article scanné | `catalogue.test.ts` | 7 |
| Schéma de connexion | `login-schema.test.ts` | 5 |

**Exigence de test manquante, et c'est la plus importante du projet : aucun test RLS n'est écrit.**
Il exige une base en ligne et deux utilisateurs d'organisations différentes (§11.2).

---

## 11. État d'avancement et reste à faire

### 11.1 Livré et en service

Interface complète, logique métier et Server Actions, **sur la base Supabase hébergée**
(`NEXT_PUBLIC_DATA_SOURCE=supabase`). Les 17 migrations sont appliquées et inscrites dans
`supabase_migrations.schema_migrations` — ce registre était absent (le schéma initial avait été posé
à la main) et a été reconstitué, de sorte que `db push` sait où il en est au lieu de vouloir tout
rejouer. Le mock reste disponible en repassant la variable à `mock`.

**Ordre impératif pour une nouvelle mise en service :** appliquer les migrations, **puis** créer un
compte, **puis** basculer la variable. La RLS refuse tout à un utilisateur anonyme — basculer sans
compte donnerait des écrans vides qu'on prendrait pour une panne de requête.

### 11.2 Reste à faire, par priorité

| Priorité | Sujet | Détail |
|---|---|---|
| **1** | **Tests RLS** | Le test le plus important du projet : vérifier qu'un utilisateur de l'organisation A ne lit ni n'écrit rien de B. Exige une base en ligne et deux comptes |
| **2** | **Encaissement de l'abonnement** | Le premium est affiché à 2 000 FCFA/mois et **rien ne permet de le payer**. Stripe n'est pas disponible pour des marchands de la zone : prévoir un adaptateur Mobile Money (PayDunya / CinetPay). Le schéma est déjà agnostique du fournisseur (`subscriptions.provider`, `billing_events` idempotents) |
| **3** | **Application réelle des limites premium** | La vitrine annonce devis, avoirs, catalogue, douchette et multi-utilisateurs comme premium ; **seul le quota de 5 factures est appliqué**. Décider : aligner le code sur la promesse, ou la promesse sur le code |
| **4** | **Liste des avoirs** | Un avoir se crée depuis une facture mais n'apparaît dans aucune liste — atteignable uniquement par URL directe |
| **5** | **Page publique de consultation** | `get_public_invoice()` et `getByPublicToken()` existent et sont sécurisés ; **aucune route ne les affiche**. C'est pourtant le lien qu'on envoie au client |
| **6** | **Envoi d'email** | Aucun service configuré : pas d'envoi de facture, pas de relance, pas d'invitation par email (d'où les codes, §4.10) |
| **7** | **Email des membres** | `listMembers` ne renvoie pas l'email : il vit dans `auth.users`, inaccessible depuis PostgREST. Il faudra le recopier dans `profiles` |
| **8** | **Récurrence** | Modèle, repositories et idempotence prêts ; ni interface, ni tâche planifiée |
| **9** | **Pagination dans l'UI** | La couche données la supporte ; les pages chargent de gros `pageSize`. À traiter avant qu'une boutique ne dépasse quelques centaines de documents |
| **10** | **Test d'intégration des deux calculs** | Comparer `lib/tax.ts` et `compute_invoice_item_totals` sur un même jeu de lignes, pour que RG-2 ne puisse pas diverger en silence |
| **11** | **Journal des événements** | `invoice_events` est alimenté et lisible ; son affichage dans le détail reste sommaire |

### 11.3 Incohérences à trancher

1. **Le nom du produit.** L'interface, la vitrine et le logo disent **MaMaFacture** ; le dépôt, le
   `package.json`, `CLAUDE.md` et `docs/design-system.md` disent **IziFacture**. Deux clés de
   stockage local cohabitent (`izifacture-theme`, `mamafacture-appearance`) et le domaine des comptes
   de caisse est `caisse.mamafacture.app`. **Choisir un nom, puis aligner** — en sachant que changer
   `DOMAINE_CAISSE` invaliderait les identifiants déjà distribués aux caissiers.
2. **Valeurs par défaut Sénégal → Niger.** Le défaut de colonne ne repasse pas sur l'existant, et
   c'est voulu : les organisations déjà inscrites gardent le pays et le taux qu'elles ont acceptés.
   Toute reprise de l'existant doit être une décision explicite, pas un effet de bord.

---

## 12. Contraintes, risques et décisions ouvertes

| # | Sujet | État |
|---|---|---|
| **R-1** | **Stripe inutilisable** pour des marchands d'Afrique de l'Ouest — bloque l'encaissement de l'abonnement. Adaptateur Mobile Money à choisir | ouvert |
| **R-2** | **Conformité OHADA** de l'immuabilité et de la numérotation : les règles implémentées (séquence sans trou, document figé, correction par avoir) suivent l'usage attendu, mais **aucune validation par un comptable OHADA n'a eu lieu** | ouvert |
| **R-3** | **Plancher Next.js 14.2.25** à tenir dans le temps (CVE-2025-29927) : toute montée de version doit rester au-dessus | surveillé |
| **R-4** | **Double implémentation du calcul** (TypeScript et PL/pgSQL) : c'est une protection et une dette. Toute évolution des règles d'arrondi se fait **des deux côtés** | ouvert (cf. §11.2, priorité 10) |
| **R-5** | **Aucune procédure de sauvegarde ni de restauration documentée** au-delà de ce que Supabase fournit par défaut | ouvert |
| **R-6** | **API de gestion Supabase en lecture seule** sur ce compte (403 sur toute écriture) : les migrations passent obligatoirement par `db push` en connexion directe | documenté |

---

## 13. Pièges déjà rencontrés — à ne pas refaire

Chacun a coûté un cycle de débogage.

| Piège | Symptôme | Parade |
|---|---|---|
| Deux graphes de modules serveur | Document créé puis 404 à la redirection | Next instancie séparément les modules des Server Components et ceux des Server Actions : l'état partagé du mock vit sur `globalThis` |
| Pages prérendues statiquement | Nouvelle facture invisible au tableau de bord | `getSession()` appelle `noStore()` |
| Token de couleur supprimé | Panneau transparent, contenu superposé | Une classe visant un token inexistant ne génère aucune CSS et n'échoue nulle part. Règle `unknown-color-token` |
| Jointure interne sur les clients | Une facture sans client disparaissait de toute l'application, encaissements compris | `invoices_view` en `left join` (migration `20260911090000`) |
| Chaîne vide au lieu de `null` | Deuxième produit sans code-barres refusé par l'index unique | La conversion `"" → null` vient **après** la validation, pas dans un `.or()` |
| Colonne ajoutée sans reprendre la vue | `tendered` renvoyé `null` par la liste — un champ faux, plus dur à débusquer qu'un champ absent | Les vues énumèrent leurs colonnes : toute colonne ajoutée doit y être reportée |
| `create or replace view` | Refus de réordonner les colonnes | N'autorise l'ajout qu'**en fin** de liste ; un `drop … cascade` coûte les droits à reposer |
| Type d'enum modifié sous une vue | Postgres refuse de changer la colonne | Supprimer la vue, convertir, la reposer **dans la même transaction**, et rétablir les droits |
| Impression de l'écran | Facture sur 3 pages, sans en-tête | Imprimer un **document** dédié, interface en `print:hidden` — puis, mieux : PDF serveur (EF-8.2) |
| `.next` corrompu | `Cannot find module './vendor-chunks/…'` | `next build` lancé pendant que `next dev` tourne. Arrêter, supprimer `.next`, relancer |
| Import ajouté après l'usage | `ReferenceError` au rendu | Le rechargement à chaud sert la page entre deux éditions : **import et usage dans la même édition** |
| Fermeture de menu dans un `onClick` | Le tiroir mobile reste ouvert après navigation | Next enveloppe la navigation dans une transition React qui happe le `setState` : réagir au **changement d'URL** |

---

## 14. Méthode de travail attendue

- **Livrer par petits lots.** Annoncer, faire une tranche, montrer, attendre.
- **Vérifier avant d'affirmer.** Une route de diagnostic temporaire coûte moins cher qu'une
  hypothèse fausse.
- **Tester le vrai trajet**, pas un raccourci : un Route Handler n'aurait pas révélé le bug des deux
  graphes de modules, seul le parcours action → page l'a montré.
- Quand un test échoue, **corriger le code, pas le test** — sauf si la spécification a changé, et le
  dire alors explicitement.
- Signaler les défauts trouvés en chemin, même hors de la demande.
- **Avant d'écrire du JSX ou du CSS**, lire `docs/design-system.md`. **Avant de toucher à un
  montant**, lire `lib/money.ts`.
- **Ce qui se discute** : le design, les libellés, l'ergonomie — tout. **Ce qui ne se discute pas
  sans décision explicite du propriétaire** : les règles du §5. Elles protègent la justesse
  comptable, et plusieurs ont déjà été rediscutées puis confirmées.

---

## 15. Glossaire

| Terme | Sens dans ce document |
|---|---|
| **Organisation** | La boutique ou l'entreprise. Unique axe d'isolation des données |
| **Document** | Facture, devis ou avoir — trois types, une même table |
| **Émission** | Passage du brouillon à l'envoyé : attribution du numéro, gel du snapshot, horodatage serveur |
| **Snapshot** | Copie figée de l'entreprise et du client au moment de l'émission |
| **Avoir** | Document de correction rattaché à une facture émise. Seul moyen de corriger un document figé |
| **Unité mineure** | Plus petite unité de la devise. En franc CFA : le franc lui-même (aucune décimale) |
| **Vente au comptoir** | Facture sans client nommé |
| **Tendu** (`tendered`) | Ce que le client a remis en espèces. La monnaie rendue vaut `tendered − amount` et n'est pas stockée |
| **Acompte** | Encaissement inférieur au total. Cas normal, pas une erreur de saisie |
| **Quota** | Nombre de factures émises autorisées par mois calendaire sur le plan gratuit |
| **RLS** | Row Level Security Postgres — la couche de sécurité qui compte réellement |
| **Compte de caisse** | Compte créé par le responsable pour un employé, sans adresse email |
| **Douchette** | Lecteur de code-barres USB, qui se comporte comme un clavier |

---

*Ce cahier des charges décrit l'état réel au 23 septembre 2026. Les sections §11 et §12 sont les
seules à porter sur du non-livré : elles sont à relire avant tout engagement commercial.*
