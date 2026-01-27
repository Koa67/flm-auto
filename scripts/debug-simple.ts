/**
 * Debug - Simple queries to understand data structure
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
  console.log('=== SIMPLE DEBUG QUERIES ===\n');

  // 1. Direct query on generations with internal_code
  console.log('1. GENERATIONS WITH INTERNAL_CODE (direct query)');
  const { data: gens, error: gensErr } = await supabase
    .from('generations')
    .select('id, name, internal_code, year_from')
    .not('internal_code', 'is', null)
    .limit(10);
  
  if (gensErr) {
    console.log('  Error:', gensErr);
  } else {
    console.log(`  Found ${gens?.length} generations with codes:`);
    gens?.forEach(g => console.log(`    ${g.internal_code} - ${g.name} (${g.year_from})`));
  }

  // 2. Check if E46 exists anywhere
  console.log('\n2. SEARCH FOR "E46" IN GENERATIONS');
  const { data: e46, error: e46Err } = await supabase
    .from('generations')
    .select('*')
    .or('internal_code.eq.E46,name.ilike.%E46%,internal_code.ilike.%E46%');
  
  if (e46Err) {
    console.log('  Error:', e46Err);
  } else {
    console.log(`  Found ${e46?.length} results for E46:`);
    e46?.forEach(g => console.log(`    ${g.id}: ${g.name} [${g.internal_code}]`));
  }

  // 3. Check BMW brand ID
  console.log('\n3. BMW BRAND');
  const { data: bmw } = await supabase
    .from('brands')
    .select('*')
    .eq('name', 'BMW')
    .single();
  
  console.log('  BMW brand:', bmw);

  // 4. Get some BMW models directly
  console.log('\n4. BMW MODELS (direct, no join filter)');
  const { data: bmwModels } = await supabase
    .from('models')
    .select('id, name, brand_id')
    .eq('brand_id', bmw?.id)
    .limit(15);
  
  console.log(`  Found ${bmwModels?.length} BMW models:`);
  bmwModels?.forEach(m => console.log(`    ${m.id}: ${m.name}`));

  // 5. Get generations for first BMW model
  if (bmwModels && bmwModels.length > 0) {
    console.log('\n5. GENERATIONS FOR BMW MODEL:', bmwModels[0].name);
    const { data: modelGens } = await supabase
      .from('generations')
      .select('id, name, internal_code, year_from, year_to')
      .eq('model_id', bmwModels[0].id)
      .limit(10);
    
    console.log(`  Found ${modelGens?.length} generations:`);
    modelGens?.forEach(g => console.log(`    ${g.internal_code || 'NO CODE'} - ${g.name} (${g.year_from}-${g.year_to || 'now'})`));
  }

  // 6. Find 3-Series model specifically
  console.log('\n6. SEARCH FOR "3" or "M3" IN BMW MODELS');
  const { data: series3 } = await supabase
    .from('models')
    .select('id, name, brand_id')
    .eq('brand_id', bmw?.id)
    .or('name.ilike.%3%,name.ilike.%M3%');
  
  console.log(`  Found: ${series3?.map(m => m.name).join(', ')}`);

  // 7. Check generations for "3" model
  if (series3 && series3.length > 0) {
    const model3 = series3.find(m => m.name === '3' || m.name === 'M3' || m.name === '3 Series');
    if (model3) {
      console.log(`\n7. GENERATIONS FOR ${model3.name}:`);
      const { data: gen3 } = await supabase
        .from('generations')
        .select('id, name, internal_code, year_from')
        .eq('model_id', model3.id)
        .order('year_from', { ascending: true });
      
      gen3?.forEach(g => console.log(`    ${g.internal_code || '???'} - ${g.name} (${g.year_from})`));
    }
  }

  // 8. Mercedes W-codes
  console.log('\n8. MERCEDES GENERATIONS WITH W-CODES');
  const { data: mercedes } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();

  const { data: mercModels } = await supabase
    .from('models')
    .select('id')
    .eq('brand_id', mercedes?.id);
  
  const modelIds = mercModels?.map(m => m.id) || [];
  
  const { data: wCodes } = await supabase
    .from('generations')
    .select('name, internal_code')
    .in('model_id', modelIds)
    .ilike('internal_code', 'W%')
    .limit(20);
  
  console.log(`  Found ${wCodes?.length} Mercedes W-code generations:`);
  wCodes?.forEach(g => console.log(`    ${g.internal_code} - ${g.name}`));

  // 9. Powerful engines (simple query)
  console.log('\n9. TOP 10 MOST POWERFUL ENGINES');
  const { data: powerful } = await supabase
    .from('powertrain_specs')
    .select(`
      power_hp,
      engine_variant_id,
      engine_variants (
        name
      )
    `)
    .not('power_hp', 'is', null)
    .order('power_hp', { ascending: false })
    .limit(10);
  
  powerful?.forEach(p => {
    const ev = p.engine_variants as any;
    console.log(`    ${p.power_hp}hp - ${ev?.name || 'Unknown'}`);
  });

  console.log('\n=== DEBUG COMPLETE ===');
}

debug().catch(console.error);
