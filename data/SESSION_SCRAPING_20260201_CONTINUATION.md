# SESSION SCRAPING 2026-02-01 - CONTINUATION

## FICHIERS CRÉÉS CETTE SESSION

### 1. EV_DATABASE_COMPLETE.json
- **350 véhicules électriques** avec autonomie réelle
- Source: ev-database.org
- Autonomie moyenne: 384 km
- Couverture complète: Lucid, Tesla, BMW, Mercedes, Audi, VW, Porsche, Škoda, Hyundai, Kia, Volvo, Peugeot, Opel, Renault
- Top 10 longest range (km réel):
  1. Lucid Air Grand Touring: 720
  2. Mercedes EQS 450+: 685
  3. Mercedes EQS 450 4MATIC: 655
  4. Mercedes EQS 500/580 4MATIC: 640
  5. Lucid Gravity Grand Touring: 625
  6. BMW iX3 50 xDrive: 610
  7. Lucid Air Sapphire: 610
  8. Audi A6 Sportback e-tron performance: 600
  9. Tesla Model S AWD: 590
  10. Mercedes CLA 250+: 585

### 2. INTERIOR_DIMENSIONS_EXTENDED.json
- **85 véhicules** avec dimensions intérieures complètes
- Sources: edmunds.com, manufacturer specs
- Données: headroom, legroom, shoulder room (avant/arrière), cargo
- Marques: BMW, Mercedes, Audi, VW, Škoda, Porsche, Tesla, Hyundai, Kia, Volvo, Opel, Peugeot, Renault

### 3. ICE_REAL_CONSUMPTION_DATABASE.json
- **65 variantes moteur** sur 25 modèles
- Sources: honestjohn.co.uk (250,000+ soumissions)
- Données: WLTP vs Real MPG/L/100km
- Couverture: BMW, Mercedes, Audi, VW, Škoda

## ANALYSE DES ÉCARTS WLTP VS RÉEL

| Type carburant | Écart moyen | Real vs WLTP |
|---------------|-------------|--------------|
| Essence | +15% | 85% |
| Diesel | +12% | 88% |
| Essence MHEV | +14% | 86% |
| Diesel MHEV | +10% | 90% |
| **Essence PHEV** | **+70%** | **30%** |

**Insight clé**: Les PHEV sont les pires en écart - leur consommation WLTP (qui assume charge régulière) est quasi-fictive pour les conducteurs qui ne chargent pas.

## CLASSEMENT MARQUES PAR FIABILITÉ CONSO

1. Škoda: 86% du WLTP
2. Volkswagen: 84% du WLTP
3. Mercedes: 82% du WLTP
4. Audi: 81% du WLTP
5. BMW: 79% du WLTP

## DONNÉES COMBINÉES SESSION PRÉCÉDENTE + ACTUELLE

| Database | Véhicules | Source |
|----------|-----------|--------|
| EV Range Complète | 350 | ev-database.org |
| Interior Dimensions | 85 | edmunds/manufacturers |
| ICE Real Consumption | 65 variants | honestjohn.co.uk |
| EuroNCAP Extended | 85 ratings | euroncap.com |
| Vehicle Photos | 500+ | wikimedia commons |
| ADAC Trunk Volumes | 145 | adac.de |
| Screen Cars | 47 | IMCDB/IGCD |

## PROCHAINES ÉTAPES SUGGÉRÉES

1. ✅ Spritmonitor ICE → Complété via Honest John (meilleure source accessible)
2. ✅ EV-Database complet → 350 véhicules couverts
3. ✅ Interior dimensions extended → 85 véhicules
4. ❌ Occasions (La Centrale/AutoScout24) → Reporté comme demandé

## COUVERTURE MVP BRANDS

| Marque | EV | ICE | Dimensions | EuroNCAP |
|--------|-----|-----|------------|----------|
| BMW | ✅ 25 | ✅ 15 | ✅ 9 | ✅ 8 |
| Mercedes | ✅ 30 | ✅ 12 | ✅ 9 | ✅ 10 |
| Audi | ✅ 20 | ✅ 10 | ✅ 9 | ✅ 9 |
| VW | ✅ 18 | ✅ 12 | ✅ 10 | ✅ 11 |
| Porsche | ✅ 15 | - | ✅ 4 | ✅ 2 |
| Škoda | ✅ 12 | ✅ 8 | ✅ 8 | ✅ 7 |
| Opel | ✅ 8 | - | ✅ 4 | - |
