# IziFacture

SaaS de facturation pour entrepreneurs africains francophones. Next.js 14 (App Router) · Supabase · Tailwind · Vercel.

Plan d'implémentation complet : `C:\Users\ThinkPad T14\.claude\plans\tu-es-un-architecte-floofy-boot.md`

## État d'avancement

| Étape | État |
|---|---|
| 1 — UI complète d'après les captures | **en attente des captures d'écran** |
| 2 — Logique métier + données locales | fait (logique, types, repositories mock) — reste le formulaire et les pages |
| 3 — Supabase : schéma, RLS | migrations écrites, **non exécutées** (voir ci-dessous) |
| 4 → 6 — Auth, landing, passe finale | à venir |

## Commandes

```bash
npm run dev         # serveur de développement
npm run test        # 114 tests unitaires (logique métier + repositories mock)
npm run typecheck   # tsc --noEmit
npm run build       # build de production
```

## Ce qui est vérifié, et ce qui ne l'est pas

**Vérifié** — `npm run test` (114 tests), `npm run typecheck` et `npm run build` passent.

**Non vérifié** — les migrations SQL de `supabase/migrations/` n'ont **jamais été exécutées** : cet
environnement n'a ni Supabase CLI, ni Docker, ni psql. Elles sont écrites mais non testées. Première
chose à faire à l'étape 3 :

```bash
npm i -g supabase   # ou scoop/brew
supabase init       # génère config.toml (absent volontairement)
supabase start      # nécessite Docker Desktop
supabase db reset   # applique les migrations
```

## Règles non négociables du projet

1. **Aucun flottant sur un montant.** Tous les montants sont des entiers en unités mineures ; le franc
   CFA n'a pas de décimale, donc 1 unité = 1 franc. Tout passe par `lib/money.ts`.
2. **Le serveur recalcule toujours les totaux.** Les montants envoyés par le client sont ignorés —
   côté application (`lib/tax.ts`) comme côté base (trigger `compute_invoice_item_totals`).
3. **Un document émis est figé.** Correction par avoir uniquement. Garanti par
   `enforce_invoice_immutability` en base, pas seulement par l'interface.
4. **Le numéro est attribué à l'émission**, jamais à la création du brouillon : la séquence reste sans trou.
5. **`overdue` n'est jamais stocké**, il se dérive de `status` + `due_date`.
6. **L'autorisation ne vit pas dans le middleware.** Il ne fait que rafraîchir la session
   (cf. CVE-2025-29927). L'isolation entre organisations est assurée par la RLS Postgres.

## Structure

```
lib/money.ts  tax.ts  dates.ts  status.ts  numbering.ts   logique pure, 100% testée
lib/domain/types.ts  schemas.ts                           types + Zod (client ET serveur)
lib/data/repository.ts                                    interfaces
lib/data/mock/                                            implémentation en mémoire (étape 2)
lib/data/index.ts                                         point de bascule vers Supabase (étape 3)
supabase/migrations/                                      schéma, triggers, RLS, vues
tests/unit/                                               114 tests
```

Le pattern repository est ce qui permet à l'étape 3 de ne toucher **aucun composant d'interface** :
seul `lib/data/index.ts` change.
