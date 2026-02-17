# FLM AUTO - DATA INVENTORY
> **Updated**: 1 Février 2026  
> **Status**: MVP Ready

---

## 📊 DATABASES COMPLÈTES

| Fichier | Description | Records | Source |
|---------|-------------|---------|--------|
| `EV_DATABASE_COMPLETE.json` | Autonomie réelle EV | 350 véhicules | ev-database.org |
| `ICE_REAL_CONSUMPTION_DATABASE.json` | Conso réelle ICE | 65 variantes | honestjohn.co.uk |
| `INTERIOR_DIMENSIONS_EXTENDED.json` | Dimensions intérieures | 85 véhicules | edmunds.com |
| `EURONCAP_EXTENDED_DATABASE.json` | Notes sécurité | 85 ratings | euroncap.com |
| `FAMILY_FIT_ISOFIX_EXTENDED.json` | ISOFIX + 3-across | 65 véhicules | thecarcrashdetective |
| `VEHICLE_RECALLS_DATABASE.json` | Rappels sécurité | 6 marques | NHTSA |
| `adac-kofferraum.json` | Volumes coffre | 145 véhicules | adac.de |
| `MEGA_VEHICLES_DATABASE.json` | Specs techniques | 3200+ modèles | ultimatespecs |

---

## 📸 PHOTOS

| Fichier | Description | Photos | Modèles |
|---------|-------------|--------|---------|
| `MVP_VEHICLE_PHOTOS.json` | Photos MVP brands | 95 | 55 |
| `CLASSIC_VEHICLE_PHOTOS.json` | Véhicules iconiques | 75 | 30 |
| `FAMILY_VEHICLE_PHOTOS.json` | Véhicules famille | 50 | 38 |
| `vehicle-photos.json` | Collection principale | 500+ | 200+ |

---

## 🎬 CULTURE POP

| Fichier | Description | Entrées |
|---------|-------------|---------|
| `imcdb/curated_screen_cars.json` | Apparitions films/TV | 35 |
| `igcd/game_appearances_curated.json` | Apparitions jeux vidéo | 12 |

---

## ✅ COUVERTURE MVP BRANDS

| Marque | EV Range | ICE Conso | Dimensions | EuroNCAP | ISOFIX | Rappels |
|--------|----------|-----------|------------|----------|--------|---------|
| BMW | ✅ 25 | ✅ 15 | ✅ 9 | ✅ 8 | ✅ 8 | ✅ 6 |
| Mercedes | ✅ 30 | ✅ 12 | ✅ 9 | ✅ 10 | ✅ 10 | ✅ 3 |
| Audi | ✅ 20 | ✅ 10 | ✅ 9 | ✅ 9 | ✅ 8 | ✅ 3 |
| VW | ✅ 18 | ✅ 12 | ✅ 10 | ✅ 11 | ✅ 6 | ✅ 3 |
| Porsche | ✅ 15 | - | ✅ 4 | ✅ 2 | - | ✅ 2 |
| Škoda | ✅ 12 | ✅ 8 | ✅ 8 | ✅ 7 | ✅ 6 | ✅ 2 |
| Opel | ✅ 8 | - | ✅ 4 | - | - | - |

---

## 🔑 INSIGHTS CLÉS

### EV Range Leaders (km réel)
1. Lucid Air GT: **720 km**
2. Mercedes EQS 450+: **685 km**
3. BMW iX3 50 xDrive: **610 km**
4. Audi A6 e-tron: **600 km**
5. Tesla Model S: **590 km**

### ICE - Écart WLTP vs Réel
| Carburant | Écart | Real vs WLTP |
|-----------|-------|--------------|
| Diesel MHEV | 10% | 90% |
| Diesel | 12% | 88% |
| Essence MHEV | 14% | 86% |
| Essence | 15% | 85% |
| **PHEV** | **70%** | **30%** |

### Family Fit - Best for 3 Child Seats
- **Very Easy**: VW ID. Buzz, Tesla Model X, Kia EV9, Volvo EX90
- **Easy**: BMW X5, Mercedes GLE, Škoda Kodiaq, VW Touareg
- **Avoid**: BMW 1 Series, Audi A3, VW Golf, Mercedes A-Class

### Rappels Majeurs 2024
- BMW: Système de freinage intégré (50,000 véhicules)
- BMW: Pompe à eau / risque incendie (750,000 véhicules)
- VW: Logiciel ID.4/Buzz (98,000 véhicules)

---

## 📁 STRUCTURE DES FICHIERS

```
/data/
├── DATABASES PRINCIPALES
│   ├── EV_DATABASE_COMPLETE.json
│   ├── ICE_REAL_CONSUMPTION_DATABASE.json
│   ├── INTERIOR_DIMENSIONS_EXTENDED.json
│   ├── EURONCAP_EXTENDED_DATABASE.json
│   ├── FAMILY_FIT_ISOFIX_EXTENDED.json
│   ├── VEHICLE_RECALLS_DATABASE.json
│   ├── adac-kofferraum.json
│   └── MEGA_VEHICLES_DATABASE.json
│
├── PHOTOS
│   ├── MVP_VEHICLE_PHOTOS.json
│   ├── CLASSIC_VEHICLE_PHOTOS.json
│   ├── FAMILY_VEHICLE_PHOTOS.json
│   └── vehicle-photos.json
│
├── CULTURE POP
│   ├── imcdb/
│   └── igcd/
│
└── DOCUMENTATION
    ├── DATA_INVENTORY.md (ce fichier)
    ├── MEGA_SCRAPING_GUIDE.md
    └── SESSION_*.md
```

---

## 🚀 PROCHAINES ÉTAPES (Post-MVP)

1. **Prix occasions** - La Centrale, AutoScout24
2. **Fiabilité** - TÜV Report, Consumer Reports
3. **Coût TCO** - Assurance, entretien, décote
4. **Extension géographique** - UK, US markets
