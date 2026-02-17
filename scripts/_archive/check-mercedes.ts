import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function checkMercedes() {
  console.log('📊 MERCEDES-BENZ STATUS\n');
  
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();
  
  // Get all Mercedes models
  const { data: models } = await supabase
    .from('models')
    .select('id, name')
    .eq('brand_id', brand!.id)
    .order('name');
  
  console.log(`Models: ${models?.length}\n`);
  
  for (const model of models || []) {
    const { count } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', model.id);
    
    console.log(`  ${model.name}: ${count} generations`);
  }
  
  // Check if "Mercedes" generic model still exists
  const genericExists = models?.find(m => m.name === 'Mercedes');
  console.log(`\n${genericExists ? '⚠️ Generic "Mercedes" still exists' : '✅ No generic "Mercedes" model'}`);
}

checkMercedes();
