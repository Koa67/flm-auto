/**
 * FLM AUTO - Scrape automobile-catalog.com for Audi, Porsche, VW
 * 
 * Usage: npx ts-node scripts/scrape-auto-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface VehicleSpec {
  brand: string;
  model: string;
  variant: string;
  generation: string | null;
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
  gears: number | null;
  fuel_consumption_l100km: number | null;
  co2_gkm: number | null;
  year_start: number | null;
  year_end: number | null;
  source_url: string;
  scraped_at: string;
}

const BRANDS = [
  { name: 'Audi', slug: 'audi' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Volkswagen', slug: 'vw' },
];

const BASE_URL = 'https://www.automobile-catalog.com';

async function fetchPage(url: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (res.ok) {
        return await res.text();
      }
      console.log(`   ⚠️ HTTP ${res.status} for ${url}`);
    } catch (err) {
      console.log(`   ⚠️ Error: ${err}`);
    }
    await delay(1000);
  }
  return null;
}

function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const match = str.match(/[\d.,]+/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(',', '.'));
  return isNaN(num) ? null : num;
}

function extractSpec(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

async function getModelLinks(brandSlug: string): Promise<string[]> {
  // automobile-catalog structure: /make/brand/
  const url = `${BASE_URL}/make/${brandSlug}/`;
  console.log(`   Fetching: ${url}`);
  
  const html = await fetchPage(url);
  if (!html) return [];

  const links: string[] = [];
  
  // Pattern: /car/brand/model/
  const pattern = new RegExp(`href="(/car/${brandSlug}/[^"]+)"`, 'gi');
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }

  // Also check for make2 pattern
  const pattern2 = new RegExp(`href="(/make2/${brandSlug}/[^"]+)"`, 'gi');
  while ((match = pattern2.exec(html)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }

  return links;
}

async function scrapeVehiclePage(url: string, brand: string): Promise<VehicleSpec | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  try {
    // Title usually contains model and variant
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    
    // Extract variant name from h1 or title
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const variant = h1Match ? h1Match[1].trim() : title.split('|')[0]?.trim() || 'Unknown';

    // Try to extract generation/model year range
    const yearMatch = variant.match(/\b(19|20)\d{2}\b/);
    const yearStart = yearMatch ? parseInt(yearMatch[0]) : null;

    // Extract model name
    const modelMatch = variant.match(new RegExp(`${brand}\\s+([A-Za-z0-9]+)`, 'i'));
    const model = modelMatch ? modelMatch[1] : variant.split(' ')[1] || 'Unknown';

    // Generation code patterns
    const genPatterns = [
      /\b([A-Z]\d{1,2})\b/,  // Audi: A4 B8, A6 C7
      /\b(Typ\s*\d+[A-Z]?)\b/i, // VW: Typ 3C
      /\b(9\d{2})\b/, // Porsche: 911, 964, 993
      /\b(Mk\s*\d+)\b/i, // Mk1, Mk2
    ];
    let generation: string | null = null;
    for (const p of genPatterns) {
      const m = variant.match(p);
      if (m) { generation = m[1]; break; }
    }

    const spec: VehicleSpec = {
      brand,
      model,
      variant,
      generation,
      engine_type: extractSpec(html, [
        /Fuel\s*(?:type)?:?\s*<[^>]*>([^<]+)/i,
        /Engine\s*type:?\s*<[^>]*>([^<]+)/i,
      ]),
      displacement_cc: parseNumber(extractSpec(html, [
        /Displacement:?\s*<[^>]*>([^<]+)/i,
        /Engine\s*size:?\s*<[^>]*>([^<]+)/i,
        /(\d{3,4})\s*cc/i,
        /(\d\.\d)\s*[Ll]/i,
      ])),
      cylinders: parseNumber(extractSpec(html, [
        /Cylinders:?\s*<[^>]*>(\d+)/i,
        /(\d)\s*cyl/i,
      ])),
      power_hp: parseNumber(extractSpec(html, [
        /Power:?\s*<[^>]*>([^<]+hp)/i,
        /(\d+)\s*hp/i,
        /(\d+)\s*bhp/i,
        /(\d+)\s*PS/i,
      ])),
      power_kw: parseNumber(extractSpec(html, [
        /(\d+)\s*kW/i,
      ])),
      torque_nm: parseNumber(extractSpec(html, [
        /Torque:?\s*<[^>]*>([^<]+)/i,
        /(\d+)\s*Nm/i,
        /(\d+)\s*lb.ft/i,
      ])),
      acceleration_0_100: parseNumber(extractSpec(html, [
        /0-100:?\s*<[^>]*>([^<]+)/i,
        /0\s*(?:to|-)?\s*100:?\s*([^<\s]+)/i,
        /Acceleration:?\s*<[^>]*>([^<]+)/i,
      ])),
      top_speed_kmh: parseNumber(extractSpec(html, [
        /Top\s*speed:?\s*<[^>]*>([^<]+)/i,
        /Max(?:imum)?\s*speed:?\s*<[^>]*>([^<]+)/i,
        /(\d{3})\s*km\/h/i,
      ])),
      length_mm: parseNumber(extractSpec(html, [
        /Length:?\s*<[^>]*>([^<]+)/i,
        /(\d{4,5})\s*mm.*length/i,
      ])),
      width_mm: parseNumber(extractSpec(html, [
        /Width:?\s*<[^>]*>([^<]+)/i,
        /(\d{4})\s*mm.*width/i,
      ])),
      height_mm: parseNumber(extractSpec(html, [
        /Height:?\s*<[^>]*>([^<]+)/i,
        /(\d{4})\s*mm.*height/i,
      ])),
      wheelbase_mm: parseNumber(extractSpec(html, [
        /Wheelbase:?\s*<[^>]*>([^<]+)/i,
        /(\d{4})\s*mm.*wheelbase/i,
      ])),
      trunk_volume_l: parseNumber(extractSpec(html, [
        /Trunk:?\s*<[^>]*>([^<]+)/i,
        /Boot:?\s*<[^>]*>([^<]+)/i,
        /Cargo:?\s*<[^>]*>([^<]+)/i,
        /(\d{2,4})\s*(?:liters?|l)\s*(?:trunk|boot|cargo)/i,
      ])),
      curb_weight_kg: parseNumber(extractSpec(html, [
        /(?:Curb|Kerb)\s*weight:?\s*<[^>]*>([^<]+)/i,
        /Weight:?\s*<[^>]*>([^<]+kg)/i,
        /(\d{3,4})\s*kg/i,
      ])),
      drivetrain: extractSpec(html, [
        /Drive(?:train)?:?\s*<[^>]*>([^<]+)/i,
        /Driven\s*wheels:?\s*<[^>]*>([^<]+)/i,
        /(AWD|4WD|FWD|RWD|Quattro|4Motion|4MATIC)/i,
      ]),
      transmission: extractSpec(html, [
        /Transmission:?\s*<[^>]*>([^<]+)/i,
        /Gearbox:?\s*<[^>]*>([^<]+)/i,
        /(Manual|Automatic|DSG|PDK|Tiptronic|S-?tronic)/i,
      ]),
      gears: parseNumber(extractSpec(html, [
        /(\d+)\s*(?:speed|gear)/i,
      ])),
      fuel_consumption_l100km: parseNumber(extractSpec(html, [
        /Consumption:?\s*<[^>]*>([^<]+)/i,
        /(\d+\.?\d*)\s*l\/100/i,
      ])),
      co2_gkm: parseNumber(extractSpec(html, [
        /CO2:?\s*<[^>]*>([^<]+)/i,
        /(\d+)\s*g\/km/i,
      ])),
      year_start: yearStart,
      year_end: null,
      source_url: url,
      scraped_at: new Date().toISOString(),
    };

    // Only return if we got meaningful data
    if (spec.power_hp || spec.displacement_cc || spec.length_mm) {
      return spec;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Scraping ${brand.name}...`);
  console.log('═'.repeat(60));

  const specs: VehicleSpec[] = [];
  const modelLinks = await getModelLinks(brand.slug);
  
  console.log(`   Found ${modelLinks.length} model/variant links`);
  await delay(500);

  let processed = 0;
  for (const link of modelLinks.slice(0, 200)) { // Limit
    processed++;
    process.stdout.write(`\r   [${processed}/${Math.min(modelLinks.length, 200)}] Scraping...`);

    const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
    const spec = await scrapeVehiclePage(fullUrl, brand.name);
    
    if (spec) {
      specs.push(spec);
    }

    await delay(300);
  }

  console.log(`\n   ✅ Found ${specs.length} vehicles for ${brand.name}`);
  return specs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - automobile-catalog.com Scraper              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/auto-catalog');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const brand of BRANDS) {
    const specs = await scrapeBrand(brand);
    
    const outputFile = path.join(outputDir, `${brand.slug}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
    console.log(`   💾 Saved to ${outputFile}`);
    
    await delay(2000);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  
  for (const brand of BRANDS) {
    const file = path.join(outputDir, `${brand.slug}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    console.log(`   ${brand.name}: ${data.length} vehicles`);
  }

  console.log('\n✅ Done! Next: npm run import:auto-catalog');
}

main().catch(console.error);
