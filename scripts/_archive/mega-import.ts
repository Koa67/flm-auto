/**
 * FLM AUTO - Mega Import: Ownership Data, ICE Consumption, Euro NCAP, etc.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Brand name normalization
function normalizeBrand(brand: string): string {
  const map: Record<string, string> = {
    'bmw': 'BMW',
    'mercedes': 'Mercedes-Benz',
    'mercedes-benz': 'Mercedes-Benz',
    'audi': 'Audi',
    'volkswagen': 'Volkswagen',
    'vw': 'Volkswagen',
    'porsche': 'Porsche',
    'skoda': 'Skoda',
    'tesla': 'Tesla',
    'hyundai': 'Hyundai',
    'volvo': 'Volvo',
    'toyota': 'Toyota',
    'honda': 'Honda',
    'ford': 'Ford',
  };
  return map[brand.toLowerCase()] || brand;
}

async function getDbMaps() {
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  return { brandMap, models, generations };
}

function findGeneration(brandId: string, modelName: string, models: any[], generations: any[]): string | null {
  const modelNameLower = modelName.toLowerCase()
    .replace(/_/g, ' ')
    .replace(/classe /g, '')
    .replace(/serie /g, '')
    .replace(/series/g, '')
    .replace(/-/g, ' ');
  
  const brandModels = models?.filter(m => m.brand_id === brandId) || [];
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, ' ');
    
    if (modelNameLower.includes(dbName) || dbName.includes(modelNameLower.split(' ')[0])) {
      const gens = generations?.filter(g => g.model_id === model.id) || [];
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

// ============================================================
// 1. Import Ownership Data (prices, insurance, maintenance)
// ============================================================
async function importOwnershipData() {
  console.log('\n💰 Importing Ownership Data...\n');
  
  const file = '../data/COMPREHENSIVE_OWNERSHIP_DATA.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // Import new prices
  const pricesNew = data['1_prices_new']?.data || {};
  for (const [brand, brandData] of Object.entries(pricesNew)) {
    const brandId = brandMap.get(brand.toLowerCase());
    if (!brandId) continue;
    
    for (const [modelKey, modelData] of Object.entries(brandData as any)) {
      const genId = findGeneration(brandId, modelKey, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'Ownership',
        source_url: '',
        spec_type: 'price_new_2025',
        spec_value: (modelData as any).base,
        raw_data: modelData,
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  // Import used prices
  const pricesUsed = data['2_prices_used']?.data || {};
  for (const [brand, brandData] of Object.entries(pricesUsed)) {
    const brandId = brandMap.get(brand.toLowerCase());
    if (!brandId) continue;
    
    for (const [modelKey, modelData] of Object.entries(brandData as any)) {
      const genId = findGeneration(brandId, modelKey, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'Ownership',
        source_url: '',
        spec_type: 'price_used',
        spec_value: (modelData as any)['3_ans']?.moyen || 0,
        raw_data: modelData,
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  // Import maintenance costs
  const maintenance = data['4_maintenance_costs']?.data || {};
  for (const [brand, brandData] of Object.entries(maintenance)) {
    const brandId = brandMap.get(brand.toLowerCase());
    if (!brandId) continue;
    
    for (const [modelKey, modelData] of Object.entries(brandData as any)) {
      const genId = findGeneration(brandId, modelKey, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'Ownership',
        source_url: '',
        spec_type: 'maintenance_annual',
        spec_value: (modelData as any).cout_annuel_moyen || 0,
        raw_data: modelData,
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  // Import insurance
  const insurance = data['5_insurance_costs']?.data || {};
  for (const [brand, brandData] of Object.entries(insurance)) {
    const brandId = brandMap.get(brand.toLowerCase());
    if (!brandId) continue;
    
    for (const [modelKey, modelData] of Object.entries(brandData as any)) {
      const genId = findGeneration(brandId, modelKey, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'Ownership',
        source_url: '',
        spec_type: 'insurance_annual',
        spec_value: (modelData as any).tous_risques?.moyen || 0,
        raw_data: modelData,
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted++;
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} ownership records`);
  return inserted;
}

// ============================================================
// 2. Import ICE Real Consumption
// ============================================================
async function importICEConsumption() {
  console.log('\n⛽ Importing ICE Real Consumption...\n');
  
  const file = '../data/ICE_REAL_CONSUMPTION_DATABASE.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  for (const [brandKey, brandData] of Object.entries(data)) {
    if (brandKey === 'metadata') continue;
    
    const brandId = brandMap.get(brandKey.toLowerCase());
    if (!brandId) continue;
    
    const modelsData = (brandData as any).models || {};
    
    for (const [modelKey, modelData] of Object.entries(modelsData)) {
      const genId = findGeneration(brandId, modelKey, models || [], generations || []);
      if (!genId) continue;
      
      // Insert each engine variant
      const engines = (modelData as any).engines || [];
      for (let i = 0; i < Math.min(engines.length, 5); i++) {
        const engine = engines[i];
        
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'RealConsumption',
          source_url: 'https://www.honestjohn.co.uk/realmpg/',
          spec_type: `real_consumption_${engine.code?.replace(/\s+/g, '_') || i}`,
          spec_value: engine.real_l100km || 0,
          raw_data: {
            engine_code: engine.code,
            fuel: engine.fuel,
            power_hp: engine.power_hp,
            wltp_mpg: engine.wltp_mpg,
            real_mpg: engine.real_mpg_avg,
            real_l100km: engine.real_l100km,
            efficiency_pct: engine.real_vs_wltp_pct,
          },
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) inserted++;
      }
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} consumption records`);
  return inserted;
}

// ============================================================
// 3. Import Euro NCAP Extended
// ============================================================
async function importEuroNCAP() {
  console.log('\n⭐ Importing Euro NCAP Extended...\n');
  
  const file = '../data/EURONCAP_EXTENDED_DATABASE.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const results = data.ratings || data.results || data;
  
  for (const result of (Array.isArray(results) ? results : Object.values(results))) {
    if (!result.brand || !result.model) continue;
    
    const brandId = brandMap.get(result.brand.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, result.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'EuroNCAP',
      source_url: result.url || '',
      spec_type: 'euroncap_rating',
      spec_value: result.stars || result.overall_rating || 0,
      raw_data: {
        stars: result.stars,
        year_tested: result.year,
        adult_occupant: result.adult_occupant || result.adult,
        child_occupant: result.child_occupant || result.child,
        pedestrian: result.pedestrian || result.vru,
        safety_assist: result.safety_assist,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} Euro NCAP records`);
  return inserted;
}

// ============================================================
// 4. Import ADAC Trunk Volumes
// ============================================================
async function importADACTrunk() {
  console.log('\n🧳 Importing ADAC Trunk Volumes...\n');
  
  const file = '../data/adac-kofferraum.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  for (const item of data) {
    const brandId = brandMap.get(item.brand?.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, item.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'ADAC',
      source_url: 'https://www.adac.de/rund-ums-fahrzeug/autokatalog/',
      spec_type: 'trunk_volume',
      spec_value: item.volumeAdac || 0,
      raw_data: {
        volume_manufacturer: item.volumeManufacturer,
        volume_adac: item.volumeAdac,
        volume_adac_roof: item.volumeAdacDachhoch,
        category: item.category,
        price_eur: item.priceEur,
        date_range: item.dateRange,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} trunk volume records`);
  return inserted;
}

// ============================================================
// 5. Import Extended ISOFIX Data
// ============================================================
async function importISOFIX() {
  console.log('\n👶 Importing Extended ISOFIX Data...\n');
  
  const file = '../data/FAMILY_FIT_ISOFIX_EXTENDED.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const vehicles = data.vehicles || data;
  
  for (const vehicle of (Array.isArray(vehicles) ? vehicles : Object.values(vehicles))) {
    if (!vehicle.brand) continue;
    
    const brandId = brandMap.get(vehicle.brand.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, vehicle.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'ISOFIX',
      source_url: '',
      spec_type: 'isofix_extended',
      spec_value: vehicle.isofix_points || 2,
      raw_data: {
        isofix_points: vehicle.isofix_points,
        isofix_positions: vehicle.isofix_positions,
        top_tether_points: vehicle.top_tether,
        center_isofix: vehicle.center_isofix,
        three_across_possible: vehicle.three_across,
        rear_bench_width: vehicle.rear_bench_width,
        notes: vehicle.notes,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} ISOFIX records`);
  return inserted;
}

// ============================================================
// 6. Import Pop Culture / Motorsport
// ============================================================
async function importPopCulture() {
  console.log('\n🎬 Importing Pop Culture & Motorsport...\n');
  
  const file = '../data/POP_CULTURE_MOTORSPORT_DATABASE.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // Movie appearances
  const movieAppearances = data.movie_appearances || data.appearances || [];
  for (const appearance of (Array.isArray(movieAppearances) ? movieAppearances : [])) {
    if (!appearance.brand) continue;
    
    const brandId = brandMap.get(appearance.brand.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, appearance.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'PopCulture',
      source_url: appearance.imdb_url || '',
      spec_type: `movie_${appearance.movie?.replace(/\s+/g, '_').substring(0, 30) || inserted}`,
      spec_value: appearance.year || 2000,
      raw_data: {
        movie: appearance.movie,
        year: appearance.year,
        role: appearance.role,
        character: appearance.character,
        iconic_scene: appearance.iconic_scene,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} pop culture records`);
  return inserted;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🚀 FLM AUTO - Mega Data Import\n');
  console.log('═'.repeat(50));
  
  let total = 0;
  
  total += await importOwnershipData();
  total += await importICEConsumption();
  total += await importEuroNCAP();
  total += await importADACTrunk();
  total += await importISOFIX();
  total += await importPopCulture();
  
  // Final stats
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 MEGA IMPORT COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   New records this run: ${total}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
