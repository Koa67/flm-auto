/**
 * DIAGNOSTIC - Why only 25 generations?
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function diagnose() {
  console.log('🔬 DIAGNOSTIC\n');
  
  // 1. Check constraint on third_party_specs
  const { data: sample } = await supabase
    .from('third_party_specs')
    .select('*')
    .eq('source', 'Generated')
    .limit(5);
  
  console.log('Sample Generated spec:');
  console.log(JSON.stringify(sample?.[0], null, 2));
  
  // 2. Count unique generation_ids
  const { data: genIds } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const unique = new Set(genIds?.map(g => g.generation_id));
  console.log(`\nUnique generation_ids with Generated: ${unique.size}`);
  
  // 3. Check if there's a unique constraint
  // Try inserting duplicate
  const testSpec = {
    generation_id: sample?.[0]?.generation_id,
    source: 'Generated',
    spec_type: 'test_duplicate',
    spec_value: 0,
    raw_data: { test: true }
  };
  
  const { error: dupError } = await supabase
    .from('third_party_specs')
    .insert([testSpec]);
  
  console.log(`\nDuplicate insert test: ${dupError ? 'BLOCKED - ' + dupError.message : 'ALLOWED'}`);
  
  // 4. Check if generation_ids in our insert match what's in DB
  const { data: allGens } = await supabase
    .from('generations')
    .select('id')
    .limit(1000);
  
  console.log(`\nGenerations from select: ${allGens?.length}`);
  
  // Check first 5 gen IDs
  console.log('\nFirst 5 generation IDs:');
  allGens?.slice(0, 5).forEach(g => console.log(`  ${g.id}`));
  
  // 5. Check what generation_ids ARE in Generated specs
  const { data: genSpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const genSpecIds = new Set(genSpecs?.map(g => g.generation_id));
  console.log(`\nGeneration IDs in Generated specs: ${genSpecIds.size}`);
  
  // Are they from allGens?
  const allGenIds = new Set(allGens?.map(g => g.id));
  const overlap = [...genSpecIds].filter(id => allGenIds.has(id));
  console.log(`Overlap with fetched generations: ${overlap.length}`);
  
  // 6. THE REAL TEST - insert one spec for a generation that should work
  const targetGenId = allGens?.[500]?.id; // Pick one from middle
  console.log(`\nTest insert for generation ${targetGenId}...`);
  
  const { error: testError } = await supabase
    .from('third_party_specs')
    .insert([{
      generation_id: targetGenId,
      source: 'TEST',
      spec_type: 'diagnostic_test',
      spec_value: 999,
      raw_data: { test: 'works' }
    }]);
  
  console.log(`Result: ${testError ? 'FAILED - ' + testError.message : 'SUCCESS'}`);
  
  // Clean up
  await supabase.from('third_party_specs').delete().eq('source', 'TEST');
  await supabase.from('third_party_specs').delete().eq('spec_type', 'test_duplicate');
}

diagnose().catch(console.error);
