import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function fixDuplicates() {
  console.log('🔧 FIXING DUPLICATE SLUG CONFLICTS\n');
  
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Mercedes-Benz').single();
  const { data: mercedesModel } = await supabase.from('models').select('id').eq('name', 'Mercedes').eq('brand_id', brand!.id).single();
  
  const { data: orphans } = await supabase.from('generations').select('id, name, slug').eq('model_id', mercedesModel!.id);
  
  console.log(`Orphans remaining: ${orphans?.length}\n`);
  
  for (const orphan of orphans || []) {
    console.log(`\n${orphan.name} (slug: ${orphan.slug}):`);
    
    // Check specs count
    const { count: specCount } = await supabase
      .from('vehicle_specifications')
      .select('*', { count: 'exact', head: true })
      .eq('generation_id', orphan.id);
    
    console.log(`  Specs: ${specCount}`);
    
    if (specCount === 0) {
      // Safe to delete - no data loss
      await supabase.from('generations').delete().eq('id', orphan.id);
      console.log(`  🗑️ Deleted (no specs)`);
    } else {
      // Rename slug to avoid conflict
      const newSlug = `${orphan.slug}-duplicate`;
      const { error } = await supabase
        .from('generations')
        .update({ slug: newSlug })
        .eq('id', orphan.id);
      
      if (error) {
        console.log(`  ❌ Failed to rename: ${error.message}`);
      } else {
        console.log(`  📝 Renamed slug to: ${newSlug}`);
      }
    }
  }
  
  // Final check
  const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('model_id', mercedesModel!.id);
  console.log(`\n📊 Remaining orphans: ${count}`);
}

fixDuplicates();
