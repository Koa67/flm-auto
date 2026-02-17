/**
 * FLM AUTO - Scrape UltimateSpecs for Audi, Porsche, VW
 * 
 * Usage: npx ts-node scripts/scrape-ultimatespecs-new.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface VehicleSpec {
  brand: string;
  model: string;
  variant: string;
  engine_type: string | null;
  displacement_cc: number | null;
  cylinders: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  trunk_volume_l: number | null;
  curb_weight_kg: number | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel_consumption_l100km: number | null;
  co2_gkm: number | null;
  source_url: string | null;
  scraped_at: string;
}

const BRANDS = [
  { name: 'Audi', slug: 'audi' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Volkswagen', slug: 'volkswagen' },
];

const BASE_URL = 'https://www.ultimatespecs.com';

/**
 * Fetch with retry
 */
async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      if (!res.ok) {
        console.log(`   ⚠️ HTTP ${res.status} for ${url}`);
        await delay(2000);
        continue;
      }
      
      return await res.text();
    } catch (err) {
      console.log(`   ⚠️ Fetch error (attempt ${i + 1}): ${err}`);
      await delay(2000);
    }
  }
  return null;
}

/**
 * Parse number from string
 */
function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract specs from vehicle page
 */
function parseVehiclePage(html: string, brand: string, url: string): VehicleSpec | null {
  try {
    // Extract title/variant name
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const variant = titleMatch ? titleMatch[1].trim() : 'Unknown';

    // Helper to extract spec value
    const getSpec = (label: string): string | null => {
      const patterns = [
        new RegExp(`${label}[^<]*<[^>]*>\\s*([^<]+)`, 'i'),
        new RegExp(`<td[^>]*>${label}<\\/td>\\s*<td[^>]*>([^<]+)<\\/td>`, 'i'),
        new RegExp(`${label}[:\\s]*</[^>]+>\\s*<[^>]+>([^<]+)`, 'i'),
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return null;
    };

    // Extract model from variant
    const modelMatch = variant.match(/^(?:Audi|Porsche|Volkswagen|VW)\s+([A-Za-z0-9]+)/i);
    const model = modelMatch ? modelMatch[1] : variant.split(' ')[1] || 'Unknown';

    const spec: VehicleSpec = {
      brand,
      model,
      variant,
      engine_type: getSpec('Engine Type') || getSpec('Fuel'),
      displacement_cc: parseNumber(getSpec('Displacement') || getSpec('Engine Size')),
      cylinders: parseNumber(getSpec('Cylinders') || getSpec('Number of Cylinders')),
      power_hp: parseNumber(getSpec('Power') || getSpec('Horsepower') || getSpec('Max Power')),
      power_kw: parseNumber(getSpec('Power.*kW') || getSpec('kW')),
      torque_nm: parseNumber(getSpec('Torque') || getSpec('Max Torque')),
      acceleration_0_100: parseNumber(getSpec('0-100') || getSpec('0 to 100') || getSpec('Acceleration')),
      top_speed_kmh: parseNumber(getSpec('Top Speed') || getSpec('Max Speed')),
      length_mm: parseNumber(getSpec('Length')),
      width_mm: parseNumber(getSpec('Width')),
      height_mm: parseNumber(getSpec('Height')),
      wheelbase_mm: parseNumber(getSpec('Wheelbase')),
      trunk_volume_l: parseNumber(getSpec('Trunk') || getSpec('Boot') || getSpec('Cargo')),
      curb_weight_kg: parseNumber(getSpec('Weight') || getSpec('Curb Weight') || getSpec('Kerb Weight')),
      drivetrain: getSpec('Drive') || getSpec('Drivetrain') || getSpec('Driven Wheels'),
      transmission: getSpec('Transmission') || getSpec('Gearbox'),
      fuel_consumption_l100km: parseNumber(getSpec('Fuel Consumption') || getSpec('Combined')),
      co2_gkm: parseNumber(getSpec('CO2') || getSpec('Emissions')),
      source_url: url,
      scraped_at: new Date().toISOString(),
    };

    // Only return if we have some useful data
    if (spec.power_hp || spec.displacement_cc || spec.length_mm) {
      return spec;
    }
    
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Get all model links from brand page
 */
async function getModelLinks(brandSlug: string): Promise<string[]> {
  const url = `${BASE_URL}/cars/specs/${brandSlug}/`;
  console.log(`   Fetching brand page: ${url}`);
  
  const html = await fetchWithRetry(url);
  if (!html) return [];

  // Extract model links
  const links: string[] = [];
  const linkPattern = new RegExp(`href="(/car-specs/${brandSlug}/[^"]+)"`, 'gi');
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    const link = match[1];
    if (!links.includes(link)) {
      links.push(link);
    }
  }

  // Also try alternative pattern
  const altPattern = new RegExp(`href="(/cars/specs/${brandSlug}/[^"]+)"`, 'gi');
  while ((match = altPattern.exec(html)) !== null) {
    const link = match[1];
    if (!links.includes(link)) {
      links.push(link);
    }
  }

  console.log(`   Found ${links.length} model links`);
  return links;
}

/**
 * Get all variant links from model page
 */
async function getVariantLinks(modelPath: string): Promise<string[]> {
  const url = `${BASE_URL}${modelPath}`;
  
  const html = await fetchWithRetry(url);
  if (!html) return [];

  const links: string[] = [];
  
  // Look for variant/generation links
  const patterns = [
    /href="([^"]*\/specs\/[^"]+)"/gi,
    /href="([^"]*-specs-[^"]+\.html)"/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const link = match[1];
      if (link.includes('specs') && !links.includes(link)) {
        links.push(link.startsWith('http') ? link : `${BASE_URL}${link}`);
      }
    }
  }

  return links.slice(0, 50); // Limit per model
}

/**
 * Scrape a single brand
 */
async function scrapeBrand(brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Scraping ${brand.name}...`);
  console.log('═'.repeat(60));

  const specs: VehicleSpec[] = [];
  
  // Get model links
  const modelLinks = await getModelLinks(brand.slug);
  await delay(500);

  let processed = 0;
  
  for (const modelPath of modelLinks.slice(0, 100)) { // Limit models
    processed++;
    process.stdout.write(`\r   [${processed}/${modelLinks.length}] Processing models...`);

    // Get variant links
    const variantLinks = await getVariantLinks(modelPath);
    await delay(300);

    for (const variantUrl of variantLinks.slice(0, 20)) { // Limit variants per model
      const html = await fetchWithRetry(variantUrl);
      if (!html) continue;

      const spec = parseVehiclePage(html, brand.name, variantUrl);
      if (spec) {
        specs.push(spec);
      }

      await delay(200);
    }
  }

  console.log(`\n   ✅ Found ${specs.length} vehicles for ${brand.name}`);
  return specs;
}

/**
 * Main
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - UltimateSpecs Scraper (Audi/Porsche/VW)     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const brand of BRANDS) {
    const specs = await scrapeBrand(brand);
    
    // Save to file
    const outputFile = path.join(outputDir, `${brand.slug}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
    console.log(`   💾 Saved to ${outputFile}`);
    
    await delay(2000); // Pause between brands
  }

  console.log('\n✅ Scraping complete!');
  console.log(`\nNext step: Import with:`);
  console.log(`  npx ts-node scripts/import-ultimatespecs-new.ts`);
}

main().catch(console.error);
