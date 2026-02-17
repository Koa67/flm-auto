import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function testInsert() {
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();
  
  console.log('Brand ID:', brand?.id);
  
  // Check if Classe G exists
  const { data: existing } = await supabase
    .from('models')
    .select('*')
    .eq('brand_id', brand!.id)
    .ilike('name', '%classe g%');
  
  console.log('Existing "Classe G" matches:', existing);
  
  // Try insert with full error
  const { data: inserted, error } = await supabase
    .from('models')
    .insert({ 
      brand_id: brand!.id, 
      name: 'Classe G',
      slug: 'classe-g'
    })
    .select();
  
  console.log('\nInsert result:', inserted);
  console.log('Error:', JSON.stringify(error, null, 2));
}

testInsert();
