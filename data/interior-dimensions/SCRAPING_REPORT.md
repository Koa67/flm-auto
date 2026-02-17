# Scraping Golden Set - Rapport Session

**Date**: 31 Janvier 2026

## Résumé

| Métrique | Valeur |
|----------|--------|
| **Véhicules scrapés** | 12 nouveaux |
| **Total v3** | 37 véhicules |
| **Golden Set couvert** | 12/30 (40%) |
| **Sources utilisées** | 12 |

## Véhicules Ajoutés (Golden Set)

| ID | Véhicule | Headroom F/R | Legroom F/R | Source |
|----|----------|--------------|-------------|--------|
| GS-001 | BMW M340i | 983/955 mm | 1067/894 mm | BMW dealer |
| GS-002 | Audi S4 | 947/950 mm | 1049/907 mm | CarsDirect |
| GS-003 | Mercedes C43 | 1016/953 mm | 1059/914 mm | StateCollege MB |
| GS-004 | BMW M3 | 1031/960 mm | 1057/904 mm | Richmond BMW |
| GS-009 | Porsche Macan S | ❌ N/A | ❌ N/A | Porsche (non publié) |
| GS-011 | VW Tiguan | 1006/988 mm | 1021/983 mm | Edmunds |
| GS-013 | Porsche 911 | ❌ N/A | ❌ N/A | Porsche (non publié) |
| GS-023 | Skoda Superb Combi | 1049/986 mm | ❌ N/A | Skoda PDF |
| GS-024 | VW Passat Variant | 1038/986 mm | 1077/992 mm | VW Press |
| GS-025 | Tesla Model 3 | 1024/960 mm | 1085/894 mm | AutoPadre |
| GS-026 | BMW i4 M50 | 970/930 mm | 1054/869 mm | BMW Seattle |
| GS-027 | Porsche Taycan | ❌ N/A | ❌ N/A | Porsche (non publié) |
| GS-030 | Hyundai Ioniq 5 | 993/953 mm | 1059/1001 mm | Doral Hyundai |

## Problème Porsche

**Porsche NE PUBLIE PAS les dimensions intérieures officielles** (headroom, legroom, shoulder room) pour :
- 911 (992)
- Taycan
- Macan
- Cayenne (partiellement)

Les specs Road & Track confirment : "Front Head Room: NA"

### Solutions possibles
1. Mesures manuelles (presse automobile)
2. Sources tierces (Car and Driver tests)
3. Estimation par plateforme (ex: Taycan ≈ Audi e-tron GT)
4. Exclusion du Golden Set pour ces véhicules

## Véhicules Golden Set Manquants

| ID | Véhicule | Action requise |
|----|----------|----------------|
| GS-005 | Audi RS4 Avant | Scraper |
| GS-006 | Mercedes C63 | Scraper (W205) |
| GS-007 | BMW X3 M40i | ✅ Déjà dans X3 |
| GS-008 | Audi SQ5 | Scraper |
| GS-010 | Skoda Karoq | Scraper |
| GS-012 | Hyundai Tucson | Scraper |
| GS-014 | BMW M2 | Scraper |
| GS-015 | Audi TT RS | Scraper |
| GS-016 | Mercedes AMG GT | Scraper |
| GS-017 | Porsche Cayman GT4 | ❌ Porsche |
| GS-018 | BMW Z4 M40i | Scraper |
| GS-019 | BMW 320d Touring | Scraper |
| GS-020 | Audi A4 Avant | ✅ Même que A4 |
| GS-021 | Mercedes C220d Estate | Scraper |
| GS-022 | Volvo V60 | Scraper |
| GS-028 | Mercedes EQE | Scraper |
| GS-029 | Audi e-tron GT | Scraper |

## Fichiers Créés

- `/data/interior-dimensions/scraped-dimensions-v3.json` - 37 véhicules
- `/data/DATA_INVENTORY.md` - Inventaire complet

## Prochaines Étapes

1. **Scraper les 15 véhicules restants** (~1h de travail)
2. **Résoudre le problème Porsche** (trouver sources alternatives)
3. **Family Fit Data** - Phase 2 prioritaire
4. **Import Supabase** - Attente config .env
