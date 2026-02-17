/**
 * FLM AUTO - ADAC Tests Scraper (Consommation réelle, bruit, etc.)
 * Source: adac.de/rund-ums-fahrzeug/autokatalog/
 * 
 * Run: npx ts-node scripts/scrapers/04_adac_tests.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle';
const OUTPUT_DIR = '../data/raw/adac';

const BRANDS = [
  { name: 'BMW', slug: 'bmw' },
  { name: 'Mercedes-Benz', slug: 'mercedes' },
  { name: 'Audi', slug: 'audi' },
  { name: 'Volkswagen', slug: 'vw' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Skoda', slug: 'skoda' },
];

interface AdacTest {
  brand: string;
  model: string;
  variant: string;
  test_date: string;
  // Consumption
  consumption_city_real: number;
  consumption_highway_real: number;
  consumption_combined_real: number;
  consumption_wltp: number;
  deviation_percent: number;
  // EcoTest
  ecotest_stars: number;
  ecotest_co2_real: number;
  ecotest_pollutants: number;
  // Noise
  noise_idle_db: number;
  noise_50kmh_db: number;
  noise_100kmh_db: number;
  noise_130kmh_db: number;
  noise_full_throttle_db: number;
  // Costs
  fuel_cost_monthly: number;
  insurance_cost_monthly: number;
  maintenance_cost_monthly: number;
  depreciation_monthly: number;
  total_cost_monthly: number;
  cost_per_km: number;
  // Ratings
  rating_overall: number;
  rating_body: number;
  rating_interior: number;
  rating_comfort: number;
  rating_engine: number;
  rating_driving: number;
  rating_safety: number;
  rating_environment: number;
  rating_costs: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'de-DE,de;q=0.9',
    }
  });
  return await response.text();
}

function parseAdacTest(html: string, brand: string): Partial<AdacTest>[] {
  const tests: Partial<AdacTest>[] = [];
  
  // Parse test results from ADAC format
  // This is a simplified parser - ADAC's structure varies
  
  const testBlockRegex = /<div class="test-result"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  
  while ((match = testBlockRegex.exec(html)) !== null) {
    const block = match[1];
    
    const test: Partial<AdacTest> = { brand };
    
    // Extract model name
    const modelMatch = block.match(/class="model-name"[^>]*>([^<]+)</);
    if (modelMatch) test.model = modelMatch[1].trim();
    
    // Extract consumption values
    const consumptionMatch = block.match(/Verbrauch.*?(\d+[,.]?\d*)\s*l/);
    if (consumptionMatch) {
      test.consumption_combined_real = parseFloat(consumptionMatch[1].replace(',', '.'));
    }
    
    // Extract CO2
    const co2Match = block.match(/CO2.*?(\d+)\s*g/);
    if (co2Match) test.ecotest_co2_real = parseInt(co2Match[1]);
    
    // Extract noise at 130 km/h
    const noiseMatch = block.match(/Innengeräusch.*?130.*?(\d+[,.]?\d*)\s*dB/);
    if (noiseMatch) test.noise_130kmh_db = parseFloat(noiseMatch[1].replace(',', '.'));
    
    // Extract ratings
    const ratingMatch = block.match(/Gesamtnote.*?(\d+[,.]?\d*)/);
    if (ratingMatch) test.rating_overall = parseFloat(ratingMatch[1].replace(',', '.'));
    
    // Extract costs
    const costMatch = block.match(/Kosten.*?(\d+)\s*€.*?Monat/);
    if (costMatch) test.total_cost_monthly = parseInt(costMatch[1]);
    
    if (test.model) tests.push(test);
  }
  
  return tests;
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<Partial<AdacTest>[]> {
  console.log(`\n🧪 Scraping ADAC tests for ${brand.name}...`);
  const tests: Partial<AdacTest>[] = [];
  
  try {
    const url = `${BASE_URL}/${brand.slug}/`;
    const html = await fetchPage(url);
    
    // Get all model pages
    const modelLinks: string[] = [];
    const linkRegex = /href="([^"]*autokatalog[^"]*${brand.slug}[^"]*)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      modelLinks.push(match[1]);
    }
    
    console.log(`  Found ${modelLinks.length} model pages`);
    
    for (const modelUrl of [...new Set(modelLinks)].slice(0, 30)) {
      await delay(600);
      
      try {
        const modelHtml = await fetchPage(modelUrl.startsWith('http') ? modelUrl : `https://www.adac.de${modelUrl}`);
        const modelTests = parseAdacTest(modelHtml, brand.name);
        tests.push(...modelTests);
      } catch (e) {
        // Skip failed pages
      }
    }
  } catch (e) {
    console.error(`  ❌ Error:`, e);
  }
  
  return tests;
}

async function main() {
  console.log('🚀 FLM AUTO - ADAC Test Scraper');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allTests: Partial<AdacTest>[] = [];
  
  for (const brand of BRANDS) {
    const brandTests = await scrapeBrand(brand);
    allTests.push(...brandTests);
    
    const brandFile = path.join(OUTPUT_DIR, `${brand.slug}_tests.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandTests, null, 2));
    console.log(`  💾 Saved ${brandTests.length} tests`);
  }
  
  const combinedFile = path.join(OUTPUT_DIR, 'all_tests.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allTests, null, 2));
  
  console.log(`\n✅ Total: ${allTests.length} ADAC tests`);
}

main().catch(console.error);
