import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function testUpdate() {
  // Get brand
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();
  
  // Get Mercedes generic model
  const { data: mercedesModel } = await supabase
    .from('models')
    .select('id')
    .eq('name', 'Mercedes')
    .single();
  
  // Get one generation (W465 = Classe G)
  const { data: gen } = await supabase
    .from('generations')
    .select('*')
    .eq('model_id', mercedesModel!.id)
    .eq('name', 'W465')
    .single();
  
  console.log('Target generation:', gen?.id, gen?.name);
  
  // Get or create Classe G model
  let { data: classeG } = await supabase
    .from('models')
    .select('id')
    .eq('brand_id', brand!.id)
    .eq('name', 'Classe G')
    .single();
  
  if (!classeG) {
    const { data: newModel } = await supabase
      .from('models')
      .insert({ brand_id: brand!.id, name: 'Classe G' })
      .select('id')
      .single();
    classeG = newModel;
    console.log('Created Classe G:', classeG?.id);
  } else {
    console.log('Classe G exists:', classeG.id);
  }
  
  // Try update with error handling
  const { data: updated, error } = await supabase
    .from('generations')
    .update({ model_id: classeG!.id })
    .eq('id', gen!.id)
    .select();
  
  console.log('\nUpdate result:', updated);
  console.log('Error:', error);
  
  // Verify
  const { data: verify } = await supabase
    .from('generations')
    .select('model_id')
    .eq('id', gen!.id)
    .single();
  
  console.log('\nVerify model_id:', verify?.model_id);
  console.log('Expected:', classeG!.id);
  console.log('Match:', verify?.model_id === classeG!.id);
}

testUpdate();
