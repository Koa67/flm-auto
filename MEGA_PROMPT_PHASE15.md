# MEGA PROMPT — Phase 15 : Photos Coverage Push + Data Gaps

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## CONTEXTE

Scorecard actuel (avant Phase 14 safety update) :
- Specs: 99.2% ✅ — pas de gap
- Photos: **81.6% verified (A+B)** — LE gap principal
- Dims: 97.9% ✅
- Family: 90.2% ✅  
- Videos: 92.4% ✅
- Safety: ~55% (post Phase 14) ✅ amélioré

Photo confidence breakdown :
- A: 2738 (real scraped photos from UltimateSpecs/Wikimedia/constructeurs)
- B: 1772 (propagated/matched)
- C: 259
- D: 1340 (low quality / synthetic / inferred)
- E: 0

**Objectif : passer de 81.6% → 90%+ verified photos** = combler ~350-400 gens sans photos A/B.

Scripts existants :
- `15-wikimedia-photos.ts` — Wikimedia Commons API, fonctionne
- `49-photos-videos-push.ts` — Reclassification par URL patterns
- `01-ultimatespecs-deep.ts` — Scrape UltimateSpecs (specs, mais les pages contiennent aussi des images)

---

## BLOC 1 — DIAGNOSTIC PHOTOS

### Step 1.1 — Script d'analyse photo

Créer : `scripts/pipeline/70-photo-diagnostic.ts`

Ce script doit :

1. Charger toutes les générations (id, name, slug, model.name, brand.name, production_start)
2. Charger toutes les vehicle_images (generation_id, image_type, confidence, url, source)
3. Pour chaque génération, calculer :
   - Nombre total de photos
   - Meilleur tier de confidence (A > B > C > D > E)
   - A-t-il au moins 1 photo extérieure ?
   - Sources présentes (ultimatespecs, wikimedia, etc.)

4. Produire `data/photo-diagnostic.json` :

```json
{
  "total_gens": 4268,
  "gens_with_any_photo": 3800,
  "gens_with_AB_photo": 3483,
  "gens_zero_photos": 468,
  "gens_only_CD_photos": 317,
  
  "gaps_by_brand": [
    { "brand": "Volkswagen", "total": 380, "with_AB": 310, "missing_AB": 70, "zero_photos": 20 },
    ...
  ],
  
  "top_50_missing": [
    { "brand": "BMW", "model": "Série 1", "gen": "E87 facelift", "slug": "...", "photos": 0, "best_tier": null },
    ...
  ],
  
  "gens_D_only": [
    { "brand": "...", "model": "...", "gen": "...", "photo_count": 3, "best_tier": "D" },
    ...
  ]
}
```

Run :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/70-photo-diagnostic.ts
```

---

## BLOC 2 — WIKIMEDIA COMMONS MASS FILL

### Step 2.1 — Améliorer le script Wikimedia

Le script `15-wikimedia-photos.ts` existe. Créer une **version améliorée** : `scripts/pipeline/71-wikimedia-photos-v2.ts`

Améliorations par rapport à la v1 :

**A) Cibler les gens sans A/B photos (pas juste zéro photos)**
- Charger le diagnostic du Bloc 1
- Traiter en priorité : gens_zero_photos > gens_D_only > gens_C_only

**B) Requêtes de recherche multiples par gen**
Pour chaque gen sans photo, essayer PLUSIEURS queries Wikimedia :
1. `"{brand} {model} {internal_code}"` (ex: "BMW 3 Series F30")
2. `"{brand} {model} {year}"` (ex: "BMW 3 Series 2012")
3. `"{brand} {model}"` seul (fallback large)
4. Si brand a un nom différent dans d'autres langues, essayer aussi (ex: "Volkswagen Golf VIII")

**C) Filtrage intelligent**
- Exclure les images < 400px de large (thumb uniquement)
- Exclure les SVG, GIF (logos, pas des photos)
- Exclure les noms de fichier contenant "logo", "emblem", "badge", "icon"
- Préférer les images contenant "front", "rear", "side", "exterior", "interior"
- Max 8 images par gen (pas 5)

**D) Classification automatique**
- Si filename contient "interior" → image_type = "interior"
- Si filename contient "engine" → image_type = "technical"  
- Sinon → image_type = "exterior"

**E) Rate limiting**
- 200ms entre requêtes (Wikimedia est tolérant)
- Checkpoint toutes les 50 gens
- Support `--resume` pour reprendre

**F) Confidence tagging**
- Photos Wikimedia Commons = confidence "A" (sources officielles CC)
- Source = "wikimedia"

### Step 2.2 — Run

D'abord un dry-run pour estimer le gain :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/71-wikimedia-photos-v2.ts --dry-run --limit=50
```

Si le dry-run montre > 50% hit rate, lancer la run complète :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/71-wikimedia-photos-v2.ts
```

**Note** : Ce script va probablement tourner 10-30 minutes (4268 gens × 3 queries × 200ms). Utiliser un checkpoint.

---

## BLOC 3 — ULTIMATESPECS IMAGE EXTRACTION

### Step 3.1 — Extraire les images des pages UltimateSpecs

Les pages UltimateSpecs contiennent des images de véhicules. Le script `01-ultimatespecs-deep.ts` scrape les specs mais PAS les images.

Créer : `scripts/pipeline/72-ultimatespecs-photos.ts`

**Stratégie** :
1. Charger les URLs déjà scrapées depuis `data/ultimatespecs-variants/` (les HTML cachés)
2. Si pas de HTML caché, utiliser les `source_url` de `third_party_specs` (qui pointent vers UltimateSpecs)
3. Pour chaque page, extraire les `<img>` :
   - Pattern UltimateSpecs : images dans `.car-photo`, `.gallery`, ou `<img>` avec URL contenant `/cars/` ou `/uploads/`
   - Exclure les icons, ads, logos
4. Insérer dans `vehicle_images` avec confidence "A", source "ultimatespecs"

**Attention** :
- Respecter robots.txt et delay de 500ms
- Ne PAS re-scraper toutes les pages — utiliser le cache existant dans `data/ultimatespecs-variants/` si disponible
- Seulement pour les gens qui manquent de photos A/B

### Step 3.2 — Alternative si pas de cache HTML

Si les pages HTML ne sont pas cachées localement, utiliser une approche plus simple :
- Pour chaque gen sans photo A/B, construire l'URL UltimateSpecs probable
- Scraper uniquement la page de la gen en question
- Extraire les images

**Si cette approche est trop lente ou complexe, skip ce bloc et passe au Bloc 4.**

---

## BLOC 4 — PHOTO PROPAGATION (B-TIER)

### Step 4.1 — Propager les photos entre générations proches

Créer : `scripts/pipeline/73-photo-propagation.ts`

Pour les gens qui n'ont TOUJOURS pas de photos après Wikimedia :

**Règle P1 : Facelift shares photos with pre-facelift**
Si "Golf VIII" a des photos A et "Golf VIII facelift" n'en a pas → copier avec confidence B

**Règle P2 : Body variant shares with base**  
Si "308" a des photos et "308 SW" n'en a pas → copier les photos extérieures avec confidence B
(L'extérieur est similaire mais pas identique — B est correct)

**Règle P3 : Same model adjacent generation**
Si un modèle a photos pour gen N mais pas gen N-1 ou N+1, et le gap < 3 ans → propager en B

**Protection** : ne JAMAIS écraser un A existant. Ne propager que vers des gens avec 0 photos ou D-only.

### Step 4.2 — Run

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/73-photo-propagation.ts --dry-run
```

Vérifier le gain, puis :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/73-photo-propagation.ts
```

---

## BLOC 5 — SCORECARD & VALIDATION

### Step 5.1 — Re-run le honest scorecard

Trouver le script qui génère `data/honest-scorecard-report.json` — c'est probablement `43-honest-scorecard.ts` ou similaire.

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/43-honest-scorecard.ts
```

### Step 5.2 — Vérifier

Lire le nouveau `data/honest-scorecard-report.json` :
- Photos verified (A+B) doit être > 88% (idéalement 90%+)
- Aucune régression sur les autres métriques
- Le overall verified score doit être > 83%

### Step 5.3 — Build + commit

```bash
npm run build
git add -A
git commit -m "Phase 15 — Photo coverage push: Wikimedia v2 + propagation"
```

---

## PRIORITÉ DES BLOCS

1. **Bloc 1** (diagnostic) — OBLIGATOIRE, base de tout
2. **Bloc 2** (Wikimedia v2) — PRIORITÉ #1, plus gros levier (~200-400 nouvelles photos A)
3. **Bloc 4** (propagation) — PRIORITÉ #2, gains faciles (~100-200 B)
4. **Bloc 3** (UltimateSpecs photos) — optionnel, complexe
5. **Bloc 5** (scorecard) — OBLIGATOIRE pour valider

Si le temps manque : Blocs 1, 2, 4, 5.

---

## NOTES TECHNIQUES

- La table `vehicle_images` a les colonnes : `id, generation_id, url, image_type, source, confidence, width, height, created_at`
- `image_type` values : "exterior", "interior", "technical", "blueprint", "diagram", "cutaway"  
- `confidence` values : "A", "B", "C", "D", "E"
- `source` values observées : "ultimatespecs", "wikimedia", "press", etc.
- Contrainte unique probable sur `generation_id + url` — utiliser upsert
- L'API Wikimedia Commons :
  - Search : `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch={query}&format=json`
  - Image info : `https://commons.wikimedia.org/w/api.php?action=query&titles={File:name}&prop=imageinfo&iiprop=url|size|mime&format=json`
- User-Agent Wikimedia : OBLIGATOIRE, format `BotName/1.0 (url; email)`
- Ne PAS insérer de photos E-tier
- Les photos D-tier existantes ne doivent PAS être supprimées — on ajoute des A/B en plus
- SUPABASE_SERVICE_ROLE_KEY dans `.env.local`
