import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function listOrphans() {
  const { data: model } = await supabase
    .from('models')
    .select('id')
    .eq('name', 'Mercedes')
    .single();
  
  const { data: gens } = await supabase
    .from('generations')
    .select('id, name, year_start, year_end')
    .eq('model_id', model!.id)
    .order('name');
  
  console.log('109 ORPHAN GENERATIONS:\n');
  
  // Group by name
  const byName: Record<string, number> = {};
  for (const g of gens || []) {
    byName[g.name] = (byName[g.name] || 0) + 1;
  }
  
  console.log('By name:');
  for (const [name, count] of Object.entries(byName).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  
  console.log('\nFirst 20:');
  for (const g of (gens || []).slice(0, 20)) {
    console.log(`  ${g.name} (${g.year_start || '?'}-${g.year_end || '?'}) [${g.id.slice(0,8)}]`);
  }
}

listOrphans();
