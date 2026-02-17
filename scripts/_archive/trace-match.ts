import { createClient } from '@supabase/supabase-js';
import { normalizeModelName } from './model-aliases';
const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);
(async () => {
  const { data: specs } = await supabase
    .from('third_party_specs')
    .select('generation_id, source, spec_type')
    .limit(5);
  console.log('Sample specs in DB:', JSON.stringify(specs, null, 2));
  
  // Check: how many rows per generation_id
  const { data } = await supabase.from('third_party_specs').select('generation_id').limit(100000);
  const counts: Record<string, number> = {};
  for (const r of data || []) {
    counts[r.generation_id] = (counts[r.generation_id] || 0) + 1;
  }
  console.log('\nRows per generation_id:');
  for (const [id, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    // Get gen name
    const { data: gen } = await supabase.from('generations').select('name, model:models(name, brand:brands(name))').eq('id', id).single();
    const brand = (gen?.model as any)?.brand?.name || '?';
    const model = (gen?.model as any)?.name || '?';
    console.log('  ' + count + ' rows → ' + brand + ' ' + model + ' | ' + gen?.name);
  }
})();
