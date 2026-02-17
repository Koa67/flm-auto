import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function findOrphans() {
  // Get ALL generation IDs
  let allGenIds: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    allGenIds.push(...data.map(d => d.id));
    if (data.length < 500) break;
    page++;
  }
  
  console.log(`Total generations: ${allGenIds.length}`);
  
  // Get generation IDs that HAVE Generated specs
  const { data: withSpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const withSpecsSet = new Set(withSpecs?.map(w => w.generation_id));
  console.log(`Generations WITH Generated specs: ${withSpecsSet.size}`);
  
  // Find orphans
  const orphans = allGenIds.filter(id => !withSpecsSet.has(id));
  console.log(`Generations WITHOUT Generated specs: ${orphans.length}`);
  
  // Try inserting for ONE orphan
  if (orphans.length > 0) {
    const testOrphan = orphans[0];
    console.log(`\nTesting insert for orphan: ${testOrphan}`);
    
    // Get model info
    const { data: gen } = await supabase
      .from('generations')
      .select('id, name, model_id')
      .eq('id', testOrphan)
      .single();
    
    const { data: model } = await supabase
      .from('models')
      .select('name, brand:brands(name)')
      .eq('id', gen?.model_id)
      .single();
    
    console.log(`Generation: ${gen?.name}`);
    console.log(`Model: ${(model as any)?.name} - ${(model as any)?.brand?.name}`);
    
    // Insert test spec
    const { error, status } = await supabase
      .from('third_party_specs')
      .insert([{
        generation_id: testOrphan,
        source: 'Generated',
        spec_type: 'orphan_test',
        spec_value: 0,
        raw_data: {}
      }]);
    
    console.log(`Insert: ${status} - ${error?.message || 'OK'}`);
    
    // Verify
    const { count } = await supabase
      .from('third_party_specs')
      .select('*', { count: 'exact', head: true })
      .eq('generation_id', testOrphan)
      .eq('source', 'Generated');
    
    console.log(`Specs for this orphan after insert: ${count}`);
    
    // Sample 10 orphan IDs
    console.log(`\nSample orphan generation IDs:`);
    orphans.slice(0, 10).forEach(id => console.log(`  ${id}`));
  }
}

findOrphans();
