import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function snapshot() {
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  // Paginate to get all
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('third_party_specs').select('generation_id, source').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  const bySource: Record<string, number> = {};
  all.forEach(s => { bySource[s.source] = (bySource[s.source] || 0) + 1; });
  
  const uniqueGens = new Set(all.map(s => s.generation_id));
  
  console.log(`📊 SNAPSHOT`);
  console.log(`   Total specs: ${count}`);
  console.log(`   Generations covered: ${uniqueGens.size}/1078`);
  console.log(`\n   By source:`);
  Object.entries(bySource).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => console.log(`      ${s}: ${c}`));
}

snapshot();
