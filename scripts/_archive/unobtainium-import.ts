/**
 * FLM AUTO - UNOBTAINIUM IMPORT 🌟
 * Import Classic Cars + Mega Vehicles + Generate more specs
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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
  
  const { data: m } = await supabase.from('models').select('id, name, brand_id');
  models = m || [];
  const { data: g } = await supabase.from('generations').select('id, model_id, name');
  generations = g || [];
}

function findGeneration(brandId: string, modelName: string): string | null {
  if (!modelName || !brandId) return null;
  const modelLower = modelName.toLowerCase().replace(/-/g, '').replace(/ /g, '');
  const brandModels = models.filter(m => m.brand_id === brandId);
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, '').replace(/ /g, '');
    if (modelLower.includes(dbName) || dbName.includes(modelLower.substring(0, 3))) {
      const gens = generations.filter(g => g.model_id === model.id);
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

// ============================================================
// 1. Classic Cars Database (array structure)
// ============================================================
async function importClassicCars() {
  console.log('\n🏛️ Importing Classic Cars Database...\n');
  
  const file = '../data/CLASSIC_CARS_DATABASE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  // Iterate through all eras (they are arrays)
  for (const [key, value] of Object.entries(data)) {
    if (key === 'metadata' || !Array.isArray(value)) continue;
    
    for (const car of value) {
      if (!car.brand) continue;
      
      const brandId = brandMap.get(car.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, car.model);
      if (!genId) continue;
      
      const engine = car.engine || {};
      const perf = car.performance || {};
      const dims = car.dimensions || {};
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'ClassicCars',
        source_url: '',
        spec_type: 'classic_info',
        spec_value: car.year || 1960,
        raw_data: {
          era: key,
          model: car.model,
          year: car.year,
          body_type: car.body_type,
          engine_type: engine.type,
          displacement_cc: engine.displacement_cc,
          power_hp: engine.power_hp,
          top_speed_kmh: perf.top_speed_kmh,
          acceleration_0_100: perf.acceleration_0_100,
          weight_kg: dims.weight_kg,
          production: car.production,
          notes: car.notes,
          significance: car.significance,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted++;
        console.log(`   ✅ ${car.brand} ${car.model} (${car.year})`);
      }
    }
  }
  
  console.log(`\n   📊 Total Classic Cars: ${inserted}`);
  return inserted;
}

// ============================================================
// 2. Mega Vehicles Database (nested structure)
// ============================================================
async function importMegaVehicles() {
  console.log('\n🚗 Importing Mega Vehicles Database...\n');
  
  const file = '../data/MEGA_VEHICLES_DATABASE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let inserted = 0;
  
  for (const [era, eraData] of Object.entries(data)) {
    if (era === 'metadata') continue;
    
    // Structure: era.vehicles[] or era directly as array
    const vehicles = (eraData as any).vehicles || (Array.isArray(eraData) ? eraData : []);
    
    for (const v of vehicles) {
      if (!v.brand) continue;
      
      const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, v.model);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'MegaDB',
        source_url: '',
        spec_type: 'mega_specs',
        spec_value: v.power_hp || v.year || 0,
        raw_data: {
          era: era,
          model: v.model,
          year: v.year,
          body_type: v.body_type,
          engine_cc: v.engine_cc,
          power_hp: v.power_hp,
          top_speed_kmh: v.top_speed_kmh,
          weight_kg: v.weight_kg,
          wheelbase_mm: v.wheelbase_mm,
          production: v.production,
          country: v.country,
          significance: v.significance,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted++;
        console.log(`   ✅ ${v.brand} ${v.model}`);
      }
    }
  }
  
  console.log(`\n   📊 Total Mega Vehicles: ${inserted}`);
  return inserted;
}

// ============================================================
// 3. Generate comprehensive specs for ALL models in DB
// ============================================================
async function generateMissingSpecs() {
  console.log('\n🔧 Generating Missing Specs for DB Models...\n');
  
  // Get all generations without certain spec types
  const { data: allGens } = await supabase
    .from('generations')
    .select(`
      id, name, 
      model:models(id, name, brand:brands(id, name))
    `);
  
  if (!allGens) return 0;
  
  // Get existing specs
  const { data: existingSpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id, spec_type');
  
  const existingSet = new Set(
    existingSpecs?.map(s => `${s.generation_id}_${s.spec_type}`) || []
  );
  
  let inserted = 0;
  
  // Typical specs by segment (estimated data for demo)
  const segmentSpecs: Record<string, any> = {
    'compact': { length: 4300, width: 1800, height: 1450, weight: 1350, trunk: 380 },
    'sedan': { length: 4700, width: 1850, height: 1450, weight: 1500, trunk: 480 },
    'suv': { length: 4600, width: 1900, height: 1700, weight: 1800, trunk: 520 },
    'sports': { length: 4400, width: 1850, height: 1300, weight: 1400, trunk: 300 },
    'luxury': { length: 5100, width: 1900, height: 1500, weight: 2000, trunk: 530 },
  };
  
  for (const gen of allGens) {
    const model = (gen as any).model;
    if (!model?.brand) continue;
    
    const brandName = model.brand.name;
    const modelName = model.name.toLowerCase();
    
    // Determine segment
    let segment = 'sedan';
    if (modelName.includes('x') || modelName.includes('q') || modelName.includes('gl') || 
        modelName.includes('suv') || modelName.includes('tiguan') || modelName.includes('tucson')) {
      segment = 'suv';
    } else if (modelName.includes('1') || modelName.includes('a3') || modelName.includes('golf') || 
               modelName.includes('polo') || modelName.includes('a1')) {
      segment = 'compact';
    } else if (modelName.includes('911') || modelName.includes('m') || modelName.includes('rs') ||
               modelName.includes('amg') || modelName.includes('gtl')) {
      segment = 'sports';
    } else if (modelName.includes('7') || modelName.includes('s-class') || modelName.includes('a8') ||
               modelName.includes('panamera')) {
      segment = 'luxury';
    }
    
    const specs = segmentSpecs[segment];
    const key = `${gen.id}_estimated_dimensions`;
    
    if (!existingSet.has(key)) {
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: gen.id,
        source: 'Estimated',
        source_url: '',
        spec_type: 'estimated_dimensions',
        spec_value: specs.length,
        raw_data: {
          brand: brandName,
          model: model.name,
          segment: segment,
          length_mm: specs.length + Math.round(Math.random() * 200 - 100),
          width_mm: specs.width + Math.round(Math.random() * 50 - 25),
          height_mm: specs.height + Math.round(Math.random() * 100 - 50),
          curb_weight_kg: specs.weight + Math.round(Math.random() * 200 - 100),
          trunk_volume_l: specs.trunk + Math.round(Math.random() * 100 - 50),
          note: 'Estimated based on segment averages',
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  console.log(`   📊 Generated ${inserted} estimated specs`);
  return inserted;
}

// ============================================================
// 4. Import all photos to third_party_specs
// ============================================================
async function importPhotosAsSpecs() {
  console.log('\n📸 Importing Photos as Specs...\n');
  
  const files = [
    '../data/MVP_VEHICLE_PHOTOS.json',
    '../data/FAMILY_VEHICLE_PHOTOS.json',
    '../data/CLASSIC_VEHICLE_PHOTOS.json',
  ];
  
  let inserted = 0;
  
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const photos = data.photos || data.vehicles || data;
    
    for (const [key, photo] of Object.entries(photos)) {
      if (key === 'metadata') continue;
      const p = photo as any;
      
      if (!p.brand) continue;
      const brandId = brandMap.get(p.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, p.model || key);
      if (!genId) continue;
      
      const urls = p.urls || p.images || [p.url].filter(Boolean);
      if (urls.length === 0) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'PhotoGallery',
        source_url: urls[0],
        spec_type: 'photo_gallery',
        spec_value: urls.length,
        raw_data: {
          brand: p.brand,
          model: p.model,
          photo_count: urls.length,
          urls: urls.slice(0, 10),
          source_file: file.split('/').pop(),
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  console.log(`   📊 Total Photo Galleries: ${inserted}`);
  return inserted;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🌟 FLM AUTO - UNOBTAINIUM IMPORT\n');
  console.log('═'.repeat(60));
  
  await initDbMaps();
  console.log(`   📊 DB: ${brandMap.size} brands, ${models.length} models, ${generations.length} generations\n`);
  
  let total = 0;
  
  total += await importClassicCars();
  total += await importMegaVehicles();
  total += await generateMissingSpecs();
  total += await importPhotosAsSpecs();
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: modelCount } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: genCount } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(60));
  console.log('🌟 UNOBTAINIUM IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   New records this run: ${total}`);
  console.log(`\n📊 FINAL DATABASE STATE:`);
  console.log(`   Brands: ${brandCount}`);
  console.log(`   Models: ${modelCount}`);
  console.log(`   Generations: ${genCount}`);
  console.log(`   third_party_specs: ${totalCount}`);
}

main().catch(console.error);
