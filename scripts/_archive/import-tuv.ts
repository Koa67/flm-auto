/**
 * IMPORT TÜV DATA - Real reliability data
 */

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function importTUV() {
  console.log('🔧 TÜV DATA IMPORT - Real reliability data\n');
  console.log('═'.repeat(60));
  
  // Load TÜV data
  const tuvData = JSON.parse(fs.readFileSync('/Users/koa/Dev/flm-auto/data/raw/tuv/mega_tuv_all.json', 'utf-8'));
  console.log(`\n📁 Loaded ${tuvData.length} TÜV records`);
  
  // Get all generations
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(id, name, brand:brands(id, name))')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allGens = [...allGens, ...data];
    if (data.length < 1000) break;
    page++;
  }
  console.log(`📊 Total generations in DB: ${allGens.length}`);
  
  // Build lookup by brand+model
  const genByBrandModel = new Map<string, any[]>();
  for (const gen of allGens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    if (!genByBrandModel.has(key)) genByBrandModel.set(key, []);
    genByBrandModel.get(key)!.push(gen);
  }
  
  // Group TÜV data by vehicle
  const tuvByVehicle = new Map<string, any[]>();
  for (const record of tuvData) {
    const key = `${record.brand.toLowerCase()}|${record.model.toLowerCase()}`;
    if (!tuvByVehicle.has(key)) tuvByVehicle.set(key, []);
    tuvByVehicle.get(key)!.push(record);
  }
  
  console.log(`\n🚗 Unique vehicles in TÜV data: ${tuvByVehicle.size}`);
  
  // Match and create specs
  const specsToInsert: any[] = [];
  let matched = 0;
  let unmatched = 0;
  const unmatchedList: string[] = [];
  
  for (const [key, records] of tuvByVehicle.entries()) {
    // Try exact match
    let gens = genByBrandModel.get(key);
    
    // Try fuzzy match
    if (!gens) {
      const [brand, model] = key.split('|');
      for (const [dbKey, dbGens] of genByBrandModel.entries()) {
        const [dbBrand, dbModel] = dbKey.split('|');
        if (dbBrand === brand && (dbModel.includes(model) || model.includes(dbModel))) {
          gens = dbGens;
          break;
        }
      }
    }
    
    // Special mappings
    if (!gens) {
      const [brand, model] = key.split('|');
      const mappings: Record<string, string> = {
        'golf sportsvan': 'golf',
        'golf variant': 'golf',
        'e-golf': 'golf',
        'a-class': 'a',
        'b-class': 'b',
        'c-class': 'c',
        'e-class': 'e',
        's-class': 's',
        'glc': 'glc',
        'gle': 'gle',
        'gla': 'gla',
        '1 series': '1',
        '2 series': '2',
        '3 series': '3',
        '5 series': '5',
      };
      
      const mappedModel = mappings[model] || model;
      gens = genByBrandModel.get(`${brand}|${mappedModel}`);
    }
    
    if (gens && gens.length > 0) {
      matched++;
      
      // Create one spec per generation with all TÜV data
      for (const gen of gens) {
        // Group records by age category
        const byAge: Record<string, any> = {};
        for (const r of records) {
          const ageKey = r.age_category.replace(/\s+/g, '_').replace(/-/g, '_');
          byAge[ageKey] = {
            report_year: r.report_year,
            rank: r.rank,
            defect_rate_percent: r.defect_rate_percent,
            avg_mileage_tkm: r.avg_mileage_tkm,
            better_than_average: r.better_than_average,
          };
        }
        
        specsToInsert.push({
          generation_id: gen.id,
          source: 'TÜV Report',
          spec_type: 'tuv_reliability',
          spec_value: records[0].defect_rate_percent,
          raw_data: {
            vehicle: `${records[0].brand} ${records[0].model}`,
            data_by_age: byAge,
            years_covered: [...new Set(records.map(r => r.report_year))],
            best_rank: Math.min(...records.map(r => r.rank)),
            lowest_defect_rate: Math.min(...records.map(r => r.defect_rate_percent)),
            source_url: records[0].source_url,
          },
        });
      }
    } else {
      unmatched++;
      unmatchedList.push(key);
    }
  }
  
  console.log(`\n✅ Matched: ${matched} vehicles`);
  console.log(`❌ Unmatched: ${unmatched} vehicles`);
  
  if (unmatchedList.length > 0 && unmatchedList.length <= 30) {
    console.log(`\n🔍 Unmatched vehicles:`);
    unmatchedList.forEach(v => console.log(`   - ${v}`));
  }
  
  // Insert
  if (specsToInsert.length > 0) {
    console.log(`\n📤 Inserting ${specsToInsert.length} TÜV specs...`);
    
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < specsToInsert.length; i += batchSize) {
      const batch = specsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('third_party_specs')
        .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) inserted += batch.length;
      else console.error(`Error: ${error.message}`);
      
      process.stdout.write(`\r   Progress: ${inserted}/${specsToInsert.length}`);
    }
    console.log('\n');
  }
  
  // Final stats
  const { count: tuvCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'TÜV Report');
  
  const { count: totalSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('═'.repeat(60));
  console.log('🔧 TÜV IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   TÜV specs in DB: ${tuvCount}`);
  console.log(`   Total third_party_specs: ${totalSpecs}`);
}

importTUV().catch(console.error);
