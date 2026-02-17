/**
 * FLM AUTO - MEGA Ultimate Specs Scraper
 * Scrape TOUTES les specs de ultimatespecs.com
 * ~50,000+ véhicules avec specs techniques complètes
 * 
 * Run: npx ts-node scrapers/mega-ultimatespecs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/ultimatespecs';
const BASE_URL = 'https://www.ultimatespecs.com';
const DELAY_MS = 250;

const TARGET_BRANDS = [
  { name: 'BMW', slug: 'BMW' },
  { name: 'Mercedes-Benz', slug: 'Mercedes-Benz' },
  { name: 'Audi', slug: 'Audi' },
  { name: 'Volkswagen', slug: 'Volkswagen' },
  { name: 'Porsche', slug: 'Porsche' },
  { name: 'Skoda', slug: 'Skoda' },
  // Extended brands
  { name: 'Tesla', slug: 'Tesla' },
  { name: 'Hyundai', slug: 'Hyundai' },
  { name: 'Volvo', slug: 'Volvo' },
  { name: 'Toyota', slug: 'Toyota' },
  { name: 'Honda', slug: 'Honda' },
  { name: 'Mazda', slug: 'Mazda' },
  { name: 'Kia', slug: 'Kia' },
  { name: 'Ford', slug: 'Ford' },
];

interface FullSpec {
  // Identity
  brand: string;
  model: string;
  generation: string;
  variant: string;
  years: string;
  url: string;
  
  // Engine
  engine_name: string | null;
  engine_code: string | null;
  engine_type: string | null;
  fuel_type: string | null;
  displacement_cc: number | null;
  cylinders: number | null;
  valves_per_cylinder: number | null;
  bore_mm: number | null;
  stroke_mm: number | null;
  compression_ratio: number | null;
  aspiration: string | null;
  
  // Power
  power_hp: number | null;
  power_kw: number | null;
  power_rpm: number | null;
  torque_nm: number | null;
  torque_rpm: number | null;
  
  // Electric (if applicable)
  battery_kwh: number | null;
  electric_range_km: number | null;
  motor_power_kw: number | null;
  
  // Transmission
  transmission_type: string | null;
  gears: number | null;
  drive: string | null;
  
  // Performance
  top_speed_kmh: number | null;
  acceleration_0_100: number | null;
  acceleration_0_60mph: number | null;
  acceleration_0_200: number | null;
  acceleration_100_200: number | null;
  standing_quarter_sec: number | null;
  standing_km_sec: number | null;
  
  // Consumption
  fuel_consumption_urban: number | null;
  fuel_consumption_extra_urban: number | null;
  fuel_consumption_combined: number | null;
  fuel_consumption_wltp_low: number | null;
  fuel_consumption_wltp_mid: number | null;
  fuel_consumption_wltp_high: number | null;
  fuel_consumption_wltp_extra_high: number | null;
  fuel_consumption_wltp_combined: number | null;
  co2_emissions_gkm: number | null;
  co2_wltp_gkm: number | null;
  fuel_tank_l: number | null;
  adblue_tank_l: number | null;
  
  // Dimensions - Exterior
  length_mm: number | null;
  width_mm: number | null;
  width_mirrors_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  front_track_mm: number | null;
  rear_track_mm: number | null;
  front_overhang_mm: number | null;
  rear_overhang_mm: number | null;
  ground_clearance_mm: number | null;
  approach_angle_deg: number | null;
  departure_angle_deg: number | null;
  ramp_angle_deg: number | null;
  wading_depth_mm: number | null;
  
  // Dimensions - Interior
  interior_length_mm: number | null;
  interior_width_front_mm: number | null;
  interior_width_rear_mm: number | null;
  interior_height_front_mm: number | null;
  interior_height_rear_mm: number | null;
  shoulder_room_front_mm: number | null;
  shoulder_room_rear_mm: number | null;
  hip_room_front_mm: number | null;
  hip_room_rear_mm: number | null;
  leg_room_front_mm: number | null;
  leg_room_rear_mm: number | null;
  head_room_front_mm: number | null;
  head_room_rear_mm: number | null;
  
  // Cargo & Weight
  trunk_volume_l: number | null;
  trunk_volume_max_l: number | null;
  frunk_volume_l: number | null;
  roof_box_volume_l: number | null;
  curb_weight_kg: number | null;
  gross_weight_kg: number | null;
  max_payload_kg: number | null;
  max_load_kg: number | null;
  towing_capacity_braked_kg: number | null;
  towing_capacity_unbraked_kg: number | null;
  max_trailer_weight_braked_kg: number | null;
  max_roof_load_kg: number | null;
  
  // Chassis
  body_type: string | null;
  doors: number | null;
  seats: number | null;
  front_suspension: string | null;
  rear_suspension: string | null;
  front_brakes: string | null;
  rear_brakes: string | null;
  front_tire_size: string | null;
  rear_tire_size: string | null;
  wheel_size: string | null;
  steering_type: string | null;
  turning_circle_m: number | null;
  
  // Aerodynamics
  drag_coefficient: number | null;
  frontal_area_m2: number | null;
  
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
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (response.status === 404) return '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(1000 * (i + 1));
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

async function getBrandModels(brand: { name: string; slug: string }): Promise<string[]> {
  const url = `${BASE_URL}/car-specs/${brand.slug}-specs`;
  console.log(`\n📂 Fetching models for ${brand.name}...`);
  
  try {
    const html = await fetchWithRetry(url);
    
    // Find model links: /car-specs/BMW-1-Series-specs
    const modelRegex = new RegExp(`/car-specs/${brand.slug}-([\\w-]+)-specs`, 'gi');
    const models: string[] = [];
    let match;
    
    while ((match = modelRegex.exec(html)) !== null) {
      const modelSlug = match[1];
      const modelUrl = `/car-specs/${brand.slug}-${modelSlug}-specs`;
      if (!models.includes(modelUrl)) {
        models.push(modelUrl);
      }
    }
    
    console.log(`   Found ${models.length} models`);
    return models;
  } catch (e) {
    console.error(`   Error: ${e}`);
    return [];
  }
}

async function getModelGenerations(modelUrl: string): Promise<string[]> {
  const url = `${BASE_URL}${modelUrl}`;
  
  try {
    const html = await fetchWithRetry(url);
    if (!html) return [];
    
    // Find generation/variant links
    const genRegex = /href="([^"]*car-specs[^"]*specs[^"]*)"/gi;
    const generations: string[] = [];
    let match;
    
    while ((match = genRegex.exec(html)) !== null) {
      let genUrl = match[1];
      // Make relative if needed
      if (genUrl.startsWith('http')) {
        genUrl = genUrl.replace(BASE_URL, '');
      }
      // Skip if same as model page
      if (genUrl !== modelUrl && !generations.includes(genUrl)) {
        generations.push(genUrl);
      }
    }
    
    return generations.slice(0, 100); // Limit per model
  } catch (e) {
    return [];
  }
}

async function getVariantSpecs(genUrl: string): Promise<string[]> {
  const url = genUrl.startsWith('http') ? genUrl : `${BASE_URL}${genUrl}`;
  
  try {
    const html = await fetchWithRetry(url);
    if (!html) return [];
    
    // Find individual spec page links
    const specRegex = /href="([^"]*\/[A-Z0-9]+-[\w-]+\.html)"/gi;
    const specs: string[] = [];
    let match;
    
    while ((match = specRegex.exec(html)) !== null) {
      let specUrl = match[1];
      if (specUrl.startsWith('http')) {
        specUrl = specUrl.replace(BASE_URL, '');
      }
      if (!specs.includes(specUrl)) {
        specs.push(specUrl);
      }
    }
    
    return specs.slice(0, 50); // Limit variants
  } catch (e) {
    return [];
  }
}

function parseSpecPage(html: string, url: string, brand: string): FullSpec | null {
  // Extract title for model info
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  const spec: FullSpec = {
    brand,
    model: title,
    generation: '',
    variant: '',
    years: '',
    url: `${BASE_URL}${url}`,
    engine_name: null,
    engine_code: null,
    engine_type: null,
    fuel_type: null,
    displacement_cc: null,
    cylinders: null,
    valves_per_cylinder: null,
    bore_mm: null,
    stroke_mm: null,
    compression_ratio: null,
    aspiration: null,
    power_hp: null,
    power_kw: null,
    power_rpm: null,
    torque_nm: null,
    torque_rpm: null,
    battery_kwh: null,
    electric_range_km: null,
    motor_power_kw: null,
    transmission_type: null,
    gears: null,
    drive: null,
    top_speed_kmh: null,
    acceleration_0_100: null,
    acceleration_0_60mph: null,
    acceleration_0_200: null,
    acceleration_100_200: null,
    standing_quarter_sec: null,
    standing_km_sec: null,
    fuel_consumption_urban: null,
    fuel_consumption_extra_urban: null,
    fuel_consumption_combined: null,
    fuel_consumption_wltp_low: null,
    fuel_consumption_wltp_mid: null,
    fuel_consumption_wltp_high: null,
    fuel_consumption_wltp_extra_high: null,
    fuel_consumption_wltp_combined: null,
    co2_emissions_gkm: null,
    co2_wltp_gkm: null,
    fuel_tank_l: null,
    adblue_tank_l: null,
    length_mm: null,
    width_mm: null,
    width_mirrors_mm: null,
    height_mm: null,
    wheelbase_mm: null,
    front_track_mm: null,
    rear_track_mm: null,
    front_overhang_mm: null,
    rear_overhang_mm: null,
    ground_clearance_mm: null,
    approach_angle_deg: null,
    departure_angle_deg: null,
    ramp_angle_deg: null,
    wading_depth_mm: null,
    interior_length_mm: null,
    interior_width_front_mm: null,
    interior_width_rear_mm: null,
    interior_height_front_mm: null,
    interior_height_rear_mm: null,
    shoulder_room_front_mm: null,
    shoulder_room_rear_mm: null,
    hip_room_front_mm: null,
    hip_room_rear_mm: null,
    leg_room_front_mm: null,
    leg_room_rear_mm: null,
    head_room_front_mm: null,
    head_room_rear_mm: null,
    trunk_volume_l: null,
    trunk_volume_max_l: null,
    frunk_volume_l: null,
    roof_box_volume_l: null,
    curb_weight_kg: null,
    gross_weight_kg: null,
    max_payload_kg: null,
    max_load_kg: null,
    towing_capacity_braked_kg: null,
    towing_capacity_unbraked_kg: null,
    max_trailer_weight_braked_kg: null,
    max_roof_load_kg: null,
    body_type: null,
    doors: null,
    seats: null,
    front_suspension: null,
    rear_suspension: null,
    front_brakes: null,
    rear_brakes: null,
    front_tire_size: null,
    rear_tire_size: null,
    wheel_size: null,
    steering_type: null,
    turning_circle_m: null,
    drag_coefficient: null,
    frontal_area_m2: null,
    scraped_at: new Date().toISOString(),
  };
  
  // Parse spec rows: various formats
  // Format 1: <td>Label</td><td>Value</td>
  // Format 2: <th>Label</th><td>Value</td>
  // Format 3: <div class="spec-label">Label</div><div class="spec-value">Value</div>
  
  const rowPatterns = [
    /<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<td[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/td>/gi,
    /<div[^>]*label[^>]*>([^<]+)<\/div>\s*<div[^>]*value[^>]*>([^<]+)<\/div>/gi,
  ];
  
  for (const pattern of rowPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const label = match[1].toLowerCase().trim();
      const value = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (!value || value === '-' || value === 'N/A') continue;
      
      // Engine
      if (label.includes('engine') && label.includes('code')) spec.engine_code = value;
      else if (label.includes('engine') && label.includes('type')) spec.engine_type = value;
      else if (label.includes('fuel') && label.includes('type')) spec.fuel_type = value;
      else if (label.includes('displacement') || label.includes('capacity')) spec.displacement_cc = extractNumber(value);
      else if (label.includes('cylinders') || label.includes('cylinder count')) spec.cylinders = extractNumber(value);
      else if (label.includes('valves')) spec.valves_per_cylinder = extractNumber(value);
      else if (label.includes('bore')) spec.bore_mm = extractNumber(value);
      else if (label.includes('stroke')) spec.stroke_mm = extractNumber(value);
      else if (label.includes('compression')) spec.compression_ratio = extractNumber(value);
      else if (label.includes('aspiration') || label.includes('turbo')) spec.aspiration = value;
      
      // Power
      else if ((label.includes('power') || label.includes('hp') || label.includes('horsepower')) && !label.includes('rpm')) {
        if (value.includes('kW')) spec.power_kw = extractNumber(value);
        else spec.power_hp = extractNumber(value);
      }
      else if (label.includes('power') && label.includes('rpm')) spec.power_rpm = extractNumber(value);
      else if (label.includes('torque') && !label.includes('rpm')) spec.torque_nm = extractNumber(value);
      else if (label.includes('torque') && label.includes('rpm')) spec.torque_rpm = extractNumber(value);
      
      // Transmission
      else if (label.includes('transmission') || label.includes('gearbox')) spec.transmission_type = value;
      else if (label.includes('gears') || label.includes('speeds')) spec.gears = extractNumber(value);
      else if (label.includes('drive') && (label.includes('type') || label.includes('wheel'))) spec.drive = value;
      
      // Performance
      else if (label.includes('top speed') || label.includes('max speed')) spec.top_speed_kmh = extractNumber(value);
      else if (label.includes('0-100') || label.includes('0 to 100')) spec.acceleration_0_100 = extractNumber(value);
      else if (label.includes('0-60') || label.includes('0 to 60')) spec.acceleration_0_60mph = extractNumber(value);
      else if (label.includes('0-200')) spec.acceleration_0_200 = extractNumber(value);
      else if (label.includes('100-200')) spec.acceleration_100_200 = extractNumber(value);
      else if (label.includes('1/4 mile') || label.includes('quarter mile')) spec.standing_quarter_sec = extractNumber(value);
      
      // Consumption
      else if (label.includes('urban') && label.includes('consumption')) spec.fuel_consumption_urban = extractNumber(value);
      else if (label.includes('extra urban') || label.includes('highway')) spec.fuel_consumption_extra_urban = extractNumber(value);
      else if (label.includes('combined') && label.includes('wltp')) spec.fuel_consumption_wltp_combined = extractNumber(value);
      else if (label.includes('combined')) spec.fuel_consumption_combined = extractNumber(value);
      else if (label.includes('co2') && label.includes('wltp')) spec.co2_wltp_gkm = extractNumber(value);
      else if (label.includes('co2')) spec.co2_emissions_gkm = extractNumber(value);
      else if (label.includes('fuel tank') || label.includes('tank capacity')) spec.fuel_tank_l = extractNumber(value);
      else if (label.includes('adblue')) spec.adblue_tank_l = extractNumber(value);
      
      // Dimensions
      else if (label.includes('length') && !label.includes('interior')) spec.length_mm = extractNumber(value);
      else if (label.includes('width') && label.includes('mirror')) spec.width_mirrors_mm = extractNumber(value);
      else if (label.includes('width') && !label.includes('interior')) spec.width_mm = extractNumber(value);
      else if (label.includes('height') && !label.includes('interior') && !label.includes('head')) spec.height_mm = extractNumber(value);
      else if (label.includes('wheelbase')) spec.wheelbase_mm = extractNumber(value);
      else if (label.includes('front track')) spec.front_track_mm = extractNumber(value);
      else if (label.includes('rear track')) spec.rear_track_mm = extractNumber(value);
      else if (label.includes('ground clearance')) spec.ground_clearance_mm = extractNumber(value);
      else if (label.includes('approach angle')) spec.approach_angle_deg = extractNumber(value);
      else if (label.includes('departure angle')) spec.departure_angle_deg = extractNumber(value);
      else if (label.includes('wading')) spec.wading_depth_mm = extractNumber(value);
      
      // Interior dimensions
      else if (label.includes('leg room') && label.includes('front')) spec.leg_room_front_mm = extractNumber(value);
      else if (label.includes('leg room') && label.includes('rear')) spec.leg_room_rear_mm = extractNumber(value);
      else if (label.includes('head room') && label.includes('front')) spec.head_room_front_mm = extractNumber(value);
      else if (label.includes('head room') && label.includes('rear')) spec.head_room_rear_mm = extractNumber(value);
      else if (label.includes('shoulder room') && label.includes('front')) spec.shoulder_room_front_mm = extractNumber(value);
      else if (label.includes('shoulder room') && label.includes('rear')) spec.shoulder_room_rear_mm = extractNumber(value);
      
      // Cargo & Weight
      else if ((label.includes('trunk') || label.includes('boot') || label.includes('cargo')) && label.includes('max')) spec.trunk_volume_max_l = extractNumber(value);
      else if (label.includes('trunk') || label.includes('boot') || label.includes('cargo')) spec.trunk_volume_l = extractNumber(value);
      else if (label.includes('frunk')) spec.frunk_volume_l = extractNumber(value);
      else if (label.includes('curb weight') || label.includes('kerb weight') || label.includes('unladen')) spec.curb_weight_kg = extractNumber(value);
      else if (label.includes('gross weight') || label.includes('gvwr')) spec.gross_weight_kg = extractNumber(value);
      else if (label.includes('payload')) spec.max_payload_kg = extractNumber(value);
      else if (label.includes('towing') && label.includes('braked')) spec.towing_capacity_braked_kg = extractNumber(value);
      else if (label.includes('towing') && label.includes('unbraked')) spec.towing_capacity_unbraked_kg = extractNumber(value);
      else if (label.includes('roof load')) spec.max_roof_load_kg = extractNumber(value);
      
      // Body & Chassis
      else if (label.includes('body') && (label.includes('type') || label.includes('style'))) spec.body_type = value;
      else if (label.includes('doors') && !label.includes('room')) spec.doors = extractNumber(value);
      else if (label.includes('seats') && !label.includes('room')) spec.seats = extractNumber(value);
      else if (label.includes('front suspension')) spec.front_suspension = value;
      else if (label.includes('rear suspension')) spec.rear_suspension = value;
      else if (label.includes('front brake')) spec.front_brakes = value;
      else if (label.includes('rear brake')) spec.rear_brakes = value;
      else if (label.includes('front tire') || label.includes('front tyre')) spec.front_tire_size = value;
      else if (label.includes('rear tire') || label.includes('rear tyre')) spec.rear_tire_size = value;
      else if (label.includes('turning circle')) spec.turning_circle_m = extractNumber(value);
      
      // Aerodynamics
      else if (label.includes('drag') || label.includes('cd') || label.includes('coefficient')) spec.drag_coefficient = extractNumber(value);
      else if (label.includes('frontal area')) spec.frontal_area_m2 = extractNumber(value);
      
      // Electric
      else if (label.includes('battery') && label.includes('capacity')) spec.battery_kwh = extractNumber(value);
      else if (label.includes('electric range') || label.includes('ev range')) spec.electric_range_km = extractNumber(value);
    }
  }
  
  // Calculate kW if we only have HP
  if (spec.power_hp && !spec.power_kw) {
    spec.power_kw = Math.round(spec.power_hp * 0.7457);
  }
  
  return spec;
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<FullSpec[]> {
  const specs: FullSpec[] = [];
  
  // Get all models for this brand
  const models = await getBrandModels(brand);
  
  for (const modelUrl of models) {
    await delay(DELAY_MS);
    
    // Get generations for this model
    const generations = await getModelGenerations(modelUrl);
    
    if (generations.length === 0) {
      // Try to scrape the model page directly
      const url = `${BASE_URL}${modelUrl}`;
      try {
        const html = await fetchWithRetry(url);
        if (html) {
          const spec = parseSpecPage(html, modelUrl, brand.name);
          if (spec) specs.push(spec);
        }
      } catch (e) {}
    }
    
    for (const genUrl of generations) {
      await delay(DELAY_MS);
      
      // Get variants for this generation
      const variants = await getVariantSpecs(genUrl);
      
      if (variants.length === 0) {
        // Scrape generation page
        const url = genUrl.startsWith('http') ? genUrl : `${BASE_URL}${genUrl}`;
        try {
          const html = await fetchWithRetry(url);
          if (html) {
            const spec = parseSpecPage(html, genUrl, brand.name);
            if (spec) specs.push(spec);
          }
        } catch (e) {}
      }
      
      for (const variantUrl of variants) {
        await delay(DELAY_MS);
        
        const url = variantUrl.startsWith('http') ? variantUrl : `${BASE_URL}${variantUrl}`;
        try {
          const html = await fetchWithRetry(url);
          if (html) {
            const spec = parseSpecPage(html, variantUrl, brand.name);
            if (spec) {
              specs.push(spec);
              process.stdout.write(`\r   ${brand.name}: ${specs.length} specs scraped...`);
            }
          }
        } catch (e) {}
      }
    }
  }
  
  console.log(`\n   ✅ ${brand.name}: ${specs.length} total specs`);
  return specs;
}

async function main() {
  console.log('🚀 FLM AUTO - MEGA Ultimate Specs Scraper');
  console.log('⏱️  This will take 1-2 hours...\n');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const allSpecs: FullSpec[] = [];
  const startTime = Date.now();
  
  for (const brand of TARGET_BRANDS) {
    const brandSpecs = await scrapeBrand(brand);
    allSpecs.push(...brandSpecs);
    
    // Save per-brand
    const brandFile = path.join(OUTPUT_DIR, `${brand.slug.toLowerCase()}.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandSpecs, null, 2));
    
    // Save checkpoint
    const checkpointFile = path.join(OUTPUT_DIR, 'checkpoint_all.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(allSpecs, null, 2));
  }
  
  // Save all
  const allFile = path.join(OUTPUT_DIR, 'mega_all_specs.json');
  fs.writeFileSync(allFile, JSON.stringify(allSpecs, null, 2));
  
  // Summary
  console.log('\n\n📊 SCRAPING COMPLETE!');
  console.log(`   Total specs: ${allSpecs.length}`);
  
  const byBrand = new Map<string, number>();
  for (const s of allSpecs) {
    byBrand.set(s.brand, (byBrand.get(s.brand) || 0) + 1);
  }
  
  console.log('\n📊 By brand:');
  for (const [brand, count] of byBrand.entries()) {
    console.log(`   ${brand}: ${count}`);
  }
  
  const withDimensions = allSpecs.filter(s => s.length_mm).length;
  const withWeight = allSpecs.filter(s => s.curb_weight_kg).length;
  const withPower = allSpecs.filter(s => s.power_hp).length;
  const withConsumption = allSpecs.filter(s => s.fuel_consumption_combined).length;
  
  console.log('\n📊 Data completeness:');
  console.log(`   Dimensions: ${withDimensions} (${Math.round(withDimensions/allSpecs.length*100)}%)`);
  console.log(`   Weight: ${withWeight} (${Math.round(withWeight/allSpecs.length*100)}%)`);
  console.log(`   Power: ${withPower} (${Math.round(withPower/allSpecs.length*100)}%)`);
  console.log(`   Consumption: ${withConsumption} (${Math.round(withConsumption/allSpecs.length*100)}%)`);
  
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n⏱️  Total time: ${elapsed.toFixed(1)} minutes`);
}

main().catch(console.error);
