import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function auditModels() {
  console.log('🔍 MODEL NAMES AUDIT\n');
  
  const { data: models } = await supabase
    .from('models')
    .select('id, name, brand:brands(name)')
    .order('name');
  
  // Group by brand
  const byBrand: Record<string, string[]> = {};
  models?.forEach(m => {
    const brand = (m.brand as any)?.name || 'Unknown';
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(m.name);
  });
  
  // Show problematic ones
  console.log('═'.repeat(60));
  console.log('MODELS BY BRAND (checking for generic names)\n');
  
  const problematic: string[] = [];
  
  Object.entries(byBrand).sort().forEach(([brand, modelNames]) => {
    const unique = [...new Set(modelNames)];
    console.log(`\n${brand} (${unique.length} models):`);
    unique.slice(0, 10).forEach(name => {
      const isGeneric = name.toLowerCase() === brand.toLowerCase().split('-')[0] ||
                        name.toLowerCase() === brand.toLowerCase().replace('-', ' ').split(' ')[0] ||
                        name === 'Default' ||
                        name.length <= 3;
      const flag = isGeneric ? ' ⚠️ GENERIC' : '';
      console.log(`   ${name}${flag}`);
      if (isGeneric) problematic.push(`${brand}|${name}`);
    });
    if (unique.length > 10) console.log(`   ... +${unique.length - 10} more`);
  });
  
  console.log('\n' + '═'.repeat(60));
  console.log(`\n⚠️ PROBLEMATIC MODELS: ${problematic.length}`);
  problematic.forEach(p => console.log(`   ${p}`));
  
  // Get generations for Mercedes to understand the pattern
  console.log('\n\n📋 MERCEDES GENERATIONS SAMPLE:');
  const { data: mercedesGens } = await supabase
    .from('generations')
    .select('id, name, model:models!inner(name, brand:brands!inner(name))')
    .eq('models.brands.name', 'Mercedes-Benz')
    .limit(30);
  
  mercedesGens?.forEach(g => {
    console.log(`   ${g.name}`);
  });
}

auditModels();
