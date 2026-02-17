# MEGA PROMPT — Phase 14 : Safety Coverage Debug (39% → 55%)

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## CONTEXTE

Safety verified (A+B) = 1682 / 4268 = 39.4%. Target : 55% = 2347 → besoin de +665.

Breakdown actuel :
- A: 736 (EuroNCAP direct + NHTSA direct)
- B: 946 (intra-model propagation)
- C: 641, D: 1284, E: 110

Scripts existants :
- `07-euroncap-safety.ts` — importe les JSON locaux + scrape (scrape cassé : site JS-rendered)
- `08-nhtsa-5star.ts` — NHTSA API 2011-2026 (fonctionnel, 189 inserts)
- `11-euroncap-full-scrape.ts` — tentative re-scrape (même problème JS)
- `50-euroncap-api-v2.ts` — idem, 0 résultat
- `51-nhtsa-extended.ts` — NHTSA 2000-2010 (cassé : 0 ratings trouvés)
- `52-safety-propagation-v4.ts` — 3-tier propagation (B/C/D)

Fichiers data exploitables :
- `data/raw/euroncap_v3_all_ratings.json` → 483 ratings
- `data/euroncap-scrape-checkpoint.json` → URLs individuelles scrapées avec sub-scores
- `data/EURONCAP_EXTENDED_DATABASE.json` → structured data
- `data/euroncap-ratings.json` → original ratings

---

## BLOC 1 — DIAGNOSTIC DB (aucun write)

### Step 1.1 — Créer un script d'analyse

Fichier : `scripts/pipeline/60-safety-diagnostic.ts`

Ce script doit :

1. **Charger toutes les générations** avec brand, model, production_start/end, body_style
2. **Charger toutes les safety_ratings** avec confidence tier
3. **Produire un rapport** `data/safety-diagnostic.json` avec :

```json
{
  "total_gens": 4268,
  "with_safety_any": 3717,
  "with_safety_AB": 1682,
  "without_safety": 551,
  "confidence_breakdown": { "A": 736, "B": 946, "C": 641, "D": 1284, "E": 110 },
  
  "models_with_A_but_missing_B": [
    {
      "brand": "BMW",
      "model": "Série 3",
      "gens_with_A": ["G20 (2019)"],
      "gens_without_AB": ["G20 facelift (2023)", "F30 (2012)", "E90 (2005)"],
      "potential_B_gains": 3
    }
  ],
  
  "top_models_by_missing_coverage": [],
  
  "brands_coverage_pct": {
    "BMW": { "total": 180, "AB": 95, "pct": 52.8 },
    ...
  },
  
  "propagation_opportunities": {
    "intra_model_same_gen_group": 0,
    "intra_model_adjacent_gen": 0,
    "facelift_inheritance": 0,
    "body_variant_inheritance": 0
  }
}
```

Le rapport doit spécifiquement identifier :

a) **Modèles avec au moins un A mais des gens sans A ni B** → ce sont les gains B les plus faciles
b) **Facelifts** : si "Golf VIII" a un A, "Golf VIII facelift" devrait avoir un B. Détecter via slug patterns contenant "facelift" ou via production_start within 3 ans
c) **Body variants** : si "308" a un A, "308 SW" devrait aussi (même plateforme). Détecter via model.name contenant le nom de base
d) **Marques à fort potentiel** : marques avec beaucoup de gens mais faible couverture AB

Run sans écrire dans la DB :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/60-safety-diagnostic.ts
```

---

## BLOC 2 — AMÉLIORER LA PROPAGATION B

### Step 2.1 — Créer un propagation v5

Fichier : `scripts/pipeline/61-safety-propagation-v5.ts`

Basé sur l'analyse du diagnostic, améliorer la propagation avec ces règles **additionnelles** (en plus de l'existant) :

**Règle B1 : Facelift inheritance** (→ confidence B)
- Si gen A a slug "volkswagen-golf-golf-viii-2022" et gen B a slug contenant "facelift" avec le même model_id → B hérite
- Pattern : si gen.slug ou gen.name contient "facelift" et que le model_id a au moins un A/B → propager
- Condition : production_start de la facelift ≤ 5 ans après le test_year du A

**Règle B2 : Body variant inheritance** (→ confidence B)
- Si "Peugeot 308" a un A, "Peugeot 308 SW" (même brand, model.name contient le nom de base) devrait hériter
- Patterns à détecter : "SW", "Variant", "Touring", "Alltrack", "Break", "Wagon", "Estate", "Avant", "Sportback"
- Aussi : "GTI", "GTD", "GTE", "R", "RS", "AMG", "M Sport" — même carrosserie = même crash test
- Condition : même model_id OU model.name contient le model.name de la source

**Règle B3 : Extended year tolerance** (→ confidence B)
- Augmenter la tolérance de ±5 ans à ±7 ans pour les gens du MÊME model_id
- Un crash test Golf 8 de 2019 est pertinent pour un Golf 8 de 2024 (même plateforme)

**Règle B4 : Same-gen sub-variants** (→ confidence B)
- Certains modèles ont des variantes comme "3-door", "5-door", "3 portes", "5 portes", "long wheelbase", "short wheelbase"
- Si le model_id est le même et que la gen est du même millésime, propager en B

### Step 2.2 — IMPORTANT : règles de protection

- **NE JAMAIS écraser un A ou B existant avec un nouveau B**
- **NE JAMAIS créer de B si la source est C, D, ou E** — seuls les A peuvent générer des B
- Logger chaque propagation avec la raison exacte

### Step 2.3 — Run la propagation

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts --dry-run
```

Vérifier le dry-run : combien de nouveaux B ? Si > 200, c'est bon signe. Si > 500, c'est suspect — vérifier la qualité.

Puis run en live :
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts
```

---

## BLOC 3 — NHTSA 2000-2010 FIX

### Step 3.1 — Debug pourquoi 51-nhtsa-extended.ts retourne 0

Le script actuel utilise `https://api.nhtsa.gov/SafetyRatings/modelyear/{year}`.

Étapes de debug :
1. Tester manuellement l'API avec curl :
   ```bash
   curl -s "https://api.nhtsa.gov/SafetyRatings/modelyear/2005" | head -100
   ```
2. Si la réponse est vide, essayer d'autres endpoints :
   ```bash
   curl -s "https://api.nhtsa.gov/SafetyRatings?modelYear=2005" | head -100
   ```
3. Vérifier la structure de réponse et adapter le parsing

Le format NHTSA change entre les anciennes et nouvelles années. Avant 2011, le système de notation était différent (pas de sous-catégories détaillées).

### Step 3.2 — Adapter le script

Si l'API fonctionne mais avec un format différent :
- Parser correctement les anciens ratings (qui peuvent être sur 5 étoiles sans les sub-scores)
- Mapper les makes/models NHTSA aux générations DB

Si l'API ne couvre pas 2000-2010 → skip ce bloc, pas critique.

---

## BLOC 4 — EURONCAP LIVE SCRAPING (Playwright)

### Step 4.1 — Scraper avec Playwright au lieu de https.get

Le site EuroNCAP est JS-rendered. Les scripts existants échouent car ils font du simple HTTP GET.

Créer : `scripts/pipeline/62-euroncap-playwright.ts`

```typescript
import { chromium } from 'playwright';
```

**Stratégie** :

1. Naviguer vers `https://www.euroncap.com/en/ratings/a-z-listing/`
2. Attendre que le contenu JS charge
3. Extraire les données de la table rendue
4. Pour chaque entrée, matcher avec les générations DB

**OU alternative plus simple** : 
- Le site EuroNCAP expose peut-être une API XHR qu'on peut intercepter
- Dans Playwright, intercepter les requêtes réseau et trouver l'endpoint JSON
- Ensuite utiliser cet endpoint directement

### Step 4.2 — Vérifier Playwright est installé

```bash
npx playwright install chromium --with-deps 2>/dev/null || echo "Playwright not configured for scripting"
```

Si Playwright n'est pas installé pour le scripting (il est installé pour les tests E2E), l'installer. Le `playwright.config.ts` existe déjà.

### Step 4.3 — Run le scraper

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/62-euroncap-playwright.ts --dry-run
```

Vérifier le dry-run, puis run en live si ça marche.

**Si le scraping Playwright échoue ou est trop complexe** : c'est OK. La propagation améliorée (Bloc 2) est le levier principal. Skip ce bloc et passe au Bloc 5.

---

## BLOC 5 — SCORECARD & VALIDATION

### Step 5.1 — Re-run le honest scorecard

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/53-safety-audit-post.ts
```

OU le scorecard complet si tu le trouves dans les scripts pipeline. Le fichier de sortie est `data/honest-scorecard-report.json`.

### Step 5.2 — Vérifier les chiffres

Lire `data/honest-scorecard-report.json` et vérifier :
- Safety verified (A+B) est > 50% (idéalement ≥ 55%)
- Les counts A et B sont cohérents
- Pas de régression sur les autres métriques

### Step 5.3 — Build check
```bash
npm run build
```

### Step 5.4 — Commit

```bash
git add -A
git commit -m "Phase 14 — Safety coverage push: propagation v5 + NHTSA fix"
```

---

## PRIORITÉ DES BLOCS

1. **Bloc 1** (diagnostic) → OBLIGATOIRE, c'est la base
2. **Bloc 2** (propagation v5) → PRIORITÉ #1, plus gros levier potentiel (+200-500 B)
3. **Bloc 3** (NHTSA fix) → utile mais gains incertains
4. **Bloc 4** (Playwright scrape) → nice-to-have, complexe, skip si trop long
5. **Bloc 5** (scorecard) → OBLIGATOIRE pour valider

Si le temps manque, faire Blocs 1, 2, 5 seulement.

---

## NOTES

- Le `SUPABASE_SERVICE_ROLE_KEY` est dans `.env.local` — tous les scripts l'utilisent
- La table `safety_ratings` a une contrainte unique sur `generation_id` — utiliser `upsert` avec `onConflict: 'generation_id'`
- Ne JAMAIS insérer de confidence E
- Les scripts existants dans `scripts/pipeline/` sont la référence pour les patterns Supabase
- Le format de confidence dans la DB est une lettre : 'A', 'B', 'C', 'D', 'E'
