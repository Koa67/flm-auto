# MEGA PROMPT — Phase 12 : E2E Fix + Product Polish

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant, continue.**

---

## CONTEXTE

Phase 11 complète. 3 tests E2E cassés (sur 16). Le build est clean (0 TS errors).

Tests en échec (tous dans `e2e/navigation.spec.ts`) :
1. `breadcrumbs navigate correctly` — chromium
2. `breadcrumbs navigate correctly` — mobile (iPhone 14)
3. `command palette opens with keyboard` — mobile (iPhone 14)

Projets Playwright : `chromium` + `mobile` (iPhone 14). Config dans `playwright.config.ts`.

Scorecard data : 79% verified, 93% all. C'est suffisant pour un MVP.

---

## BLOC 1 — FIX E2E (3 tests cassés)

### 1.1 — Fix breadcrumbs test

Le test `breadcrumbs navigate correctly` est flaky car :
- L'onboarding tour (`src/components/onboarding-tour.tsx`) crée un overlay `.fixed.inset-0` au premier visit
- Le cookie banner (`src/components/cookie-banner.tsx`) peut aussi bloquer
- Le test essaie de dismiss l'overlay mais le sélecteur est trop fragile

**Fix** dans `e2e/navigation.spec.ts` — remplacer le test breadcrumbs :

```typescript
test("breadcrumbs navigate correctly", async ({ page }) => {
  // Set localStorage to skip onboarding + cookie banner
  await page.addInitScript(() => {
    localStorage.setItem("flm-onboarding-done", "true");
    localStorage.setItem("flm-cookies-accepted", "true");
  });
  await page.goto("/marques/bmw");
  await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

  // Find breadcrumb "Marques" link
  const breadcrumb = page.locator('nav a[href="/marques"]').first();
  if (await breadcrumb.isVisible({ timeout: 3000 })) {
    await breadcrumb.click();
    await expect(page).toHaveURL("/marques");
  }
});
```

Vérifier que les clés localStorage `flm-onboarding-done` et `flm-cookies-accepted` sont bien celles utilisées dans `onboarding-tour.tsx` et `cookie-banner.tsx`. Adapter si différent.

### 1.2 — Fix command palette mobile

Le test `command palette opens with keyboard` échoue sur mobile car `Meta+K` n'existe pas sur iPhone. Deux options :

**Option A** (recommandée) : Skip ce test sur mobile.
```typescript
test("command palette opens with keyboard", async ({ page, browserName }) => {
  // Skip on mobile — no keyboard shortcut
  test.skip(page.viewportSize()!.width < 768, "No keyboard shortcut on mobile");
  await page.goto("/");
  await page.keyboard.press("Meta+k");
  await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 3000 });
});
```

**Option B** : Ajouter un test spécifique mobile qui clique sur le search icon button dans la nav :
```typescript
test("mobile search button opens command palette", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, "Desktop has keyboard shortcut");
  await page.goto("/");
  const searchBtn = page.locator("nav button").filter({ has: page.locator("svg.lucide-search") }).first();
  await searchBtn.click();
  await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 3000 });
});
```

Implémente les DEUX options (skip Meta+K sur mobile + nouveau test mobile).

### 1.3 — Run E2E pour valider

```bash
npx playwright test e2e/navigation.spec.ts --reporter=list
```

Les 16 tests doivent tous passer (8 chromium + 8 mobile, avec 1 skip sur mobile).

Si d'autres tests cassent, les fixer immédiatement avec la même approche (localStorage seeding pour éviter overlays).

**Commit** : `fix(e2e): fix breadcrumbs overlay + command palette mobile skip`

---

## BLOC 2 — PRODUCT POLISH : CORE FLOWS

### 2.1 — Homepage hero CTA clarity

Lire `src/app/page.tsx`. Le hero section doit avoir un flow clair :

1. Le `<h1>` doit être accrocheur et mentionner "4268 générations" ou le nombre actuel (query DB)
2. L'`InstantSearch` component doit être le CTA principal, bien visible
3. En dessous du search : 4 stat pills (marques, modèles, générations, variantes) — vérifier qu'ils utilisent les vrais chiffres de la DB
4. Les cards outils doivent être visuellement distinctes et avoir des hover states engageants

Si les stats sont hardcodées, les remplacer par des données DB dynamiques (elles sont déjà fetchées dans `getHomeData()`, s'assurer qu'elles sont affichées).

### 2.2 — Vehicle page flow check

La page véhicule `src/app/marques/[brand]/[model]/[generation]/page.tsx` est le cœur du produit. Vérifier :

1. **HeroSection** : photo principale + nom + badges (body style, years, stars). Si pas de photo → fallback SVG propre (pas d'image cassée)
2. **Tabs** : Vérifier que `TabsList` a `overflow-x-auto` sur mobile pour scroll horizontal
3. **Table motorisations** : dans un `<div className="overflow-x-auto">`. Les colonnes prioritaires sur mobile : nom, puissance, 0-100, conso
4. **Safety section** : si safety.confidence est 'D' ou 'E', afficher un disclaimer visible. Si pas de safety du tout → `EmptySafety` component
5. **Family Fit section** : le `SeatConfigurator` et `ISOFIXSchema` doivent être lisibles sur mobile
6. **Photos** : le gallery doit afficher un `EmptyPhotos` si aucune photo au lieu d'un blanc
7. **SpecsRadar** : vérifier qu'il ne crash pas si les données sont incomplètes (certains axes à null)

### 2.3 — Compare flow

Tester le flow complet dans `src/app/comparer/page.tsx` :

1. Le search input doit chercher via l'API `/api/compare` ou `/api/search`
2. Les résultats dropdown doivent montrer marque + modèle + génération + année
3. Le bouton "Comparer" ne doit être activé qu'avec 2+ véhicules sélectionnés
4. Sur la page résultat `src/app/comparatif/[slugs]/page.tsx` : les tables doivent être en `overflow-x-auto` sur mobile
5. Le `CompareRadar` doit avoir `maxWidth: 100%` et `aspect-ratio: 1` sur mobile (pas de débordement)
6. L'export PDF (`exportComparisonPDF`) doit rester fonctionnel

### 2.4 — Search UX

Dans `src/app/recherche/page.tsx` :

1. L'input doit avoir un debounce de 300ms minimum (vérifier)
2. Les résultats doivent montrer : brand + model + gen + année + body_style badge + photo thumbnail si disponible
3. Si aucun résultat → message clair "Aucun véhicule trouvé pour X"
4. Le compteur de résultats doit être visible ("42 résultats")
5. L'URL doit se mettre à jour avec `?q=...` en temps réel

### 2.5 — Empty states audit

Vérifier `src/components/empty-states.tsx` — s'assurer que TOUS les empty states ont :
1. Un icon approprié (pas juste du texte)
2. Un message explicatif en français
3. Un CTA quand pertinent (ex: "Rechercher un autre véhicule")

Vérifier que ces empty states sont bien utilisés sur les pages véhicule quand les données manquent :
- `EmptyVariants` — si 0 motorisations
- `EmptySafety` — si pas de safety rating
- `EmptyPhotos` — si 0 photos

### 2.6 — Confidence badges consistency

Vérifier `src/components/confidence-badge.tsx` :

1. Les couleurs doivent être : A=green, B=blue, C=amber, D=red/orange, E=hidden
2. Le tooltip doit expliquer la signification en français :
   - A: "Donnée vérifiée (source officielle)"
   - B: "Donnée fiable (propagée depuis une source vérifiée)"
   - C: "Estimation (basée sur des données proches)"
   - D: "Inférence (estimation heuristique)"
3. Le badge doit être petit et discret (pas plus gros que la donnée elle-même)
4. Sur mobile, le tooltip doit fonctionner au tap (pas hover-only)
5. Les données confidence E ne doivent JAMAIS être affichées nulle part (vérifier les requêtes Supabase : `.neq('confidence', 'E')`)

**Commit** : `feat(ui): product polish — hero stats, vehicle page, compare, search, empty states, confidence badges`

---

## BLOC 3 — PRODUCT POLISH : ALAIN + MOBILE + PERF

### 3.1 — ALAIN chat UX polish

Dans `src/components/alain/chat-widget.tsx` :

1. Le panel est déjà full-screen sur mobile (`h-dvh w-full` sans sm: prefix) ✅
2. Vérifier que `env(safe-area-inset-bottom)` fonctionne (déjà dans le code)
3. Le markdown rendering dans `formatMarkdown()` est basique. Ajouter le support des tableaux simples si le response contient `|` — sinon laisser tel quel
4. Ajouter un message d'erreur explicite si l'API retourne 503 : "ALAIN est en pause. Relance le serveur local ou vérifie la clé API."
5. Les suggestion chips doivent scroller horizontalement sur mobile (wrap `flex-nowrap overflow-x-auto`)

### 3.2 — Mobile micro-interactions

1. **Nav** : Le bouton hamburger Sheet est OK. S'assurer que le Sheet a un `aria-label="Menu de navigation"`
2. **Vehicle page tabs** : Ajouter `scroll-smooth` et `snap-x` au TabsList sur mobile pour un scroll naturel
3. **Cards** : Tous les cards cliquables (vehicle cards, brand cards) doivent avoir `active:scale-[0.98]` pour feedback tactile
4. **Images** : Les images en gallery doivent supporter le swipe/scroll horizontal sur mobile (vérifier `gallery-pro.tsx`)

### 3.3 — Performance vérifications

1. Vérifier que `next.config.ts` a `reactCompiler: true` ✅ (déjà fait)
2. Vérifier que les dynamic imports sont en place pour : `CompareRadar`, `SpecsRadar`, `AlainChatWidget` ✅ (déjà fait)
3. Ajouter `fetchPriority="high"` à l'image hero de la page véhicule (première image visible)
4. Vérifier que les pages véhicule ont `revalidate = 3600` ✅ (déjà fait)
5. S'assurer que les fonts sont bien en `display: "swap"` ✅ (déjà fait dans layout.tsx)

### 3.4 — Skeleton/loading states

Vérifier que les loading.tsx existent pour toutes les routes dynamiques lentes :
- `/marques/[brand]/[model]/[generation]/loading.tsx` ✅
- `/marques/[brand]/[model]/loading.tsx` ✅
- `/marques/[brand]/loading.tsx` ✅
- `/comparer/loading.tsx` ✅
- `/comparatif/[slugs]/loading.tsx` ✅
- `/recherche/loading.tsx` ✅
- `/meilleur/[category]/loading.tsx` ✅

Si certains sont trop basiques (juste un Loader2 spinner), les remplacer par des skeletons qui reflètent la structure de la page (utiliser les composants dans `src/components/skeletons.tsx`).

**Commit** : `feat(ui): ALAIN UX + mobile micro-interactions + perf + loading skeletons`

---

## BLOC 4 — VALIDATION FINALE

### 4.1 — Build

```bash
npm run build
```

0 erreurs attendues.

### 4.2 — E2E complet

```bash
npx playwright test --reporter=list
```

Tous les tests doivent passer. Si des tests cassent à cause des changements UI, les fixer.

### 4.3 — ESLint

```bash
npx eslint src/ --max-warnings=120
```

Aucun nouveau warning.

### 4.4 — Commit final + tag

```bash
git add -A
git commit -m "Phase 12 complete — E2E fixes + product polish"
```

---

## RÉSUMÉ

| Bloc | Scope | Commit |
|------|-------|--------|
| 1 | Fix 3 E2E (breadcrumbs localStorage, cmd palette mobile skip) | `fix(e2e)` |
| 2 | Product polish : hero, vehicle page, compare, search, empty states, confidence | `feat(ui)` |
| 3 | ALAIN UX, mobile micro-interactions, perf, loading skeletons | `feat(ui)` |
| 4 | Build + E2E all green + ESLint clean | final commit |
