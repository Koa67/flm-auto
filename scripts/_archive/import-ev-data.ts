/**
 * FLM AUTO - Import EV Database specs into third_party_specs
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface EvEntry {
  brand: string;
  model: string;
  variant: string;
  range_real_km: number | null;
  efficiency_whkm: number | null;
  battery_kwh: number | null;
  fastcharge_kw: number | null;
  acceleration_sec: number | null;
  seats: number | null;
  segment: string | null;
  drive: string | null;
  v2l: boolean;
  heat_pump: boolean;
  url: string | null;
}

async function main() {
  console.log('🚀 FLM AUTO - EV Database Import');
  
  const evData: EvEntry[] = JSON.parse(
    fs.readFileSync('../data/raw/ev_database/all_ev_specs.json', 'utf-8')
  );
  console.log(`📊 Loaded ${evData.length} EV entries`);
  
  // Get brands
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach((b: any) => {
    brandMap.set(b.name.toLowerCase(), b.id);
    if (b.name === 'Mercedes-Benz') brandMap.set('mercedes-benz', b.id);
  });
  console.log(`📋 ${brandMap.size} brands`);
  
  // Get models
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const modelMap = new Map<string, string>();
  models?.forEach((m: any) => {
    modelMap.set(`${m.brand_id}_${m.name.toLowerCase()}`, m.id);
  });
  console.log(`📋 ${modelMap.size} models`);
  
  // Get generations
  const { data: generations } = await supabase
    .from('generations')
    .select('id, model_id, name, production_start, production_end');
  
  const gensByModel = new Map<string, any[]>();
  generations?.forEach((g: any) => {
    const existing = gensByModel.get(g.model_id) || [];
    existing.push(g);
    gensByModel.set(g.model_id, existing);
  });
  console.log(`📋 ${generations?.length} generations`);
  
  const toInsert: any[] = [];
  const notFound = new Set<string>();
  let matched = 0;
  
  for (const ev of evData) {
    const brandId = brandMap.get(ev.brand.toLowerCase());
    if (!brandId) {
      notFound.add(`Brand: ${ev.brand}`);
      continue;
    }
    
    // Extract model name from variant (e.g., "iX3 50 xDrive" -> "iX3")
    const variantParts = ev.variant.split(' ');
    const modelNames = [
      ev.variant.toLowerCase(),
      variantParts[0]?.toLowerCase(),
      variantParts.slice(0, 2).join(' ').toLowerCase(),
    ].filter(Boolean);
    
    let modelId: string | undefined;
    for (const name of modelNames) {
      modelId = modelMap.get(`${brandId}_${name}`);
      if (modelId) break;
    }
    
    // Fuzzy match
    if (!modelId) {
      for (const [key, id] of modelMap.entries()) {
        if (!key.startsWith(brandId)) continue;
        const dbModel = key.split('_').slice(1).join('_');
        const evFirst = variantParts[0]?.toLowerCase() || '';
        if (dbModel.includes(evFirst) || evFirst.includes(dbModel)) {
          modelId = id;
          break;
        }
      }
    }
    
    if (!modelId) {
      notFound.add(`${ev.brand} ${ev.variant}`);
      continue;
    }
    
    // Find most recent generation
    const modelGens = gensByModel.get(modelId) || [];
    const bestGen = modelGens.sort((a: any, b: any) => 
      (b.production_start || 0) - (a.production_start || 0)
    )[0];
    
    if (!bestGen) {
      notFound.add(`${ev.brand} ${ev.variant} (no gen)`);
      continue;
    }
    
    // Create specs entries for each non-null value
    const specs: { type: string; value: number }[] = [];
    
    if (ev.range_real_km) specs.push({ type: 'ev_range_real_km', value: ev.range_real_km });
    if (ev.efficiency_whkm) specs.push({ type: 'ev_efficiency_whkm', value: ev.efficiency_whkm });
    if (ev.battery_kwh) specs.push({ type: 'ev_battery_kwh', value: ev.battery_kwh });
    if (ev.fastcharge_kw) specs.push({ type: 'ev_fastcharge_kw', value: ev.fastcharge_kw });
    if (ev.acceleration_sec) specs.push({ type: 'ev_acceleration_sec', value: ev.acceleration_sec });
    
    for (const spec of specs) {
      toInsert.push({
        generation_id: bestGen.id,
        source: 'EV Database',
        source_url: ev.url || 'https://ev-database.org/',
        spec_type: spec.type,
        spec_value: spec.value,
        raw_data: {
          brand: ev.brand,
          model: ev.model,
          variant: ev.variant,
          drive: ev.drive,
          segment: ev.segment,
          v2l: ev.v2l,
          heat_pump: ev.heat_pump,
        },
        tested_at: '2025-01-01',
      });
    }
    
    matched++;
  }
  
  console.log(`\n✅ Matched: ${matched} EVs`);
  console.log(`❌ Not found: ${notFound.size}`);
  
  if (notFound.size <= 30) {
    [...notFound].slice(0, 30).forEach(m => console.log(`   - ${m}`));
  }
  
  if (toInsert.length === 0) {
    console.log('\n❌ No data to insert');
    return;
  }
  
  // Deduplicate
  const seen = new Set<string>();
  const uniqueInserts = toInsert.filter(row => {
    const key = `${row.generation_id}_${row.spec_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\n📥 Inserting ${uniqueInserts.length} specs (deduped from ${toInsert.length})...`);
  
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < uniqueInserts.length; i += batchSize) {
    const batch = uniqueInserts.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('third_party_specs')
      .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    
    if (error) {
      console.error(`Batch error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`✅ Inserted: ${inserted}`);
  
  const { count } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'EV Database');
  
  console.log(`📊 Total EV specs in DB: ${count}`);
}

main().catch(console.error);
