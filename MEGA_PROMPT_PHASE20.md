# PHASE 20 — ALAIN v3 + TCO/ADEME + PHOTOS QUALITY

> **3 axes** : ALAIN chatbot enrichi, TCO avec données ADEME, photos quality push
> **Méthode** : 6 blocs séquentiels. Exécuter sans demander confirmation.
> **Commits** : Un commit par bloc.

---

## BLOC 1 — ALAIN v3 : MULTI-TURN INTELLIGENT (priorité #1)

L'objectif est de transformer ALAIN d'un Q&A stateless en un assistant conversationnel qui comprend le contexte, extrait les préférences utilisateur au fil de la discussion, et injecte ces préférences dans chaque requête.

### Step 1.1 — Preference extraction middleware

Le conversation store (`src/lib/alain/conversation-store.ts`) a déjà un objet `preferences` dans le context, mais il n'est jamais alimenté.

Créer `src/lib/alain/preference-extractor.ts` :

```
LOGIQUE :
- Recevoir la liste des messages
- Analyser les messages user pour extraire :
  - Budget (regex: "budget (\d+)", "moins de (\d+)", "entre (\d+) et (\d+)")
  - Nombre d'enfants (regex: "(\d+) enfant", "3 sièges")
  - Type carburant (regex: "diesel", "essence", "électrique", "hybride")
  - Usage (regex: "ville", "autoroute", "montagne", "remorquage")
  - Priorités (regex: "confort", "sportif", "économique", "familial", "fiabilité")
- Retourner un objet PreferenceUpdate
- Le store Zustand merge ces preferences à chaque message user
```

NE PAS utiliser l'IA pour extraire — faire du regex simple côté client. C'est instantané et déterministe.

### Step 1.2 — Inject preferences into API call

Modifier `src/app/api/alain/chat/route.ts` :

```
CHANGEMENTS :
1. Le body de la requête accepte un champ optionnel `preferences: { budget?, fuelTypes?, childSeats?, priorities?, usage? }`
2. Le chat-widget.tsx envoie les preferences du store dans chaque appel API
3. Dans la route, si des preferences existent, les ajouter au system prompt :
   "L'utilisateur a indiqué les préférences suivantes : budget 20-30k€, 2 enfants, priorité fiabilité.
    Adapte tes réponses en conséquence."
4. Le pre-router utilise aussi les preferences pour enrichir les recherches (ex: si budget < 25k, filtrer les résultats)
```

### Step 1.3 — Smart follow-up suggestions

Modifier `src/lib/alain/suggestions.ts` :

```
CHANGEMENTS :
1. Après une réponse ALAIN qui mentionne un véhicule, proposer :
   - "Comparer avec [dernier véhicule vu]" (si lastVehicles non vide)
   - "Combien ça coûte par mois ?" (lien vers TCO)
   - "Compatible sièges enfants ?" (si childSeats dans preferences)
2. Après une comparaison, proposer :
   - "Lequel est le plus fiable ?"
   - "Lequel est le moins cher à l'usage ?"
3. Les suggestions utilisent les preferences pour être pertinentes
```

### Step 1.4 — Conversation summary for long chats

Quand messages.length > 10, le full history devient trop long pour un 3B.

Modifier `src/app/api/alain/chat/route.ts` :

```
CHANGEMENTS :
1. Si messages.length > 10, ne pas envoyer tous les messages au LLM
2. Envoyer :
   - Le system prompt (avec preferences injectées)
   - Un résumé des 8 premiers messages : "L'utilisateur a discuté de [véhicules mentionnés], ses préférences sont [X]"
   - Les 4 derniers messages en entier
3. Ce "sliding window + summary" garde le contexte sans exploser le token limit du 3B
```

Le résumé est construit côté serveur par extraction simple (pas d'appel LLM pour résumer), en extrayant les noms de véhicules et les préférences des anciens messages.

### Step 1.5 — UI polish du widget

Modifier `src/components/alain/chat-widget.tsx` :

```
CHANGEMENTS :
1. Afficher un indicateur de contexte sous le header :
   "🎯 Budget: 20-30k€ | 👶 2 enfants | ⛽ Électrique"
   Visible seulement si ≥1 preference est définie. Cliquable pour reset.
2. Améliorer le rendu Markdown :
   - Supporter les tableaux Markdown (| col1 | col2 |)
   - Supporter les blocs de code inline `backticks`
   - Les liens [texte](url) deviennent cliquables
3. Quand ALAIN cite un véhicule de la DB, afficher un mini-card cliquable :
   - Si la réponse contient "/marques/xxx/yyy/zzz", extraire et afficher un lien stylé
   - Sinon, si un nom brand+model est détecté, le wrapper dans un <Link>
4. Ajouter un indicateur "sources" en bas de bulle assistant :
   - Si la réponse vient du pre-router (données DB injectées), afficher "📊 Données FLM AUTO"
   - Si la réponse vient d'Ollama sans pre-routing, afficher "🤖 ALAIN"
   - Si fallback Anthropic, afficher "☁️ Cloud"
```

Pour le point 4, modifier la response JSON de l'API pour inclure `provider` (déjà fait) et `preRouted: boolean`.

```bash
git add -A && git commit -m "Phase 20 Bloc 1: ALAIN v3 — multi-turn, preferences, smart suggestions"
```

---

## BLOC 2 — TCO CALCULATOR ENRICHI (priorité #2)

### Step 2.1 — ADEME data import

L'ADEME publie les émissions et consommations officielles de tous les véhicules neufs vendus en France.

```
SOURCE : https://data.ademe.fr/datasets/ademe-car-labelling
ALTERNATIVE : https://www.data.gouv.fr/fr/datasets/emissions-de-co2-et-de-polluants-des-vehicules-commercialises-en-france/
FORMAT : CSV
```

Créer `scripts/pipeline/94-ademe-import.ts` :

```
LOGIQUE :
1. Télécharger le CSV ADEME (ou le lire depuis data/raw/ s'il a été téléchargé manuellement)
2. Colonnes utiles : Marque, Modèle, Année, Carburant, Conso mixte WLTP (l/100km), CO2 WLTP (g/km), Puissance (kW), Masse (kg)
3. Pour chaque ligne :
   a. Matcher brand → notre table brands (fuzzy: "PEUGEOT" → "Peugeot")
   b. Matcher model → notre table models (fuzzy)
   c. Matcher année → la bonne generation (production_start <= année <= production_end)
4. Stocker dans third_party_specs :
   - source: 'ademe'
   - spec_type: 'wltp_consumption_official'
   - spec_value: conso_mixte
   - raw_data: { co2_gkm, fuel_type, power_kw, mass_kg, year }
   - confidence: 'A' (données homologuées officielles)
5. Ne PAS écraser les données Spritmonitor existantes (source='spritmonitor')
6. Dry-run d'abord, afficher le match rate
```

Si le CSV n'est pas téléchargeable automatiquement (URL cassée ou protection), skip et passer au step 2.2.

### Step 2.2 — TCO avec données réelles

Le TCO calculator (`src/components/tco/tco-calculator.tsx`) existe mais utilise des estimations statiques.

Modifier pour intégrer les données réelles de la DB :

```
CHANGEMENTS dans src/app/tco/page.tsx :
1. Quand un véhicule est sélectionné, fetcher aussi :
   - third_party_specs WHERE source='spritmonitor' → realConsumption
   - third_party_specs WHERE source='ademe' → officialConsumption
   - vehicle_pricing → co2, malus
   - safety_ratings → assurance (les 5 étoiles NCAP = rabais assurance)
2. Passer ces données au TCOCalculator component

CHANGEMENTS dans src/components/tco/tco-calculator.tsx :
1. Si realConsumption existe, l'utiliser comme défaut pour "conso" au lieu de l'estimation
2. Afficher un badge "⛽ Conso réelle Spritmonitor" à côté du slider de consommation
3. Si officialConsumption (ADEME) existe, l'afficher aussi comme référence "Conso officielle WLTP"
4. Ajouter une comparaison visuelle : barre montrant conso officielle vs réelle vs estimation
5. Si le malus est connu (vehicle_pricing), le pré-remplir au lieu de le recalculer

CHANGEMENTS dans src/lib/tco-calculator.ts :
1. Ajouter un paramètre optionnel realConsumption dans TCOParams
2. Si fourni, utiliser realConsumption au lieu de la conso constructeur pour :
   - Le calcul du coût carburant mensuel
   - Le budget carburant annuel
3. Afficher la différence : "Économie estimée vs conso constructeur : +12%"
```

### Step 2.3 — Lien TCO depuis la fiche véhicule

Le lien TCO existant sur la fiche véhicule (`/tco`) est générique. Le rendre pré-rempli.

```
CHANGEMENTS dans src/app/marques/[brand]/[model]/[generation]/page.tsx :
1. Le bouton "Calculer" pointe vers /tco?vehicle={generation_id}
2. La page /tco/page.tsx lit ce query param et auto-sélectionne le véhicule
3. Si vehicleData est chargé via URL param, skip l'étape de recherche
```

```bash
git add -A && git commit -m "Phase 20 Bloc 2: TCO enrichi avec données ADEME et Spritmonitor"
```

---

## BLOC 3 — PHOTOS QUALITY PUSH

### Step 3.1 — Hero image scoring

Actuellement les 4 premières images `exterior` sont utilisées dans le hero, sans tri de qualité. Certaines images Wikimedia sont des photos de parking, d'autres sont des photos presse professionnelles.

Créer `scripts/pipeline/95-photo-scoring.ts` :

```
LOGIQUE :
1. Charger toutes les vehicle_images WHERE image_type = 'exterior'
2. Pour chaque image, calculer un score basé sur :
   - Source : 'press' ou 'manufacturer' = +30, 'wikimedia' = +10, 'autoblog' = +15
   - URL patterns : contient "press" ou "official" = +20
   - Résolution (si width/height existent dans raw_data) : > 1200px = +20, > 800px = +10
   - Confidence : A = +20, B = +10, C = 0, D = -10
3. Ajouter une colonne `hero_score` dans vehicle_images (INTEGER, nullable)
   - Migration SQL : ALTER TABLE vehicle_images ADD COLUMN hero_score INTEGER;
4. Update toutes les images avec leur score
5. Les 4 images avec le meilleur hero_score seront utilisées dans le hero
```

### Step 3.2 — Modifier le data fetch pour trier par hero_score

```
CHANGEMENTS dans src/app/marques/[brand]/[model]/[generation]/page.tsx (function getVehicleData) :
1. Le query vehicle_images ajoute : .order('hero_score', { ascending: false, nullsFirst: false })
2. Ceci trie les images par qualité décroissante, les meilleures en premier
3. Le hero section prend automatiquement les 4 meilleures
```

### Step 3.3 — Photo dedup et cleanup

Des doublons peuvent exister (même URL, images visuellement identiques).

Créer `scripts/pipeline/96-photo-dedup.ts` :

```
LOGIQUE :
1. Charger toutes les vehicle_images groupées par generation_id
2. Pour chaque group :
   a. Détecter les doublons exacts (même URL) → supprimer les dupes, garder le meilleur confidence
   b. Détecter les quasi-doublons (URLs qui diffèrent par résolution : "/800px-" vs "/1200px-") → garder la plus grande
3. Dry-run d'abord, compter les suppressions potentielles
4. Exécuter si > 100 doublons trouvés
```

### Step 3.4 — Photos manquantes pour véhicules populaires

Cibler les générations sans aucune photo qui sont les plus consultées / les plus récentes.

```
LOGIQUE :
1. Identifier les générations 2015+ sans aucune vehicle_image
2. Pour chacune, tenter Wikimedia Commons :
   - Construire la requête : "{brand} {model} {year}" sur l'API Wikimedia
   - Filtrer les résultats : license CC, résolution > 800px
   - Insérer avec source='wikimedia', confidence='B'
3. Maximum 200 tentatives (politesse Wikimedia)
4. Le script 71-wikimedia-photos-v2.ts existe déjà dans le pipeline — le re-run ciblé
```

```bash
git add -A && git commit -m "Phase 20 Bloc 3: photo scoring, hero optimization, dedup, missing coverage"
```

---

## BLOC 4 — ALAIN TCO INTEGRATION

Connecter ALAIN au TCO : quand l'utilisateur demande "combien coûte cette voiture par mois ?", ALAIN peut répondre avec les données TCO.

### Step 4.1 — Nouveau tool ALAIN : calculate_tco

Ajouter dans `src/lib/alain/tools.ts` :

```typescript
{
  name: "calculate_tco",
  description: "Calcule le coût total de possession (TCO) mensuel d'un véhicule : carburant, assurance, entretien, décote, malus.",
  input_schema: {
    type: "object",
    properties: {
      generation_id: { type: "string", description: "UUID de la génération" },
      km_per_year: { type: "number", description: "Km parcourus par an (défaut: 15000)" },
      duration_years: { type: "number", description: "Durée de possession (défaut: 5)" },
    },
    required: ["generation_id"],
  },
}
```

### Step 4.2 — Implement executeTool for calculate_tco

Dans `src/lib/alain/execute-tool.ts`, ajouter le case :

```
LOGIQUE :
1. Récupérer le véhicule (brand, model, generation)
2. Récupérer : pricing (co2, malus), realConsumption (spritmonitor), interiorDims
3. Calculer via calculateTCO() existant dans src/lib/tco-calculator.ts
4. Retourner un JSON formaté :
   {
     vehicleName: "BMW Série 3 G20",
     monthlyTotal: 650,
     breakdown: { fuel: 120, insurance: 80, maintenance: 60, depreciation: 350, malus: 40 },
     realConsumption: "7.2 L/100km",
     malus2025: 2500
   }
```

### Step 4.3 — Pre-router TCO detection

Ajouter un pattern dans le pre-router :

```
const TCO_PATTERN = /\b(co[uû]t|tco|budget|mensuel|par mois|combien.*co[uû]te|prix.*usage|cher.*entretien)\b/i;
```

Si TCO_PATTERN match ET un véhicule est détecté, force le tool calculate_tco dans le pre-router.

```bash
git add -A && git commit -m "Phase 20 Bloc 4: ALAIN TCO integration — tool + pre-router"
```

---

## BLOC 5 — TESTS & VALIDATION

### Step 5.1 — E2E tests pour ALAIN v3

Ajouter 3 tests E2E dans le fichier de tests existant :

```
1. Test multi-turn : envoyer 2 messages, vérifier que le widget garde l'historique
2. Test suggestion : ouvrir le widget, vérifier que des suggestions contextuelles apparaissent
3. Test preference badge : envoyer "budget 25000 euros", vérifier qu'un badge "Budget" apparaît
```

### Step 5.2 — E2E tests pour TCO enrichi

```
1. Test : naviguer sur /tco, sélectionner un véhicule, vérifier que le calculateur s'affiche
2. Test : naviguer sur /tco?vehicle={id}, vérifier que le véhicule est pré-sélectionné
3. Test : vérifier que si realConsumption existe, un badge Spritmonitor est visible
```

### Step 5.3 — Golden set + build + existing tests

```bash
npx playwright test
npm run build
```

122+ E2E pass. 50/50 golden set. 0 build errors.

```bash
git add -A && git commit -m "Phase 20 Bloc 5: tests ALAIN v3, TCO, validation"
```

---

## BLOC 6 — VALIDATION FINALE

### Step 6.1 — Audit complet

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final-v4.ts
```

### Step 6.2 — Vérifications manuelles

Lister les résultats :
- ALAIN : preference extraction fonctionne ? suggestions contextuelles ? provider badge ?
- TCO : données réelles injectées ? lien pré-rempli depuis fiche véhicule ?
- Photos : hero images sont meilleures ? doublons supprimés ?

### Step 6.3 — Commit final

```bash
git add -A && git commit -m "Phase 20 complete: ALAIN v3 multi-turn, TCO enrichi ADEME, photos quality"
```

---

## TARGETS FINAUX

| Feature | Avant | Target |
|---------|:-----:|:------:|
| ALAIN preferences | Non extrait | Budget, enfants, carburant, usage |
| ALAIN multi-turn | Full history brut | Sliding window + résumé |
| ALAIN suggestions | Statiques par page | Contextuelles + preferences |
| ALAIN TCO tool | Non existant | calculate_tco fonctionnel |
| TCO données réelles | Estimations | Spritmonitor + ADEME + malus réel |
| TCO pré-rempli | Générique | Lien depuis fiche véhicule |
| Photos hero | 4 premières | 4 meilleures (scored) |
| Photos doublons | Inconnu | Dédupliqués |
| Photos manquantes 2015+ | Inconnu | Couvertes Wikimedia |
| E2E tests | 122 | 128+ |
| Build | 0 errors | 0 errors |

---

## NOTES TECHNIQUES

- **ALAIN** : Le 3B (Qwen2.5-3B) ne gère pas bien les longs contextes. Le sliding window (4 derniers messages + résumé) est CRITIQUE pour éviter la dégradation.
- **Preferences** : Extraction par regex côté client, PAS par LLM. C'est plus rapide, plus fiable, et gratuit.
- **ADEME** : Le CSV peut peser 20-50 MB. Parser avec des streams, pas fs.readFileSync.
- **Photos** : La colonne hero_score nécessite une migration SQL. Créer le fichier dans `supabase/migrations/`.
- **TCO** : La fonction calculateTCO() existe déjà dans `src/lib/tco-calculator.ts`. La réutiliser, ne pas réécrire.
- **Pre-router** : Ne PAS ajouter plus de 10 patterns — le pre-router doit rester rapide (< 5ms).
- **Zod** : Mettre à jour alainChatSchema dans `src/lib/validators.ts` pour accepter le champ `preferences`.
- **Ne JAMAIS casser** les 122 tests existants.

## ORDRE D'EXÉCUTION

```
Bloc 1 (ALAIN v3) → Bloc 2 (TCO/ADEME) → Bloc 3 (Photos) → Bloc 4 (ALAIN TCO) → Bloc 5 (Tests) → Bloc 6 (Validation)
```

Si le temps manque : Blocs 1 + 2 + 5 minimum. Bloc 3 et 4 sont bonus mais à fort impact UX.
