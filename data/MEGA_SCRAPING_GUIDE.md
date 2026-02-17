# 🔥 FLM AUTO - MEGA SCRAPING GUIDE
> **Créé**: 31 Janvier 2026  
> **Dernière MAJ**: 31 Janvier 2026  
> **But**: Référence complète des sources de scraping pour MVP et post-MVP

---

## 📊 TABLEAU RÉCAPITULATIF DES SOURCES

| Source | URL | Type de données | Fiabilité | Scraping Status | Notes |
|--------|-----|-----------------|-----------|-----------------|-------|
| **Edmunds** | edmunds.com | Interior dims (inches) | ⭐⭐⭐⭐⭐ | ✅ Actif | Meilleure source US |
| **ADAC** | adac.de | Trunk volumes, tests | ⭐⭐⭐⭐⭐ | ✅ Actif | Meilleure source EU |
| **EuroNCAP** | euroncap.com | Safety ratings | ⭐⭐⭐⭐⭐ | ✅ Complet | API publique |
| **UltimateSpecs** | ultimatespecs.com | Specs techniques | ⭐⭐⭐⭐ | ✅ Complet | 75+ marques |
| **Skoda PDF** | skoda-auto.com | Dimensions officielles | ⭐⭐⭐⭐⭐ | ✅ Complet | Source officielle |
| **SafelyTravelled** | safelytravelled.com | ISOFIX data | ⭐⭐⭐⭐ | ✅ Partiel | Best UK source |
| **BabyDrive** | babydrive.com.au | ISOFIX, 3-across | ⭐⭐⭐⭐ | ✅ Partiel | Best AU source |
| **IMCDB** | imcdb.org | Screen cars | ⭐⭐⭐⭐⭐ | ✅ Complet | Movie/TV appearances |
| **IGCD** | igcd.net | Game appearances | ⭐⭐⭐⭐⭐ | ✅ Complet | Video games |
| **Spritmonitor** | spritmonitor.de | Real consumption | ⭐⭐⭐⭐⭐ | ❌ Pas commencé | API disponible |
| **EV-Database** | ev-database.org | EV range/efficiency | ⭐⭐⭐⭐⭐ | ❌ Pas commencé | Best EV source |
| **AutoPadre** | autopadre.com | Interior dims | ⭐⭐⭐⭐ | ✅ Actif | Backup US |
| **US News Cars** | usnews.com/cars | Specs, reviews | ⭐⭐⭐⭐⭐ | ✅ Actif | Professional reviews |
| **CarsDirect** | carsdirect.com | Specs | ⭐⭐⭐⭐ | ✅ Actif | Good US backup |
| **TrueCar** | truecar.com | Specs, pricing | ⭐⭐⭐⭐ | ✅ Actif | US pricing |
| **KBB** | kbb.com | Specs, family reviews | ⭐⭐⭐⭐⭐ | ✅ Actif | Best Family reviews |
| **Car and Driver** | caranddriver.com | Tests, specs | ⭐⭐⭐⭐⭐ | ✅ Actif | Professional tests |
| **MotorTrend** | motortrend.com | Tests, specs | ⭐⭐⭐⭐⭐ | ⚠️ Partiel | Paywall issues |
| **Automobile-Catalog** | automobile-catalog.com | Historic specs | ⭐⭐⭐⭐ | ✅ Complet | All generations |
| **CarSized** | carsized.com | Visual comparisons | ⭐⭐⭐ | ✅ Complet | Dimensions visuelles |
| **RIDC** | ridc.or.kr | Korean specs | ⭐⭐⭐⭐ | ⚠️ Difficile | Korean only |
| **La Centrale** | lacentrale.fr | Prix FR occasion | ⭐⭐⭐⭐⭐ | ❌ Pas commencé | Post-MVP |
| **AutoScout24** | autoscout24.fr | Prix EU occasion | ⭐⭐⭐⭐⭐ | ❌ Pas commencé | Post-MVP |
| **CarWale** | carwale.com | India specs | ⭐⭐⭐⭐ | ❌ Post-MVP | India market |
| **AutoTrader UK** | autotrader.co.uk | UK specs/prices | ⭐⭐⭐⭐⭐ | ❌ Post-MVP | UK market |
| **NHTSA VPIC** | vpic.nhtsa.dot.gov | US VIN/specs | ⭐⭐⭐⭐⭐ | ✅ API OK | Official US gov |

---

## 🎯 DONNÉES PAR CATÉGORIE

### 1. DIMENSIONS INTÉRIEURES

**Sources primaires** (ordre de préférence):
1. **Edmunds.com** - Pattern: `https://www.edmunds.com/{brand}/{model}/{year}/features-specs/`
   - Format: inches → convertir ×25.4 pour mm
   - Données: headroom, legroom, shoulder room, hip room
   
2. **Skoda/VW PDF officiels** - Press kits
   - Format: mm direct
   - Qualité: Meilleure précision
   
3. **Dealers (BMW, Mercedes, Audi)**
   - Pattern: `{brand}of{city}.com`
   - Ex: bmwofseattle.com, mercedesbenzof*.com

**Sources backup**:
- AutoPadre.com
- CarsDirect.com
- TheCarConnection.com
- US News Cars

**Conversions importantes**:
```
1 inch = 25.4 mm
Front headroom: "39.9 in" → 1013 mm
Rear legroom: "35.2 in" → 894 mm
```

### 2. VOLUMES COFFRE

**Source principale**: ADAC Autokatalog
- URL: `https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/{brand}/{model}/`
- Données:
  - Kofferraumvolumen (Herstellerangabe) - Volume constructeur
  - Kofferraumvolumen (ADAC-Messung) - Volume mesuré ADAC
  - Volumen bis Dachhöhe - Volume jusqu'au toit
  
**Fichier existant**: `/data/adac-kofferraum.json` - 145 véhicules ✅

### 3. FAMILY FIT / ISOFIX

**Sources primaires**:
1. **SafelyTravelled** (UK) - `safelytravelled.com`
   - ISOFIX positions par modèle
   - 3-across compatibility tests
   
2. **BabyDrive** (Australia) - `babydrive.com.au`
   - Tests détaillés avec photos
   - Mesures réelles
   
3. **Cars.com Car Seat Check** - `cars.com/child-car-seat-fit-and-ease-of-use/`
   - US focus (LATCH system)
   - Tests par modèle

4. **Constructeurs** (manuels propriétaires)
   - BMW: Points ISOFIX dans Owner's Manual PDF
   - Mercedes: Manuel technique
   - Audi: Configuration ISOFIX

**Fichiers existants**:
- `/data/family-fit/isofix-data.json` - 26 véhicules ✅
- `/data/family-fit/family-fit-consolidated.json` - 20 véhicules ✅

### 4. SÉCURITÉ

**Source principale**: EuroNCAP
- URL: `https://www.euroncap.com/en/results/{brand}/{model}/`
- API disponible
- Données: Stars, Adult %, Child %, Pedestrian %, Safety Assist %

**Fichier existant**: `/data/euroncap/safety_ratings_curated.json` - 30 ratings ✅

### 5. CONSOMMATION RÉELLE (POST-MVP)

**Source principale**: Spritmonitor.de
- API: `https://www.spritmonitor.de/api/` (documentation disponible)
- Données: L/100km moyenne, écart-type, nombre de rapports

**Source EV**: EV-Database.org
- Autonomie réelle vs WLTP
- Efficacité kWh/100km

### 6. SCREEN CARS (FILMS/TV/JEUX)

**IMCDB** (Films/TV):
- URL: `https://www.imcdb.org/vehicles_make-{brand}.html`
- Fichier: `/data/imcdb/curated_screen_cars.json` ✅

**IGCD** (Jeux vidéo):
- URL: `https://www.igcd.net/vehicles.php?make={brand}`
- Fichier: `/data/igcd/game_appearances_curated.json` ✅

### 7. PHOTOS

**Sources**:
- Wikimedia Commons (license OK)
- Unsplash (license OK)
- Constructeurs (press kits)

**Fichier existant**: `/data/vehicle-photos.json` - 500+ photos ✅

---

## 🚀 SCRAPING PATTERNS

### Edmunds Pattern
```bash
# Example URL
https://www.edmunds.com/bmw/3-series/2024/features-specs/

# Scraping target: div.specs-list
# Data format: 
# Front Head Room: 39.9 in.
# Rear Leg Room: 35.2 in.
```

### ADAC Pattern
```bash
# Example URL
https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/bmw/3er/

# Structure:
# - Übersicht (overview)
# - Technische Daten (specs)
# - Autotest PDF (detailed test)
```

### Dealer Pattern (BMW example)
```bash
# BMW dealers US
https://www.bmwofseattle.com/new-inventory/index.htm?model=330i
https://www.richmondmotors.com/bmw-330i-specs/

# Data in "Specifications" tab
```

### SafelyTravelled Pattern
```bash
# ISOFIX data
https://www.safelytravelled.com/isofix-locations/{brand}-{model}/

# Contains:
# - Number of ISOFIX points
# - Positions (left/center/right)
# - Top tether locations
```

---

## 📋 VÉHICULES PRIORITAIRES À SCRAPER

### Phase actuelle (MVP - 50 véhicules)

**Golden Set - 30 véhicules** (27/30 done ✅):
| Status | Véhicule | Manque |
|--------|----------|--------|
| ✅ | BMW M340i | - |
| ✅ | Audi S4 | - |
| ✅ | Mercedes C43 | - |
| ✅ | BMW M3 G80 | - |
| ✅ | Audi RS4 Avant | - |
| ✅ | BMW X3 M40i | - |
| ✅ | Audi SQ5 | - |
| ✅ | Mercedes C63 | - |
| ⚠️ | **Porsche Macan** | No interior dims (policy) |
| ✅ | Hyundai Tucson | - |
| ✅ | VW Tiguan | - |
| ✅ | Skoda Karoq | - |
| ⚠️ | **Porsche 911** | No interior dims (policy) |
| ⚠️ | **Porsche Cayman GT4** | No interior dims (policy) |
| ✅ | Mercedes AMG GT | - |
| ✅ | BMW M2 G87 | - |
| ✅ | Audi TT RS | - |
| ✅ | BMW Z4 M40i | - |
| ✅ | BMW 320d Touring | - |
| ✅ | Audi A4 Avant | - |
| ✅ | Mercedes C220d Estate | - |
| ✅ | Volvo V60 | - |
| ✅ | Skoda Superb Combi | - |
| ✅ | VW Passat Variant | - |
| ✅ | Tesla Model 3 | - |
| ✅ | BMW i4 M50 | - |
| ⚠️ | **Porsche Taycan** | No interior dims (policy) |
| ✅ | Audi e-tron GT | - |
| ✅ | Mercedes EQE | - |
| ✅ | Hyundai Ioniq 5 | - |

**Note Porsche**: Porsche ne publie PAS de dimensions intérieures officielles. Confirmé sur tous les canaux.

### Post-MVP Extensions

**Phase 2 - Premium brands** (50 véhicules):
- Lamborghini: Urus, Huracán, Aventador
- Ferrari: Roma, 296 GTB, SF90
- Rolls-Royce: Ghost, Phantom, Cullinan
- Bentley: Continental GT, Bentayga, Flying Spur
- Aston Martin: DB11, Vantage, DBX
- McLaren: 720S, Artura, GT

**Phase 3 - Volume brands** (100+ véhicules):
- Toyota: Camry, RAV4, Land Cruiser, Supra
- Honda: Civic, Accord, CR-V, NSX
- Ford: Mustang, F-150, Bronco
- Chevrolet: Corvette, Camaro, Tahoe
- Peugeot: 308, 508, 3008, 5008
- Renault: Mégane, Clio, Austral

---

## 🔧 SCRIPTS DE SCRAPING

### Fichiers existants
```
/scripts/
├── import-interior-dimensions.ts  ✅
├── import-family-fit.ts           ✅
├── migrate-family-fit.ts          ✅
├── add-missing-brands.ts          ✅
```

### Scripts à créer (Post-MVP)
```
/scripts/
├── scrape-spritmonitor.ts         ❌
├── scrape-ev-database.ts          ❌
├── scrape-lacentrale-prices.ts    ❌
├── scrape-euroncap-api.ts         ❌
```

---

## 📁 FICHIERS DE DONNÉES

### Structure actuelle
```
/data/
├── interior-dimensions/
│   ├── scraped-dimensions-v4.json     ✅ 48 véhicules
│   ├── MEGA_SCRAPE_REPORT.md          ✅
│   └── SCRAPING_REPORT.md             ✅
│
├── family-fit/
│   ├── isofix-data.json               ✅ 26 véhicules
│   └── family-fit-consolidated.json   ✅ 20 véhicules
│
├── euroncap/
│   └── safety_ratings_curated.json    ✅ 30 ratings
│
├── imcdb/
│   └── curated_screen_cars.json       ✅ 47 apparitions
│
├── igcd/
│   └── game_appearances_curated.json  ✅
│
├── ultimatespecs/
│   └── *.json                         ✅ 75+ marques
│
├── adac-kofferraum.json               ✅ 145 véhicules
├── vehicle-photos.json                ✅ 500+ photos
└── DATA_INVENTORY.md                  ✅
```

---

## ⚠️ PROBLÈMES CONNUS

### Porsche - Pas de dimensions intérieures
**Confirmé**: Porsche ne publie AUCUNE dimension intérieure officielle.
- Vérifié: Press releases, dealers, forums, magazines
- Solution possible: Estimation via plateforme partagée (Taycan ≈ e-tron GT)

### MotorTrend - Paywall
- Certains articles derrière paywall
- Alternative: Car and Driver, US News

### RIDC (Corée) - Langue
- Site en coréen uniquement
- Besoin de traduction automatique

---

## 🎯 NEXT ACTIONS

1. **Continuer scraping dimensions**
   - Cibles: modèles populaires hors Golden Set
   - Focus: SUV familiaux (marché principal)

2. **Enrichir Family Fit**
   - Plus de données ISOFIX
   - Tests 3-across réels

3. **Préparer Post-MVP**
   - Setup Spritmonitor API
   - Setup EV-Database scraping

---

*Document vivant - MAJ à chaque session de scraping*
