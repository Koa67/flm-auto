# MEGA PROMPT — Phase 13 : Fix 12 Legacy E2E Tests

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## CONTEXTE

12 tests E2E échouent (pré-existants, pas des régressions). Le build est clean.
Tests répartis dans : `e2e/phase4-features.spec.ts`, `e2e/phase5-features.spec.ts`, `e2e/phase6-blueprints.spec.ts`, `e2e/phase7-premium.spec.ts`, `e2e/phase8-auth.spec.ts`.
Playwright config : 2 projets (`chromium` desktop + `mobile` iPhone 14). Chaque test tourne 2 fois → 12 échecs = probablement 6 tests uniques × 2.
Le dev server doit tourner sur localhost:3000 (`reuseExistingServer: true`).

**IMPORTANT** : Tous les tests ont accès à la DB Supabase en prod (lecture). Les données existent.

---

## BLOC 1 — DIAGNOSTIC

### Step 1.1 — Run toute la suite et capturer la sortie complète

```bash
npx playwright test --reporter=list 2>&1 | tee data/e2e-full-report.txt
```

### Step 1.2 — Extraire les échecs

Depuis la sortie, identifier :
1. Le nom exact de chaque test en échec
2. Le fichier spec
3. Le projet (chromium ou mobile)
4. Le message d'erreur exact
5. Le sélecteur qui échoue ou le timeout

Écrire un résumé dans `data/e2e-failures-analysis.json` :
```json
{
  "total_pass": 122,
  "total_fail": 12,
  "total_skip": 4,
  "failures": [
    {
      "test": "Nav has Configurateur link",
      "file": "e2e/phase5-features.spec.ts",
      "project": "chromium",
      "error": "Element not found: nav a[href='/configurateur']",
      "root_cause": "Nav component doesn't include /configurateur link",
      "fix_strategy": "code" // or "test"
    }
  ]
}
```

### Step 1.3 — Classifier chaque échec

Pour chaque test en échec, décider :

**Fix le CODE** si :
- La feature est implémentée mais un sélecteur/structure HTML a changé
- Un lien/bouton/route manque alors qu'il devrait exister
- Un endpoint API retourne un mauvais status code

**Fix le TEST** si :
- Le test attend un élément qui n'a plus de raison d'exister (feature retirée/renommée)
- Le test est trop fragile (timing, sélecteur trop spécifique)
- Le test utilise un sélecteur qui ne correspond pas à l'implémentation actuelle

**Skip le TEST** (dernier recours) si :
- Le test vérifie une feature non encore implémentée
- Le fix serait disproportionné par rapport à la valeur

---

## BLOC 2 — FIXES

Appliquer les fixes dans l'ordre de priorité : code fixes d'abord, test fixes ensuite.

### Indices connus (basés sur l'audit du code) :

1. **`Nav has Configurateur link`** (phase5) : La nav (`src/components/nav.tsx`) ne contient PAS de lien `/configurateur` dans le tableau `links`. Le test cherche `nav a[href="/configurateur"]`. 
   - **Fix recommandé** : Supprimer ce test — le Configurateur est accessible depuis la homepage et la recherche, pas besoin d'être dans la nav principale (elle a déjà 7 liens). OU ajouter le lien dans la nav si c'est voulu.

2. **Tout test qui interagit avec un overlay** : L'onboarding tour et le cookie banner peuvent bloquer les clics. 
   - **Fix pattern** : Ajouter `addInitScript` au début de chaque test qui navigue vers une page :
   ```typescript
   await page.addInitScript(() => {
     localStorage.setItem("flm-onboarding-done", "true");
     localStorage.setItem("flm-cookies-accepted", "true");
   });
   ```
   ATTENTION : Vérifier les noms exacts des clés localStorage dans `src/components/onboarding-tour.tsx` (constante `STORAGE_KEY`) et `src/components/cookie-banner.tsx`.

3. **Tests API qui retournent 500** : Si Supabase n'est pas accessible ou si le schema a changé, les tests API vont échouer. Vérifier que `.env.local` est chargé par le serveur de dev.

4. **Tests mobile avec keyboard shortcuts** : Si un test attend `Meta+K` sur mobile → skip avec `test.skip()`.

5. **Timeouts** : Certains tests ont `timeout: 15000` qui peut être trop court pour le premier chargement. Augmenter à `30000` si nécessaire.

### Exécution des fixes

Pour chaque test en échec :

1. Lire le message d'erreur exact
2. Ouvrir le fichier spec correspondant
3. Ouvrir le composant/page/API correspondant
4. Appliquer le fix (code ou test)
5. Re-run UNIQUEMENT ce test pour valider :
   ```bash
   npx playwright test e2e/{fichier}.spec.ts -g "{nom du test}" --reporter=list
   ```

### Après tous les fixes

Run la suite complète :
```bash
npx playwright test --reporter=list 2>&1 | tee data/e2e-post-fix-report.txt
```

**Objectif : 0 échecs.** Si certains tests restent flaky (passent parfois), ajouter `test.describe.configure({ retries: 1 })` dans le describe bloc.

---

## BLOC 3 — HARDENING

### 3.1 — Helper d'initialisation partagé

Créer `e2e/helpers.ts` :
```typescript
import { Page } from "@playwright/test";

/**
 * Dismiss all overlays (onboarding tour, cookie banner)
 * Call this in beforeEach or at the start of tests that navigate
 */
export async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("flm-onboarding-done", "true");
    localStorage.setItem("flm-cookies-accepted", "true");
  });
}

/**
 * Check if running on mobile viewport
 */
export function isMobile(page: Page): boolean {
  const size = page.viewportSize();
  return (size?.width ?? 1280) < 768;
}
```

Vérifier les noms des clés localStorage en lisant `src/components/onboarding-tour.tsx` et `src/components/cookie-banner.tsx`. Adapter les noms dans le helper si différents.

### 3.2 — Refactorer les specs existants

Dans chaque fichier spec qui avait des échecs, ajouter `dismissOverlays` au début des tests qui naviguent vers des pages.

### 3.3 — Run final

```bash
npx playwright test --reporter=list 2>&1 | tee data/e2e-final-report.txt
```

Vérifier : 0 failures. 

**Commit** : `fix(e2e): fix all 12 legacy test failures + add overlay dismissal helper`

---

## BLOC 4 — VALIDATION

### 4.1 — Build check
```bash
npm run build
```

### 4.2 — ESLint
```bash
npx eslint src/ e2e/ --max-warnings=120
```

### 4.3 — Commit final
```bash
git add -A
git commit -m "Phase 13 complete — all E2E tests green"
```

---

## NOTES

- Le serveur de dev doit tourner sur `localhost:3000` pour Playwright. Le webServer config dans `playwright.config.ts` le lance automatiquement avec `npm run dev`.
- Les tests utilisent la base Supabase de prod/preview — les données sont réelles.
- Si un test échoue sur un sélecteur de type `[role="tab"]:has-text("Rappels")`, vérifier que le TabsTrigger existe bien dans le composant Tabs de la page véhicule (`src/app/marques/[brand]/[model]/[generation]/page.tsx`). Le tab "Rappels" est le dernier dans le TabsList.
- Les tests `phase8-auth.spec.ts` testent des routes auth (connexion, dashboard redirect, saved items 401). Ces tests ne nécessitent pas de user authentifié — ils testent le comportement non-auth.
- Le manifest.json est dans `public/manifest.json`, le sw.js dans `public/sw.js`, le offline.html dans `public/offline.html`.
