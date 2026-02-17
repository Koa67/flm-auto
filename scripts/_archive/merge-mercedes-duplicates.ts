import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

// Merge duplicates: source → target (keep target, delete source)
const MERCEDES_MERGES = [
  ['A-Class', 'Classe A'],
  ['B-Class', 'Classe B'],
  ['C-Class', 'Classe C'],
  ['E-Class', 'Classe E'],
  ['G-Class', 'Classe G'],
  ['S-Class', 'Classe S'],
];

async function mergeDuplicates() {
  console.log('🔀 MERGING MERCEDES DUPLICATES\n');
  
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Mercedes-Benz').single();
  
  for (const [source, target] of MERCEDES_MERGES) {
    const { data: sourceModel } = await supabase.from('models').select('id').eq('brand_id', brand!.id).eq('name', source).single();
    const { data: targetModel } = await supabase.from('models').select('id').eq('brand_id', brand!.id).eq('name', target).single();
    
    if (!sourceModel) {
      console.log(`⏭️ ${source}: not found (already merged?)`);
      continue;
    }
    
    if (!targetModel) {
      // Just rename source to target
      await supabase.from('models').update({ name: target }).eq('id', sourceModel.id);
      console.log(`📝 ${source} → ${target} (renamed)`);
      continue;
    }
    
    // Move generations from source to target
    const { data: gens } = await supabase.from('generations').select('id, slug').eq('model_id', sourceModel.id);
    
    let moved = 0;
    for (const gen of gens || []) {
      // Check for slug conflict
      const { data: existing } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', targetModel.id)
        .eq('slug', gen.slug)
        .single();
      
      if (existing) {
        // Rename slug
        await supabase.from('generations').update({ slug: `${gen.slug}-merged` }).eq('id', gen.id);
      }
      
      await supabase.from('generations').update({ model_id: targetModel.id }).eq('id', gen.id);
      moved++;
    }
    
    // Delete empty source model
    await supabase.from('models').delete().eq('id', sourceModel.id);
    console.log(`✅ ${source} → ${target}: ${moved} generations moved, model deleted`);
  }
  
  console.log('\n✅ Merge complete');
}

mergeDuplicates();
