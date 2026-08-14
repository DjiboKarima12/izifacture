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
   `transition-colors` pour les états. Aucune animation d'entrée sur du contenu de page.
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

Étapes 1–3 faites. Le schéma est appliqué sur le projet Supabase hébergé (13 tables, 19 fonctions,
13 triggers, 2 vues, RLS et 28 politiques), et `NEXT_PUBLIC_DATA_SOURCE=supabase` : l'application
lit la vraie base. Le mock reste disponible en repassant la variable à `mock`.

Pas de Docker ici, donc pas de `supabase start` : la base locale n'existe pas et les migrations
s'appliquent sur le projet distant. La CLI Supabase est installée (`npx supabase`), mais elle n'est
ni authentifiée ni liée — `db push` demande une chaîne de connexion en port **5432** (mode session ;
le 6543 est en mode transaction et refuse les fonctions PL/pgSQL).

**À faire :** la migration `20260813180000_restrict_anon_execute.sql` n'est pas encore passée. Sans
elle, `next_document_number` reste appelable sans authentification et permet de creuser des trous
dans la numérotation (cf. règle métier 4).
