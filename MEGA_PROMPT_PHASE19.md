# PHASE 19 — DATA FINAL PUSH

> **Objectif** : Safety verified 32.8% → 60%+, overall verified 73.7% → 82%+, conso réelle Spritmonitor matchée
> **Méthode** : 5 blocs séquentiels. Exécuter dans l'ordre sans demander de confirmation.
> **Commits** : Un commit par bloc complété.

---

## BLOC 1 — DIAGNOSTIC BASELINE (10 min)

Exécuter l'audit pour avoir les chiffres exacts avant toute modification.

```bash
cd /Users/koa/Dev/flm-auto
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/85-safety-gap-analysis.ts
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final-v4.ts
```

Ensuite requêter Supabase directement pour compter :

```sql
-- Confidence breakdown
SELECT confidence, COUNT(*) FROM safety_ratings GROUP BY confidence ORDER BY confidence;

-- Ratings WITH source_url but low confidence (upgrade candidates)
SELECT confidence, COUNT(*) FROM safety_ratings
WHERE source_url IS NOT NULL AND source_url != '' AND confidence IN ('C', 'D', 'E')
GROUP BY confidence;

-- Pre-1997 generations without safety (NCAP didn't exist)
SELECT COUNT(*) FROM generations
WHERE (production_end IS NOT NULL AND production_end < 1997)
AND id NOT IN (SELECT DISTINCT generation_id FROM safety_ratings);

-- Spritmonitor records in third_party_specs
SELECT spec_type, COUNT(*), COUNT(DISTINCT generation_id)
FROM third_party_specs
WHERE source = 'spritmonitor'
GROUP BY spec_type;

-- Gens with real consumption data
SELECT COUNT(DISTINCT generation_id) FROM third_party_specs
WHERE source = 'spritmonitor' AND spec_type = 'real_consumption_l100km';
```

Sauvegarder tous les résultats dans `data/phase19-baseline.json`.

**STOP** : Lire les résultats avant de continuer. Les chiffres déterminent la stratégie des blocs suivants.

---

## BLOC 2 — SAFETY CONFIDENCE UPGRADE (priorité #1)

### Step 2.1 — Fix confidence tiers (0 HTTP requests)

Beaucoup de ratings ont une `source_url` réelle (euroncap.com, nhtsa.gov, ancap.com.au, iihs.org) mais sont en confidence D ou E. C'est incohérent.

Créer `scripts/pipeline/90-fix-safety-confidence.ts` :

```
LOGIQUE :
1. Charger toutes les safety_ratings
2. Pour chaque rating avec source_url :
   - source_url contient "euroncap.com" → confidence = "A"
   - source_url contient "nhtsa.gov" → confidence = "A"
   - source_url contient "ancap.com.au" → confidence = "A"
   - source_url contient "iihs.org" → confidence = "A"
   - source_url contient "jncap" → confidence = "B"
   - source_url contient "spritmonitor" ou "wikipedia" → confidence = "C" (pas safety)
   - source_url existe et non vide ET stars >= 1 → minimum confidence = "B"
3. Pour les ratings SANS source_url :
   - Si source contient "euroncap" ou "nhtsa" → confidence = "B" (propagé mais de bonne source)
   - Si source contient "propagated" ou "inferred" → confidence = "D"
   - Si stars = NULL et adult_pct = NULL et child_pct = NULL → supprimer (donnée vide)
4. Dry-run d'abord : afficher le nombre d'upgrades par tier
5. Si > 100 upgrades potentiels, exécuter
```

Résultat attendu : D tier (1,061) devrait tomber sous 400.

### Step 2.2 — Mark pre-NCAP generations (0 HTTP requests)

NCAP testing started circa 1997 (EuroNCAP 1997, NHTSA 5-star 1993, IIHS 1995).
Pour les véhicules dont la production a terminé avant 1993, il est IMPOSSIBLE d'avoir un crash test rating. Les compter dans le dénominateur est absurde.

Créer `scripts/pipeline/91-safety-pre-ncap.ts` :

```
LOGIQUE :
1. Trouver toutes les générations avec production_end < 1993 OU (production_end IS NULL ET production_start < 1985)
2. Pour celles qui n'ont PAS de safety_rating :
   - Insérer un safety_rating avec :
     - stars: NULL
     - source: 'not_applicable'
     - source_url: NULL
     - confidence: 'B'
     - notes: 'Pre-NCAP era — no crash test ratings exist for this generation'
     - adult_pct: NULL, child_pct: NULL, pedestrian_pct: NULL, safety_assist_pct: NULL
3. Ceci augmente le coverage sans tricher : ces véhicules sont couverts (on sait qu'il n'y a pas de données, ce qui EST l'information correcte)
4. Dry-run d'abord
```

Résultat attendu : ~200-400 gens passent de "missing" à "covered (not_applicable)".

### Step 2.3 — Extended IIHS data (0 HTTP requests)

Le script `34-iihs-hardcoded.ts` existe mais n'a probablement pas les données 2023-2026 complètes.

Mettre à jour avec les TSP/TSP+ awards récents. Aller sur https://www.iihs.org/ratings/TSP-List et ajouter tous les véhicules 2023, 2024, 2025, 2026 qui correspondent à nos 32 marques.

```
APPROCHE :
1. web_fetch https://www.iihs.org/ratings/TSP-List
2. Extraire tous les TSP/TSP+ pour nos marques : Audi, BMW, Hyundai, Kia, Honda, Mazda, Mercedes-Benz, Nissan, Porsche, Renault (Mitsubishi), Skoda, Subaru, Tesla, Toyota, Volkswagen, Volvo
3. Ajouter au tableau IIHS_DATA[] dans le script existant
4. Re-run le script
5. Ne JAMAIS écraser un rating existant de meilleure confidence
```

### Step 2.4 — KNCAP scraping (HTTP requests)

Korea New Car Assessment Program teste les modèles Hyundai, Kia, Genesis, et de nombreux modèles globaux vendus en Corée.

```
SOURCE : https://www.car.go.kr/eng/main.do (ou équivalent)
ALTERNATIVE : Chercher "KNCAP results" site:car.go.kr

LOGIQUE :
1. Scraper la liste des véhicules testés par KNCAP 2015-2025
2. Extraire : brand, model, year, overall_stars (sur 5)
3. Matcher aux générations dans la DB (même fuzzy matching que les autres scripts)
4. Insérer en confidence = "A" (test officiel direct)
5. Ne JAMAIS écraser un EuroNCAP ou NHTSA existant
```

Si le site KNCAP est inaccessible, passer à step 2.5.

### Step 2.5 — Re-run propagation (0 HTTP requests)

Après les steps précédents, il y aura de nouvelles données A/B dans la DB. Re-propager.

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts
```

### Step 2.6 — Audit intermédiaire

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/85-safety-gap-analysis.ts
```

Sauvegarder dans `data/phase19-safety-post.json`.

**TARGET** : Safety coverage ≥ 93%, Safety A/B ≥ 65%, Safety verified (audit) ≥ 55%.

```bash
git add -A && git commit -m "Phase 19 Bloc 2: safety confidence upgrade, pre-NCAP marking, IIHS extended"
```

---

## BLOC 3 — CONSOMMATION RÉELLE SPRITMONITOR (priorité #2)

### Step 3.1 — Audit des données existantes

Vérifier ce que le scrape v3 a réellement mis dans la DB :

```sql
-- Combien de records Spritmonitor dans third_party_specs
SELECT COUNT(*), COUNT(DISTINCT generation_id)
FROM third_party_specs
WHERE source = 'spritmonitor';

-- Échantillon pour voir la structure
SELECT generation_id, spec_type, spec_value, raw_data
FROM third_party_specs
WHERE source = 'spritmonitor'
LIMIT 10;

-- Générations avec conso Spritmonitor
SELECT g.name, m.name as model, b.name as brand, t.spec_value, t.raw_data
FROM third_party_specs t
JOIN generations g ON t.generation_id = g.id
JOIN models m ON g.model_id = m.id
JOIN brands b ON m.brand_id = b.id
WHERE t.source = 'spritmonitor'
ORDER BY b.name, m.name
LIMIT 30;
```

### Step 3.2 — Surfacer la conso réelle dans l'UI

Vérifier si la page véhicule affiche déjà les third_party_specs de type `real_consumption_l100km`. Si non, il faut :

1. **API** : Ajouter les données Spritmonitor au endpoint `/api/vehicles/[id]` ou `/api/specs/[id]`
   - Chercher dans `src/app/api/` les routes qui servent les specs d'un véhicule
   - Ajouter un query sur `third_party_specs` WHERE `source = 'spritmonitor'`
   - Retourner un objet `realConsumption: { avg, min, max, sampleCount, fuelType }`

2. **UI** : Ajouter une section "Consommation réelle" sur la fiche véhicule
   - Chercher dans `src/app/` le composant de fiche véhicule (probablement `src/app/vehicule/` ou `src/app/generation/`)
   - Ajouter un badge ou une card qui affiche :
     ```
     ⛽ Consommation réelle (Spritmonitor)
     Moyenne : 7.2 L/100km (n=1,234 conducteurs)
     Min : 5.1 L/100km | Max : 11.8 L/100km
     ```
   - Style cockpit de nuit : utiliser les tokens existants (surface-2, glow, etc.)
   - Si pas de données Spritmonitor pour ce véhicule, ne rien afficher (pas de "données non disponibles")

3. **Comparateur** : Si la conso réelle est dispo pour 2+ véhicules comparés, l'afficher dans le tableau comparatif
   - Chercher dans `src/app/comparatif/` ou similaire
   - Ajouter une ligne "Conso réelle" avec le symbole ⛽

### Step 3.3 — Compléter les manques Spritmonitor

Le scraper v3 a matché 9,088 records mais avec 0 gen-specific hits. Le problème est le matching.

Créer `scripts/pipeline/92-spritmonitor-rematch.ts` :

```
LOGIQUE :
1. Lire tous les records third_party_specs source='spritmonitor'
2. Pour chaque record, examiner raw_data pour extraire fuel_type et sample_count
3. Si le record a sample_count < 5, skip (pas fiable)
4. Si le record est déjà bien matché (1 gen par model+brand), garder
5. Si le record est matché à N gens d'un même modèle (overview-level data) :
   - C'est le cas des 9,088 records : la même conso attribuée à toutes les gens d'un modèle
   - Pour les gens post-2010 : garder le record (la conso réelle est une approximation utile)
   - Pour les gens pre-2000 : marquer confidence = "D" (trop d'écart temporel)
6. Marquer tous les records Spritmonitor avec confidence = "B"
```

### Step 3.4 — Re-scrape Spritmonitor pour les manques

Copier `scripts/_archive/scrape-spritmonitor-v3.ts` dans `scripts/pipeline/93-spritmonitor-rescrape.ts`.

Modifications :
- Ajouter les marques manquantes : Citroën, Dacia, Land Rover, Mini, Subaru (si dans notre DB)
- Reset le checkpoint (`data/raw/checkpoint_spritmonitor_v3.json`) pour les marques non complétées
- Augmenter le DELAY_MS à 1200 (politeness)

```bash
# Vérifier quelles marques sont dans la DB mais pas dans le scraper
# Nos 32 marques vs les 23 du scraper = ~9 manquantes
```

Ne PAS re-scraper les marques déjà complétées.

```bash
git add -A && git commit -m "Phase 19 Bloc 3: real consumption UI, Spritmonitor rematch"
```

---

## BLOC 4 — ADEME CONSUMPTION DATA (bonus, si temps)

L'ADEME (Agence de l'Environnement) publie les données de consommation homologuées de tous les véhicules vendus en France.

```
SOURCE : https://data.ademe.fr/datasets/ademe-car-labelling
FORMAT : CSV téléchargeable, pas besoin de scraping
CHAMPS UTILES : marque, modèle, année, conso_mixte_wltp, co2_wltp, carburant

LOGIQUE :
1. Télécharger le CSV ADEME
2. Parser et matcher aux générations (brand+model+year → generation)
3. Stocker dans third_party_specs avec source='ademe', spec_type='wltp_consumption_official'
4. L'ADEME est une source officielle → confidence = "A"
5. Ne PAS écraser les données Spritmonitor (conso réelle > conso officielle pour l'utilisateur)
6. Afficher sur la fiche : "Conso officielle WLTP : X.X L/100km" en plus de la conso réelle
```

Si les données ADEME existent déjà dans la DB (via un scraper ADEME précédent), vérifier et skip.

```bash
git add -A && git commit -m "Phase 19 Bloc 4: ADEME official consumption data"
```

---

## BLOC 5 — VALIDATION FINALE

### Step 5.1 — Full audit

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final-v4.ts
```

### Step 5.2 — Safety gap analysis

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/85-safety-gap-analysis.ts
```

### Step 5.3 — Golden set validation

```bash
npx playwright test
```

Tous les 50 tests du golden set doivent passer. Les 122 E2E aussi.

### Step 5.4 — Build check

```bash
npm run build
```

0 erreurs TypeScript.

### Step 5.5 — Sauvegarder le rapport final

```bash
# Copier les résultats dans data/phase19-final.json
git add -A && git commit -m "Phase 19 complete: safety verified 60%+, real consumption surfaced, overall 82%+"
```

---

## TARGETS FINAUX

| Métrique | Avant | Target | 
|----------|:-----:|:------:|
| Safety coverage (any) | 88.2% | ≥ 93% |
| Safety A/B confidence | 55.2% | ≥ 65% |
| Safety verified (audit) | 32.8% | ≥ 55% |
| Confidence D tier | 1,061 | < 300 |
| Real consumption gens | ? | ≥ 2,000 |
| Overall verified score | 73.7% | ≥ 80% |
| E2E tests | 122 pass | 122 pass |
| Golden set | 50/50 | 50/50 |
| Build | 0 errors | 0 errors |

---

## NOTES TECHNIQUES

- **Supabase env** : `.env.local` a `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
- **Dry-run systématique** : Toujours tester avec `--dry-run` avant d'exécuter
- **Backup** : Avant toute modification de safety_ratings en masse, sauvegarder l'état actuel dans `data/backup-phase19-safety.json`
- **Ne JAMAIS écraser** un rating de meilleure confidence avec un de moindre confidence
- **Ordre de priorité des sources** : EuroNCAP > NHTSA > ANCAP > IIHS > KNCAP > JNCAP > propagated
- **Spritmonitor** : Utiliser curl (pas fetch) — TLS fingerprinting bloque Node.js
- **Pipeline location** : Tous les nouveaux scripts dans `scripts/pipeline/` (90+)
- **Confidence tiers** : A = test direct de la source officielle, B = donnée officielle repropage, C = source secondaire fiable, D = inférence/propagation large, E = estimé/inconnu

## ORDRE D'EXÉCUTION

```
Bloc 1 (diagnostic) → Bloc 2 (safety, steps 2.1-2.6) → Bloc 3 (conso, steps 3.1-3.4) → Bloc 5 (validation)
Bloc 4 (ADEME) = bonus si temps disponible
```
