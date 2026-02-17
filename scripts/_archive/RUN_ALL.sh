#!/bin/bash
# ============================================
# FLM AUTO - MASS DATA COLLECTION
# ============================================
# 
# INSTRUCTIONS:
# 1. cd /Users/koa/Dev/flm-auto/scripts
# 2. npm install
# 3. Exécuter les commandes ci-dessous
#
# ============================================

# INSTALLATION (une seule fois)
cd /Users/koa/Dev/flm-auto/scripts
npm install

# ============================================
# COMMANDES INDIVIDUELLES
# ============================================

# 1. SPECS TECHNIQUES (Auto-Data.net - 54000+ véhicules)
npm run scrape:specs
# Output: data/raw/autodata/*.json
# Durée estimée: 30-45 min (avec délais polis)

# 2. FIABILITÉ TÜV (2024, 2025, 2026 reports)
npm run scrape:tuv
# Output: data/raw/tuv/*.json
# Durée estimée: 5-10 min

# 3. PRIX NEUFS L'ARGUS
npm run scrape:prices
# Output: data/raw/argus/*.json
# Durée estimée: 15-20 min

# 4. TESTS ADAC (conso réelle, bruit, coûts)
npm run scrape:adac
# Output: data/raw/adac/*.json
# Durée estimée: 20-30 min

# 5. SÉCURITÉ EURO NCAP
npm run scrape:safety
# Output: data/raw/euroncap/*.json
# Durée estimée: 5-10 min

# 6. COTES OCCASION LA CENTRALE
npm run scrape:cote
# Output: data/raw/lacentrale/*.json
# Durée estimée: 20-30 min

# 7. SPECS EV COMPLETS
npm run scrape:ev
# Output: data/raw/ev_database/*.json
# Durée estimée: 10-15 min

# 8. PERFORMANCE CARWOW
npm run scrape:perf
# Output: data/raw/carwow/*.json
# Durée estimée: 2-5 min

# ============================================
# COMMANDE TOUT-EN-UN (2-3 heures)
# ============================================
npm run scrape:all

# ============================================
# STRUCTURE FINALE ATTENDUE
# ============================================
# data/raw/
# ├── autodata/
# │   ├── bmw.json (~500 specs)
# │   ├── mercedes-benz.json (~500 specs)
# │   ├── audi.json (~400 specs)
# │   ├── volkswagen.json (~400 specs)
# │   ├── porsche.json (~200 specs)
# │   ├── skoda.json (~200 specs)
# │   └── all_specs.json (~2200 specs)
# ├── tuv/
# │   ├── tuv_2024.json
# │   ├── tuv_2025.json
# │   ├── tuv_2026.json
# │   └── tuv_all_years.json
# ├── argus/
# │   └── *_prices.json
# ├── adac/
# │   └── *_tests.json
# ├── euroncap/
# │   └── *_safety.json
# ├── lacentrale/
# │   └── *_cotes.json
# ├── ev_database/
# │   └── *_ev.json
# └── carwow/
#     └── *_performance.json

echo "✅ Scripts prêts à exécuter"
