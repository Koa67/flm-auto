import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function check() {
  const { count: genCount } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: specCount } = await supabase.from('vehicle_specifications').select('*', { count: 'exact', head: true });
  const { count: thirdCount } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log(`Generations: ${genCount}`);
  console.log(`vehicle_specifications: ${specCount}`);
  console.log(`third_party_specs: ${thirdCount}`);
  
  // Covered by third_party_specs
  const { data } = await supabase.from('third_party_specs').select('generation_id');
  const covered = new Set(data?.map(d => d.generation_id));
  console.log(`\nGenerations with specs: ${covered.size}`);
  console.log(`Missing: ${genCount! - covered.size}`);
}
check();
