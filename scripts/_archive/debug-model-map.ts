import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function debugModelMap() {
  // Get generations
  const { data: gens } = await supabase.from('generations').select('id, model_id').limit(20);
  
  // Get models
  const { data: models } = await supabase.from('models').select('id, name');
  
  console.log('Models fetched:', models?.length);
  console.log('Sample model IDs:', models?.slice(0, 5).map(m => m.id));
  
  console.log('\nGenerations model_ids:');
  gens?.forEach(g => {
    const model = models?.find(m => m.id === g.model_id);
    console.log(`  ${g.id.substring(0, 8)}... model_id=${g.model_id?.substring(0, 8) || 'NULL'}... match=${model ? model.name : 'NO MATCH'}`);
  });
  
  // Count how many generations have NULL or invalid model_id
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('generations').select('id, model_id').range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    allGens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  
  const modelIdSet = new Set(models?.map(m => m.id));
  
  const nullModelId = allGens.filter(g => !g.model_id).length;
  const invalidModelId = allGens.filter(g => g.model_id && !modelIdSet.has(g.model_id)).length;
  const validModelId = allGens.filter(g => g.model_id && modelIdSet.has(g.model_id)).length;
  
  console.log(`\n📊 Generation model_id status:`);
  console.log(`  NULL model_id: ${nullModelId}`);
  console.log(`  Invalid model_id: ${invalidModelId}`);
  console.log(`  Valid model_id: ${validModelId}`);
  console.log(`  Total: ${allGens.length}`);
}

debugModelMap();
