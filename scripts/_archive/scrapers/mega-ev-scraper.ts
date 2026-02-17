/**
 * FLM AUTO - MEGA EV Database Scraper
 * Scrape TOUTES les pages individuelles de véhicules
 * ~1200 véhicules x 50+ specs chacun
 * 
 * Run: npx ts-node scrapers/mega-ev-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/ev_database';
const BASE_URL = 'https://ev-database.org';
const DELAY_MS = 300; // Polite delay between requests

interface FullEvSpec {
  // Identity
  id: string;
  brand: string;
  model: string;
  variant: string;
  url: string;
  
  // Battery & Range
  battery_capacity_kwh: number | null;
  battery_usable_kwh: number | null;
  battery_type: string | null;
  battery_cells: number | null;
  battery_architecture: string | null;
  range_wltp_km: number | null;
  range_real_km: number | null;
  range_city_cold_km: number | null;
  range_highway_cold_km: number | null;
  range_city_mild_km: number | null;
  range_highway_mild_km: number | null;
  
  // Efficiency
  efficiency_wltp_whkm: number | null;
  efficiency_real_whkm: number | null;
  efficiency_city_whkm: number | null;
  efficiency_highway_whkm: number | null;
  
  // Charging
  charge_port: string | null;
  charge_port_location: string | null;
  fastcharge_port: string | null;
  fastcharge_max_kw: number | null;
  fastcharge_10_80_min: number | null;
  fastcharge_avg_kw: number | null;
  fastcharge_max_kmh: number | null;
  onboard_charger_kw: number | null;
  onboard_charger_phases: number | null;
  charge_0_100_hours: number | null;
  charge_curve: { soc: number; kw: number }[];
  
  // Performance
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
  power_kw: number | null;
  power_hp: number | null;
  torque_nm: number | null;
  motor_type: string | null;
  motor_count: number | null;
  
  // Drivetrain
  drive: string | null; // AWD, RWD, FWD
  gearbox: string | null;
  
  // Dimensions
  length_mm: number | null;
  width_mm: number | null;
  width_mirrors_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  weight_unladen_kg: number | null;
  weight_gvwr_kg: number | null;
  max_payload_kg: number | null;
  cargo_volume_l: number | null;
  cargo_volume_max_l: number | null;
  frunk_volume_l: number | null;
  tow_weight_braked_kg: number | null;
  tow_weight_unbraked_kg: number | null;
  roof_load_kg: number | null;
  ground_clearance_mm: number | null;
  
  // Features
  seats: number | null;
  isofix_points: number | null;
  turning_circle_m: number | null;
  platform: string | null;
  body_style: string | null;
  segment: string | null;
  
  // EV Features
  heat_pump: boolean;
  heat_pump_standard: boolean;
  v2l: boolean;
  v2h: boolean;
  v2g: boolean;
  
  // Pricing
  price_germany_eur: number | null;
  price_netherlands_eur: number | null;
  price_uk_gbp: number | null;
  price_france_eur: number | null;
  
  // Availability
  available_since: string | null;
  available_until: string | null;
  
  // Safety
  ncap_rating: number | null;
  ncap_year: number | null;
  
  // Misc
  colors_available: string[];
  warranty_years: number | null;
  warranty_km: number | null;
  battery_warranty_years: number | null;
  battery_warranty_km: number | null;
  
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
  const match = text.replace(/,/g, '.').match(/-?[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

function extractInt(text: string | null | undefined): number | null {
  const num = extractNumber(text);
  return num !== null ? Math.round(num) : null;
}

async function getAllVehicleUrls(): Promise<{ url: string; name: string }[]> {
  console.log('📋 Fetching vehicle list...');
  
  const html = await fetchWithRetry(BASE_URL);
  const vehicles: { url: string; name: string }[] = [];
  
  // Pattern: href="/car/XXXX/Brand-Model"
  const urlRegex = /href="(\/car\/(\d+)\/([^"]+))"/g;
  let match;
  
  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[1];
    const name = match[3].replace(/-/g, ' ');
    
    // Avoid duplicates
    if (!vehicles.find(v => v.url === url)) {
      vehicles.push({ url, name });
    }
  }
  
  console.log(`  Found ${vehicles.length} unique vehicles`);
  return vehicles;
}

async function scrapeVehiclePage(url: string): Promise<FullEvSpec | null> {
  try {
    const fullUrl = `${BASE_URL}${url}`;
    const html = await fetchWithRetry(fullUrl);
    
    // Extract vehicle ID from URL
    const idMatch = url.match(/\/car\/(\d+)\//);
    const id = idMatch ? idMatch[1] : '';
    
    // Extract brand and model from title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const fullName = titleMatch ? titleMatch[1].trim() : '';
    
    // Split brand and model
    const brandPatterns = [
      'Mercedes-Benz', 'Rolls-Royce', 'Alfa Romeo', 'Land Rover',
      'BMW', 'Audi', 'Volkswagen', 'Porsche', 'Skoda', 'Tesla',
      'Volvo', 'Hyundai', 'Kia', 'Ford', 'Peugeot', 'Renault',
      'Citroën', 'Fiat', 'Opel', 'Nissan', 'Toyota', 'Honda',
      'Mazda', 'Mini', 'Smart', 'Jaguar', 'Lexus', 'Genesis',
      'Polestar', 'Lucid', 'Rivian', 'BYD', 'NIO', 'Xpeng',
    ];
    
    let brand = '';
    let model = fullName;
    
    for (const b of brandPatterns) {
      if (fullName.startsWith(b + ' ')) {
        brand = b;
        model = fullName.substring(b.length + 1);
        break;
      }
    }
    
    if (!brand) {
      const parts = fullName.split(' ');
      brand = parts[0] || '';
      model = parts.slice(1).join(' ');
    }
    
    const spec: FullEvSpec = {
      id,
      brand,
      model: fullName,
      variant: model,
      url: fullUrl,
      
      // Initialize all fields as null
      battery_capacity_kwh: null,
      battery_usable_kwh: null,
      battery_type: null,
      battery_cells: null,
      battery_architecture: null,
      range_wltp_km: null,
      range_real_km: null,
      range_city_cold_km: null,
      range_highway_cold_km: null,
      range_city_mild_km: null,
      range_highway_mild_km: null,
      efficiency_wltp_whkm: null,
      efficiency_real_whkm: null,
      efficiency_city_whkm: null,
      efficiency_highway_whkm: null,
      charge_port: null,
      charge_port_location: null,
      fastcharge_port: null,
      fastcharge_max_kw: null,
      fastcharge_10_80_min: null,
      fastcharge_avg_kw: null,
      fastcharge_max_kmh: null,
      onboard_charger_kw: null,
      onboard_charger_phases: null,
      charge_0_100_hours: null,
      charge_curve: [],
      acceleration_0_100: null,
      top_speed_kmh: null,
      power_kw: null,
      power_hp: null,
      torque_nm: null,
      motor_type: null,
      motor_count: null,
      drive: null,
      gearbox: null,
      length_mm: null,
      width_mm: null,
      width_mirrors_mm: null,
      height_mm: null,
      wheelbase_mm: null,
      weight_unladen_kg: null,
      weight_gvwr_kg: null,
      max_payload_kg: null,
      cargo_volume_l: null,
      cargo_volume_max_l: null,
      frunk_volume_l: null,
      tow_weight_braked_kg: null,
      tow_weight_unbraked_kg: null,
      roof_load_kg: null,
      ground_clearance_mm: null,
      seats: null,
      isofix_points: null,
      turning_circle_m: null,
      platform: null,
      body_style: null,
      segment: null,
      heat_pump: false,
      heat_pump_standard: false,
      v2l: false,
      v2h: false,
      v2g: false,
      price_germany_eur: null,
      price_netherlands_eur: null,
      price_uk_gbp: null,
      price_france_eur: null,
      available_since: null,
      available_until: null,
      ncap_rating: null,
      ncap_year: null,
      colors_available: [],
      warranty_years: null,
      warranty_km: null,
      battery_warranty_years: null,
      battery_warranty_km: null,
      scraped_at: new Date().toISOString(),
    };
    
    // Parse spec tables - look for <th>Label</th><td>Value</td> patterns
    const specRegex = /<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/td>/gi;
    let specMatch;
    
    while ((specMatch = specRegex.exec(html)) !== null) {
      const label = specMatch[1].trim().toLowerCase();
      const value = specMatch[2].replace(/<[^>]+>/g, '').trim();
      
      // Battery
      if (label.includes('battery capacity') && label.includes('usable')) {
        spec.battery_usable_kwh = extractNumber(value);
      } else if (label.includes('battery capacity') && label.includes('full')) {
        spec.battery_capacity_kwh = extractNumber(value);
      } else if (label.includes('battery type')) {
        spec.battery_type = value;
      } else if (label.includes('number of cells')) {
        spec.battery_cells = extractInt(value);
      } else if (label.includes('pack configuration') || label.includes('architecture')) {
        spec.battery_architecture = value;
      }
      
      // Range
      else if (label.includes('range') && label.includes('wltp')) {
        spec.range_wltp_km = extractInt(value);
      } else if (label.includes('range') && label.includes('real') && !label.includes('city') && !label.includes('highway')) {
        spec.range_real_km = extractInt(value);
      } else if (label.includes('city') && label.includes('cold')) {
        spec.range_city_cold_km = extractInt(value);
      } else if (label.includes('highway') && label.includes('cold')) {
        spec.range_highway_cold_km = extractInt(value);
      } else if (label.includes('city') && label.includes('mild')) {
        spec.range_city_mild_km = extractInt(value);
      } else if (label.includes('highway') && label.includes('mild')) {
        spec.range_highway_mild_km = extractInt(value);
      }
      
      // Efficiency
      else if (label.includes('efficiency') && label.includes('wltp')) {
        spec.efficiency_wltp_whkm = extractInt(value);
      } else if (label.includes('efficiency') && label.includes('real')) {
        spec.efficiency_real_whkm = extractInt(value);
      }
      
      // Charging
      else if (label.includes('charge port')) {
        spec.charge_port = value;
      } else if (label.includes('port location')) {
        spec.charge_port_location = value;
      } else if (label.includes('fastcharge port') || label.includes('dc port')) {
        spec.fastcharge_port = value;
      } else if (label.includes('fastcharge') && label.includes('power') || label.includes('dc charge')) {
        spec.fastcharge_max_kw = extractInt(value);
      } else if (label.includes('10-80') || label.includes('10% to 80%')) {
        spec.fastcharge_10_80_min = extractInt(value);
      } else if (label.includes('average charging speed')) {
        spec.fastcharge_avg_kw = extractInt(value);
      } else if (label.includes('km/h') && label.includes('charge')) {
        spec.fastcharge_max_kmh = extractInt(value);
      } else if (label.includes('on-board charger') || label.includes('onboard charger')) {
        spec.onboard_charger_kw = extractNumber(value);
      } else if (label.includes('charge phases')) {
        spec.onboard_charger_phases = extractInt(value);
      } else if (label.includes('0-100%') && label.includes('hour')) {
        spec.charge_0_100_hours = extractNumber(value);
      }
      
      // Performance
      else if (label.includes('acceleration') || label.includes('0-100')) {
        spec.acceleration_0_100 = extractNumber(value);
      } else if (label.includes('top speed')) {
        spec.top_speed_kmh = extractInt(value);
      } else if (label.includes('power') && label.includes('kw')) {
        spec.power_kw = extractInt(value);
      } else if (label.includes('power') && label.includes('hp')) {
        spec.power_hp = extractInt(value);
      } else if (label.includes('torque')) {
        spec.torque_nm = extractInt(value);
      } else if (label.includes('motor') && label.includes('type')) {
        spec.motor_type = value;
      }
      
      // Drivetrain
      else if (label.includes('drive')) {
        if (value.toLowerCase().includes('all') || value.toLowerCase().includes('awd') || value.toLowerCase().includes('4')) {
          spec.drive = 'AWD';
        } else if (value.toLowerCase().includes('rear') || value.toLowerCase().includes('rwd')) {
          spec.drive = 'RWD';
        } else if (value.toLowerCase().includes('front') || value.toLowerCase().includes('fwd')) {
          spec.drive = 'FWD';
        } else {
          spec.drive = value;
        }
      }
      
      // Dimensions
      else if (label.includes('length')) {
        spec.length_mm = extractInt(value);
      } else if (label.includes('width') && label.includes('mirror')) {
        spec.width_mirrors_mm = extractInt(value);
      } else if (label.includes('width')) {
        spec.width_mm = extractInt(value);
      } else if (label.includes('height')) {
        spec.height_mm = extractInt(value);
      } else if (label.includes('wheelbase')) {
        spec.wheelbase_mm = extractInt(value);
      } else if (label.includes('weight') && label.includes('unladen')) {
        spec.weight_unladen_kg = extractInt(value);
      } else if (label.includes('gross') || label.includes('gvwr')) {
        spec.weight_gvwr_kg = extractInt(value);
      } else if (label.includes('payload')) {
        spec.max_payload_kg = extractInt(value);
      } else if (label.includes('cargo') && label.includes('max')) {
        spec.cargo_volume_max_l = extractInt(value);
      } else if (label.includes('cargo') || label.includes('boot') || label.includes('trunk')) {
        spec.cargo_volume_l = extractInt(value);
      } else if (label.includes('frunk')) {
        spec.frunk_volume_l = extractInt(value);
      } else if (label.includes('tow') && label.includes('braked')) {
        spec.tow_weight_braked_kg = extractInt(value);
      } else if (label.includes('tow') && label.includes('unbraked')) {
        spec.tow_weight_unbraked_kg = extractInt(value);
      } else if (label.includes('roof load')) {
        spec.roof_load_kg = extractInt(value);
      } else if (label.includes('ground clearance')) {
        spec.ground_clearance_mm = extractInt(value);
      }
      
      // Features
      else if (label.includes('seats')) {
        spec.seats = extractInt(value);
      } else if (label.includes('isofix')) {
        spec.isofix_points = extractInt(value);
      } else if (label.includes('turning circle')) {
        spec.turning_circle_m = extractNumber(value);
      } else if (label.includes('platform')) {
        spec.platform = value;
      } else if (label.includes('body')) {
        spec.body_style = value;
      } else if (label.includes('segment')) {
        spec.segment = value;
      }
      
      // Pricing
      else if (label.includes('germany') && label.includes('€')) {
        spec.price_germany_eur = extractInt(value.replace(/[€,.\s]/g, ''));
      } else if (label.includes('netherlands') && label.includes('€')) {
        spec.price_netherlands_eur = extractInt(value.replace(/[€,.\s]/g, ''));
      } else if (label.includes('uk') && (label.includes('£') || label.includes('gbp'))) {
        spec.price_uk_gbp = extractInt(value.replace(/[£,.\s]/g, ''));
      } else if (label.includes('france') && label.includes('€')) {
        spec.price_france_eur = extractInt(value.replace(/[€,.\s]/g, ''));
      }
      
      // Availability
      else if (label.includes('available') && label.includes('since')) {
        spec.available_since = value;
      }
      
      // Safety
      else if (label.includes('ncap') || label.includes('safety rating')) {
        spec.ncap_rating = extractInt(value);
      }
    }
    
    // Check for features in the page
    spec.heat_pump = html.includes('Heat pump') || html.toLowerCase().includes('heat pump');
    spec.v2l = html.includes('V2L') || html.includes('Vehicle-to-Load');
    spec.v2h = html.includes('V2H') || html.includes('Vehicle-to-Home');
    spec.v2g = html.includes('V2G') || html.includes('Vehicle-to-Grid');
    
    // Calculate HP if we have kW but not HP
    if (spec.power_kw && !spec.power_hp) {
      spec.power_hp = Math.round(spec.power_kw * 1.341);
    }
    
    return spec;
    
  } catch (e) {
    console.error(`  Error scraping ${url}:`, e);
    return null;
  }
}

async function main() {
  console.log('🚀 FLM AUTO - MEGA EV Database Scraper');
  console.log('⏱️  This will take 20-40 minutes...\n');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Get all vehicle URLs
  const vehicles = await getAllVehicleUrls();
  
  const allSpecs: FullEvSpec[] = [];
  const errors: string[] = [];
  
  let processed = 0;
  const startTime = Date.now();
  
  for (const vehicle of vehicles) {
    processed++;
    
    // Progress update every 50 vehicles
    if (processed % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (vehicles.length - processed) / rate;
      console.log(`\n📊 Progress: ${processed}/${vehicles.length} (${Math.round(processed/vehicles.length*100)}%)`);
      console.log(`   ETA: ${Math.round(remaining / 60)} minutes remaining`);
    }
    
    process.stdout.write(`\r  Scraping: ${vehicle.name.substring(0, 40).padEnd(40)}...`);
    
    const spec = await scrapeVehiclePage(vehicle.url);
    
    if (spec) {
      allSpecs.push(spec);
    } else {
      errors.push(vehicle.url);
    }
    
    await delay(DELAY_MS);
    
    // Save checkpoint every 100 vehicles
    if (processed % 100 === 0) {
      const checkpointFile = path.join(OUTPUT_DIR, `checkpoint_${processed}.json`);
      fs.writeFileSync(checkpointFile, JSON.stringify(allSpecs, null, 2));
    }
  }
  
  console.log('\n\n📊 Scraping complete!');
  console.log(`  ✅ Successful: ${allSpecs.length}`);
  console.log(`  ❌ Errors: ${errors.length}`);
  
  // Save all specs
  const allFile = path.join(OUTPUT_DIR, 'mega_all_ev_specs.json');
  fs.writeFileSync(allFile, JSON.stringify(allSpecs, null, 2));
  console.log(`\n💾 Saved to ${allFile}`);
  
  // Summary by brand
  const brandCounts = new Map<string, number>();
  for (const spec of allSpecs) {
    brandCounts.set(spec.brand, (brandCounts.get(spec.brand) || 0) + 1);
  }
  
  console.log('\n📊 By brand:');
  const sorted = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 20).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });
  
  // Data quality stats
  const withRange = allSpecs.filter(s => s.range_real_km).length;
  const withBattery = allSpecs.filter(s => s.battery_usable_kwh).length;
  const withCharging = allSpecs.filter(s => s.fastcharge_max_kw).length;
  const withPrice = allSpecs.filter(s => s.price_germany_eur).length;
  const withDimensions = allSpecs.filter(s => s.length_mm).length;
  
  console.log('\n📊 Data completeness:');
  console.log(`  Range (real): ${withRange} (${Math.round(withRange/allSpecs.length*100)}%)`);
  console.log(`  Battery (usable): ${withBattery} (${Math.round(withBattery/allSpecs.length*100)}%)`);
  console.log(`  Fast charging: ${withCharging} (${Math.round(withCharging/allSpecs.length*100)}%)`);
  console.log(`  Price (DE): ${withPrice} (${Math.round(withPrice/allSpecs.length*100)}%)`);
  console.log(`  Dimensions: ${withDimensions} (${Math.round(withDimensions/allSpecs.length*100)}%)`);
  
  // Save errors
  if (errors.length > 0) {
    const errorsFile = path.join(OUTPUT_DIR, 'scrape_errors.json');
    fs.writeFileSync(errorsFile, JSON.stringify(errors, null, 2));
  }
  
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n⏱️  Total time: ${elapsed.toFixed(1)} minutes`);
}

main().catch(console.error);
