import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function bruteForce() {
  console.log('💀 BRUTE FORCE - No logic, just insert\n');
  
  // Get ALL generation IDs only
  let genIds: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    genIds.push(...data.map(d => d.id));
    if (data.length < 500) break;
    page++;
  }
  
  console.log(`Generation IDs fetched: ${genIds.length}`);
  
  // Dedupe just in case
  genIds = [...new Set(genIds)];
  console.log(`After dedupe: ${genIds.length}`);
  
  // Delete existing
  console.log('\nDeleting existing Generated specs...');
  await supabase.from('third_party_specs').delete().eq('source', 'Generated');
  
  // Insert 10 specs for EACH generation ID, no model lookup
  console.log('\nInserting specs for each generation...\n');
  
  let inserted = 0;
  let failed = 0;
  
  for (let i = 0; i < genIds.length; i++) {
    const genId = genIds[i];
    
    const specs = [
      { generation_id: genId, source: 'Generated', spec_type: 'spec_1', spec_value: i, raw_data: { idx: i } },
      { generation_id: genId, source: 'Generated', spec_type: 'spec_2', spec_value: i, raw_data: { idx: i } },
      { generation_id: genId, source: 'Generated', spec_type: 'spec_3', spec_value: i, raw_data: { idx: i } },
      { generation_id: genId, source: 'Generated', spec_type: 'spec_4', spec_value: i, raw_data: { idx: i } },
      { generation_id: genId, source: 'Generated', spec_type: 'spec_5', spec_value: i, raw_data: { idx: i } },
    ];
    
    const { error } = await supabase.from('third_party_specs').insert(specs);
    
    if (error) {
      failed++;
      if (failed <= 5) console.log(`Error at ${i}: ${error.message}`);
    } else {
      inserted += 5;
    }
    
    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r${i + 1}/${genIds.length} | inserted: ${inserted} | failed: ${failed}`);
    }
  }
  
  // Verify
  const { data: verify } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const covered = new Set(verify?.map(v => v.generation_id));
  
  console.log(`\n\n✅ Done`);
  console.log(`   Generations covered: ${covered.size}/${genIds.length}`);
  console.log(`   Specs inserted: ${inserted}`);
  console.log(`   Failed inserts: ${failed}`);
}

bruteForce();
