import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function debug() {
  // 1. Find Mercedes model
  const { data: model, error: e1 } = await supabase
    .from('models')
    .select('*')
    .eq('name', 'Mercedes')
    .single();
  
  console.log('Model:', model);
  console.log('Error:', e1);
  
  if (!model) return;
  
  // 2. Count generations
  const { count, error: e2 } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('model_id', model.id);
  
  console.log('\nGenerations count:', count);
  console.log('Error:', e2);
  
  // 3. Get first 5
  const { data: gens, error: e3 } = await supabase
    .from('generations')
    .select('*')
    .eq('model_id', model.id)
    .limit(5);
  
  console.log('\nFirst 5 generations:', JSON.stringify(gens, null, 2));
  console.log('Error:', e3);
}

debug();
