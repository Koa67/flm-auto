/**
 * FLM AUTO - Scraper Auto-Data.net (54000+ specs)
 * Source: https://www.auto-data.net/
 * 
 * Run: npx ts-node scripts/scrapers/01_autodata_specs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.auto-data.net';
const OUTPUT_DIR = '../data/raw/autodata';
const BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda'];

interface VehicleSpec {
  brand: string;
  model: string;
  generation: string;
  variant: string;
  year_start: number;
  year_end: number | null;
  body_type: string;
  doors: number;
  seats: number;
  engine: {
    name: string;
    type: string; // petrol, diesel, electric, hybrid
    displacement_cc: number | null;
    cylinders: number | null;
    power_hp: number;
    power_kw: number;
    torque_nm: number;
    fuel_system: string;
  };
  performance: {
    top_speed_kmh: number;
    acceleration_0_100: number;
  };
  consumption: {
    wltp_combined: number | null;
    wltp_city: number | null;
    wltp_highway: number | null;
    co2_gkm: number | null;
    fuel_tank_l: number;
    electric_range_km: number | null;
    battery_kwh: number | null;
  };
  dimensions: {
    length_mm: number;
    width_mm: number;
    height_mm: number;
    wheelbase_mm: number;
    front_track_mm: number;
    rear_track_mm: number;
    ground_clearance_mm: number;
  };
  weight: {
    curb_kg: number;
    gross_kg: number;
    payload_kg: number;
    towing_braked_kg: number;
    towing_unbraked_kg: number;
    roof_load_kg: number;
  };
  trunk: {
    volume_l: number;
    volume_max_l: number;
  };
  transmission: {
    type: string; // manual, automatic, dct, cvt
    gears: number;
    drive: string; // fwd, rwd, awd
  };
  tires: {
    front: string;
    rear: string;
  };
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
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      console.log(`Retry ${i + 1}/${retries} for ${url}`);
      await delay(2000 * (i + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function getBrandModels(brand: string): Promise<string[]> {
  const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
  const url = `${BASE_URL}/en/${brandSlug}`;
  const html = await fetchWithRetry(url);
  
  // Extract model links
  const modelLinks: string[] = [];
  const regex = /href="(\/en\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1].includes(brandSlug) && !match[1].includes('news')) {
      modelLinks.push(match[1]);
    }
  }
  return [...new Set(modelLinks)];
}

async function getModelGenerations(modelUrl: string): Promise<string[]> {
  const url = `${BASE_URL}${modelUrl}`;
  const html = await fetchWithRetry(url);
  
  const generationLinks: string[] = [];
  const regex = /href="(\/en\/[^"]+)"[^>]*>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1].includes('generation') || match[1].match(/\d{4}/)) {
      generationLinks.push(match[1]);
    }
  }
  return [...new Set(generationLinks)];
}

async function parseVehiclePage(url: string): Promise<Partial<VehicleSpec> | null> {
  try {
    const html = await fetchWithRetry(`${BASE_URL}${url}`);
    
    // Parse specs from HTML tables
    const spec: Partial<VehicleSpec> = {};
    
    // Extract title/model info
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (titleMatch) {
      spec.variant = titleMatch[1].trim();
    }
    
    // Parse spec tables
    const tableRegex = /<tr[^>]*>\s*<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/g;
    let tableMatch;
    
    const rawSpecs: Record<string, string> = {};
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      rawSpecs[tableMatch[1].trim().toLowerCase()] = tableMatch[2].trim();
    }
    
    // Map to structured format
    spec.engine = {
      name: rawSpecs['engine'] || '',
      type: rawSpecs['fuel type'] || '',
      displacement_cc: parseInt(rawSpecs['engine displacement']) || null,
      cylinders: parseInt(rawSpecs['number of cylinders']) || null,
      power_hp: parseInt(rawSpecs['max power']) || 0,
      power_kw: parseInt(rawSpecs['max power']) ? Math.round(parseInt(rawSpecs['max power']) * 0.7457) : 0,
      torque_nm: parseInt(rawSpecs['max torque']) || 0,
      fuel_system: rawSpecs['fuel system'] || '',
    };
    
    spec.performance = {
      top_speed_kmh: parseInt(rawSpecs['top speed']) || 0,
      acceleration_0_100: parseFloat(rawSpecs['acceleration 0-100 km/h']) || 0,
    };
    
    spec.dimensions = {
      length_mm: parseInt(rawSpecs['length']) || 0,
      width_mm: parseInt(rawSpecs['width']) || 0,
      height_mm: parseInt(rawSpecs['height']) || 0,
      wheelbase_mm: parseInt(rawSpecs['wheelbase']) || 0,
      front_track_mm: parseInt(rawSpecs['front track']) || 0,
      rear_track_mm: parseInt(rawSpecs['rear track']) || 0,
      ground_clearance_mm: parseInt(rawSpecs['minimum ground clearance']) || 0,
    };
    
    spec.weight = {
      curb_kg: parseInt(rawSpecs['kerb weight']) || 0,
      gross_kg: parseInt(rawSpecs['max weight']) || 0,
      payload_kg: parseInt(rawSpecs['max load']) || 0,
      towing_braked_kg: parseInt(rawSpecs['max towing capacity braked']) || 0,
      towing_unbraked_kg: parseInt(rawSpecs['max towing capacity unbraked']) || 0,
      roof_load_kg: parseInt(rawSpecs['max roof load']) || 0,
    };
    
    spec.consumption = {
      wltp_combined: parseFloat(rawSpecs['fuel consumption (combined)']) || null,
      wltp_city: parseFloat(rawSpecs['fuel consumption (urban)']) || null,
      wltp_highway: parseFloat(rawSpecs['fuel consumption (extra urban)']) || null,
      co2_gkm: parseInt(rawSpecs['co2 emissions']) || null,
      fuel_tank_l: parseInt(rawSpecs['fuel tank capacity']) || 0,
      electric_range_km: parseInt(rawSpecs['all-electric range']) || null,
      battery_kwh: parseFloat(rawSpecs['battery capacity']) || null,
    };
    
    spec.trunk = {
      volume_l: parseInt(rawSpecs['trunk (boot) space - minimum']) || 0,
      volume_max_l: parseInt(rawSpecs['trunk (boot) space - maximum']) || 0,
    };
    
    return spec;
  } catch (e) {
    console.error(`Error parsing ${url}:`, e);
    return null;
  }
}

async function scrapeBrand(brand: string): Promise<VehicleSpec[]> {
  console.log(`\n🚗 Scraping ${brand}...`);
  const specs: VehicleSpec[] = [];
  
  const models = await getBrandModels(brand);
  console.log(`  Found ${models.length} models`);
  
  for (const modelUrl of models) {
    await delay(500); // Polite delay
    
    const generations = await getModelGenerations(modelUrl);
    console.log(`  ${modelUrl}: ${generations.length} generations`);
    
    for (const genUrl of generations) {
      await delay(300);
      
      const spec = await parseVehiclePage(genUrl);
      if (spec) {
        specs.push({
          brand,
          ...spec,
        } as VehicleSpec);
      }
    }
  }
  
  return specs;
}

async function main() {
  console.log('🚀 FLM AUTO - Auto-Data.net Scraper');
  console.log(`📋 Brands: ${BRANDS.join(', ')}`);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allSpecs: VehicleSpec[] = [];
  
  for (const brand of BRANDS) {
    const brandSpecs = await scrapeBrand(brand);
    allSpecs.push(...brandSpecs);
    
    // Save per-brand file
    const brandFile = path.join(OUTPUT_DIR, `${brand.toLowerCase().replace(/\s+/g, '_')}.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandSpecs, null, 2));
    console.log(`  💾 Saved ${brandSpecs.length} specs to ${brandFile}`);
  }
  
  // Save combined file
  const combinedFile = path.join(OUTPUT_DIR, 'all_specs.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allSpecs, null, 2));
  console.log(`\n✅ Total: ${allSpecs.length} vehicle specifications`);
  console.log(`💾 Combined file: ${combinedFile}`);
}

main().catch(console.error);
