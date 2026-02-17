import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function analyzeOrphans() {
  console.log('🔍 ANALYZING ORPHANED MERCEDES GENERATIONS\n');
  
  // Get the "Mercedes" model
  const { data: mercedesModel } = await supabase
    .from('models')
    .select('id')
    .eq('name', 'Mercedes')
    .single();
  
  if (!mercedesModel) {
    console.log('No "Mercedes" model found');
    return;
  }
  
  // Get orphan generations
  const { data: orphans } = await supabase
    .from('generations')
    .select('id, name, year_start, year_end')
    .eq('model_id', mercedesModel.id);
  
  console.log(`Found ${orphans?.length} orphan generations\n`);
  
  // Group by name
  const byName: Record<string, any[]> = {};
  for (const o of orphans || []) {
    if (!byName[o.name]) byName[o.name] = [];
    byName[o.name].push(o);
  }
  
  console.log('Grouped by name:');
  for (const [name, gens] of Object.entries(byName)) {
    console.log(`  ${name}: ${gens.length} generations`);
    // Show year range
    const years = gens.map(g => g.year_start).filter(Boolean).sort();
    if (years.length) {
      console.log(`    Years: ${years[0]} - ${years[years.length - 1]}`);
    }
  }
  
  // Sample specs to understand what models these are
  console.log('\n📋 SAMPLING SPECS FROM ORPHANS:\n');
  
  for (const orphan of (orphans || []).slice(0, 5)) {
    const { data: specs } = await supabase
      .from('vehicle_specifications')
      .select('spec_key, spec_value')
      .eq('generation_id', orphan.id)
      .limit(10);
    
    console.log(`Generation: ${orphan.name} (${orphan.year_start || '?'}-${orphan.year_end || '?'})`);
    console.log(`  ID: ${orphan.id}`);
    if (specs?.length) {
      for (const s of specs) {
        console.log(`    ${s.spec_key}: ${s.spec_value}`);
      }
    } else {
      console.log('  No specs found');
    }
    console.log('');
  }
}

analyzeOrphans();
