/**
 * DEBUG - What the hell happened?
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function debug() {
  console.log('🔬 DEBUG - Checking what actually happened\n');
  
  // 1. Check unique generation_ids in specs
  const { data: specGenIds } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const uniqueGenIds = new Set(specGenIds?.map(s => s.generation_id) || []);
  console.log(`Generated specs exist for: ${uniqueGenIds.size} unique generations`);
  
  // 2. Sample the generation_ids
  const sampleIds = [...uniqueGenIds].slice(0, 10);
  console.log(`\nSample generation IDs with 'Generated' specs:`);
  
  const { data: sampleGens } = await supabase
    .from('generations')
    .select('id, name, model:models(name, brand:brands(name))')
    .in('id', sampleIds);
  
  sampleGens?.forEach(g => {
    const m = g.model as any;
    console.log(`   ${g.id}: ${m?.brand?.name} ${m?.name} ${g.name}`);
  });
  
  // 3. Check if it's the SAME 10 generations from early scripts
  const { data: allSpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id, source, spec_type');
  
  const byGen: Record<string, Record<string, number>> = {};
  for (const s of allSpecs || []) {
    if (!byGen[s.generation_id]) byGen[s.generation_id] = {};
    byGen[s.generation_id][s.source] = (byGen[s.generation_id][s.source] || 0) + 1;
  }
  
  console.log(`\n📊 Generations by source breakdown:`);
  const sourceCounts: Record<string, number> = {};
  for (const [genId, sources] of Object.entries(byGen)) {
    for (const src of Object.keys(sources)) {
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
  }
  
  Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([src, cnt]) => {
    console.log(`   ${src}: ${cnt} generations`);
  });
  
  // 4. Check total count vs what we expect
  const { count: totalSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  const { count: generatedSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true }).eq('source', 'Generated');
  
  console.log(`\n📈 Spec counts:`);
  console.log(`   Total specs: ${totalSpecs}`);
  console.log(`   Generated specs: ${generatedSpecs}`);
  console.log(`   Other specs: ${totalSpecs! - generatedSpecs!}`);
  
  // 5. The REAL problem - let's see which generations have NO Generated specs
  const { data: allGens } = await supabase.from('generations').select('id');
  const allGenIdSet = new Set(allGens?.map(g => g.id) || []);
  
  const gensWithGenerated = new Set(
    (allSpecs || []).filter(s => s.source === 'Generated').map(s => s.generation_id)
  );
  
  const gensWithoutGenerated = [...allGenIdSet].filter(id => !gensWithGenerated.has(id));
  
  console.log(`\n❌ Generations WITHOUT 'Generated' specs: ${gensWithoutGenerated.length}`);
  
  // What specs DO these orphan generations have?
  if (gensWithoutGenerated.length > 0) {
    const orphanSpecs = (allSpecs || []).filter(s => gensWithoutGenerated.includes(s.generation_id));
    const orphanSources: Record<string, number> = {};
    
    for (const s of orphanSpecs) {
      orphanSources[s.source] = (orphanSources[s.source] || 0) + 1;
    }
    
    console.log(`   These generations have specs from:`);
    Object.entries(orphanSources).forEach(([src, cnt]) => {
      console.log(`      ${src}: ${cnt}`);
    });
  }
}

debug().catch(console.error);
