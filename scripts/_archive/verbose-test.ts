import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function verboseTest() {
  // Get 5 random generations
  const { data: gens } = await supabase
    .from('generations')
    .select('id, model_id')
    .range(500, 504);  // middle of the list
  
  console.log('Testing 5 generations from middle of list:\n');
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(brands?.map(b => [b.id, b.name]));
  const modelMap = new Map(models?.map(m => [m.id, { name: m.name, brand: brandMap.get(m.brand_id) }]));
  
  for (const gen of gens || []) {
    const model = modelMap.get(gen.model_id);
    console.log(`\nGen: ${gen.id}`);
    console.log(`Model: ${model?.name} (${model?.brand})`);
    
    // Check if this gen already has Generated specs
    const { data: existing, count } = await supabase
      .from('third_party_specs')
      .select('spec_type', { count: 'exact' })
      .eq('generation_id', gen.id)
      .eq('source', 'Generated');
    
    console.log(`Existing Generated specs: ${count}`);
    if (existing?.length) {
      console.log(`Types: ${existing.map(e => e.spec_type).join(', ')}`);
    }
    
    // Try to insert ONE spec
    const testSpec = {
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'test_verbose',
      spec_value: 999,
      raw_data: { test: true }
    };
    
    const { data: insertResult, error, status, statusText } = await supabase
      .from('third_party_specs')
      .insert([testSpec])
      .select();
    
    console.log(`Insert status: ${status} ${statusText}`);
    console.log(`Insert error: ${error ? error.message : 'none'}`);
    console.log(`Insert result: ${insertResult?.length || 0} rows`);
    
    // Clean up
    await supabase.from('third_party_specs').delete().eq('spec_type', 'test_verbose');
  }
}

verboseTest();
