/**
 * FLM AUTO - MEGA ADAC Scraper
 * Scrape les tests ADAC complets: conso réelle, bruit, coûts, notes
 * 
 * Run: npx ts-node scrapers/mega-adac-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/adac';
const BASE_URL = 'https://www.adac.de';
const DELAY_MS = 500;

const TARGET_BRANDS = [
  { name: 'BMW', slug: 'bmw' },
  { name: 'Mercedes', slug: 'mercedes' },
  { name: 'Audi', slug: 'audi' },
  { name: 'VW', slug: 'vw' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Skoda', slug: 'skoda' },
  { name: 'Tesla', slug: 'tesla' },
  { name: 'Hyundai', slug: 'hyundai' },
  { name: 'Volvo', slug: 'volvo' },
  { name: 'Toyota', slug: 'toyota' },
  { name: 'Kia', slug: 'kia' },
  { name: 'Ford', slug: 'ford' },
];

interface AdacTest {
  brand: string;
  model: string;
  variant: string;
  test_date: string | null;
  url: string;
  
  // Overall rating
  rating_overall: number | null;
  rating_body_interior: number | null;
  rating_comfort: number | null;
  rating_engine_drive: number | null;
  rating_driving_characteristics: number | null;
  rating_safety: number | null;
  rating_environment: number | null;
  rating_ecotest: number | null;
  rating_costs: number | null;
  
  // Consumption - REAL values from ADAC testing
  consumption_city_l100km: number | null;
  consumption_highway_l100km: number | null;
  consumption_combined_l100km: number | null;
  consumption_ecotest_l100km: number | null;
  consumption_wltp_l100km: number | null;
  consumption_deviation_percent: number | null;
  
  // Electric consumption
  consumption_city_kwh100km: number | null;
  consumption_highway_kwh100km: number | null;
  consumption_combined_kwh100km: number | null;
  
  // CO2 emissions
  co2_ecotest_gkm: number | null;
  co2_wltp_gkm: number | null;
  
  // Noise measurements (dB)
  noise_idle_db: number | null;
  noise_50kmh_db: number | null;
  noise_100kmh_db: number | null;
  noise_120kmh_db: number | null;
  noise_130kmh_db: number | null;
  noise_full_throttle_db: number | null;
  
  // Range (electric)
  range_adac_km: number | null;
  range_city_km: number | null;
  range_highway_km: number | null;
  range_wltp_km: number | null;
  
  // Performance measured
  acceleration_0_100_measured: number | null;
  acceleration_0_100_manufacturer: number | null;
  top_speed_measured: number | null;
  top_speed_manufacturer: number | null;
  elasticity_60_100_sec: number | null;
  elasticity_80_120_sec: number | null;
  
  // Braking
  braking_100_0_m: number | null;
  braking_100_0_wet_m: number | null;
  
  // Costs (monthly/yearly)
  cost_monthly_eur: number | null;
  cost_per_km_eur: number | null;
  cost_fuel_monthly_eur: number | null;
  cost_insurance_monthly_eur: number | null;
  cost_tax_yearly_eur: number | null;
  cost_maintenance_monthly_eur: number | null;
  cost_depreciation_monthly_eur: number | null;
  
  // Trunk volume measured
  trunk_adac_l: number | null;
  trunk_max_adac_l: number | null;
  
  // Dimensions measured
  interior_length_mm: number | null;
  interior_width_front_mm: number | null;
  interior_width_rear_mm: number | null;
  
  scraped_at: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        }
      });
      if (response.status === 404) return '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(2000 * (i + 1));
    }
  }
  throw new Error('Fetch failed');
}

function extractNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '.').replace(/\s/g, '');
  const match = cleaned.match(/-?[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

async function getBrandModelList(brand: { name: string; slug: string }): Promise<string[]> {
  // ADAC URL structure: /rund-ums-fahrzeug/autokatalog/marken-modelle/BRAND/
  const url = `${BASE_URL}/rund-ums-fahrzeug/autokatalog/marken-modelle/${brand.slug}/`;
  
  try {
    const html = await fetchWithRetry(url);
    if (!html) return [];
    
    // Find model links
    const modelUrls: string[] = [];
    const linkRegex = /href="([^"]*autokatalog[^"]*marken-modelle[^"]*)"[^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      let modelUrl = match[1];
      if (!modelUrl.startsWith('http')) {
        modelUrl = modelUrl.startsWith('/') ? modelUrl : '/' + modelUrl;
      }
      if (modelUrl.includes(brand.slug) && !modelUrls.includes(modelUrl)) {
        modelUrls.push(modelUrl);
      }
    }
    
    return modelUrls;
  } catch (e) {
    return [];
  }
}

async function getModelVariants(modelUrl: string): Promise<string[]> {
  const url = modelUrl.startsWith('http') ? modelUrl : `${BASE_URL}${modelUrl}`;
  
  try {
    const html = await fetchWithRetry(url);
    if (!html) return [];
    
    // Find test/variant links
    const variantUrls: string[] = [];
    const linkRegex = /href="([^"]*autotest[^"]*)"/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      let variantUrl = match[1];
      if (!variantUrl.startsWith('http')) {
        variantUrl = variantUrl.startsWith('/') ? variantUrl : '/' + variantUrl;
      }
      if (!variantUrls.includes(variantUrl)) {
        variantUrls.push(variantUrl);
      }
    }
    
    return variantUrls.slice(0, 30); // Limit variants
  } catch (e) {
    return [];
  }
}

function parseTestPage(html: string, url: string, brandName: string): AdacTest | null {
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  if (!title) return null;
  
  const test: AdacTest = {
    brand: brandName,
    model: title,
    variant: '',
    test_date: null,
    url,
    rating_overall: null,
    rating_body_interior: null,
    rating_comfort: null,
    rating_engine_drive: null,
    rating_driving_characteristics: null,
    rating_safety: null,
    rating_environment: null,
    rating_ecotest: null,
    rating_costs: null,
    consumption_city_l100km: null,
    consumption_highway_l100km: null,
    consumption_combined_l100km: null,
    consumption_ecotest_l100km: null,
    consumption_wltp_l100km: null,
    consumption_deviation_percent: null,
    consumption_city_kwh100km: null,
    consumption_highway_kwh100km: null,
    consumption_combined_kwh100km: null,
    co2_ecotest_gkm: null,
    co2_wltp_gkm: null,
    noise_idle_db: null,
    noise_50kmh_db: null,
    noise_100kmh_db: null,
    noise_120kmh_db: null,
    noise_130kmh_db: null,
    noise_full_throttle_db: null,
    range_adac_km: null,
    range_city_km: null,
    range_highway_km: null,
    range_wltp_km: null,
    acceleration_0_100_measured: null,
    acceleration_0_100_manufacturer: null,
    top_speed_measured: null,
    top_speed_manufacturer: null,
    elasticity_60_100_sec: null,
    elasticity_80_120_sec: null,
    braking_100_0_m: null,
    braking_100_0_wet_m: null,
    cost_monthly_eur: null,
    cost_per_km_eur: null,
    cost_fuel_monthly_eur: null,
    cost_insurance_monthly_eur: null,
    cost_tax_yearly_eur: null,
    cost_maintenance_monthly_eur: null,
    cost_depreciation_monthly_eur: null,
    trunk_adac_l: null,
    trunk_max_adac_l: null,
    interior_length_mm: null,
    interior_width_front_mm: null,
    interior_width_rear_mm: null,
    scraped_at: new Date().toISOString(),
  };
  
  // Parse spec tables
  const patterns = [
    /<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]*)<\/td>/gi,
    /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/gi,
    /<span[^>]*class="[^"]*label[^"]*"[^>]*>([^<]+)<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]+)<\/span>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const label = match[1].toLowerCase().trim();
      const value = match[2].trim();
      
      if (!value || value === '-') continue;
      
      // Ratings (German: Note, Bewertung)
      if (label.includes('gesamtnote') || label.includes('overall')) test.rating_overall = extractNumber(value);
      else if (label.includes('karosserie') || label.includes('body')) test.rating_body_interior = extractNumber(value);
      else if (label.includes('komfort') || label.includes('comfort')) test.rating_comfort = extractNumber(value);
      else if (label.includes('motor') || label.includes('engine')) test.rating_engine_drive = extractNumber(value);
      else if (label.includes('fahreigenschaft') || label.includes('driving')) test.rating_driving_characteristics = extractNumber(value);
      else if (label.includes('sicherheit') || label.includes('safety')) test.rating_safety = extractNumber(value);
      else if (label.includes('umwelt') || label.includes('environment')) test.rating_environment = extractNumber(value);
      else if (label.includes('ecotest')) test.rating_ecotest = extractNumber(value);
      else if (label.includes('kosten') || label.includes('cost')) test.rating_costs = extractNumber(value);
      
      // Consumption (German: Verbrauch)
      else if ((label.includes('stadt') || label.includes('city')) && label.includes('verbrauch')) {
        if (label.includes('kwh')) test.consumption_city_kwh100km = extractNumber(value);
        else test.consumption_city_l100km = extractNumber(value);
      }
      else if ((label.includes('land') || label.includes('highway') || label.includes('außerorts')) && label.includes('verbrauch')) {
        if (label.includes('kwh')) test.consumption_highway_kwh100km = extractNumber(value);
        else test.consumption_highway_l100km = extractNumber(value);
      }
      else if (label.includes('ecotest') && label.includes('verbrauch')) test.consumption_ecotest_l100km = extractNumber(value);
      else if (label.includes('wltp') && label.includes('verbrauch')) test.consumption_wltp_l100km = extractNumber(value);
      else if (label.includes('gesamt') && label.includes('verbrauch')) {
        if (label.includes('kwh')) test.consumption_combined_kwh100km = extractNumber(value);
        else test.consumption_combined_l100km = extractNumber(value);
      }
      
      // CO2
      else if (label.includes('co2') && label.includes('ecotest')) test.co2_ecotest_gkm = extractNumber(value);
      else if (label.includes('co2') && label.includes('wltp')) test.co2_wltp_gkm = extractNumber(value);
      
      // Noise (German: Geräusch, Innengeräusch)
      else if (label.includes('leerlauf') || label.includes('idle')) test.noise_idle_db = extractNumber(value);
      else if (label.includes('50 km') || label.includes('50km')) test.noise_50kmh_db = extractNumber(value);
      else if (label.includes('100 km') || label.includes('100km')) test.noise_100kmh_db = extractNumber(value);
      else if (label.includes('120 km') || label.includes('120km')) test.noise_120kmh_db = extractNumber(value);
      else if (label.includes('130 km') || label.includes('130km')) test.noise_130kmh_db = extractNumber(value);
      else if (label.includes('vollgas') || label.includes('full throttle')) test.noise_full_throttle_db = extractNumber(value);
      
      // Range (German: Reichweite)
      else if (label.includes('adac') && label.includes('reichweite')) test.range_adac_km = extractNumber(value);
      else if (label.includes('stadt') && label.includes('reichweite')) test.range_city_km = extractNumber(value);
      else if ((label.includes('autobahn') || label.includes('highway')) && label.includes('reichweite')) test.range_highway_km = extractNumber(value);
      else if (label.includes('wltp') && label.includes('reichweite')) test.range_wltp_km = extractNumber(value);
      
      // Performance
      else if (label.includes('0-100') || label.includes('beschleunigung')) {
        if (label.includes('gemessen') || label.includes('measured')) test.acceleration_0_100_measured = extractNumber(value);
        else if (label.includes('hersteller') || label.includes('manufacturer')) test.acceleration_0_100_manufacturer = extractNumber(value);
        else test.acceleration_0_100_measured = extractNumber(value);
      }
      else if (label.includes('höchstgeschwindigkeit') || label.includes('top speed')) {
        if (label.includes('gemessen')) test.top_speed_measured = extractNumber(value);
        else test.top_speed_manufacturer = extractNumber(value);
      }
      else if (label.includes('60-100') || label.includes('elastizität')) test.elasticity_60_100_sec = extractNumber(value);
      else if (label.includes('80-120')) test.elasticity_80_120_sec = extractNumber(value);
      
      // Braking
      else if (label.includes('bremsweg') && label.includes('trocken')) test.braking_100_0_m = extractNumber(value);
      else if (label.includes('bremsweg') && label.includes('nass')) test.braking_100_0_wet_m = extractNumber(value);
      
      // Costs (German: Kosten)
      else if (label.includes('monatlich') && label.includes('gesamt')) test.cost_monthly_eur = extractNumber(value);
      else if (label.includes('pro km') || label.includes('cent/km')) test.cost_per_km_eur = extractNumber(value);
      else if (label.includes('kraftstoff') && label.includes('monat')) test.cost_fuel_monthly_eur = extractNumber(value);
      else if (label.includes('versicherung')) test.cost_insurance_monthly_eur = extractNumber(value);
      else if (label.includes('steuer')) test.cost_tax_yearly_eur = extractNumber(value);
      else if (label.includes('werkstatt') || label.includes('wartung')) test.cost_maintenance_monthly_eur = extractNumber(value);
      else if (label.includes('wertverlust')) test.cost_depreciation_monthly_eur = extractNumber(value);
      
      // Trunk (German: Kofferraum)
      else if (label.includes('kofferraum') && label.includes('max')) test.trunk_max_adac_l = extractNumber(value);
      else if (label.includes('kofferraum') || label.includes('ladevolumen')) test.trunk_adac_l = extractNumber(value);
    }
  }
  
  // Extract test date
  const dateMatch = html.match(/getestet[:\s]+(\d{1,2})\.?\s*\/?\s*(\d{4})/i) ||
                    html.match(/Stand[:\s]+(\d{1,2})\.(\d{4})/i);
  if (dateMatch) {
    test.test_date = `${dateMatch[2]}-${dateMatch[1].padStart(2, '0')}-01`;
  }
  
  return test;
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<AdacTest[]> {
  console.log(`\n🚗 Scraping ${brand.name}...`);
  
  const tests: AdacTest[] = [];
  
  // Get model list
  const models = await getBrandModelList(brand);
  console.log(`   Found ${models.length} model pages`);
  
  for (const modelUrl of models.slice(0, 30)) { // Limit models per brand
    await delay(DELAY_MS);
    
    // Get variants/tests for this model
    const variants = await getModelVariants(modelUrl);
    
    for (const variantUrl of variants.slice(0, 20)) { // Limit variants
      await delay(DELAY_MS);
      
      const url = variantUrl.startsWith('http') ? variantUrl : `${BASE_URL}${variantUrl}`;
      
      try {
        const html = await fetchWithRetry(url);
        if (!html) continue;
        
        const test = parseTestPage(html, url, brand.name);
        if (test && (test.rating_overall || test.consumption_combined_l100km || test.noise_130kmh_db)) {
          tests.push(test);
          process.stdout.write(`\r   ${brand.name}: ${tests.length} tests scraped...`);
        }
      } catch (e) {
        // Skip failed pages
      }
    }
  }
  
  console.log(`\n   ✅ ${brand.name}: ${tests.length} tests`);
  return tests;
}

async function main() {
  console.log('🚀 FLM AUTO - MEGA ADAC Scraper');
  console.log('⏱️  Estimated time: 30-60 minutes\n');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const allTests: AdacTest[] = [];
  const startTime = Date.now();
  
  for (const brand of TARGET_BRANDS) {
    const brandTests = await scrapeBrand(brand);
    allTests.push(...brandTests);
    
    // Save per-brand
    const brandFile = path.join(OUTPUT_DIR, `${brand.slug}_tests.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandTests, null, 2));
    
    // Checkpoint
    const checkpointFile = path.join(OUTPUT_DIR, 'checkpoint_all.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(allTests, null, 2));
  }
  
  // Save all
  const allFile = path.join(OUTPUT_DIR, 'mega_adac_all.json');
  fs.writeFileSync(allFile, JSON.stringify(allTests, null, 2));
  
  // Summary
  console.log('\n\n📊 SCRAPING COMPLETE!');
  console.log(`   Total tests: ${allTests.length}`);
  
  const withConsumption = allTests.filter(t => t.consumption_combined_l100km || t.consumption_combined_kwh100km).length;
  const withNoise = allTests.filter(t => t.noise_130kmh_db).length;
  const withCosts = allTests.filter(t => t.cost_monthly_eur).length;
  const withRating = allTests.filter(t => t.rating_overall).length;
  
  console.log('\n📊 Data completeness:');
  console.log(`   Consumption: ${withConsumption} (${Math.round(withConsumption/allTests.length*100)}%)`);
  console.log(`   Noise levels: ${withNoise} (${Math.round(withNoise/allTests.length*100)}%)`);
  console.log(`   Cost data: ${withCosts} (${Math.round(withCosts/allTests.length*100)}%)`);
  console.log(`   Ratings: ${withRating} (${Math.round(withRating/allTests.length*100)}%)`);
  
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n⏱️  Total time: ${elapsed.toFixed(1)} minutes`);
}

main().catch(console.error);
