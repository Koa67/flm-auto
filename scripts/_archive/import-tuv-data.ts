/**
 * FLM AUTO - Import MEGA TÜV data into third_party_specs
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

interface TuvEntry {
  report_year: string;
  age_category: string;
  production_years: string;
  rank: number;
  brand: string;
  model: string;
  defect_rate_percent: number;
  avg_mileage_tkm: number;
}

async function main() {
  console.log('🚀 FLM AUTO - MEGA TÜV Data Import');
  
  const tuvData: TuvEntry[] = JSON.parse(
    fs.readFileSync('../data/raw/tuv/mega_tuv_all.json', 'utf-8')
  );
  console.log(`📊 Loaded ${tuvData.length} TÜV entries (2024+2025)`);
  
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach((b: any) => {
    brandMap.set(b.name.toLowerCase(), b.id);
    if (b.name === 'Mercedes-Benz') brandMap.set('mercedes-benz', b.id);
    if (b.name === 'Volkswagen') brandMap.set('vw', b.id);
  });
  console.log(`📋 ${brands?.length} brands in DB`);
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const modelMap = new Map<string, string>();
  models?.forEach((m: any) => {
    modelMap.set(`${m.brand_id}_${m.name.toLowerCase()}`, m.id);
  });
  console.log(`📋 ${models?.length} models in DB`);
  
  const { data: generations } = await supabase
    .from('generations')
    .select('id, model_id, name, production_start, production_end');
  
  const gensByModel = new Map<string, any[]>();
  generations?.forEach((g: any) => {
    const existing = gensByModel.get(g.model_id) || [];
    existing.push(g);
    gensByModel.set(g.model_id, existing);
  });
  console.log(`📋 ${generations?.length} generations in DB`);
  
  const toInsert: any[] = [];
  const notFoundModels = new Set<string>();
  let matched = 0;
  
  for (const tuv of tuvData) {
    const brandId = brandMap.get(tuv.brand.toLowerCase());
    if (!brandId) continue;
    
    const modelVariants = [
      tuv.model.toLowerCase(),
      tuv.model.toLowerCase().split(' ')[0],
      tuv.model.toLowerCase().replace(/-/g, ' '),
    ];
    
    let modelId: string | undefined;
    for (const name of modelVariants) {
      modelId = modelMap.get(`${brandId}_${name}`);
      if (modelId) break;
    }
    
    if (!modelId) {
      for (const [key, id] of modelMap.entries()) {
        if (!key.startsWith(brandId)) continue;
        const dbModel = key.split('_').slice(1).join('_');
        const tuvFirst = tuv.model.toLowerCase().split(' ')[0];
        if (dbModel.includes(tuvFirst) || tuvFirst.includes(dbModel)) {
          modelId = id;
          break;
        }
      }
    }
    
    if (!modelId) {
      notFoundModels.add(`${tuv.brand} ${tuv.model}`);
      continue;
    }
    
    const modelGens = gensByModel.get(modelId) || [];
    const [startYear, endYear] = tuv.production_years.split('-').map(Number);
    
    let bestGen = modelGens.find((g: any) => {
      const genStart = g.production_start || 2000;
      const genEnd = g.production_end || 2030;
      return genStart <= endYear && genEnd >= startYear;
    });
    
    if (!bestGen && modelGens.length > 0) {
      bestGen = modelGens[0];
    }
    
    if (!bestGen) {
      notFoundModels.add(`${tuv.brand} ${tuv.model} (no gen)`);
      continue;
    }
    
    // Include year in spec_type
    const specType = `tuv_${tuv.report_year}_defect_${tuv.age_category.replace(/\s+/g, '_').replace(/-/g, '_')}`;
    
    toInsert.push({
      generation_id: bestGen.id,
      source: 'TÜV Report',
      source_url: 'https://car-recalls.eu/reliability/',
      spec_type: specType,
      spec_value: tuv.defect_rate_percent,
      raw_data: {
        report_year: tuv.report_year,
        age_category: tuv.age_category,
        production_years: tuv.production_years,
        rank: tuv.rank,
        avg_mileage_tkm: tuv.avg_mileage_tkm,
        brand: tuv.brand,
        model: tuv.model,
      },
      tested_at: `${tuv.report_year}-01-01`,
    });
    
    matched++;
  }
  
  console.log(`\n✅ Matched: ${matched}`);
  console.log(`❌ Not found: ${notFoundModels.size}`);
  
  // Deduplicate
  const seen = new Set<string>();
  const uniqueInserts = toInsert.filter(row => {
    const key = `${row.generation_id}_${row.spec_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\n📥 Inserting ${uniqueInserts.length} unique records...`);
  
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
    .eq('source', 'TÜV Report');
  
  console.log(`📊 Total TÜV records in DB: ${count}`);
}

main().catch(console.error);
