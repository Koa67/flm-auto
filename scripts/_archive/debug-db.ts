/**
 * Debug script to understand database structure
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('=== DATABASE DEBUG ===\n');
  
  // 1. Check table existence
  console.log('1. TABLE EXISTENCE');
  
  const tables = ['brands', 'models', 'generations', 'engine_variants', 
                  'powertrain_specs', 'performance_specs', 'dimensions_specs', 'fuel_specs'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    const exists = !error || error.code !== '42P01';
    const count = data ? data.length : 0;
    console.log(`  ${table}: ${exists ? '✓' : '✗'} ${error?.code || ''}`);
  }
  
  // 2. Sample generations with model/brand
  console.log('\n2. GENERATIONS SAMPLE (with parent info)');
  const { data: gens } = await supabase
    .from('generations')
    .select(`
      id, 
      name, 
      internal_code,
      year_from,
      year_to,
      models (
        id,
        name,
        brands (
          id,
          name
        )
      )
    `)
    .limit(10);
  
  if (gens) {
    for (const g of gens) {
      const model = (g.models as any);
      const brand = model?.brands?.name || '?';
      const modelName = model?.name || '?';
      console.log(`  ${brand} ${modelName} ${g.name} [${g.internal_code || 'no code'}] (${g.year_from}-${g.year_to || 'present'})`);
    }
  }
  
  // 3. Search for BMW models
  console.log('\n3. BMW MODELS');
  const { data: bmwModels } = await supabase
    .from('models')
    .select(`
      id,
      name,
      brands!inner (name)
    `)
    .eq('brands.name', 'BMW')
    .limit(20);
  
  if (bmwModels) {
    console.log(`  Found ${bmwModels.length} BMW models`);
    console.log(`  Names: ${bmwModels.map(m => m.name).join(', ')}`);
  }
  
  // 4. Search specifically for "M3" or "3 Series"
  console.log('\n4. SEARCHING FOR M3/3-SERIES');
  const { data: m3Search } = await supabase
    .from('models')
    .select(`
      id,
      name,
      generations (
        id,
        name,
        internal_code,
        year_from
      )
    `)
    .or('name.ilike.%M3%,name.ilike.%3 Series%,name.ilike.%3-Series%');
  
  if (m3Search && m3Search.length > 0) {
    for (const model of m3Search) {
      console.log(`  Model: ${model.name}`);
      const gens = model.generations as any[];
      if (gens) {
        for (const g of gens.slice(0, 5)) {
          console.log(`    - ${g.name} [${g.internal_code || 'no code'}] (${g.year_from})`);
        }
      }
    }
  } else {
    console.log('  No M3 or 3-Series found');
  }
  
  // 5. Check what internal_code values look like
  console.log('\n5. INTERNAL_CODE VALUES (non-null)');
  const { data: withCodes } = await supabase
    .from('generations')
    .select('internal_code')
    .not('internal_code', 'is', null)
    .limit(30);
  
  if (withCodes && withCodes.length > 0) {
    const codes = [...new Set(withCodes.map(g => g.internal_code))];
    console.log(`  Found ${codes.length} unique codes: ${codes.slice(0, 20).join(', ')}`);
  } else {
    console.log('  NO internal_code values found - this is the problem!');
  }
  
  // 6. Check performance_specs structure
  console.log('\n6. PERFORMANCE_SPECS COLUMNS');
  const { data: perfSample } = await supabase
    .from('performance_specs')
    .select('*')
    .limit(1);
  
  if (perfSample && perfSample[0]) {
    console.log(`  Columns: ${Object.keys(perfSample[0]).join(', ')}`);
    console.log(`  Sample values:`, JSON.stringify(perfSample[0], null, 2));
  }
  
  // 7. Check engine_variants to understand structure
  console.log('\n7. ENGINE_VARIANTS SAMPLE');
  const { data: evSample } = await supabase
    .from('engine_variants')
    .select(`
      id,
      name,
      generation_id,
      generations (
        name,
        internal_code,
        models (
          name,
          brands (name)
        )
      )
    `)
    .limit(5);
  
  if (evSample) {
    for (const ev of evSample) {
      const gen = ev.generations as any;
      const model = gen?.models;
      const brand = model?.brands?.name || '?';
      console.log(`  ${brand} ${model?.name || '?'} ${gen?.name || '?'} - ${ev.name}`);
    }
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
}

debug().catch(console.error);
