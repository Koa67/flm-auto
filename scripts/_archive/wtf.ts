/**
 * WTF IS HAPPENING
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function wtf() {
  // Clean slate
  await supabase.from('third_party_specs').delete().eq('source', 'TEST_WTF');
  
  // Get 10 generations
  const { data: gens } = await supabase
    .from('generations')
    .select('id')
    .limit(10);
  
  console.log('10 generation IDs:');
  gens?.forEach((g, i) => console.log(`  ${i}: ${g.id}`));
  
  // Create specs for each
  const specs: any[] = [];
  for (const gen of gens || []) {
    specs.push({
      generation_id: gen.id,
      source: 'TEST_WTF',
      spec_type: 'test',
      spec_value: 0,
      raw_data: { gen_id_used: gen.id }
    });
  }
  
  console.log('\nSpecs to insert:');
  specs.forEach((s, i) => console.log(`  ${i}: gen_id=${s.generation_id}`));
  
  // Insert
  const { error } = await supabase.from('third_party_specs').insert(specs);
  console.log(`\nInsert result: ${error ? error.message : 'OK'}`);
  
  // Check what's in DB
  const { data: inserted } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'TEST_WTF');
  
  const unique = new Set(inserted?.map(i => i.generation_id));
  console.log(`\nIn DB: ${inserted?.length} rows, ${unique.size} unique gen_ids`);
  
  // Clean up
  await supabase.from('third_party_specs').delete().eq('source', 'TEST_WTF');
}

wtf().catch(console.error);
