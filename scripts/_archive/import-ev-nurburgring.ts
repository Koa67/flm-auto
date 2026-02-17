/**
 * FLM AUTO - Import EV Database & Nürburgring (fixed structures)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Parse "Mercedes-Benz EQS 450+" -> { brand: "Mercedes-Benz", model: "EQS" }
function parseModelName(fullName: string): { brand: string; model: string } | null {
  const patterns = [
    { regex: /^(Mercedes-Benz|Mercedes)\s+(.+)/, brand: 'Mercedes-Benz' },
    { regex: /^(BMW)\s+(.+)/, brand: 'BMW' },
    { regex: /^(Audi)\s+(.+)/, brand: 'Audi' },
    { regex: /^(Volkswagen|VW)\s+(.+)/, brand: 'Volkswagen' },
    { regex: /^(Porsche)\s+(.+)/, brand: 'Porsche' },
    { regex: /^(Tesla)\s+(.+)/, brand: 'Tesla' },
    { regex: /^(Hyundai)\s+(.+)/, brand: 'Hyundai' },
    { regex: /^(Kia)\s+(.+)/, brand: 'Kia' },
    { regex: /^(Volvo)\s+(.+)/, brand: 'Volvo' },
    { regex: /^(Skoda|Škoda)\s+(.+)/, brand: 'Skoda' },
    { regex: /^(Toyota)\s+(.+)/, brand: 'Toyota' },
    { regex: /^(Honda)\s+(.+)/, brand: 'Honda' },
    { regex: /^(Ford)\s+(.+)/, brand: 'Ford' },
    { regex: /^(Nissan)\s+(.+)/, brand: 'Nissan' },
    { regex: /^(Lexus)\s+(.+)/, brand: 'Lexus' },
    { regex: /^(Ferrari)\s+(.+)/, brand: 'Ferrari' },
    { regex: /^(Lamborghini)\s+(.+)/, brand: 'Lamborghini' },
    { regex: /^(Maserati)\s+(.+)/, brand: 'Maserati' },
  ];
  
  for (const { regex, brand } of patterns) {
    const match = fullName.match(regex);
    if (match) {
      // Extract base model name (first word/number group)
      const modelPart = match[2];
      const modelMatch = modelPart.match(/^([A-Za-z]+[\s-]?\d*|[A-Za-z]+)/);
      if (modelMatch) {
        return { brand, model: modelMatch[1].trim() };
      }
    }
  }
  return null;
}

function findGeneration(brandId: string, modelName: string, models: any[], generations: any[]): string | null {
  const modelLower = modelName.toLowerCase().replace(/-/g, '').replace(/ /g, '');
  const brandModels = models?.filter(m => m.brand_id === brandId) || [];
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, '').replace(/ /g, '');
    if (modelLower.includes(dbName) || dbName.includes(modelLower) || modelLower === dbName) {
      const gens = generations?.filter(g => g.model_id === model.id) || [];
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

// ============================================================
// 1. EV Database Complete (fixed)
// ============================================================
async function importEVDatabase() {
  console.log('\n⚡ Importing EV Database Complete...\n');
  
  const file = '../data/EV_DATABASE_COMPLETE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // Structure: vehicles_by_real_range.category[]
  const categories = data.vehicles_by_real_range || {};
  
  for (const [category, vehicles] of Object.entries(categories)) {
    if (!Array.isArray(vehicles)) continue;
    
    for (const v of vehicles) {
      const parsed = parseModelName(v.model);
      if (!parsed) continue;
      
      const brandId = brandMap.get(parsed.brand.toLowerCase().replace(/-/g, ''));
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, parsed.model, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'EVDatabase',
        source_url: `https://ev-database.org${v.url || ''}`,
        spec_type: 'ev_real_range',
        spec_value: v.real_range_km || 0,
        raw_data: {
          full_model: v.model,
          real_range_km: v.real_range_km,
          category: category,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted++;
        console.log(`   ✅ ${v.model}: ${v.real_range_km}km`);
      }
    }
  }
  
  console.log(`\n   📊 Inserted ${inserted} EV range records`);
  return inserted;
}

// ============================================================
// 2. Nürburgring Lap Times (fixed)
// ============================================================
async function importNurburgring() {
  console.log('\n🏁 Importing Nürburgring Lap Times...\n');
  
  const file = '../data/NURBURGRING_LAP_TIMES.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // Extract all lap records from nested structure
  const allRecords: any[] = [];
  
  // all_time_records
  const allTime = data.all_time_records || {};
  for (const [key, record] of Object.entries(allTime)) {
    if (record && typeof record === 'object' && (record as any).vehicle) {
      allRecords.push({ ...(record as any), record_type: key });
    }
  }
  
  // brand_specific_records
  const brandSpecific = data.brand_specific_records || {};
  for (const [brand, brandData] of Object.entries(brandSpecific)) {
    const records = (brandData as any).records || [];
    for (const r of records) {
      allRecords.push({ ...r, brand_hint: brand });
    }
  }
  
  // production_cars_by_brand
  const byBrand = data.production_cars_by_brand || {};
  for (const [brand, brandData] of Object.entries(byBrand)) {
    const records = (brandData as any).models || (brandData as any).cars || [];
    if (Array.isArray(records)) {
      for (const r of records) {
        allRecords.push({ ...r, brand_hint: brand });
      }
    }
  }
  
  console.log(`   Found ${allRecords.length} lap records\n`);
  
  for (const record of allRecords) {
    const vehicleName = record.vehicle || record.model || record.car;
    if (!vehicleName) continue;
    
    const parsed = parseModelName(vehicleName);
    if (!parsed) continue;
    
    const brandId = brandMap.get(parsed.brand.toLowerCase().replace(/-/g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, parsed.model, models || [], generations || []);
    if (!genId) continue;
    
    // Parse lap time to seconds
    const lapTime = record.time || record.lap_time;
    let lapSeconds = 0;
    if (lapTime) {
      const match = lapTime.match(/(\d+):(\d+)\.?(\d*)/);
      if (match) {
        lapSeconds = parseInt(match[1]) * 60 + parseInt(match[2]) + (parseFloat(`0.${match[3] || '0'}`));
      }
    }
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'Nurburgring',
      source_url: record.video_url || '',
      spec_type: 'nurburgring_lap',
      spec_value: Math.round(lapSeconds * 100), // centiseconds
      raw_data: {
        vehicle: vehicleName,
        lap_time: lapTime,
        lap_seconds: lapSeconds,
        driver: record.driver,
        date: record.date,
        power_hp: record.power_hp,
        record_type: record.record_type,
        notes: record.notes,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted++;
      console.log(`   ✅ ${vehicleName}: ${lapTime}`);
    }
  }
  
  console.log(`\n   📊 Inserted ${inserted} Nürburgring records`);
  return inserted;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🚀 FLM AUTO - EV & Nürburgring Import\n');
  console.log('═'.repeat(50));
  
  let total = 0;
  
  total += await importEVDatabase();
  total += await importNurburgring();
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 IMPORT COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   New records this run: ${total}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
