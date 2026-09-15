# IziFacture

SaaS de facturation pour entrepreneurs africains francophones.
Next.js 14 (App Router) · Supabase · Tailwind · Vercel. Interface **en français**, montants en **FCFA**.

---

## Design system — obligatoire

**Toute page ou composant créé suit [`docs/design-system.md`](docs/design-system.md).**
Lire ce document avant d'écrire du JSX ou du CSS. La règle est vérifiée mécaniquement :

```bash
npm run lint:design     # échoue si un composant contourne le système
```

Les huit règles qu'on enfreint le plus souvent, à connaître sans ouvrir le document :

1. **Aucune couleur en dur.** Jamais de `#hex`, `rgb()`, ni de palette Tailwind par défaut
   (`bg-gray-100`, `text-blue-600`). Uniquement des tokens sémantiques : `bg-card`,
   `text-muted-foreground`, `border-border`, `text-destructive`.
2. **Jamais de variante `dark:` dans un composant.** Le mode sombre s'obtient en redéfinissant les
   tokens dans `.dark` (`app/globals.css`). Un composant s'écrit une seule fois.
3. **Bordures : 1 px, toujours.** `border-border` pour la structure, `border-input` pour les champs.
   Aucune bordure ne prend une couleur de marque ou de statut.
4. **Rayons** : `rounded-xl` cartes · `rounded-lg` boutons et champs · `rounded-md` pastilles, icônes
   et éléments de nav · `rounded-full` avatars. `rounded` nu et `rounded-2xl` sont refusés.
5. **Ombres** : `shadow-card` (au repos) ou `shadow-raised` (flottant). Rien d'autre.
6. **Animations** : `animate-fade-in` / `animate-overlay-in` (180 ms) pour les surfaces flottantes,
   `transition-colors` pour les états, `animate-rise-in` (240 ms) pour l'entrée du contenu au
   chargement — au tableau de bord seulement, jamais sur un écran de saisie. La **vitrine publique**
   fait exception et admet la boucle (cf. §2 du design system).
7. **Focus visible obligatoire** sur tout élément atteignable au clavier
   (`focus-visible:ring-2 focus-visible:ring-ring`).
8. **Nombres à droite avec `tabular`**, texte à gauche. Une seule action `primary` par écran.

Réutiliser les composants de `components/ui/` — ne pas réécrire une carte, un tableau ou un bouton
à la main dans une page.

---

## Règles métier — l'application gère l'argent de vrais utilisateurs

1. **Aucun flottant sur un montant.** Tous les montants sont des **entiers** en unités mineures ; le
   franc CFA n'a pas de décimale, donc 1 unité = 1 franc. Tout passe par `lib/money.ts`.
   `toFixed()` est interdit et refusé par le vérificateur.
2. **Le serveur recalcule toujours les totaux.** Les montants envoyés par le client sont ignorés —
   côté application (`lib/tax.ts`) comme côté base (trigger `compute_invoice_item_totals`). Ces deux
   implémentations doivent rester synchronisées.
3. **Un document émis est figé.** Un brouillon se modifie ; une facture envoyée ne se modifie plus.
   Correction par **avoir** uniquement. Garanti en base par `enforce_invoice_immutability`.
4. **Le numéro est attribué à l'émission**, jamais à la création du brouillon : la séquence reste
   sans trou. Généré par `next_document_number()` sous verrou de ligne.
5. **`overdue` n'est jamais stocké** — il se dérive de `status` + `due_date`. Aucune tâche planifiée
   n'est nécessaire pour qu'une facture en retard s'affiche comme telle.
6. **L'autorisation ne vit pas dans le middleware** (cf. CVE-2025-29927 : un en-tête forgé le
   contournait). Le middleware rafraîchit la session ; l'isolation entre organisations est assurée
   par la **RLS Postgres**, et le contrôle d'accès par les layouts serveur et les Server Actions.
7. **Multi-tenant par organisation.** Toute table métier porte `org_id`, toute requête le borne
   explicitement.

---

## Architecture

```
lib/money.ts  tax.ts  dates.ts  status.ts  numbering.ts   logique pure, 100% testée
lib/domain/types.ts  schemas.ts                           types + Zod (client ET serveur)
lib/data/repository.ts                                    interfaces
lib/data/mock/                                            implémentation en mémoire
lib/data/index.ts                                         point de bascule vers Supabase
components/ui/  components/layout/                        primitives du design system
supabase/migrations/                                      schéma, triggers, RLS, vues
```

Les composants n'accèdent aux données que via `repositories` (`lib/data`), jamais directement. C'est
ce qui permet de passer du mock à Supabase sans toucher une seule page.

Le même schéma Zod valide le formulaire **et** l'entrée serveur. Aucune Server Action ne lit son
entrée sans passer par `lib/domain/schemas.ts`.

---

## Commandes

```bash
npm run dev           # serveur de développement
npm test              # tests unitaires + vérification du design system
npm run lint:design   # design system seul
npm run typecheck
npm run build         # ⚠ arrêter `npm run dev` avant : les deux écrivent dans .next/
```

## État

Étapes 1–3 faites. Le schéma est appliqué sur le projet Supabase hébergé et `NEXT_PUBLIC_DATA_SOURCE=supabase` :
l'application lit la vraie base. Le mock reste disponible en repassant la variable à `mock`.

Toutes les migrations du dépôt sont appliquées et inscrites dans
`supabase_migrations.schema_migrations`. Ce registre était absent — le schéma initial avait été posé
à la main — et a été reconstitué : `db push` sait donc où il en est au lieu de vouloir tout rejouer.

### Appliquer une migration

Pas de Docker ici, donc pas de `supabase start` : la base locale n'existe pas, les migrations
s'appliquent sur le projet distant.

```bash
PW=$(cat "$USERPROFILE/.supabase/db-password")
ENC=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$PW")
npx supabase db push --db-url "postgresql://postgres:${ENC}@db.<ref>.supabase.co:5432/postgres"
```

**L'hôte compte, et c'est le piège.** Trois chemins existent, un seul fonctionne :

| Chemin | Résultat |
|---|---|
| `db.<ref>.supabase.co:5432` | **fonctionne** — connexion directe, mode session, PL/pgSQL accepté |
| `aws-1-<region>.pooler.supabase.com:5432` | authentification refusée (`28P01`), quel que soit le mot de passe |
| `aws-1-<region>.pooler.supabase.com:6543` | se connecte, mais mode transaction : refuse les fonctions PL/pgSQL |

C'est l'API de gestion qui renvoie l'hôte du pooler ; ne pas s'y fier pour `db push`. Une demi-journée
a été perdue à croire à une erreur de mot de passe alors que seul l'hôte était faux.

Le mot de passe vit dans `~/.supabase/db-password`, hors du dépôt, lisible par le seul compte de
l'utilisateur. Il n'est **pas** consultable depuis le tableau de bord Supabase : le perdre oblige à
le réinitialiser. L'application, elle, ne s'en sert jamais — elle passe entièrement par l'API REST
avec les clés `anon` et `service_role`.

### Ce qui reste fermé

L'API de gestion (`POST /v1/projects/{ref}/database/migrations`) renverrait la version appliquée
*et* inscrite, mais **toute écriture y renvoie 403** sur ce compte, jeton de compte neuf compris.
`GET /v1/organizations` renvoie `[]`, ce qui pointe vers un droit manquant sur l'organisation.
Son endpoint `/database/query` est en lecture seule : utile pour **vérifier** l'état de la base
après une migration, jamais pour la modifier.
