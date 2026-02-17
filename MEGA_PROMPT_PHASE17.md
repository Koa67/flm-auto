# MEGA PROMPT — Phase 17 : Data Cleanup + Targeted Scraping

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## CONTEXTE

Scorecard : 83.7% overall verified. Les gains faciles sont épuisés. Analyse des diagnostics :

**Photos (88.9%)** : 468 gens sans photos. Mais beaucoup sont des **entrées poubelles** :
- "BMW 335Specs", "BMW M3Specs" → artifacts de scraping (nom finissant par "Specs")
- "Audi A5 A5 F5", "Porsche Boxster Boxster 987" → doublons avec noms dupliqués
- "BMW LCI F12", "BMW LCI F06" → "LCI" n'est pas un modèle, c'est un facelift
- "Skoda Winnetou", "VW Kurierwagen", "Audi Nuvolari", "Audi Avantissimo" → concepts/obscurs
- "VW Lavida", "VW SP1" → modèles marchés domestiques (Chine, Brésil)
- Nombreuses entrées avec slug "default" → shells vides

**Safety (54.8%)** : le plus gros gap. Propagation v5 épuisée (0 opportunités).
- Porsche 21%, Peugeot 10%, Fiat 9%, Lamborghini/Ferrari/Maserati 0%
- ANCAP script cassé (0 résultats)
- 1061 ratings D-tier (heuristiques) à potentiellement upgrader

**Specs (99.2%)** / **Dims (97.9%)** / **Videos (92.4%)** : pas de gain significatif possible.

---

## STRATÉGIE

1. **Nettoyer les gens poubelles** → réduit le dénominateur → améliore TOUS les pourcentages
2. **Fix ANCAP + nouvelles sources safety** → attaque directe sur le 54.8%
3. **Photos ciblées** pour les gens légitimes restants
4. **Re-run propagation safety** après cleanup (nouvelles opportunités possibles)

---

## BLOC 1 — GARBAGE GENERATION CLEANUP

### Step 1.1 — Diagnostic des gens suspectes

Créer : `scripts/pipeline/80-garbage-diagnostic.ts`

Ce script doit identifier les générations suspectes par pattern matching :

**Catégorie A — À SUPPRIMER (ou marquer hidden=true si la colonne existe, sinon supprimer)** :
1. Modèle finissant par "Specs" (ex: "335Specs", "M3Specs") → artifact de scraping
2. Nom de gen = "Default" ET modèle obscur (pas un vrai modèle connu)
3. Nom de modèle = 1-2 caractères ET pas un vrai modèle (ex: "K", "T", "E" sauf quand c'est un vrai modèle comme BMW i3)
4. Nom de gen contenant le nom du modèle dupliqué (ex: "A5 A5 F5", "Boxster Boxster 987", "SP1 SP1")
5. Modèle = "LCI" (LCI n'est pas un modèle, c'est "Life Cycle Impulse" = facelift)

**Catégorie B — À VÉRIFIER manuellement** :
1. Concepts cars (Nuvolari, Avantissimo, Winnetou) → garder si data exists, sinon supprimer
2. Modèles marché domestique (Lavida, SP1, Laura) → garder si data exists
3. Modèles historiques obscurs (Audi 75, VW Grand, Skoda 430, Skoda 1202)

**Catégorie C — LÉGITIMES mais sans photos** :
- GT-R, Kona Electric, Mercedes W210, W176, W168, BMW M8, etc. → NE PAS TOUCHER

Le script produit `data/garbage-diagnostic.json` :
```json
{
  "category_A_delete": [
    { "id": "...", "brand": "BMW", "model": "335Specs", "gen": "Default", "reason": "model_ends_with_specs" },
    ...
  ],
  "category_B_review": [...],
  "category_C_legit_missing": [...],
  "summary": {
    "total_suspect": 150,
    "category_A": 80,
    "category_B": 40,
    "category_C": 30
  }
}
```

### Step 1.2 — Exécuter le nettoyage catégorie A

Créer : `scripts/pipeline/81-garbage-cleanup.ts`

Pour les gens catégorie A :
1. Supprimer les `vehicle_images` liées (si elles existent)
2. Supprimer les `vehicle_videos` liées
3. Supprimer les `safety_ratings` liées
4. Supprimer les `third_party_specs` liées
5. Supprimer les `engine_variants` liées (et leurs `powertrain_specs`, `performance_specs`)
6. Supprimer les `family_fit_compatibility` liées
7. Supprimer les `interior_dimensions` liées
8. Enfin, supprimer la `generation` elle-même
9. Si un `model` n'a plus aucune generation après cleanup, supprimer le `model` aussi

**ATTENTION** : Faire un dry-run d'abord. Logger chaque suppression. Sauvegarder un backup JSON des gens supprimées.

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/81-garbage-cleanup.ts --dry-run
```

Si le dry-run montre < 200 suppressions et que les gens sont clairement du garbage, exécuter en live :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/81-garbage-cleanup.ts
```

### Step 1.3 — Catégorie B : concepts et modèles obscurs

Pour les gens catégorie B, appliquer une logique simple :
- Si la gen a **0 photos ET 0 specs ET 0 variants** → SUPPRIMER (coquille vide)
- Si la gen a des données → GARDER (données précieuses même si modèle obscur)

---

## BLOC 2 — SAFETY SCRAPING : FIX ANCAP + NOUVELLES SOURCES

### Step 2.1 — Fix ANCAP

Le script `18-ancap-import.ts` retourne 0 véhicules. Le problème est probablement :
- L'URL de l'API ANCAP a changé
- Le format de réponse a changé
- L'endpoint est bloqué

**Investigation** :
1. Lire le script `18-ancap-import.ts` en entier
2. Tester manuellement l'URL de l'API ANCAP dans un navigateur ou avec curl
3. L'API publique ANCAP est sur `https://www.ancap.com.au/safety-ratings` — le site charge les résultats en JSON via XHR
4. Si l'API est morte, essayer de scraper la page HTML directement

Créer : `scripts/pipeline/82-ancap-v2.ts`

**Stratégie ANCAP** :
- ANCAP utilise les mêmes résultats que EuroNCAP pour la plupart des véhicules
- Leur site liste des véhicules par marque avec étoiles
- Scraper `https://www.ancap.com.au/safety-ratings/{brand}` pour chaque marque
- Parser le HTML pour extraire : marque, modèle, année, étoiles
- Matcher aux generations en DB
- Insérer en source="ancap", confidence="A"

**Marques prioritaires ANCAP** (celles avec le plus de gap safety) :
- Nissan (47.1% → 359 gens)
- Peugeot (10.4% → 163 gens)
- Renault (45.5% → 246 gens)
- Hyundai (67.3% → 220 gens)
- Kia (62.4% → 189 gens)
- Mazda (69.2% → 169 gens)
- Toyota (50.5% → 535 gens)

### Step 2.2 — EuroNCAP REST API (si existe)

Vérifier s'il existe un endpoint JSON sur euroncap.com :
- `https://www.euroncap.com/en/ratings/all/` (ou équivalent)  
- L'API v2 (`50-euroncap-api-v2.ts`) a déjà été tentée. Lire le report pour voir ce qui a marché/échoué.

Si une API REST fonctionne, re-scraper les ratings les plus récents (2023-2025).

### Step 2.3 — IIHS (Insurance Institute for Highway Safety)

Créer : `scripts/pipeline/83-iihs-scrape.ts`

IIHS est l'équivalent US des crash tests. Source : `https://www.iihs.org/ratings`
- Ratings par véhicule : Overall, Frontal, Side, Roof, Head Restraints
- Format : "Good", "Acceptable", "Marginal", "Poor"
- Mapper : Good=5★, Acceptable=4★, Marginal=3★, Poor=2★

Priorité : marques américaines et japonaises (Ford, Toyota, Honda, Nissan, Hyundai, Kia)

**Note** : IIHS est un site JS-rendered. Options :
1. Essayer si les données sont dans le HTML initial
2. Si non, chercher un endpoint XHR/JSON
3. En dernier recours, utiliser les données du script `34-iihs-hardcoded.ts` — vérifier ce qu'il contient

### Step 2.4 — Re-run safety propagation post-cleanup

Après le cleanup du Bloc 1 et les nouvelles données A des Blocs 2.1-2.3 :

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts
```

Le cleanup peut avoir créé de nouvelles opportunités si des gens doublons ont été supprimées et que les gens restantes héritent maintenant correctement.

---

## BLOC 3 — PHOTOS CIBLÉES POUR GENS LÉGITIMES

### Step 3.1 — Script de scraping ciblé

Créer : `scripts/pipeline/84-targeted-photos.ts`

Utiliser la liste `category_C_legit_missing` du diagnostic Bloc 1.
Pour chaque gen légitime sans photos :

1. **Constructeur press kit** : chercher `"{brand} {model} {year} press photo"` sur Google Images (pas de scraping Google — utiliser Wikimedia à la place)
2. **Wikimedia Commons** avec queries améliorées :
   - Query 1: `"{brand} {model} {internal_code}"` (ex: "Mercedes W210")
   - Query 2: `"{brand} {model} {year}"` (ex: "Nissan GT-R 2007")
   - Query 3: `"{brand} {model}"` seul
3. **Fallback** : si Wikimedia échoue, essayer Unsplash API (gratuit, photos CC0)
   - `https://api.unsplash.com/search/photos?query={brand}+{model}&client_id={ACCESS_KEY}`
   - Note : nécessite un Access Key Unsplash (gratuit, 50 req/hour en demo)

Focus sur les gens importantes (modèles connus) :
- Mercedes W210, W176, W168, W222
- Nissan GT-R
- BMW M8 (F92, F91)
- Hyundai Kona Electric, Santa Fe DM
- Mazda6
- Renault Mégane E-Tech
- Seat Cupra Born

### Step 3.2 — Run

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/84-targeted-photos.ts --dry-run
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/84-targeted-photos.ts
```

---

## BLOC 4 — YOUTUBE VIDEOS (RAPPEL)

### Step 4.1 — Skoda Kodiaq & Enyaq

D'après le rappel utilisateur : relancer `scrape-youtube-videos.ts` pour Skoda Kodiaq et Enyaq.

```bash
# Trouver le script YouTube
find /Users/koa/Dev/flm-auto/scripts -name "*youtube*" -o -name "*scrape-youtube*" | head -10
```

Exécuter le script pour les 2 modèles spécifiques.

---

## BLOC 5 — SCORECARD & VALIDATION

### Step 5.1 — Re-run le honest scorecard

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/43-honest-scorecard.ts
```

### Step 5.2 — Vérifier les métriques

Lire `data/honest-scorecard-report.json` :
- **Attente réaliste post-cleanup** :
  - Photos : 88.9% → 91-93% (moins de gens au dénominateur + nouvelles photos)
  - Safety : 54.8% → 58-62% (ANCAP + IIHS + re-propagation + moins de gens au dénominateur)
  - Overall : 83.7% → 86-88%
- Aucune régression sur specs, dims, family, videos

### Step 5.3 — Build + E2E + commit

```bash
npm run build
npx playwright test --project=chromium --project=mobile
git add -A
git commit -m "Phase 17 — Data cleanup + ANCAP/IIHS safety + targeted photos"
```

---

## PRIORITÉ DES BLOCS

1. **Bloc 1** (garbage cleanup) — OBLIGATOIRE, améliore TOUT mécaniquement
2. **Bloc 2** (safety scraping) — PRIORITÉ #1, biggest verified gap
3. **Bloc 3** (photos ciblées) — PRIORITÉ #2, ~50 gens importantes
4. **Bloc 4** (YouTube Skoda) — bonus, rappel utilisateur
5. **Bloc 5** (scorecard) — OBLIGATOIRE pour valider

Si le temps manque : Blocs 1, 2 (steps 2.1 + 2.4 minimum), 5.

---

## NOTES TECHNIQUES

- **CASCADE DELETES** : La DB a `ON DELETE CASCADE` sur les FK. Supprimer une gen devrait cascader automatiquement. Vérifier avec un test sur une gen poubelle d'abord.
- **BACKUP** : Avant toute suppression, sauvegarder les IDs et données dans `data/backup-phase17-cleanup.json`
- **ANCAP** : Leur site est probablement un SPA React/Next — chercher les endpoints XHR dans le Network tab
- **IIHS** : Même chose, site JS-rendered — chercher un endpoint JSON d'abord
- **Safety source** : champ `source` dans `safety_ratings` — utiliser "ancap", "iihs", "euroncap", "nhtsa"
- **Confidence** : données directes de ANCAP/IIHS = confidence "A"
- **SUPABASE_SERVICE_ROLE_KEY** dans `.env.local`
- **Ne PAS supprimer** des gens qui ont des données réelles (specs, photos, etc.) même si le nom semble bizarre
- **Dry-run** systématique avant toute suppression
