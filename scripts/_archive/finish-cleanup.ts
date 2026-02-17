import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function finishCleanup() {
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Mercedes-Benz').single();
  const { data: mercedesModel } = await supabase.from('models').select('id').eq('name', 'Mercedes').eq('brand_id', brand!.id).single();
  
  // Find AMG ONE model (different spelling)
  const { data: amgModels } = await supabase.from('models').select('id, name').eq('brand_id', brand!.id).ilike('name', '%amg%');
  console.log('AMG models:', amgModels?.map(m => m.name));
  
  // Get remaining orphans
  const { data: orphans } = await supabase.from('generations').select('id, name').eq('model_id', mercedesModel!.id);
  console.log('\nOrphans:', orphans?.map(o => o.name));
  
  for (const orphan of orphans || []) {
    if (orphan.name === 'Default') {
      await supabase.from('generations').delete().eq('id', orphan.id);
      console.log('🗑️ Deleted Default');
    } else if (orphan.name === 'E63') {
      // E63 is AMG E63, not AMG One. Let's check what AMG ONE's id is
      const amgOne = amgModels?.find(m => m.name.includes('ONE'));
      if (amgOne) {
        await supabase.from('generations').update({ model_id: amgOne.id }).eq('id', orphan.id);
        console.log(`✅ E63 → ${amgOne.name}`);
      } else {
        // Just delete it - E63 is likely a mistake
        await supabase.from('generations').delete().eq('id', orphan.id);
        console.log('🗑️ Deleted E63 (orphan)');
      }
    }
  }
  
  // Final check & cleanup
  const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('model_id', mercedesModel!.id);
  console.log(`\nRemaining: ${count}`);
  
  if (count === 0) {
    await supabase.from('models').delete().eq('id', mercedesModel!.id);
    console.log('🗑️ Deleted "Mercedes" model');
  }
}

finishCleanup();
