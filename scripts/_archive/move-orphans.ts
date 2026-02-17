import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const MERCEDES_MAP: Record<string, string> = {
  'C118': 'CLA', 'X247': 'GLB', 'V167': 'GLE', 'V295': 'EQE',
  'W201': '190', 'W198': '300 SL', 'E63': 'AMG One'
};

async function moveOrphans() {
  console.log('🔧 MOVING RENAMED ORPHANS\n');
  
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Mercedes-Benz').single();
  const { data: mercedesModel } = await supabase.from('models').select('id').eq('name', 'Mercedes').eq('brand_id', brand!.id).single();
  
  const { data: orphans } = await supabase.from('generations').select('id, name, slug').eq('model_id', mercedesModel!.id);
  
  let moved = 0;
  
  for (const orphan of orphans || []) {
    const modelName = MERCEDES_MAP[orphan.name];
    
    if (!modelName) {
      console.log(`⏭️ ${orphan.name}: no mapping (Default?)`);
      continue;
    }
    
    // Find target model
    const { data: targetModel } = await supabase
      .from('models')
      .select('id')
      .eq('brand_id', brand!.id)
      .eq('name', modelName)
      .single();
    
    if (!targetModel) {
      console.log(`❌ ${orphan.name}: model "${modelName}" not found`);
      continue;
    }
    
    // Move
    const { error } = await supabase
      .from('generations')
      .update({ model_id: targetModel.id })
      .eq('id', orphan.id);
    
    if (error) {
      console.log(`❌ ${orphan.name}: ${error.message}`);
    } else {
      console.log(`✅ ${orphan.name} → ${modelName}`);
      moved++;
    }
  }
  
  console.log(`\nMoved: ${moved}`);
  
  // Check remaining
  const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('model_id', mercedesModel!.id);
  console.log(`Remaining: ${count}`);
  
  if (count === 1) {
    // Only "Default" left - delete it
    const { data: defaultGen } = await supabase
      .from('generations')
      .select('id, name')
      .eq('model_id', mercedesModel!.id)
      .single();
    
    if (defaultGen?.name === 'Default') {
      await supabase.from('generations').delete().eq('id', defaultGen.id);
      console.log('🗑️ Deleted "Default" generation');
      
      await supabase.from('models').delete().eq('id', mercedesModel!.id);
      console.log('🗑️ Deleted "Mercedes" model');
    }
  }
}

moveOrphans();
