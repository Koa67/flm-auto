import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function audit() {
  // Total counts
  const { count: totalBrands } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: totalModels } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: totalGenerations } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: totalSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('═'.repeat(60));
  console.log('📊 DATABASE AUDIT');
  console.log('═'.repeat(60));
  console.log(`Total brands: ${totalBrands}`);
  console.log(`Total models: ${totalModels}`);
  console.log(`Total generations: ${totalGenerations}`);
  console.log(`Total third_party_specs: ${totalSpecs}`);
  
  // Get all specs for analysis
  const { data: rawSpecs } = await supabase.from('third_party_specs').select('spec_type, generation_id, source');
  
  const specTypeCounts: Record<string, number> = {};
  const specsPerGen: Record<string, Set<string>> = {};
  const sourceCounts: Record<string, number> = {};
  const genWithPhotos = new Set<string>();
  
  rawSpecs?.forEach(s => {
    specTypeCounts[s.spec_type] = (specTypeCounts[s.spec_type] || 0) + 1;
    
    if (!specsPerGen[s.generation_id]) specsPerGen[s.generation_id] = new Set();
    specsPerGen[s.generation_id].add(s.spec_type);
    
    if (s.source !== 'Generated') {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
    }
    
    if (s.spec_type === 'photos') {
      genWithPhotos.add(s.generation_id);
    }
  });
  
  const uniqueGenWithSpecs = Object.keys(specsPerGen).length;
  
  console.log(`\n📷 PHOTOS:`);
  console.log(`Generations with photos: ${genWithPhotos.size} / ${totalGenerations}`);
  console.log(`Coverage: ${((genWithPhotos.size / (totalGenerations || 1)) * 100).toFixed(1)}%`);
  
  console.log(`\n📋 SPECS COVERAGE:`);
  console.log(`Generations with ANY specs: ${uniqueGenWithSpecs} / ${totalGenerations}`);
  console.log(`Coverage: ${((uniqueGenWithSpecs / (totalGenerations || 1)) * 100).toFixed(1)}%`);
  
  // Count specs per generation
  const specCountsArr = Object.values(specsPerGen).map(set => set.size);
  const avgSpecs = specCountsArr.reduce((a, b) => a + b, 0) / specCountsArr.length;
  const minSpecs = Math.min(...specCountsArr);
  const maxSpecs = Math.max(...specCountsArr);
  
  console.log(`\nSpec TYPES per generation:`);
  console.log(`  Min: ${minSpecs}`);
  console.log(`  Max: ${maxSpecs}`);
  console.log(`  Avg: ${avgSpecs.toFixed(1)}`);
  
  // Generations with complete data (let's say 80+ spec types)
  const completeGens = specCountsArr.filter(c => c >= 80).length;
  const goodGens = specCountsArr.filter(c => c >= 50 && c < 80).length;
  const partialGens = specCountsArr.filter(c => c >= 20 && c < 50).length;
  const poorGens = specCountsArr.filter(c => c < 20).length;
  
  console.log(`\n🎯 DATA COMPLETENESS:`);
  console.log(`  Complete (80+ types): ${completeGens} (${((completeGens/uniqueGenWithSpecs)*100).toFixed(1)}%)`);
  console.log(`  Good (50-79 types): ${goodGens} (${((goodGens/uniqueGenWithSpecs)*100).toFixed(1)}%)`);
  console.log(`  Partial (20-49 types): ${partialGens} (${((partialGens/uniqueGenWithSpecs)*100).toFixed(1)}%)`);
  console.log(`  Poor (<20 types): ${poorGens} (${((poorGens/uniqueGenWithSpecs)*100).toFixed(1)}%)`);
  
  // List all spec types with counts
  console.log(`\n📑 SPEC TYPES (${Object.keys(specTypeCounts).length} unique types):`);
  const sortedTypes = Object.entries(specTypeCounts).sort((a, b) => b[1] - a[1]);
  sortedTypes.forEach(([type, count]) => {
    const coverage = ((count / (totalGenerations || 1)) * 100).toFixed(0);
    console.log(`  ${type}: ${count} (${coverage}%)`);
  });
  
  // Real data sources
  console.log(`\n🔍 REAL DATA SOURCES (non-generated):`);
  const totalReal = Object.values(sourceCounts).reduce((a, b) => a + b, 0);
  console.log(`  Total real data: ${totalReal}`);
  Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });
  
  // Missing generations (no specs at all)
  const { data: allGens } = await supabase.from('generations').select('id, name, model:models(name, brand:brands(name))');
  const gensWithNoSpecs = allGens?.filter(g => !specsPerGen[g.id]) || [];
  
  console.log(`\n❌ GENERATIONS WITH NO SPECS: ${gensWithNoSpecs.length}`);
  if (gensWithNoSpecs.length > 0 && gensWithNoSpecs.length <= 20) {
    gensWithNoSpecs.forEach(g => {
      const model = g.model as any;
      console.log(`  - ${model?.brand?.name} ${model?.name} ${g.name}`);
    });
  }
}

audit().catch(console.error);
