import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function checkConstraint() {
  // Get all Generated specs
  const { data, count } = await supabase
    .from('third_party_specs')
    .select('id, generation_id, spec_type', { count: 'exact' })
    .eq('source', 'Generated');
  
  console.log(`Total Generated rows: ${count}`);
  
  // Count by generation_id
  const byGen: Record<string, number> = {};
  data?.forEach(d => {
    byGen[d.generation_id] = (byGen[d.generation_id] || 0) + 1;
  });
  
  console.log(`\nUnique generation_ids: ${Object.keys(byGen).length}`);
  
  // Show distribution
  const counts = Object.values(byGen);
  console.log(`\nSpecs per generation:`);
  console.log(`  Min: ${Math.min(...counts)}`);
  console.log(`  Max: ${Math.max(...counts)}`);
  console.log(`  Avg: ${(counts.reduce((a,b) => a+b, 0) / counts.length).toFixed(1)}`);
  
  // Sample one generation with many specs
  const maxGen = Object.entries(byGen).sort((a, b) => b[1] - a[1])[0];
  console.log(`\nGeneration with most specs: ${maxGen[0]} (${maxGen[1]} specs)`);
  
  const { data: sample } = await supabase
    .from('third_party_specs')
    .select('spec_type')
    .eq('generation_id', maxGen[0])
    .eq('source', 'Generated');
  
  console.log(`Spec types for this gen:`);
  sample?.forEach(s => console.log(`  - ${s.spec_type}`));
  
  // Check if there's duplicates (same gen + same spec_type)
  const seen = new Set<string>();
  let dupes = 0;
  data?.forEach(d => {
    const key = `${d.generation_id}|${d.spec_type}`;
    if (seen.has(key)) dupes++;
    seen.add(key);
  });
  
  console.log(`\nDuplicate (gen_id + spec_type) pairs: ${dupes}`);
}

checkConstraint();
