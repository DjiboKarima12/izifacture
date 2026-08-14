# IziFacture — dossier de reprise

Document de référence pour tout modèle d'IA ou développeur qui reprend ce projet.
Il décrit **ce qui existe réellement**, pas ce qui était prévu.

Dernière mise à jour : 12 août 2026.

---

## 1. Ce que fait l'application

SaaS de facturation pour **entrepreneurs africains francophones**. Interface entièrement en
français, montants en **franc CFA**.

L'utilisateur type est un indépendant ou une petite structure à Niamey, Dakar ou Abidjan, qui
facture aujourd'hui dans Word ou Excel. Il travaille souvent **depuis un téléphone**, sur une
connexion lente, et encaisse majoritairement en **espèces ou Mobile Money** — pas par carte.

Ces trois faits gouvernent la plupart des décisions techniques du projet.

### Le cycle couvert

```
Client → Devis → (accepté) → Facture → Encaissements → Soldée
                                  ↓
                            Avoir (correction)
```

---

## 2. Fonctionnalités implémentées

### Tableau de bord — `/dashboard`
- 4 indicateurs : Total encaissé, Factures en attente, En retard (en rouge), Nouveaux clients
- Variation mensuelle calculée sur les données réelles, pas figée
- 5 dernières factures, client + email empilés
- Graphique 12 mois facturé / encaissé, avec repli en tableau de données

### Factures — `/invoices`
- Liste filtrable par statut (tous, brouillon, envoyée, partiellement payée, en retard, payée)
- Recherche par numéro ou client, lignes cliquables
- **Création** `/invoices/new` : formulaire à lignes dynamiques (ajout, duplication, suppression),
  TVA et totaux recalculés à chaque frappe, **aperçu du document en direct**
- Confirmation avant création, rappelant le numéro attribué et le montant total
- Modale après création : télécharger ou revenir à la liste
- **Détail** `/invoices/[id]` : lignes, totaux, client, encaissements, historique
- **Modification** `/invoices/[id]/edit` : brouillons uniquement ; un document émis redirige vers son détail
- Menu « Changer statut » avec les transitions légitimes uniquement
- Impression / téléchargement PDF via la boîte d'impression du navigateur

### Devis — `/quotes`
- Vocabulaire distinct : Envoyé, **Expiré** (jamais « en retard »), Refusé, Accepté
- Colonne « Valable jusqu'au » et non « Échéance »
- Action « Accepter et facturer » : crée une facture depuis les lignes, les deux documents coexistent

### Clients — `/clients`
- Liste avec chiffre d'affaires par client, recherche
- Création et modification par formulaire modal
- **Fiche** `/clients/[id]` : coordonnées, encours (facturé / encaissé / reste dû), tous ses documents
- Suppression = **archivage** (un client facturé ne peut pas disparaître), réactivable

### Encaissements — `/payments`
- 5 filtres combinables : recherche (facture, client, référence), moyen, période, fourchette de montant
- Le total du bandeau suit les filtres
- Enregistrement d'un règlement : montant modifiable (partiel), moyen (**espèces par défaut**),
  date, référence
- Suppression d'un encaissement saisi par erreur, avec recalcul du statut

### Paramètres — `/settings`
- 4 onglets dans l'URL (`?tab=`) : Profil, Régional & Devise, Modèles de facturation, Équipe & Accès
- Enregistrement fonctionnel, bouton en en-tête, modale de confirmation
- Équipe : membres affichés ; les invitations attendent l'authentification

### Transverse
- Mode sombre avec palette propre (pas une inversion), sans clignotement au chargement
- Navigation mobile en tiroir, identique au desktop
- Recherche contextuelle selon la page
- `prefers-reduced-motion` respecté

---

## 3. Technologies

| Couche | Choix | Version |
|---|---|---|
| Framework | Next.js App Router | `^14.2.25` (plancher imposé, cf. §6) |
| Langage | TypeScript `strict` + `noUncheckedIndexedAccess` | `^5.5` |
| UI | Tailwind CSS 3 + Radix UI (dialog, dropdown, select, slot) | — |
| Icônes | lucide-react | `^0.446` |
| Validation | Zod | `^3.23` |
| Base (prévu) | Supabase — `@supabase/ssr` + `supabase-js` | installés, **non branchés** |
| Tests | Vitest | 132 tests |

**Aucune librairie de graphique** : le graphique est du SVG écrit à la main. Recharts aurait pesé
~100 ko pour deux séries de barres.

---

## 4. Structure des fichiers

```
app/
  layout.tsx                    racine : police, script anti-clignotement du thème
  page.tsx                      redirige vers /dashboard
  globals.css                   TOUS les tokens de couleur + styles d'impression
  (app)/
    layout.tsx                  sidebar + barre supérieure ; garde d'auth à venir
    dashboard/ invoices/ quotes/ clients/ payments/ settings/ support/

components/
  ui/                           primitives du design system (11 fichiers)
  layout/                       sidebar, nav mobile, recherche, thème
  invoices/ clients/ dashboard/ settings/   composants métier

lib/
  money.ts                      arithmétique monétaire — AUCUN flottant
  tax.ts                        calcul des lignes et totaux
  dates.ts  status.ts  numbering.ts
  domain/types.ts  schemas.ts   types + Zod, partagés client et serveur
  data/repository.ts            interfaces d'accès aux données
  data/mock/                    implémentation en mémoire
  data/index.ts                 POINT DE BASCULE vers Supabase
  actions/                      Server Actions (invoices, clients, payments, organization)
  auth/session.ts               session provisoire ; `noStore()` y est appelé

supabase/migrations/            4 fichiers SQL — ÉCRITS, JAMAIS EXÉCUTÉS
scripts/check-design-system.mjs vérificateur exécutable du design system
docs/design-system.md           spécification complète
tests/unit/                     132 tests
```

### Répartition des tests

| Fichier | Tests | Ce qu'il protège |
|---|---|---|
| `mock-repository.test.ts` | 28 | Immuabilité, numérotation, encaissements, isolation |
| `money.test.ts` | 26 | Arrondis, formats, absence de zéro négatif |
| `status.test.ts` | 24 | Machine à états, `overdue` vs `expired` |
| `dates.test.ts` | 18 | Arithmétique calendaire, fuseaux |
| `tax.test.ts` | 16 | TVA, remises, somme exacte des lignes |
| `numbering.test.ts` | 12 | Format et séquence des numéros |
| `schemas.test.ts` | 8 | Charges exactes envoyées par les formulaires |

---

## 5. Décisions de design

Le design system est décrit en entier dans **`docs/design-system.md`** et **appliqué
mécaniquement** par `npm run lint:design` (12 règles).

Les points structurants :

- **Aucune couleur en dur.** Un composant ne connaît que des rôles (`bg-card`,
  `text-muted-foreground`). Les valeurs vivent dans `app/globals.css`.
- **Aucune variante `dark:` dans un composant.** Le mode sombre redéfinit les tokens dans `.dark`.
  Un composant s'écrit une seule fois.
- **Bordures 1 px, deux ombres, une échelle de rayons** dérivée de `--radius`.
- **Trois animations**, 180 ms. Aucune animation d'entrée sur du contenu de page.
- **Nombres à droite avec `tabular`**, texte à gauche. Une seule action `primary` par écran.
- **La couleur ne porte jamais seule une information** : une pastille de statut écrit son libellé.
- **Couleurs de graphique validées**, pas choisies à l'œil : ΔE 31,5 en protanopie, 36,6 en vision
  normale. Le mode sombre a son **propre** couple, revalidé contre le fond sombre. Ne pas les
  changer sans relancer le validateur.

---

## 6. Règles métier — l'application gère l'argent de vrais gens

Ces règles ne sont pas des préférences. Les enfreindre produit des bugs comptables.

1. **Aucun flottant sur un montant.** Entiers en unités mineures ; le franc CFA n'a pas de décimale,
   donc 1 unité = 1 franc. Tout passe par `lib/money.ts`. `toFixed()` est refusé par le vérificateur.
2. **Arrondi par ligne**, moitié à l'écart de zéro. Les totaux sont la somme exacte des lignes — pas
   d'écart d'un franc entre ce qui est affiché et ce qui est additionné.
3. **Le serveur recalcule toujours les totaux.** Ceux transmis par le client sont ignorés.
4. **Un document émis est figé.** Correction par **avoir** uniquement. Un brouillon se modifie
   librement.
5. **Le numéro est attribué à la création définitive**, jamais au brouillon : la séquence reste sans
   trou. Un brouillon abandonné ne consomme aucun numéro.
6. **`overdue` n'est jamais stocké** — il se dérive de `status` + `due_date`. Aucune tâche planifiée
   n'est nécessaire. Sur un **devis**, la même date signifie « fin de validité » : il devient
   `expired`, jamais « en retard ».
7. **Le statut de paiement ne s'écrit pas à la main** : il se déduit de la somme des encaissements.
8. **Un document émis porte un snapshot figé** de l'entreprise et du client. Modifier ses coordonnées
   ne change pas une facture déjà envoyée — c'est ce que le client a reçu.
9. **L'autorisation ne vit pas dans le middleware** (CVE-2025-29927 : un en-tête forgé le
   contournait). Middleware = rafraîchissement de session. Isolation = **RLS Postgres**.
10. **Multi-tenant par organisation.** Toute table porte `org_id`, toute requête le borne.

---

## 7. Pièges déjà rencontrés — à ne pas refaire

Chacun a coûté un cycle de débogage. Ils sont listés pour ne pas être répétés.

| Piège | Symptôme | Cause et parade |
|---|---|---|
| **Deux graphes de modules serveur** | Document créé puis 404 à la redirection | Next instancie séparément les modules des Server Components et ceux des Server Actions. L'état partagé DOIT vivre sur `globalThis` — voir `lib/data/mock/seed.ts`. |
| **Pages prérendues statiquement** | Nouvelle facture invisible au tableau de bord | Rien ne signalait à Next que les données changent. `getSession()` appelle `noStore()`. |
| **Token de couleur supprimé** | Panneau transparent, contenu superposé | Une classe visant un token inexistant ne génère aucune CSS et n'échoue nulle part. La règle `unknown-color-token` du vérificateur l'attrape désormais. |
| **Import ajouté après l'usage** | `ReferenceError` au rendu | Le rechargement à chaud a servi la page entre les deux éditions. **Import et usage dans la même édition.** |
| **`.next` corrompu** | `Cannot find module './vendor-chunks/...'` | `next build` lancé pendant que `next dev` tourne. Arrêter le serveur, `rm -rf .next`, relancer. |
| **Fermeture de menu dans un `onClick`** | Le tiroir mobile reste ouvert après navigation | Next enveloppe la navigation dans une transition React qui happe le `setState`. Réagir au **changement d'URL**. |
| **Impression de l'écran** | Facture sur 3 pages, sans en-tête | On imprimait l'interface. Imprimer un **document** dédié (`InvoicePreview`), l'interface en `print:hidden`. |

---

## 8. État réel du projet

**Fonctionne, en mode `mock`** — toute l'interface, la logique métier, les Server Actions, sur des
**données en mémoire**. 132 tests, typecheck propre, design system respecté.

**Écrit mais JAMAIS exécuté contre une vraie base :**
- Les **5 migrations SQL**. L'environnement de développement n'a ni Docker, ni Supabase CLI, ni
  psql, et le MCP Supabase n'était pas exposé à la session. Attendez-vous à corriger des erreurs au
  premier passage.
- **`lib/data/supabase/`** — l'implémentation Supabase des repositories. Elle compile ; aucune de
  ses requêtes n'a jamais atteint un serveur.
- **L'authentification** — `/login`, `/signup`, `/onboarding`, le callback email, la déconnexion.
- Le **middleware** de rafraîchissement de session.

La bascule se fait par `NEXT_PUBLIC_DATA_SOURCE=supabase` dans `.env.local` (voir `.env.example`).
Tant qu'elle vaut `mock`, rien de tout cela n'est actif et l'application tourne comme avant.

**Ordre impératif à la mise en service :** exécuter les migrations, PUIS créer un compte, PUIS
basculer la variable. La **RLS refuse tout à un utilisateur anonyme** — basculer sans compte
donnerait des écrans vides qu'on prendrait pour un bug de requête.

**Ne fonctionne pas encore :**
- Pas d'envoi d'email, pas de génération PDF côté serveur, pas de récurrence, pas d'abonnement SaaS.
- Impossible de créer un devis depuis l'interface (l'éditeur ne produit que des factures).
- Les avoirs ne sont listés nulle part — atteignables seulement par URL directe.
- `listMembers` ne renvoie pas l'email des membres : il vit dans `auth.users`, inaccessible depuis
  PostgREST. Il faudra le recopier dans `profiles`.
- Aucun test RLS écrit — c'est le test le plus important du projet, et il exige une base en ligne.

---

## 9. Instructions pour un futur modèle IA

**Avant d'écrire du JSX ou du CSS**, lire `docs/design-system.md`. Le vérificateur refusera le code
non conforme, et une règle contournée est une régression silencieuse.

**Avant de toucher à un montant**, lire `lib/money.ts`. Ne jamais introduire de flottant, de
`toFixed()`, ni de calcul monétaire hors de `lib/money.ts` et `lib/tax.ts`.

**Vérifier après chaque lot :**
```bash
npm run typecheck
npm test              # inclut lint:design
npm run build         # ⚠ arrêter `npm run dev` avant : les deux écrivent dans .next/
```

**Méthode :**
- Livrer par **petits lots**. Le propriétaire du projet a interrompu un tour qui touchait une
  dizaine de fichiers. Annoncer, faire une tranche, montrer, attendre.
- **Vérifier avant d'affirmer.** Plusieurs bugs de cette session venaient d'une conclusion tirée
  sans preuve. Une route de diagnostic temporaire coûte moins cher qu'une hypothèse fausse.
- **Tester le vrai trajet**, pas un raccourci. Un Route Handler n'a pas révélé le bug des deux
  graphes de modules ; seul le parcours action → page l'aurait montré.
- Quand un test échoue, **corriger le code, pas le test** — sauf si la spécification a changé,
  et le dire alors explicitement.
- Signaler les défauts trouvés en chemin même s'ils sortent de la demande.

**Ce qui se discute et ce qui ne se discute pas.** Le design, les libellés, l'ergonomie : tout est
ouvert. Les règles de la section 6 ne le sont pas sans décision explicite du propriétaire — elles
protègent la justesse comptable, et plusieurs ont déjà été rediscutées puis confirmées.

**Prochaine étape logique :** exécuter les migrations Supabase et basculer `lib/data/index.ts` du
mock vers l'implémentation Supabase. L'interface `Repositories` est le contrat ; **aucun composant
ne doit changer**. C'est précisément ce que cette architecture rend possible.
