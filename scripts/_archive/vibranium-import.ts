/**
 * FLM AUTO - VIBRANIUM IMPORT 💎
 * 
 * Import remaining gold:
 * - Head-to-Head Comparisons
 * - Classic Cars Database
 * - Mega Vehicles Database
 * - scraped data folder
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

let brandMap: Map<string, string>;
let models: any[];
let generations: any[];

async function initDbMaps() {
  const { data: brands } = await supabase.from('brands').select('id, name');
  brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
    brandMap.set(b.name.toLowerCase().replace(/ /g, ''), b.id);
  });
  
  // Add aliases
  brandMap.set('mercedes', brandMap.get('mercedesbenz') || '');
  brandMap.set('vw', brandMap.get('volkswagen') || '');
  brandMap.set('alfa', brandMap.get('alfaromeo') || '');
  
  const { data: m } = await supabase.from('models').select('id, name, brand_id');
  models = m || [];
  const { data: g } = await supabase.from('generations').select('id, model_id, name');
  generations = g || [];
}

function extractBrandFromVehicle(vehicle: string): string | null {
  const brands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Porsche', 'Tesla', 'Ferrari', 
                  'Lamborghini', 'Hyundai', 'Kia', 'Toyota', 'Honda', 'Ford', 'Chevrolet',
                  'Nissan', 'Mazda', 'Volvo', 'Skoda', 'Jaguar', 'Land Rover', 'Lexus'];
  
  for (const brand of brands) {
    if (vehicle.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

function extractModelFromVehicle(vehicle: string, brand: string): string {
  // Remove brand and common suffixes
  return vehicle
    .replace(new RegExp(brand, 'gi'), '')
    .replace(/\(.*\)/g, '')
    .replace(/competition|performance|sport|plus|e-?hybrid/gi, '')
    .split(/\s+/)
    .filter(p => p.length > 0)
    .slice(0, 2)
    .join(' ')
    .trim();
}

function findGeneration(brandId: string, modelName: string): string | null {
  if (!modelName || !brandId) return null;
  
  const modelLower = modelName.toLowerCase().replace(/-/g, '').replace(/ /g, '');
  const brandModels = models.filter(m => m.brand_id === brandId);
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, '').replace(/ /g, '');
    if (modelLower.includes(dbName) || dbName.includes(modelLower.substring(0, Math.min(3, modelLower.length)))) {
      const gens = generations.filter(g => g.model_id === model.id);
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

// ============================================================
// 1. Head-to-Head Comparisons
// ============================================================
async function importComparisons() {
  console.log('\n🏁 Importing Head-to-Head Comparisons...\n');
  
  const file = '../data/HEAD_TO_HEAD_COMPARISONS.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  // Generation battles
  const battles = data.generation_battles || {};
  for (const [category, catData] of Object.entries(battles)) {
    for (const [era, eraData] of Object.entries(catData as any)) {
      const contenders = (eraData as any).contenders || [];
      
      for (const car of contenders) {
        const brand = extractBrandFromVehicle(car.vehicle);
        if (!brand) continue;
        
        const brandId = brandMap.get(brand.toLowerCase().replace(/-/g, ''));
        if (!brandId) continue;
        
        const modelName = extractModelFromVehicle(car.vehicle, brand);
        const genId = findGeneration(brandId, modelName);
        if (!genId) continue;
        
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'HeadToHead',
          source_url: '',
          spec_type: `comparison_${category.substring(0, 20)}`,
          spec_value: car.power_hp || 0,
          raw_data: {
            category: category,
            era: era,
            vehicle: car.vehicle,
            engine: car.engine,
            power_hp: car.power_hp,
            torque_nm: car.torque_nm,
            zero_to_sixty_sec: car.zero_to_sixty_sec,
            quarter_mile_sec: car.quarter_mile_sec,
            top_speed_mph: car.top_speed_mph,
            weight_kg: car.weight_kg,
            price_usd: car.price_usd,
            drivetrain: car.drivetrain,
          },
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) {
          inserted++;
          console.log(`   ✅ ${car.vehicle}`);
        }
      }
    }
  }
  
  // Drag races
  const dragRaces = data.carwow_drag_races || {};
  for (const [raceId, race] of Object.entries(dragRaces)) {
    const competitors = (race as any).competitors || [];
    
    for (const car of competitors) {
      const brand = extractBrandFromVehicle(car.vehicle || '');
      if (!brand) continue;
      
      const brandId = brandMap.get(brand.toLowerCase().replace(/-/g, ''));
      if (!brandId) continue;
      
      const modelName = extractModelFromVehicle(car.vehicle, brand);
      const genId = findGeneration(brandId, modelName);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'DragRace',
        source_url: (race as any).youtube_url || '',
        spec_type: `dragrace_${raceId.substring(0, 20)}`,
        spec_value: Math.round((car.quarter_mile_sec || 0) * 100),
        raw_data: {
          race: raceId,
          vehicle: car.vehicle,
          power_hp: car.power_hp,
          quarter_mile_sec: car.quarter_mile_sec,
          trap_speed_mph: car.trap_speed_mph,
          result: car.result,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  console.log(`\n   📊 Total Comparisons: ${inserted}`);
  return inserted;
}

// ============================================================
// 2. Classic Cars Database
// ============================================================
async function importClassicCars() {
  console.log('\n🏛️ Importing Classic Cars Database...\n');
  
  const file = '../data/CLASSIC_CARS_DATABASE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  const cars = data.classics || data.vehicles || data;
  
  for (const [key, car] of Object.entries(cars)) {
    if (key === 'metadata') continue;
    const c = car as any;
    
    if (!c.brand) continue;
    const brandId = brandMap.get(c.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, c.model || key);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'ClassicCars',
      source_url: c.url || '',
      spec_type: 'classic_info',
      spec_value: c.year || c.production_year || 1970,
      raw_data: {
        model: c.model,
        years: c.years,
        engine: c.engine,
        power_hp: c.power_hp,
        production_numbers: c.production_numbers,
        notable_features: c.notable_features,
        auction_value: c.auction_value,
        significance: c.significance,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   📊 Total Classic Cars: ${inserted}`);
  return inserted;
}

// ============================================================
// 3. Mega Vehicles Database
// ============================================================
async function importMegaVehicles() {
  console.log('\n🚗 Importing Mega Vehicles Database...\n');
  
  const file = '../data/MEGA_VEHICLES_DATABASE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  const vehicles = data.vehicles || data;
  
  for (const [key, vehicle] of Object.entries(vehicles)) {
    if (key === 'metadata') continue;
    const v = vehicle as any;
    
    if (!v.brand) continue;
    const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.model || key);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'MegaDB',
      source_url: '',
      spec_type: 'mega_specs',
      spec_value: v.power_hp || 0,
      raw_data: v,
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   📊 Total Mega Vehicles: ${inserted}`);
  return inserted;
}

// ============================================================
// 4. Scraped NHTSA
// ============================================================
async function importNHTSA() {
  console.log('\n🛡️ Importing NHTSA Safety Data...\n');
  
  const file = '../data/scraped/nhtsa-vpic-mvp.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  const vehicles = Array.isArray(data) ? data : data.vehicles || data.results || [];
  
  for (const v of vehicles) {
    if (!v.Make) continue;
    
    const brandId = brandMap.get(v.Make.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.Model);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'NHTSA',
      source_url: 'https://www.nhtsa.gov/',
      spec_type: 'nhtsa_safety',
      spec_value: v.OverallRating || v.VehicleId || 0,
      raw_data: {
        make: v.Make,
        model: v.Model,
        year: v.ModelYear,
        overall_rating: v.OverallRating,
        front_crash: v.FrontCrashRating,
        side_crash: v.SideCrashRating,
        rollover: v.RolloverRating,
        complaints: v.ComplaintsCount,
        recalls: v.RecallsCount,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   📊 Total NHTSA: ${inserted}`);
  return inserted;
}

// ============================================================
// 5. Complete Brands Database (add missing brands)
// ============================================================
async function importCompleteBrands() {
  console.log('\n🏭 Checking Complete Brands Database...\n');
  
  const file = '../data/COMPLETE_BRANDS_DATABASE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const brandsData = data.brands || data;
  
  let addedBrands = 0;
  
  for (const [key, brand] of Object.entries(brandsData)) {
    if (key === 'metadata') continue;
    const b = brand as any;
    
    const brandName = b.name || key;
    if (brandMap.has(brandName.toLowerCase().replace(/-/g, '').replace(/ /g, ''))) continue;
    
    // Add new brand
    const { data: newBrand, error } = await supabase
      .from('brands')
      .insert({ name: brandName })
      .select()
      .single();
    
    if (!error && newBrand) {
      addedBrands++;
      brandMap.set(brandName.toLowerCase().replace(/-/g, '').replace(/ /g, ''), newBrand.id);
      console.log(`   ➕ Added brand: ${brandName}`);
    }
  }
  
  console.log(`   📊 New brands added: ${addedBrands}`);
  return addedBrands;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('💎 FLM AUTO - VIBRANIUM IMPORT\n');
  console.log('═'.repeat(60));
  
  await initDbMaps();
  console.log(`   📊 DB: ${brandMap.size} brands, ${models.length} models, ${generations.length} generations\n`);
  
  let total = 0;
  
  await importCompleteBrands();
  await initDbMaps(); // Refresh after adding brands
  
  total += await importComparisons();
  total += await importClassicCars();
  total += await importMegaVehicles();
  total += await importNHTSA();
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(60));
  console.log('💎 VIBRANIUM IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   New records this run: ${total}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
