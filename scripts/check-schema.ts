/**
 * Check exact schema of generations table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log('=== SCHEMA CHECK ===\n');

  // Get one full row from each main table
  const tables = ['brands', 'models', 'generations', 'engine_variants', 'powertrain_specs', 'performance_specs'];
  
  for (const table of tables) {
    console.log(`\n${table.toUpperCase()} COLUMNS:`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log(`  Error: ${error.message}`);
    } else if (data && data[0]) {
      const cols = Object.keys(data[0]);
      console.log(`  ${cols.join(', ')}`);
    }
  }

  // Get a full generation record
  console.log('\n\nFULL GENERATION RECORD (E46):');
  const { data: e46 } = await supabase
    .from('generations')
    .select('*')
    .eq('internal_code', 'E46')
    .limit(1);
  
  if (e46 && e46[0]) {
    console.log(JSON.stringify(e46[0], null, 2));
  }

  // Get M3 model with generations
  console.log('\n\nM3 MODEL WITH GENERATIONS:');
  const { data: m3Model } = await supabase
    .from('models')
    .select('id, name')
    .eq('name', 'M3')
    .single();
  
  if (m3Model) {
    console.log('M3 model ID:', m3Model.id);
    
    const { data: m3Gens } = await supabase
      .from('generations')
      .select('*')
      .eq('model_id', m3Model.id);
    
    console.log(`Found ${m3Gens?.length} generations for M3:`);
    m3Gens?.forEach(g => console.log(JSON.stringify(g, null, 2)));
  }

  // Check engine_variants for E46
  console.log('\n\nENGINE VARIANTS FOR E46:');
  const { data: e46Gen } = await supabase
    .from('generations')
    .select('id')
    .eq('internal_code', 'E46')
    .limit(1);
  
  if (e46Gen && e46Gen[0]) {
    const { data: e46Variants, count } = await supabase
      .from('engine_variants')
      .select('*', { count: 'exact' })
      .eq('generation_id', e46Gen[0].id)
      .limit(3);
    
    console.log(`Found ${count} variants for E46 (${e46Gen[0].id}):`);
    e46Variants?.forEach(v => console.log(`  - ${v.name}`));
  }
}

checkSchema().catch(console.error);
