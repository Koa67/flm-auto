import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase
    .from('third_party_specs')
    .select('source, spec_type, generation_id')
    .eq('source', 'ADAC');
  
  if (error) { console.error(error); return; }
  
  console.log('ADAC specs in DB:', data.length);
  
  const { data: sample } = await supabase
    .from('third_party_specs')
    .select(`
      spec_value,
      raw_data,
      generations (
        name,
        models (
          name,
          brands (name)
        )
      )
    `)
    .eq('source', 'ADAC')
    .limit(5);
  
  console.log('\nSample entries:');
  sample?.forEach(s => {
    const g = s.generations as any;
    if (!g) return;
    const diff = (s.raw_data as any).volumeManufacturer - Number(s.spec_value);
    console.log(`  ${g.models.brands.name} ${g.models.name}: ADAC=${s.spec_value}L (diff: ${diff}L)`);
  });
}
check();
