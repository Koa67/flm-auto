# MEGA PROMPT — Phase 11 : Safety Blitz + UI/UX MVP + ALAIN Boost

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant, continue.**
> **Utilise `npx ts-node --compiler-options '{"module":"CommonJS"}'` pour tous les scripts TS.**
> **Tous les scripts pipeline vont dans `scripts/pipeline/`.**
> **Toutes les données intermédiaires vont dans `data/`.**
> **Patterns existants : checkpoint JSON, rate limiting, idempotent upserts, confidence tiers A-E.**

---

## ÉTAT DES LIEUX (ne pas re-auditer, c'est fait)

```
DB: 32 brands, 538 models, 4268 generations, 13054 variants
Specs: 99.2% verified ✅
Photos: 74.1% verified (287K photos)
Safety: 39.4% verified (736A + 945B = 1681 sur 4268) ← PROBLÈME
Dims: 97.9% verified ✅
Family: 90.2% verified ✅
Videos: 92.4% verified (57K videos) ✅
Score global verified: 77.9%
```

---

## BLOC 1 — SAFETY BLITZ (objectif: verified >55%)

### Step 1.1 — EuroNCAP API v2 (re-scrape complet)

Créer `scripts/pipeline/50-euroncap-api-v2.ts`.

Le script existant `11-euroncap-full-scrape.ts` utilise l'Umbraco API. Le problème : le matching est faible.

Nouveau script :
1. Fetch `https://www.euroncap.com/en/ratings/a-z-listing/` — parse toutes les entrées (make/model/year/stars/url)
2. Pour chaque entrée, fetch la page detail pour récupérer les 4 scores (adult_pct, child_pct, pedestrian_pct, safety_assist_pct)
3. Matching amélioré contre la DB :
   - Normaliser les noms (trim spaces, lowercase, remove accents)
   - Mapper les alias connus : `VW` → `Volkswagen`, `Merc` → `Mercedes-Benz`, etc.
   - Chercher par `brands.name ILIKE` + `models.name ILIKE` + year overlap avec `generations.production_start/end`
   - Si plusieurs gens matchent pour un même modèle+année, prendre la plus récente
4. Upsert dans `safety_ratings` avec `confidence = 'A'`, `source_url` rempli
5. Ne JAMAIS écraser un rating existant de confidence A (seulement enrichir les champs manquants)
6. Checkpoint JSON dans `data/euroncap-api-v2-checkpoint.json`
7. Rate limit: 500ms entre requêtes
8. Report final dans `data/euroncap-api-v2-report.json`

### Step 1.2 — NHTSA Extended (années 2000-2010)

Le script `08-nhtsa-5star.ts` couvre 2011-2026. Créer `scripts/pipeline/51-nhtsa-extended.ts` pour étendre à 2000-2010.

API : `https://api.nhtsa.gov/SafetyRatings/modelyear/{year}`
Puis pour chaque véhicule : `https://api.nhtsa.gov/SafetyRatings/VehicleId/{id}`

1. Années 2000-2010 incluses
2. Même logique de matching que le script existant
3. Confidence `'A'` pour les ratings NHTSA directs
4. Ne pas écraser les EuroNCAP existants (EuroNCAP > NHTSA pour le marché FR)
5. Rate limit: 100ms (API gratuite mais respecter)
6. Checkpoint + report

### Step 1.3 — Propagation intelligente v4

Créer `scripts/pipeline/52-safety-propagation-v4.ts`.

Logique de propagation (les scripts v1-v3 existent déjà mais laissent des trous) :

1. **Intra-modèle** (→ confidence B) : Si une génération d'un modèle a un rating A, propager aux autres générations du MÊME modèle qui n'ont aucun rating, SI la différence d'année est ≤ 5 ans
2. **Même plateforme** (→ confidence C) : Les plateformes partagées (MQB, CLAR, EMP2, CMP, MFA, etc.) — créer une map `platform → [generation_ids]` en se basant sur `generations.platform` si le champ existe, sinon par heuristique connue. Propager le rating de la gen la mieux notée aux autres gens sur la même plateforme
3. **Segment + marque + époque** (→ confidence D) : Pour les gens restantes sans rating, inférer à partir de la médiane du segment (body_style) de la même marque dans la même décennie

Règles strictes :
- Ne JAMAIS écraser A par B, ou B par C, etc.
- Ne JAMAIS créer de confidence E
- Log chaque propagation avec raison

### Step 1.4 — Audit safety post-blitz

Créer `scripts/pipeline/53-safety-audit-post.ts`.

1. Compter les ratings par confidence tier (A/B/C/D/E)
2. Calculer le % verified (A+B) / total gens
3. Lister les 20 modèles les plus populaires (par nombre de variants) qui n'ont toujours PAS de rating
4. Générer `data/safety-audit-post-report.json`
5. Afficher un tableau récapitulatif dans la console

### Step 1.5 — Lancer le scorecard final

Exécuter `scripts/pipeline/43-honest-scorecard.ts` et sauvegarder le résultat dans `data/honest-scorecard-post-safety.json`.

**Commit** : `feat(data): safety blitz — EuroNCAP v2 + NHTSA extended + propagation v4`

---

## BLOC 2 — UI/UX MVP PUSH

### Step 2.1 — Audit responsive complet

Créer `scripts/ui-audit.ts` qui utilise Playwright pour :
1. Visiter les pages clés : `/`, `/recherche`, `/comparer`, `/marques/volkswagen/golf/golf-8`, `/family-fit`, `/coffre`
2. Pour chaque page, tester 4 viewports : mobile (375×667), tablet (768×1024), desktop (1280×800), wide (1920×1080)
3. Prendre des screenshots dans `data/ui-audit/`
4. Vérifier :
   - Pas de horizontal overflow (scrollWidth > clientWidth)
   - Tous les boutons/liens ont min 44px touch target
   - Les tables ne débordent pas sur mobile
   - Les images ont des `alt` text non vides
5. Générer `data/ui-audit-report.json` avec les issues trouvées

### Step 2.2 — Fix responsive issues

En se basant sur le rapport d'audit, fixer les problèmes dans cet ordre de priorité :

**Homepage (`src/app/page.tsx`)** :
- S'assurer que le hero search est centré et utilisable sur mobile
- Les cards outils doivent être en 1 colonne sur mobile, 2 sur tablet, 4 sur desktop
- Les stats animées doivent être visibles sans scroll horizontal

**Page recherche (`src/app/recherche/page.tsx`)** :
- L'input search doit avoir 100% width sur mobile
- Les résultats doivent être en cards empilées sur mobile (pas de table)
- Le bouton "Sauvegarder" doit être accessible

**Page véhicule (`src/app/marques/[brand]/[model]/[generation]/page.tsx`)** :
- Les Tabs doivent être scrollables horizontalement sur mobile (pas de wrap)
- La table des motorisations doit être dans un `overflow-x-auto` container
- Le HeroSection doit s'adapter (image full width sur mobile, layout side-by-side sur desktop)
- Les ConfidenceBadge doivent être lisibles sur petit écran

**Comparateur (`src/app/comparer/page.tsx` + `src/app/comparatif/[slugs]/page.tsx`)** :
- Sur mobile : switcher d'un affichage côte-à-côte à un affichage empilé (un véhicule sous l'autre)
- Le CompareRadar doit être de taille 300×300 max sur mobile

**Family Fit (`src/app/family-fit/page.tsx`)** :
- Le SeatConfigurator doit fonctionner au touch
- Les résultats ISOFIX doivent être lisibles sur mobile

### Step 2.3 — Navigation mobile

Vérifier et améliorer `src/components/nav.tsx` :
1. Le menu hamburger doit exister et fonctionner sur mobile (<768px)
2. Le menu doit inclure : Recherche, Comparer, Family Fit, Coffre, Marques
3. La command palette (⌘K) doit rester accessible
4. Le breadcrumb (`src/components/breadcrumbs.tsx`) doit tronquer proprement sur mobile

### Step 2.4 — ALAIN Chat Widget mobile

Vérifier `src/components/alain/chat-widget.tsx` :
1. Sur mobile : le widget doit être full-screen (pas floating dans un coin)
2. L'input doit être fixé en bas de l'écran
3. Les suggestions doivent être scrollables horizontalement
4. Le bouton close doit être visible et accessible
5. Pas de keyboard push-up issues sur iOS (tester avec `visualViewport`)

### Step 2.5 — Performance quick wins

1. Vérifier que toutes les images utilisent `next/image` avec `sizes` prop correcte
2. Ajouter `loading="lazy"` aux images below-the-fold
3. Vérifier le `next.config.ts` pour `images.remotePatterns` — s'assurer que Wikimedia, Netcarshow, etc. sont autorisés
4. Ajouter `<link rel="preconnect">` pour les domaines Supabase et images dans `src/app/layout.tsx`
5. Vérifier que les fonts sont chargées avec `next/font` et `display: swap`

### Step 2.6 — SEO quick wins

1. Vérifier `src/app/robots.ts` — s'assurer que les pages API sont disallow
2. Vérifier `src/app/sitemap.ts` — s'assurer qu'il génère les URLs pour toutes les marques/modèles/générations
3. Ajouter `<link rel="canonical">` sur les pages véhicule
4. Vérifier que `generateMetadata` est implémenté sur TOUTES les pages publiques (marques, recherche, comparer, family-fit, coffre, meilleur, tco)
5. Vérifier les pages légales (cgu, confidentialite, mentions-legales) — elles doivent avoir des meta titles uniques

### Step 2.7 — Accessibility quick pass

1. Ajouter `aria-label` sur les icon-only buttons (theme toggle, menu hamburger, search, close)
2. Vérifier le contraste des ConfidenceBadge (A=green, B=blue, C=orange, D=red) — ratio min 4.5:1
3. Les form inputs doivent tous avoir des `<label>` associés
4. Le focus ring doit être visible sur tous les éléments interactifs
5. Skip-to-content link dans `layout.tsx`

**Commit** : `feat(ui): responsive audit + mobile fixes + SEO + a11y`

---

## BLOC 3 — ALAIN QUALITY BOOST (objectif: golden set >65%)

### Step 3.1 — Améliorer le system prompt

Éditer `src/lib/alain/prompts.ts` :

1. Ajouter une section "Exemples de réponses" avec 3-4 exemples concrets :
   ```
   ## Exemples
   Q: "Puissance de la BMW M3 G80 ?"
   → Appelle search_vehicles("BMW M3 G80"), puis résume : "La BMW M3 G80 développe **510 ch** (Competition) avec un 3.0L biturbo. Le 0-100 se fait en **3.9s**."
   
   Q: "Compare le 3008 et le Tiguan"
   → Appelle search_vehicles pour les deux, puis compare_vehicles avec les IDs trouvés.
   
   Q: "Quelle est la météo ?"
   → "Je suis ALAIN, spécialisé automobile. Je ne peux pas t'aider sur ce sujet, mais pose-moi une question sur les voitures !"
   ```

2. Ajouter une section "Workflow de recherche" :
   ```
   ## Workflow de recherche
   Quand un utilisateur demande des infos sur un véhicule :
   1. D'ABORD appelle search_vehicles pour trouver le véhicule
   2. ENSUITE appelle get_vehicle_details avec le generation_id trouvé
   3. ENFIN résume les données en langage naturel
   Ne réponds JAMAIS avec des données inventées. Utilise TOUJOURS les outils.
   ```

3. Préciser le nombre de mots dans le prompt : "Réponds en 50-100 mots pour une question simple, 100-200 pour une comparaison."

### Step 3.2 — Améliorer le pre-router

Éditer `src/app/api/alain/chat/route.ts` :

Le pre-router actuel ne gère que `search` et `engine`. Ajouter :

1. **Détection de comparaison** : si le message contient "vs", "versus", "compare", "comparaison", "ou", "mieux entre" + 2 noms de véhicules → pre-route avec 2 appels `search_vehicles` puis `compare_vehicles`
2. **Détection family fit** : si le message contient "siège", "bébé", "enfant", "isofix", "family", "famille" + un nom de véhicule → pre-route avec `search_vehicles` puis `check_family_fit`
3. **Détection coffre** : si le message contient "coffre", "volume", "poussette", "valise", "chargement" + un nom de véhicule → pre-route avec `search_vehicles` puis `get_cargo_info`
4. **Détection sécurité** : si le message contient "ncap", "sécurité", "crash", "étoile" + un nom de véhicule → pre-route avec `search_vehicles` puis `get_vehicle_details` (qui inclut safety)
5. **Détection rappels** : si le message contient "rappel", "recall", "défaut" + un nom de véhicule → pre-route avec `search_vehicles` puis `get_recalls`

Pattern de détection pour chaque cas :
```typescript
const COMPARE_PATTERN = /\b(vs|versus|compar|mieux entre|ou le|ou la|plutôt le|plutôt la)\b/i;
const FAMILY_PATTERN = /\b(siège|bébé|enfant|isofix|family|famille|3.across|trois.sièges)\b/i;
const CARGO_PATTERN = /\b(coffre|volume|poussette|valise|chargement|rentre|bagages?)\b/i;
const SAFETY_PATTERN = /\b(ncap|sécurité|crash|étoile|stars?|safe)\b/i;
const RECALL_PATTERN = /\b(rappel|recall|défaut|problème connu)\b/i;
```

### Step 3.3 — Ajouter un tool `search_and_detail` combo

Ajouter un nouveau tool dans `src/lib/alain/tools.ts` et `src/lib/alain/execute-tool.ts` :

```typescript
{
  name: "search_and_detail",
  description: "Recherche un véhicule ET retourne sa fiche technique complète en une seule requête. Utilise ce tool quand tu connais le nom du véhicule et que tu veux ses specs.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Nom du véhicule (ex: 'BMW M3 G80')" },
    },
    required: ["query"],
  },
}
```

L'exécution : fait un `search_vehicles` interne, prend le premier résultat, puis fait un `get_vehicle_details` avec le `generation_id`. Retourne le tout combiné. Cela réduit le nombre de tool calls nécessaires de 2 à 1 pour le cas le plus fréquent.

### Step 3.4 — Enrichir le golden set

Éditer `slm/eval/golden-set-slm.ts` :

Ajouter 10 tests supplémentaires pour couvrir les nouveaux patterns pre-router :
```
SLM-21: "Le coffre du Skoda Kodiaq fait combien de litres ?" → cargo
SLM-22: "Est-ce qu'un Maxi-Cosi rentre dans une Golf 8 ?" → family_fit
SLM-23: "3008 ou Tiguan pour une famille ?" → compare
SLM-24: "Note sécurité de la Volvo XC60 ?" → safety
SLM-25: "Y a des rappels sur la Peugeot 308 ?" → recalls
SLM-26: "Fiche technique complète du Renault Captur 2" → search_and_detail
SLM-27: "Meilleure voiture pour 3 sièges auto ?" → knowledge (pas de véhicule spécifique)
SLM-28: "Combien consomme une Tesla Model 3 ?" → search + detail
SLM-29: "Le EA888 a des problèmes ?" → engine
SLM-30: "Montre-moi des SUV 7 places" → search (catégorie)
```

### Step 3.5 — Évaluer l'amélioration

Si Ollama tourne (`ollama serve`), lancer le golden set :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' slm/eval/golden-set-slm.ts
```

Si Ollama n'est PAS disponible, skip cette étape et log : "Golden set eval skipped — Ollama not running. Run manually: ollama serve && npx ts-node ..."

**Commit** : `feat(alain): improved system prompt + pre-router v2 + combo tool + expanded golden set`

---

## BLOC 4 — VALIDATION FINALE

### Step 4.1 — Build check

```bash
npm run build
```

0 erreurs TS attendues. Si erreurs, fixer immédiatement.

### Step 4.2 — E2E smoke test

```bash
npx playwright test e2e/navigation.spec.ts --reporter=list
```

Si des tests cassent à cause des changements UI, les fixer.

### Step 4.3 — ESLint

```bash
npx eslint src/ --max-warnings=120
```

Les 105 `any` pré-existants sont tolérés. Aucun NOUVEAU warning ne doit apparaître.

### Step 4.4 — Commit final

```bash
git add -A
git commit -m "Phase 11 complete — Safety blitz + UI/UX MVP + ALAIN boost"
```

---

## RÉSUMÉ DES LIVRABLES ATTENDUS

| Bloc | Fichiers créés/modifiés | Métrique cible |
|------|------------------------|----------------|
| Safety Blitz | 50-euroncap-api-v2.ts, 51-nhtsa-extended.ts, 52-safety-propagation-v4.ts, 53-safety-audit-post.ts | Safety verified >55% |
| UI/UX | ui-audit.ts, fixes dans ~10 composants, SEO/a11y fixes | 0 overflow mobile, touch targets OK |
| ALAIN | prompts.ts, route.ts, tools.ts, execute-tool.ts, golden-set-slm.ts | Golden set >65% (ou skip si no Ollama) |
| Validation | build + e2e + eslint clean | 0 new errors |
