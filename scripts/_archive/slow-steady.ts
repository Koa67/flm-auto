import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function slowAndSteady() {
  console.log('🐢 SLOW AND STEADY - With delays and verification\n');
  
  // Get ALL generation IDs
  let genIds: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('generations').select('id').range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    genIds.push(...data.map(d => d.id));
    if (data.length < 500) break;
    page++;
  }
  genIds = [...new Set(genIds)];
  console.log(`Generations: ${genIds.length}`);
  
  // Delete existing
  await supabase.from('third_party_specs').delete().eq('source', 'Generated');
  console.log('Cleaned.\n');
  
  let reallyInserted = 0;
  
  // Insert ONE generation at a time with verification
  for (let i = 0; i < genIds.length; i++) {
    const genId = genIds[i];
    
    const specs = [
      { generation_id: genId, source: 'Generated', spec_type: 's1', spec_value: 0, raw_data: {} },
      { generation_id: genId, source: 'Generated', spec_type: 's2', spec_value: 0, raw_data: {} },
      { generation_id: genId, source: 'Generated', spec_type: 's3', spec_value: 0, raw_data: {} },
    ];
    
    const { data: result, error } = await supabase
      .from('third_party_specs')
      .insert(specs)
      .select('id');  // Force return to verify
    
    if (result && result.length === 3) {
      reallyInserted += 3;
    } else {
      console.log(`\n⚠️ Gen ${i}: expected 3, got ${result?.length || 0}. Error: ${error?.message || 'none'}`);
    }
    
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r${i + 1}/${genIds.length} | verified inserts: ${reallyInserted}`);
      await sleep(100); // Small delay every 50
    }
  }
  
  // Final check
  const { data: final } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const covered = new Set(final?.map(f => f.generation_id));
  
  console.log(`\n\n✅ Final verification`);
  console.log(`   Generations covered: ${covered.size}/${genIds.length}`);
  console.log(`   Verified inserts: ${reallyInserted}`);
}

slowAndSteady();
