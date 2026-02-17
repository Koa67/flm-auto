import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function realCount() {
  console.log('📊 REAL COUNT WITH PAGINATION\n');
  
  // Count Generated with pagination
  let allGenerated: string[] = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('generation_id')
      .eq('source', 'Generated')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (!data || data.length === 0) break;
    allGenerated.push(...data.map(d => d.generation_id));
    console.log(`Page ${page + 1}: ${data.length} rows (total: ${allGenerated.length})`);
    if (data.length < 1000) break;
    page++;
  }
  
  const uniqueGens = new Set(allGenerated);
  
  console.log(`\n✅ REAL RESULTS:`);
  console.log(`   Total Generated rows: ${allGenerated.length}`);
  console.log(`   Unique generations with Generated: ${uniqueGens.size}`);
  
  // Compare to total generations
  const { count: totalGens } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  console.log(`   Total generations: ${totalGens}`);
  console.log(`   Coverage: ${((uniqueGens.size / totalGens!) * 100).toFixed(1)}%`);
}

realCount();
