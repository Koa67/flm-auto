import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function findMissing() {
  console.log('🔍 FINDING MISSING GENERATION\n');
  
  // Get all generation IDs
  const { data: gens, count } = await supabase
    .from('generations')
    .select('id, name, model:models(name, brand:brands(name))', { count: 'exact' });
  
  console.log(`Total generations: ${count}`);
  
  // Get all generation IDs that have specs
  const { data: specGens } = await supabase
    .from('vehicle_specifications')
    .select('generation_id')
    .limit(100000);
  
  const coveredIds = new Set(specGens?.map(s => s.generation_id));
  console.log(`Covered by specs: ${coveredIds.size}`);
  
  // Find uncovered
  const uncovered = gens?.filter(g => !coveredIds.has(g.id)) || [];
  
  console.log(`\n⚠️ UNCOVERED GENERATIONS: ${uncovered.length}`);
  for (const g of uncovered) {
    const m = g.model as any;
    console.log(`  ${m?.brand?.name || '?'} | ${m?.name || '?'} | ${g.name}`);
  }
  
  // Also check for orphan specs (pointing to non-existent generations)
  const genIds = new Set(gens?.map(g => g.id));
  const orphanSpecs = specGens?.filter(s => !genIds.has(s.generation_id));
  
  if (orphanSpecs?.length) {
    console.log(`\n🗑️ ORPHAN SPECS (bad generation_id): ${orphanSpecs.length}`);
    const orphanIds = [...new Set(orphanSpecs.map(s => s.generation_id))];
    console.log(`  IDs: ${orphanIds.slice(0, 5).join(', ')}...`);
  }
}

findMissing();
