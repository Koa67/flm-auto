# MEGA PROMPT — Phase 16 : UI/UX Audit Final & Polish

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## CONTEXTE

Le design system est en place : dark-only "cockpit de nuit", tokens cohérents, shadcn/ui + Tailwind v4. Le code est fonctionnel, E2E passent. Il s'agit maintenant d'un **audit de polish professionnel** — trouver et corriger les inconsistances, les problèmes mobile, les edge cases visuels.

Stack : Next.js 16 / React 19 / Tailwind v4 / shadcn/ui
Theme : Dark only, forced via `html.dark`
Viewports testés en E2E : Desktop Chrome (1280×720) + iPhone 14 (390×844)
Fonts : Inter (sans), JetBrains Mono (mono), Space Grotesk (display)

Pages à auditer :
- `/` (home)
- `/marques` (brand list)
- `/marques/[brand]` (brand detail)
- `/marques/[brand]/[model]` (model detail)  
- `/marques/[brand]/[model]/[generation]` (vehicle detail — **PAGE LA PLUS CRITIQUE**)
- `/comparer` (comparator)
- `/recherche` (search)
- `/family-fit`
- `/coffre`
- `/tco`
- `/favoris`

Composants transversaux : Nav, Footer, CommandPalette, AlainChatWidget, CookieBanner, FloatingCompareBar

---

## BLOC 1 — AUDIT AUTOMATISÉ (scripts, pas de writes visuels)

### Step 1.1 — Linter Tailwind & classes inutilisées

```bash
# Check for hardcoded colors (devrait utiliser des tokens)
grep -rn "bg-\[#" src/components/ src/app/ --include="*.tsx" | grep -v "node_modules" | head -50
grep -rn "text-\[#" src/components/ src/app/ --include="*.tsx" | grep -v "node_modules" | head -50
grep -rn "border-\[#" src/components/ src/app/ --include="*.tsx" | grep -v "node_modules" | head -50
```

Objectif : identifier les couleurs hardcodées qui devraient être des CSS variables/tokens.
**NE PAS corriger maintenant** — juste logger le count. Si > 50, c'est un problème systémique à traiter dans le Bloc 2.

### Step 1.2 — Audit accessibilité avec Playwright

Créer : `e2e/audit-ui.spec.ts`

Ce test doit parcourir les pages clés et vérifier :

1. **Images sans alt** : `page.$$eval('img:not([alt])', els => els.length)` doit être 0
2. **Boutons sans label** : `button:not([aria-label]):not(:has(span:not(.sr-only)))` 
3. **Liens vides** : `a:not([aria-label]):empty`
4. **Contraste** : vérifier que les textes `text-muted-foreground` (#707085) sur `surface-base` (#08080c) passent WCAG AA — calculer le ratio
5. **Focus visible** : Tab à travers la nav et vérifier que `:focus-visible` est visible
6. **Heading hierarchy** : vérifier qu'il n'y a pas de h3 avant h2, etc.

Pages à tester : `/`, `/marques/bmw`, `/marques/bmw/serie-3` (ou un slug existant), `/comparer`

### Step 1.3 — Audit overflow mobile

Créer un test Playwright en viewport iPhone 14 (390×844) :

```typescript
// Pour chaque page :
const hasHorizontalScroll = await page.evaluate(() => {
  return document.documentElement.scrollWidth > document.documentElement.clientWidth;
});
expect(hasHorizontalScroll).toBe(false);
```

Pages à tester : TOUTES les pages listées ci-dessus.

Si un overflow est détecté, logger quel élément le cause :
```typescript
const overflowingElements = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  const viewportWidth = document.documentElement.clientWidth;
  return Array.from(all)
    .filter(el => el.scrollWidth > viewportWidth || el.getBoundingClientRect().right > viewportWidth)
    .map(el => ({ tag: el.tagName, class: el.className.substring(0, 80), width: el.scrollWidth }))
    .slice(0, 10);
});
```

Run :
```bash
npx playwright test e2e/audit-ui.spec.ts --project=mobile
npx playwright test e2e/audit-ui.spec.ts --project=chromium
```

---

## BLOC 2 — FIXES MOBILE PRIORITAIRES

Basé sur les résultats du Bloc 1, corriger les problèmes mobile dans cet ordre de priorité :

### Step 2.1 — Fix overflow horizontal

Les causes courantes d'overflow mobile :
- **Tables** sans `overflow-x-auto` sur le wrapper
- **Pre/code blocks** sans `overflow-x-auto`
- **Flexbox** avec `gap` trop large sur petit écran → ajouter `flex-wrap`
- **Fixed widths** (ex: `w-72`, `min-w-[300px]`) qui dépassent 390px
- **Tabs/TabsList** sans scroll horizontal

Pour chaque overflow trouvé :
- Ajouter `overflow-x-auto` sur le container
- OU remplacer `flex` par `flex flex-wrap` 
- OU ajouter un breakpoint responsive (`hidden sm:block` etc.)

### Step 2.2 — Tables responsive

Le tableau des motorisations dans la page véhicule est le plus critique.
Pattern à appliquer si pas déjà fait :

```tsx
<div className="overflow-x-auto -mx-4 sm:mx-0">
  <div className="min-w-[600px] px-4 sm:px-0">
    <Table>...</Table>
  </div>
</div>
```

Sur mobile, les colonnes les moins importantes (V.max, Transmission) peuvent être masquées :
```tsx
<TableHead className="hidden lg:table-cell">V.max</TableHead>
```

### Step 2.3 — Touch targets

Tous les boutons et liens interactifs doivent avoir un touch target minimum de 44×44px sur mobile.
Vérifier en particulier :
- Les brand buttons dans le hero de la homepage (actuellement `px-3 py-1.5 text-xs`)
- Les onglets dans la page véhicule
- Les boutons dans le comparateur
- Les liens du footer

Fix pattern :
```tsx
// Mobile : plus grand, Desktop : compact
<button className="px-4 py-3 text-sm sm:px-3 sm:py-1.5 sm:text-xs">
```

### Step 2.4 — Typographie responsive

Vérifier que les tailles de texte sont appropriées sur mobile :
- Hero h1 : `text-4xl sm:text-5xl md:text-7xl` — ok si c'est déjà le cas
- Section headers : pas trop petits sur mobile
- Mono numbers dans les stats : lisibles sur petit écran
- Les badges ne doivent pas être tronqués

---

## BLOC 3 — POLISH VISUEL

### Step 3.1 — Hardcoded colors → tokens

Basé sur le grep du Bloc 1 :
- Remplacer `text-[#a0a0b5]` par `text-muted-foreground` ou `text-[var(--text-secondary)]`
- Remplacer `bg-[#12121a]` par `surface-2` 
- Remplacer `border-[#2a2a3d]` par `border-[var(--border-default)]`

**Ne changer QUE les hardcoded colors qui ont un token équivalent exact**. Ne pas inventer de nouveaux tokens.

### Step 3.2 — Consistance des Cards

Auditer toutes les `<Card>` dans l'app :
- Toutes doivent avoir le même border radius
- Toutes doivent utiliser les mêmes border/bg tokens
- Les paddings internes doivent être cohérents (p-4 ou p-6, pas un mélange)
- Le `card-hover` effect doit être appliqué uniformément sur les cards cliquables

### Step 3.3 — Loading states

Vérifier que chaque page a un `loading.tsx` approprié :
- `/marques/loading.tsx` ✅ (existe)
- `/marques/[brand]/loading.tsx` ✅ (existe)
- `/marques/[brand]/[model]/loading.tsx` ✅ (existe)
- `/marques/[brand]/[model]/[generation]/loading.tsx` ✅ (existe)

Les loading states doivent utiliser les `<Skeleton>` components de shadcn, pas du texte "Chargement...".

Vérifier aussi : `/comparer`, `/recherche`, `/family-fit`, `/coffre`, `/tco` — ces pages client-side doivent avoir un état de chargement visible.

### Step 3.4 — Empty states

Le composant `empty-states.tsx` existe. Vérifier qu'il est utilisé partout où les données peuvent être vides :
- Aucun résultat de recherche → EmptySearch
- Comparateur vide → message d'invitation
- Favoris vide → encouragement à explorer
- Véhicule sans photos → EmptyPhotos ✅
- Véhicule sans safety → EmptySafety ✅
- Véhicule sans variants → EmptyVariants ✅

### Step 3.5 — Image error handling

Ajouter un fallback pour les images qui ne chargent pas :
- Les `<Image>` de Next.js doivent avoir un `onError` handler
- Le fallback doit être un placeholder cohérent (icône Car sur fond surface-2)
- Vérifier que les images Wikimedia Commons (HTTP URLs) sont supportées par `next.config.ts` dans `images.remotePatterns`

Check :
```bash
grep -n "remotePatterns" src/app/layout.tsx next.config.ts next.config.mjs 2>/dev/null
```

---

## BLOC 4 — INTERACTIONS & MICRO-ANIMATIONS

### Step 4.1 — Hover states consistants

Toutes les surfaces cliquables doivent avoir un hover visible :
- Cards : `card-hover` class (translateY + glow) ✅
- Boutons : `hover:bg-*` ✅
- Liens nav : `hover:text-white` ✅
- Lignes de tableau : ajouter `hover:bg-[var(--bg-hover)]` si manquant

### Step 4.2 — Transitions smooth

Vérifier que les transitions sont uniformes :
- `transition-colors duration-200` pour les changements de couleur
- `transition-all duration-300` pour les transforms
- PAS de changement brusque sans transition

### Step 4.3 — Scroll behavior

```css
html { scroll-behavior: smooth; }
```

Si pas déjà dans globals.css, l'ajouter. Les anchor links (vehicle-nav) doivent scroller smooth.

### Step 4.4 — Page transitions

Le composant `page-transition.tsx` existe. Vérifier qu'il est utilisé dans `template.tsx` :
- Les pages doivent avoir une transition fade-in subtile
- Pas de flash blanc entre les navigations

---

## BLOC 5 — ACCESSIBILITÉ

### Step 5.1 — Skip to content

Le skip link existe dans `layout.tsx` ✅. Vérifier qu'il fonctionne (focus visible, jump to `#main-content`).

### Step 5.2 — ARIA labels

Vérifier/ajouter les ARIA labels manquants :
- `aria-label` sur les icon-only buttons (search, menu, favorites)
- `role="navigation"` sur les nav sections ✅
- `role="contentinfo"` sur le footer ✅
- `aria-current="page"` sur le lien actif dans la nav
- `aria-live="polite"` sur les zones de résultats de recherche dynamiques

### Step 5.3 — Contraste

Les problèmes de contraste les plus probables :
- `text-muted-foreground` (#707085) sur `surface-base` (#08080c) → ratio ~3.5:1 → **FAIL AA pour small text**
- Solution : augmenter `--text-tertiary` à #808095 ou similaire (ratio ≥ 4.5:1)

Vérifier avec :
```typescript
function contrastRatio(hex1: string, hex2: string): number {
  // ... luminance calculation
}
```

Si le ratio est < 4.5:1 pour le texte small, augmenter la luminosité du token.

### Step 5.4 — Keyboard navigation

- Tab order doit être logique (nav → content → footer)
- Les dialogs/sheets doivent trap le focus
- Escape doit fermer les modals
- La command palette (⌘K) doit être accessible au clavier

---

## BLOC 6 — E2E VALIDATION & BUILD

### Step 6.1 — Run existing E2E

```bash
npx playwright test --project=chromium --project=mobile
```

Aucune régression autorisée. Si un test échoue à cause d'un changement visuel, corriger le composant OU le test.

### Step 6.2 — Build check

```bash
npm run build
```

0 errors. Les warnings ESLint existants sont acceptables.

### Step 6.3 — Lint check

```bash
npx next lint
```

### Step 6.4 — Commit

```bash
git add -A
git commit -m "Phase 16 — UI/UX audit: responsive fixes, a11y, visual polish"
```

---

## PRIORITÉ DES BLOCS

1. **Bloc 1** (audit automatisé) — OBLIGATOIRE, fonde tout le reste
2. **Bloc 2** (fixes mobile) — PRIORITÉ #1, impact utilisateur maximal
3. **Bloc 3** (polish visuel) — PRIORITÉ #2, consistance professionnelle
4. **Bloc 5** (accessibilité) — PRIORITÉ #3, conformité
5. **Bloc 4** (interactions) — nice-to-have, micro-améliorations
6. **Bloc 6** (validation) — OBLIGATOIRE pour fermer

Si le temps manque : Blocs 1, 2, 3, 6.

---

## CONTRAINTES

- **NE PAS changer le design system** (tokens, couleurs, fonts) — seulement corriger l'utilisation
- **NE PAS ajouter de nouvelles dépendances** — utiliser ce qui est déjà installé
- **NE PAS réécrire des composants entiers** — corriger chirurgicalement
- **NE PAS casser les E2E** — chaque fix doit être validé
- **Préserver le theme cockpit** — c'est le differentiator visuel, ne pas l'adoucir
- **Tailwind v4 syntax** — pas de `@apply` dans les composants (seulement dans globals.css)
- Les changements doivent être des **diffs minimaux** — pas de reformatting inutile
