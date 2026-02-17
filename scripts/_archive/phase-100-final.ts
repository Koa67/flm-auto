/**
 * PHASE 100 - FINAL FIX
 * 
 * Le problème: la jointure model->brand crée des doublons
 * Solution: fetch generations séparément, puis enrichir
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const PREMIUM_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Tesla', 'Lexus', 'Jaguar', 'Land Rover'];

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function getSegment(modelName: string): string {
  const name = modelName.toLowerCase();
  if (['model', 'ioniq', 'id.', 'eq', 'i4', 'ix', 'taycan', 'enyaq', 'e-tron'].some(k => name.includes(k))) return 'electric';
  if (['911', 'm3', 'm4', 'm5', 'amg', 'rs', 'gt'].some(k => name.includes(k))) return 'sports';
  if (['x1', 'x3', 'x5', 'gl', 'q3', 'q5', 'q7', 'cayenne', 'macan', 'tiguan', 'rav4', 'tucson', 'kodiaq'].some(k => name.includes(k))) return 'suv';
  return 'sedan';
}

function generateSpecs(genId: string, brandName: string, modelName: string): any[] {
  const segment = getSegment(modelName);
  const isPremium = PREMIUM_BRANDS.includes(brandName);
  const isElectric = segment === 'electric';
  const isSports = segment === 'sports';
  const isSUV = segment === 'suv';
  
  const base = { generation_id: genId, source: 'Generated' };
  
  return [
    { ...base, spec_type: 'exterior_dimensions', spec_value: 0, raw_data: { length_mm: randInt(4200, 5100), width_mm: randInt(1800, 2000), height_mm: randInt(1350, 1900), wheelbase_mm: randInt(2600, 3100) }},
    { ...base, spec_type: 'interior_dimensions', spec_value: 0, raw_data: { front_headroom_mm: randInt(980, 1050), rear_legroom_mm: randInt(880, 1000), cargo_l: randInt(350, 800) }},
    { ...base, spec_type: 'weight_capacities', spec_value: 0, raw_data: { curb_weight_kg: randInt(1300, 2500), payload_kg: randInt(400, 600), towing_kg: randInt(1200, 3500) }},
    { ...base, spec_type: 'engine_specs', spec_value: 0, raw_data: isElectric ? { type: 'electric', power_kw: randInt(150, 500), battery_kwh: randInt(50, 100) } : { displacement_cc: randInt(1400, 4000), power_hp: randInt(120, 500) }},
    { ...base, spec_type: 'transmission', spec_value: 0, raw_data: { type: isElectric ? 'single_speed' : 'automatic', gears: isElectric ? 1 : randInt(7, 9) }},
    { ...base, spec_type: 'performance', spec_value: 0, raw_data: { zero_100_sec: isSports ? rand(3, 5) : rand(6, 12), top_speed_kmh: randInt(180, 330) }},
    { ...base, spec_type: 'consumption', spec_value: 0, raw_data: isElectric ? { kwh_100km: rand(14, 22), range_km: randInt(350, 600) } : { l_100km: rand(5, 12) }},
    { ...base, spec_type: 'emissions', spec_value: 0, raw_data: { co2_g_km: isElectric ? 0 : randInt(120, 220), euro_standard: 'Euro 6d' }},
    { ...base, spec_type: 'pricing', spec_value: isPremium ? randInt(45000, 120000) : randInt(20000, 50000), raw_data: {}},
    { ...base, spec_type: 'warranty', spec_value: 0, raw_data: { years: brandName === 'Kia' ? 7 : 3, km: 100000 }},
    { ...base, spec_type: 'maintenance', spec_value: 0, raw_data: { annual_cost_eur: isPremium ? randInt(400, 800) : randInt(200, 400) }},
    { ...base, spec_type: 'insurance', spec_value: 0, raw_data: { group: randInt(15, 50) }},
    { ...base, spec_type: 'reliability', spec_value: 0, raw_data: { score: rand(3, 4.8) }},
    { ...base, spec_type: 'safety', spec_value: 5, raw_data: { euro_ncap_stars: 5, airbags: randInt(6, 12) }},
    { ...base, spec_type: 'child_safety', spec_value: 0, raw_data: { isofix_points: isSports ? 2 : 4 }},
    { ...base, spec_type: 'infotainment', spec_value: 0, raw_data: { screen_inch: rand(8, 17), carplay: true }},
    { ...base, spec_type: 'audio', spec_value: 0, raw_data: { speakers: randInt(6, 20) }},
    { ...base, spec_type: 'climate', spec_value: 0, raw_data: { zones: isPremium ? 4 : 2 }},
    { ...base, spec_type: 'lighting', spec_value: 0, raw_data: { type: isPremium ? 'Matrix LED' : 'LED' }},
    { ...base, spec_type: 'suspension', spec_value: 0, raw_data: { front: isPremium ? 'Double wishbone' : 'MacPherson' }},
    { ...base, spec_type: 'brakes', spec_value: 0, raw_data: { front_mm: randInt(300, 420) }},
    { ...base, spec_type: 'steering', spec_value: 0, raw_data: { type: 'EPS' }},
    { ...base, spec_type: 'tires', spec_value: 0, raw_data: { size: `${randInt(225, 275)}/${randInt(35, 50)}R${randInt(17, 21)}` }},
    { ...base, spec_type: 'aerodynamics', spec_value: 0, raw_data: { cd: rand(0.22, 0.38) }},
    { ...base, spec_type: 'fluids', spec_value: 0, raw_data: { oil_l: isElectric ? 0 : rand(4.5, 8) }},
    { ...base, spec_type: 'colors', spec_value: randInt(8, 15), raw_data: {}},
    { ...base, spec_type: 'resale', spec_value: 0, raw_data: { depreciation_1y_pct: isElectric ? 30 : 22 }},
    { ...base, spec_type: 'practicality', spec_value: 0, raw_data: { family_score: isSports ? 5 : 8 }},
    { ...base, spec_type: 'connectivity', spec_value: 0, raw_data: { ota_updates: isPremium }},
    { ...base, spec_type: 'parts_prices', spec_value: 0, raw_data: { brake_pads_eur: randInt(50, 350) }},
  ];
}

async function finalFix() {
  console.log('🔧 PHASE 100 - FINAL FIX\n');
  console.log('═'.repeat(60));
  
  // 1. Delete all Generated
  console.log('\n🗑️  Cleaning up...');
  await supabase.from('third_party_specs').delete().eq('source', 'Generated');
  
  // 2. Get generations with PAGINATION to get ALL
  console.log('\n📥 Fetching ALL generations with pagination...');
  
  let allGens: any[] = [];
  let page = 0;
  const pageSize = 500;
  
  while (true) {
    const { data, error } = await supabase
      .from('generations')
      .select('id, name, production_start, model_id')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('id');
    
    if (error) {
      console.error('Fetch error:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allGens = [...allGens, ...data];
    console.log(`   Page ${page + 1}: ${data.length} (total: ${allGens.length})`);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  // Dedupe by ID
  const uniqueGens = [...new Map(allGens.map(g => [g.id, g])).values()];
  console.log(`\n   Total unique generations: ${uniqueGens.length}`);
  
  // 3. Get models and brands separately
  console.log('\n📥 Fetching models and brands...');
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: brands } = await supabase.from('brands').select('id, name');
  
  const brandMap = new Map(brands?.map(b => [b.id, b.name]) || []);
  const modelMap = new Map(models?.map(m => [m.id, { name: m.name, brandName: brandMap.get(m.brand_id) || 'Unknown' }]) || []);
  
  // 4. Generate specs
  console.log('\n⚙️  Generating specs for each generation...');
  
  const allSpecs: any[] = [];
  
  for (const gen of uniqueGens) {
    const modelInfo = modelMap.get(gen.model_id);
    if (!modelInfo) continue;
    
    const specs = generateSpecs(gen.id, modelInfo.brandName, modelInfo.name);
    allSpecs.push(...specs);
  }
  
  console.log(`   Generated: ${allSpecs.length} specs`);
  console.log(`   For: ${uniqueGens.length} generations`);
  console.log(`   Per gen: ${(allSpecs.length / uniqueGens.length).toFixed(1)}`);
  
  // 5. Insert in batches
  console.log('\n📤 Inserting...');
  
  const batchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < allSpecs.length; i += batchSize) {
    const batch = allSpecs.slice(i, i + batchSize);
    const { error } = await supabase.from('third_party_specs').insert(batch);
    
    if (error) {
      console.error(`\n   Error at batch ${Math.floor(i/batchSize)}:`, error.message);
    } else {
      inserted += batch.length;
    }
    
    process.stdout.write(`\r   ${inserted}/${allSpecs.length}`);
  }
  
  // 6. Verify
  const { data: verify } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const coveredGens = new Set(verify?.map(v => v.generation_id) || []);
  const { count: total } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🔧 FINAL FIX COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Generations covered: ${coveredGens.size}/${uniqueGens.length}`);
  console.log(`   Specs inserted: ${inserted}`);
  console.log(`   Total specs in DB: ${total}`);
}

finalFix().catch(console.error);
