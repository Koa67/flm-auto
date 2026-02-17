#!/bin/bash
#
# run-all.sh — Run the full FLM AUTO data pipeline
#
# Usage:
#   bash scripts/pipeline/run-all.sh              # Full run (with purge)
#   bash scripts/pipeline/run-all.sh --skip-purge  # Skip the purge step
#
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

SKIP_PURGE=false
for arg in "$@"; do
  case $arg in
    --skip-purge) SKIP_PURGE=true ;;
  esac
done

TS_NODE="npx ts-node --compiler-options {\"module\":\"CommonJS\"}"

echo ""
echo "================================================================"
echo "  FLM AUTO DATA PIPELINE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""

# Step 0: Purge duplicates and orphans
if [ "$SKIP_PURGE" = false ]; then
  echo ">>> STEP 0: Purge duplicates & orphans"
  echo "---"
  $TS_NODE scripts/pipeline/00-purge-generated.ts
  echo ""
else
  echo ">>> STEP 0: SKIPPED (--skip-purge)"
  echo ""
fi

# Step 1: Import UltimateSpecs
echo ">>> STEP 1: Import UltimateSpecs data"
echo "---"
$TS_NODE scripts/pipeline/01-ultimatespecs-deep.ts
echo ""

# Step 2: Import EV database
echo ">>> STEP 2: Import EV database"
echo "---"
$TS_NODE scripts/pipeline/02-ev-database-import.ts
echo ""

# Step 3: Import TUV reliability data
echo ">>> STEP 3: Import TUV reliability data"
echo "---"
$TS_NODE scripts/pipeline/03-tuv-import.ts
echo ""

# Step 4: Import EPA Fuel Economy (requires manual download first)
if [ -f "data/epa-vehicles.csv" ]; then
  echo ">>> STEP 4: Import EPA Fuel Economy data"
  echo "---"
  $TS_NODE scripts/pipeline/04-epa-import.ts
  echo ""
else
  echo ">>> STEP 4: SKIPPED (data/epa-vehicles.csv not found)"
  echo "    Download: curl -L -o data/epa-vehicles.csv.zip 'https://fueleconomy.gov/feg/epadata/vehicles.csv.zip'"
  echo ""
fi

# Step 5: Import Kaggle Car Specs (requires manual download first)
if [ -f "data/kaggle-car-specs.csv" ]; then
  echo ">>> STEP 5: Import Kaggle Car Specifications"
  echo "---"
  $TS_NODE scripts/pipeline/05-kaggle-specs-import.ts
  echo ""
else
  echo ">>> STEP 5: SKIPPED (data/kaggle-car-specs.csv not found)"
  echo "    Download from: https://www.kaggle.com/datasets/jahaidulislam/car-specification-dataset-1945-2020"
  echo ""
fi

# Step 6: Fix UltimateSpecs matching (analysis only)
echo ">>> STEP 6: Analyze UltimateSpecs matching quality"
echo "---"
$TS_NODE scripts/pipeline/06-fix-ultimatespecs-matching.ts --dry-run
echo ""

# Final: Audit coverage
echo ">>> FINAL: Audit coverage"
echo "---"
$TS_NODE scripts/pipeline/audit-coverage.ts
echo ""

echo "================================================================"
echo "  PIPELINE COMPLETE"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
