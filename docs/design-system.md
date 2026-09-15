# Design system IziFacture

Extrait du dashboard. **Toute page ou composant créé après ce document s'y conforme.**

La règle est vérifiée mécaniquement : `npm run lint:design` échoue si un composant contourne le
système. Ce document explique le *pourquoi* ; le script applique le *quoi*.

---

## 0. Le principe qui tient tout le reste

**Un composant ne connaît aucune couleur.** Il ne connaît que des rôles : `bg-card`,
`text-muted-foreground`, `border-border`. Les valeurs concrètes vivent dans un seul fichier,
[`app/globals.css`](../app/globals.css).

Conséquences directes, et c'est ce qui rend le système utile plutôt que décoratif :

- changer la direction artistique = éditer un fichier, jamais 40 composants ;
- le mode sombre s'obtient en redéfinissant les tokens dans `.dark`, **jamais** avec des variantes
  `dark:` dans les composants — un composant s'écrit une fois et fonctionne dans les deux thèmes ;
- une couleur inaccessible se corrige à la source, pour toute l'application d'un coup.

---

## 1. Les éléments

### Hiérarchie des surfaces

| Rôle | Token | Usage |
|---|---|---|
| Fond de page | `bg-surface` | La zone de contenu. Gris très clair — c'est lui qui fait ressortir les cartes. |
| Fond de carte | `bg-card` | Blanc. Tout bloc de contenu. |
| Sidebar / barres | `bg-background` | Blanc, séparé du contenu par une bordure. |
| Fond secondaire | `bg-secondary` | Élément de nav actif, pastilles de rôle. |
| Fond appuyé | `bg-surface-strong` | Piste d'interrupteur, fonds de contrôles inertes. |
| Fond d'accent | `bg-accent` | Tuiles d'icônes, avatars, encarts d'information. |

### Inventaire des composants

Aucun de ces éléments ne se réécrit à la main dans une page — on importe le composant.

| Composant | Fichier | Anatomie figée |
|---|---|---|
| `Card` | `components/ui/card.tsx` | `rounded-xl border border-border bg-card shadow-card` |
| `Button` | `components/ui/button.tsx` | `rounded-lg`, hauteurs `h-9 / h-10 / h-12`, anneau de focus obligatoire |
| `Input`, `Textarea` | `components/ui/input.tsx` | `h-10 rounded-lg border border-input` |
| `FloatingField` | `components/ui/input.tsx` | Libellé encoché dans la bordure — le motif des formulaires |
| `Field` | `components/ui/input.tsx` | Libellé au-dessus — écrans de paramètres |
| `Select` | `components/ui/select.tsx` | Radix, `rounded-lg`, contenu en `animate-fade-in` |
| `Table` | `components/ui/table.tsx` | Défilement horizontal intégré |
| `StatusBadge` | `components/ui/status-badge.tsx` | `rounded-md px-2 py-0.5 text-xs`, libellé toujours écrit |
| `StatCard` | `components/dashboard/stat-card.tsx` | Libellé · icône encadrée · chiffre héros · contexte |
| `Switch` | `components/ui/switch.tsx` | `role="switch"` + `aria-checked` |
| `Segmented` | `components/ui/segmented.tsx` | `role="radiogroup"`, navigation aux flèches |
| `EmptyState` | `components/ui/empty-state.tsx` | Icône · titre · explication · **action suivante** |
| `PageHeader` | `components/ui/page-header.tsx` | Titre + description à gauche, actions à droite |
| `PageShell` | `components/layout/page-shell.tsx` | Gouttières et largeur maximale de page |

### Anatomie de la carte de statistique

C'est le motif de référence du dashboard, à reproduire pour toute tuile chiffrée :

```
┌──────────────────────────────────┐
│ Libellé (sm, muted)      [icône] │  ← flex items-start justify-between
│                                  │
│ 4 500 000 F CFA                  │  ← text-2xl font-bold tabular, mt-4
│ +20,1 % vs mois dernier          │  ← text-xs muted, mt-1.5
└──────────────────────────────────┘
```

L'icône est **encadrée, jamais colorée** : `size-8 rounded-md border border-border
text-muted-foreground`. Elle situe, elle n'alerte pas. C'est la **valeur** qui prend
`text-destructive` quand le chiffre est mauvais (montant en retard), pas son décor.

### Typographie

| Niveau | Classes | Usage |
|---|---|---|
| Titre de page | `text-xl font-bold tracking-tight` | Un seul `h1` par page |
| Titre de carte | `text-base font-semibold` | `h2` |
| Chiffre héros | `text-2xl font-bold tracking-tight tabular` | Valeur de KPI |
| Corps | `text-sm` | Libellés, cellules |
| Secondaire | `text-xs text-muted-foreground` | Contexte, en-têtes de tableau |
| Étiquette de groupe | `text-[0.65rem] font-semibold uppercase tracking-wider` | MENU, UTILITAIRES |

**`tabular` est obligatoire sur tout nombre** (classe utilitaire de `globals.css`). Sans elle, les
chiffres d'une colonne de montants ne s'alignent pas verticalement et la colonne devient illisible.

---

## 2. Les animations

Trois mouvements, pas un de plus.

| Animation | Durée | Usage |
|---|---|---|
| `animate-fade-in` | 180 ms `ease-out` | Apparition de surface flottante : menu, select, dialogue, infobulle. Opacité + 4 px de translation verticale. |
| `animate-overlay-in` | 180 ms `ease-out` | Voile derrière un dialogue. Opacité seule. |
| `transition-colors` | défaut (150 ms) | **Tout** changement d'état au survol ou au focus. |

| `animate-rise-in` | 240 ms `ease-out` | Entrée du contenu au chargement d'une page. Opacité + 8 px de montée. |
| `animate-rise-in-lg` | 420 ms | **Vitrine uniquement.** Opacité + 20 px + un soupçon d'agrandissement. Le réglage discret passe inaperçu sur une page qu'on ne voit qu'une fois. |

Cas particuliers admis : `transition-transform` sur le curseur d'un `Switch`,
`transition-opacity` sur les barres du graphique au survol, `transition-shadow` sur une carte
survolable, et `hover:-translate-y-1` sur les cartes de la **vitrine** — une ombre seule ne se
remarque pas, alors qu'un déplacement dit que l'élément est vivant.

**`animate-rise-in` est un amendement**, demandé par le propriétaire du produit le 11 septembre 2026.
La version précédente de cette règle interdisait toute animation d'entrée sur du contenu de page —
« le contenu apparaît, il ne se met pas en scène ». Ce qui la rend tenable :

- elle ne joue **qu'au chargement**, jamais en réaction à une action de l'utilisateur ;
- **240 ms**, assez pour se voir, trop court pour faire attendre ;
- **8 px** de déplacement : rien ne saute, rien ne se réorganise sous le curseur ;
- le décalage entre éléments reste **sous 100 ms** — au-delà, on regarde l'interface se construire
  au lieu de la lire.

Elle ne s'applique qu'au tableau de bord, où l'on arrive. **Pas sur les écrans de saisie** : une
facture en cours de rédaction ne se remet pas en scène à chaque enregistrement.

### La vitrine publique fait exception

**Amendement du 15 septembre 2026, demandé par le propriétaire du produit.** La page d'accueil
(`app/page.tsx` et `components/marketing/`) admet deux choses que l'application refuse :

| Autorisé sur la vitrine | Pourquoi pas dans l'application |
|---|---|
| Révélation au défilement (`Reveal`) | Personne ne « découvre » un tableau de bord qu'il ouvre dix fois par jour. |
| Animation **en boucle** (`ReceiptDemo`) | Un mouvement répété distrait quelqu'un qui travaille. Un visiteur, lui, ne travaille pas : il lui faut trois secondes pour comprendre ce que fait le produit, et le voir se faire le démontre mieux qu'un paragraphe. |

Les garde-fous restent entiers :

- `prefers-reduced-motion` **arrête la boucle** et montre l'état final. Ce n'est pas une préférence
  esthétique : le mouvement répété déclenche des nausées chez certaines personnes.
- Le contenu est **visible par défaut**. `Reveal` ne masque qu'après le montage, et seulement ce qui
  est hors de vue : sans JavaScript — connexion coupée en route, le cas courant sur les réseaux
  visés — la page reste entièrement lisible.
- Aucune couleur n'est inventée pour la vitrine : elle emprunte les jetons de la barre latérale.

**Interdits partout, vitrine comprise** : rotation continue, rebond, animation déclenchée par une
saisie, et toute animation qui retarde une action de l'utilisateur.

`prefers-reduced-motion: reduce` neutralise tout, globalement, dans `globals.css`. Ce n'est pas une
option : le mouvement déclenche des nausées chez certaines personnes.

---

## 3. Les bordures

**Une seule épaisseur : 1 px.** Aucune bordure de 2 px ou plus dans l'interface. La hiérarchie se
crée par les surfaces et l'espacement, pas par l'épaisseur du trait.

| Contexte | Classe |
|---|---|
| Carte, panneau, séparateur de zone | `border border-border` |
| Champ de saisie | `border border-input` — un cran plus contrasté, le champ doit se voir |
| Séparateur entre lignes | `divide-y divide-border` |
| Séparateur simple | `border-t border-border` |
| Champ en erreur | `border-destructive` |
| Bordure en pointillés | `border border-dashed border-input` — **uniquement** pour une zone d'ajout (« Ajouter une ligne ») |

`* { @apply border-border }` est posé globalement : une bordure sans couleur explicite prend déjà la
bonne teinte.

### Les couleurs de bordure

| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| `--border` | `220 16% 91%` | `224 18% 22%` | Structure : cartes, séparateurs, tableaux |
| `--input` | `220 16% 88%` | `224 18% 26%` | Contour de champ, plus marqué que la structure |
| `--ring` | `221 83% 53%` | `217 91% 62%` | Anneau de focus — le bleu vif, jamais le marine |

Aucune bordure ne prend une couleur de marque, de statut ou de graphique. La seule exception est
`border-destructive` sur un champ invalide, et `focus-visible:ring-ring` au focus.

### Focus — non négociable

Tout élément atteignable au clavier porte :

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

Supprimer un anneau de focus sans le remplacer rend l'application inutilisable au clavier. Les
champs utilisent une variante plus discrète : `focus-visible:border-interactive
focus-visible:ring-1`.

---

## 4. Le style de design

### Rayons

`--radius: 0.75rem`, et toute l'échelle en dérive.

| Classe | Valeur | Usage |
|---|---|---|
| `rounded-xl` | 12 px | Cartes, panneaux, blocs de ligne de facture |
| `rounded-lg` | 8 px | Boutons, champs, panneau flottant d'un select |
| `rounded-md` | 6 px | Pastilles de statut, tuiles d'icône, éléments de navigation et de menu |
| `rounded-sm` | 4 px | Témoins de couleur du graphique |
| `rounded-full` | — | Avatars, interrupteurs, points |

`rounded` nu (4 px, hors échelle), `rounded-2xl` et `rounded-3xl` sont refusés par le vérificateur.

### Ombres

Deux, et elles portent une intention :

- `shadow-card` — carte au repos, posée sur le fond. Presque invisible, volontairement.
- `shadow-raised` — élément qui **flotte au-dessus** du contenu : menu, dialogue, infobulle.

L'échelle Tailwind par défaut (`shadow-sm`, `shadow-md`…) est refusée.

### Couleurs d'action

| Token | Rôle | Règle |
|---|---|---|
| `primary` (marine) | Action principale | **Une seule par écran.** Deux boutons marine = aucune hiérarchie. |
| `interactive` (bleu vif) | Contrôles | Interrupteurs, cases, focus, icône de nav active |
| `destructive` | Danger | Suppression, erreur, montant en retard |
| `brand` (vert) | Marque | Marque de l'en-tête de facture, exclusivement |
| `status-*` | États de document | **Réservés.** Jamais réutilisés comme couleur décorative. |
| `chart-1`, `chart-2` | Séries de graphique | Validés pour le daltonisme — voir §7 |

Hiérarchie des boutons sur un écran : un `primary`, puis `outline` ou `ghost` pour le reste.

### Densité

Espacement sur une base de 4 px. Rythme réel du dashboard :

- entre sections d'une page : `mt-5`
- entre cartes d'une grille : `gap-4`
- intérieur d'une carte de statistique : `p-5`
- intérieur d'un en-tête ou d'un contenu de carte : `p-6`
- cellule de tableau : `px-4 py-3.5`
- icône ↔ texte : `gap-2` (petit), `gap-3` (élément de nav)

---

## 5. Les alignements

- **Texte à gauche.** C'est le défaut, il ne se justifie pas.
- **Nombres à droite, toujours**, avec `tabular`. Montants, quantités, pourcentages.
- **Titre à gauche, actions à droite** : `flex items-center justify-between`. Vrai pour l'en-tête de
  page comme pour celui d'une carte.
- **Icône et texte alignés au centre** : `flex items-center gap-2`. Une icône ne se cale jamais à la
  ligne de base.
- **En-tête de carte à deux blocs** : `items-start justify-between` — le bloc titre + description
  reste calé en haut quand l'action à droite est plus courte.
- **Tableau dans une carte** : `CardContent` passe en `px-0`, et les cellules de bord reprennent
  `pl-6` / `pr-6` pour retomber sur la gouttière de la carte.
- **Une seule colonne de lecture** : le contenu est centré, `max-w-[1240px]`.

---

## 6. La responsivité

**Mobile d'abord.** Les utilisateurs cibles sont majoritairement sur téléphone, souvent en 3G. La
classe sans préfixe décrit le mobile ; `sm:`, `lg:`, `xl:` ajoutent.

| Palier | Largeur | Ce qui change |
|---|---|---|
| base | < 640 px | Une colonne. Sidebar en tiroir. Gouttières `px-4`. |
| `sm:` | ≥ 640 px | Grilles à 2 colonnes, gouttières `px-8`. |
| `lg:` | ≥ 1024 px | Sidebar fixe de 236 px, contenu décalé de `lg:pl-[236px]`. Éditeur de facture en deux colonnes. |
| `xl:` | ≥ 1280 px | Grille de KPI à 4 colonnes. |

Règles fermes :

- **La page ne défile jamais horizontalement.** Tout contenu large — tableau, graphique, bloc de
  code — défile *dans son propre conteneur* `overflow-x-auto`. Le composant `Table` le fait déjà :
  c'est la raison de l'exiger plutôt que d'écrire un `<table>` à la main.
- **La navigation mobile est la même que celle du desktop**, dans un tiroir. Pas une version
  réduite : un utilisateur sur téléphone doit atteindre les mêmes écrans.
- **Cible tactile ≥ 36 px** (`h-9` au minimum) sur tout élément cliquable.
- **Aucune largeur fixe sur du contenu.** Les largeurs fixes sont réservées aux chrome de mise en
  page (sidebar, panneau d'aperçu).
- Le graphique est en `viewBox` SVG et se met à l'échelle ; il ne se re-mesure pas en JavaScript.

---

## 7. Accessibilité — les points qui ne se négocient pas

1. **La couleur ne porte jamais seule une information.** Une pastille de statut écrit toujours son
   libellé. Un graphique a toujours une légende, et son tableau de données en repli.
2. **Les couleurs de graphique se valident, elles ne se choisissent pas à l'œil.** Le couple en
   place a été passé au validateur (ΔE 31,5 en protanopie, 36,6 en vision normale, contraste ≥ 3:1).
   Le mode sombre a son **propre** couple, revalidé contre le fond sombre — l'éclaircissement naïf
   des teintes claires échouait la bande de luminosité. Ne pas les changer sans relancer le
   validateur.
3. **Tout bouton à icône seule porte un `aria-label`.**
4. **Les icônes décoratives portent `aria-hidden`.** Une icône à côté d'un texte qui la dit déjà ne
   doit pas être annoncée deux fois.
5. **L'élément de navigation actif porte `aria-current="page"`**, pas seulement une couleur.
6. **Un écran vide propose l'action suivante.** C'est le premier écran que voit un nouvel
   utilisateur.

---

## 8. Faire respecter la règle

```bash
npm run lint:design        # tout app/ et components/
npm test                   # l'inclut
```

Douze règles sont appliquées mécaniquement :

| Règle | Ce qu'elle refuse |
|---|---|
| `no-color-literal` | `#hex`, `rgb()`, `hsl()` dans un composant |
| `no-tailwind-palette` | `bg-gray-100`, `text-blue-600`… — la palette Tailwind par défaut |
| `unknown-color-token` | `bg-sidebar` alors que `--sidebar` n'existe plus — la classe ne génère aucune CSS et l'élément devient transparent |
| `no-dark-variant` | Toute variante `dark:` dans un composant |
| `no-arbitrary-color` | `text-[#123456]`, `border-[rgb(...)]` |
| `shadow-scale` | `shadow-md` et le reste de l'échelle par défaut |
| `radius-scale` | `rounded` nu, `rounded-2xl`, `rounded-[10px]` |
| `no-inline-style-color` | Une couleur posée en `style={{ }}` |
| `no-tofixed` | `.toFixed()` — les montants sont des entiers |
| `no-hardcoded-currency` | Le sigle « F CFA » écrit ailleurs que dans `lib/money.ts` |
| `no-raw-anchor` | `<a href="/…">` au lieu de `<Link>` |
| `img-needs-alt` | `<img>` sans `alt` |

Le vérificateur n'attrape que ce qui est mécanisable. Les règles d'alignement, de densité et de
hiérarchie des boutons se tiennent à la relecture — d'où ce document.

**Ajouter une règle** : compléter `LINE_RULES` ou `CLASS_RULES` dans
[`scripts/check-design-system.mjs`](../scripts/check-design-system.mjs), puis vérifier que le dépôt
reste vert. Une règle qui produit des faux positifs sera désactivée par le premier développeur
qu'elle gêne — et ne protégera plus rien.
