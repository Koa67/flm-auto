#!/bin/bash
#
# FLM AUTO - Complete Photo Scraping Pipeline
# Runs all photo scrapers in sequence with fallback strategy
#
# Usage: ./scripts/run-photo-pipeline.sh
#

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   FLM AUTO - Complete Photo Scraping Pipeline              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

# Check if tsx is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

# Step 1: Ultimate scraper (API-based, fast)
echo "═══════════════════════════════════════════════════════════"
echo "STEP 1/2: Running Ultimate Photo Scraper (API-based)"
echo "═══════════════════════════════════════════════════════════"
echo ""

npx tsx scripts/scrape-photos-ultimate.ts || {
    echo "⚠️  Ultimate scraper had issues, continuing..."
}

echo ""

# Step 2: Aggressive scraper (Puppeteer-based, for missing photos)
echo "═══════════════════════════════════════════════════════════"
echo "STEP 2/2: Running Aggressive Photo Scraper (Puppeteer)"
echo "═══════════════════════════════════════════════════════════"
echo ""

npx tsx scripts/scrape-photos-aggressive.ts || {
    echo "⚠️  Aggressive scraper had issues, continuing..."
}

echo ""

# Final report
echo "═══════════════════════════════════════════════════════════"
echo "FINAL REPORT"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Count photos in each file
count_photos() {
    if [ -f "$1" ]; then
        node -e "console.log(JSON.parse(require('fs').readFileSync('$1')).length)"
    else
        echo "0"
    fi
}

echo "Photo files:"
echo "  vehicle-photos.json:      $(count_photos data/vehicle-photos.json)"
echo "  photos-mega-batch.json:   $(count_photos data/photos-mega-batch.json)"
echo "  photos-premium-batch.json: $(count_photos data/photos-premium-batch.json)"
echo "  photos-ultimate.json:     $(count_photos data/photos-ultimate.json)"
echo "  photos-aggressive.json:   $(count_photos data/photos-aggressive.json)"
echo ""

# Total
total=$(node -e "
const fs = require('fs');
const files = [
    'data/vehicle-photos.json',
    'data/photos-mega-batch.json',
    'data/photos-premium-batch.json',
    'data/photos-ultimate.json',
    'data/photos-aggressive.json'
];
let total = 0;
for (const f of files) {
    try {
        total += JSON.parse(fs.readFileSync(f)).length;
    } catch (e) {}
}
console.log(total);
")

echo "═══════════════════════════════════════════════════════════"
echo "TOTAL PHOTOS: $total"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Pipeline complete!"
