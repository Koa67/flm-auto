import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function truthAudit() {
  console.log('📊 TRUTH AUDIT - With proper pagination\n');
  console.log('═'.repeat(60));
  
  // 1. Total specs (use count which is accurate)
  const { count: totalSpecs } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal third_party_specs: ${totalSpecs}`);
  
  // 2. Get ALL specs with pagination for analysis
  let allSpecs: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('generation_id, source, spec_type')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allSpecs.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`Fetched for analysis: ${allSpecs.length}`);
  
  // 3. By source
  const bySource: Record<string, number> = {};
  allSpecs.forEach(s => { bySource[s.source] = (bySource[s.source] || 0) + 1; });
  
  console.log(`\n📦 BY SOURCE:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([src, cnt]) => {
    console.log(`   ${src}: ${cnt}`);
  });
  
  // 4. Unique generations with specs
  const gensWithSpecs = new Set(allSpecs.map(s => s.generation_id));
  
  // 5. Total generations
  const { count: totalGens } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎯 COVERAGE:`);
  console.log(`   Generations with specs: ${gensWithSpecs.size}/${totalGens}`);
  console.log(`   Coverage: ${((gensWithSpecs.size / totalGens!) * 100).toFixed(1)}%`);
  
  // 6. Specs per generation
  const specsPerGen: Record<string, number> = {};
  allSpecs.forEach(s => { specsPerGen[s.generation_id] = (specsPerGen[s.generation_id] || 0) + 1; });
  
  const counts = Object.values(specsPerGen);
  console.log(`\n📈 SPECS PER GENERATION:`);
  console.log(`   Min: ${Math.min(...counts)}`);
  console.log(`   Max: ${Math.max(...counts)}`);
  console.log(`   Avg: ${(counts.reduce((a,b) => a+b, 0) / counts.length).toFixed(1)}`);
  
  // 7. Unique spec types
  const specTypes = new Set(allSpecs.map(s => s.spec_type));
  console.log(`\n📋 Unique spec types: ${specTypes.size}`);
  
  // 8. Photos
  const { count: photoCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('spec_type', 'photos');
  
  console.log(`\n📷 Photo specs: ${photoCount}`);
  
  console.log('\n' + '═'.repeat(60));
}

truthAudit();
