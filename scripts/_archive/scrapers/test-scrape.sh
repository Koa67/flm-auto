#!/bin/bash
# Quick scrape test - run from project root
# Usage: ./scripts/scrapers/test-scrape.sh

echo "🚀 Testing Edmunds scrape structure..."

# BMW 3-Series 2024 (known working)
URL="https://www.edmunds.com/bmw/3-series/2024/features-specs/"

echo "Testing: $URL"
echo ""

# Extract key dimensions using grep patterns
curl -sL "$URL" 2>/dev/null | grep -oE "(Front|Rear) (head|leg|shoulder) room[^<]*<[^>]*>[0-9.]+ in" | head -10

echo ""
echo "✅ If you see dimension data above, scraping works!"
echo ""
echo "Full scrape list in: data/raw/scrape-urls.json"
