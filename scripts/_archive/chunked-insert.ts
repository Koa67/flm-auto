import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function chunkedInsert() {
  console.log('🔨 CHUNKED INSERT - Small batches with long delays\n');
  
  // Get generations without Generated specs
  let allGenIds: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('generations').select('id').range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    allGenIds.push(...data.map(d => d.id));
    if (data.length < 500) break;
    page++;
  }
  allGenIds = [...new Set(allGenIds)];
  
  // Get already covered
  const { data: existing } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const coveredSet = new Set(existing?.map(e => e.generation_id));
  const missing = allGenIds.filter(id => !coveredSet.has(id));
  
  console.log(`Total generations: ${allGenIds.length}`);
  console.log(`Already covered: ${coveredSet.size}`);
  console.log(`Missing: ${missing.length}`);
  
  if (missing.length === 0) {
    console.log('Nothing to do!');
    return;
  }
  
  // Process in chunks of 10 generations at a time
  const chunkSize = 10;
  let totalInserted = 0;
  
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    
    // Build specs for this chunk
    const specs: any[] = [];
    for (const genId of chunk) {
      specs.push(
        { generation_id: genId, source: 'Generated', spec_type: 'a1', spec_value: 0, raw_data: {} },
        { generation_id: genId, source: 'Generated', spec_type: 'a2', spec_value: 0, raw_data: {} },
        { generation_id: genId, source: 'Generated', spec_type: 'a3', spec_value: 0, raw_data: {} },
      );
    }
    
    // Insert with retry
    let retries = 3;
    while (retries > 0) {
      const { data, error } = await supabase.from('third_party_specs').insert(specs).select('id');
      
      if (data && data.length === specs.length) {
        totalInserted += data.length;
        break;
      } else {
        retries--;
        if (retries > 0) {
          console.log(`\nRetrying chunk ${i}... (got ${data?.length || 0}/${specs.length})`);
          await sleep(2000);
        }
      }
    }
    
    process.stdout.write(`\r${Math.min(i + chunkSize, missing.length)}/${missing.length} | inserted: ${totalInserted}`);
    
    // Delay between chunks
    await sleep(500);
  }
  
  // Verify
  const { data: final } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const finalCovered = new Set(final?.map(f => f.generation_id));
  
  console.log(`\n\n✅ Done`);
  console.log(`   Now covered: ${finalCovered.size}/${allGenIds.length}`);
  console.log(`   Inserted this run: ${totalInserted}`);
}

chunkedInsert();
