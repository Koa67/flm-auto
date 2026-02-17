/**
 * QUALITY AUDIT - Trouver les anomalies
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function audit() {
  console.log('🔍 QUALITY AUDIT\n');
  console.log('═'.repeat(60));
  
  // 1. Total counts
  const { count: totalSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  const { count: totalGens } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: totalModels } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: totalBrands } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 TOTALS:`);
  console.log(`   Brands: ${totalBrands}`);
  console.log(`   Models: ${totalModels}`);
  console.log(`   Generations: ${totalGens}`);
  console.log(`   Specs: ${totalSpecs}`);
  console.log(`   Avg specs/gen: ${(totalSpecs! / totalGens!).toFixed(1)}`);
  
  // 2. Specs by source
  const { data: allSpecs } = await supabase.from('third_party_specs').select('source, spec_type, generation_id');
  
  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const specsByGen: Record<string, Set<string>> = {};
  
  for (const s of allSpecs || []) {
    bySource[s.source] = (bySource[s.source] || 0) + 1;
    byType[s.spec_type] = (byType[s.spec_type] || 0) + 1;
    
    if (!specsByGen[s.generation_id]) specsByGen[s.generation_id] = new Set();
    specsByGen[s.generation_id].add(s.spec_type);
  }
  
  console.log(`\n📦 BY SOURCE:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([src, cnt]) => {
    console.log(`   ${src}: ${cnt}`);
  });
  
  console.log(`\n📋 TOP SPEC TYPES (${Object.keys(byType).length} unique):`);
  Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([type, cnt]) => {
    const coverage = ((cnt / totalGens!) * 100).toFixed(0);
    console.log(`   ${type}: ${cnt} (${coverage}%)`);
  });
  
  // 3. Coverage analysis
  const specCounts = Object.values(specsByGen).map(s => s.size);
  const min = Math.min(...specCounts);
  const max = Math.max(...specCounts);
  const avg = specCounts.reduce((a, b) => a + b, 0) / specCounts.length;
  
  console.log(`\n🎯 COVERAGE ANALYSIS:`);
  console.log(`   Generations with specs: ${Object.keys(specsByGen).length}/${totalGens}`);
  console.log(`   Spec types per gen: min=${min}, max=${max}, avg=${avg.toFixed(1)}`);
  
  // 4. Find generations with LOW specs
  const lowSpecGens: string[] = [];
  for (const [genId, types] of Object.entries(specsByGen)) {
    if (types.size < 50) lowSpecGens.push(genId);
  }
  
  if (lowSpecGens.length > 0) {
    console.log(`\n⚠️  GENERATIONS WITH <50 SPEC TYPES: ${lowSpecGens.length}`);
    
    // Get details
    const { data: lowGens } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .in('id', lowSpecGens.slice(0, 10));
    
    lowGens?.forEach(g => {
      const m = g.model as any;
      const count = specsByGen[g.id]?.size || 0;
      console.log(`   - ${m?.brand?.name} ${m?.name} ${g.name}: ${count} types`);
    });
  }
  
  // 5. Find generations with NO specs
  const { data: allGensData } = await supabase.from('generations').select('id');
  const allGenIds = new Set(allGensData?.map(g => g.id) || []);
  const gensWithSpecs = new Set(Object.keys(specsByGen));
  const gensWithoutSpecs = [...allGenIds].filter(id => !gensWithSpecs.has(id));
  
  console.log(`\n❌ GENERATIONS WITH NO SPECS: ${gensWithoutSpecs.length}`);
  
  if (gensWithoutSpecs.length > 0 && gensWithoutSpecs.length <= 20) {
    const { data: noSpecGens } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .in('id', gensWithoutSpecs);
    
    noSpecGens?.forEach(g => {
      const m = g.model as any;
      console.log(`   - ${m?.brand?.name} ${m?.name} ${g.name}`);
    });
  }
  
  // 6. Check for potential duplicates (same gen, same type, different source)
  const typesByGen: Record<string, string[]> = {};
  for (const s of allSpecs || []) {
    const key = `${s.generation_id}|${s.spec_type}`;
    if (!typesByGen[key]) typesByGen[key] = [];
    typesByGen[key].push(s.source);
  }
  
  const multiSource = Object.entries(typesByGen).filter(([_, sources]) => sources.length > 1);
  console.log(`\n🔄 MULTI-SOURCE SPECS (same gen+type, different sources): ${multiSource.length}`);
  
  // 7. Photos audit
  const { data: photoSpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id, spec_value, source')
    .eq('spec_type', 'photos');
  
  const gensWithPhotos = new Set(photoSpecs?.map(p => p.generation_id) || []);
  const totalPhotos = photoSpecs?.reduce((sum, p) => sum + (p.spec_value || 0), 0) || 0;
  
  console.log(`\n📷 PHOTOS AUDIT:`);
  console.log(`   Generations with photos: ${gensWithPhotos.size}/${totalGens} (${((gensWithPhotos.size / totalGens!) * 100).toFixed(1)}%)`);
  console.log(`   Total photos: ${totalPhotos}`);
  console.log(`   Avg photos/gen: ${(totalPhotos / gensWithPhotos.size).toFixed(1)}`);
  
  // Photo sources
  const photoSources: Record<string, number> = {};
  photoSpecs?.forEach(p => {
    photoSources[p.source] = (photoSources[p.source] || 0) + 1;
  });
  console.log(`   By source:`);
  Object.entries(photoSources).forEach(([src, cnt]) => {
    console.log(`      ${src}: ${cnt} gens`);
  });
  
  // 8. B) Orphelins photos - LIST THEM
  const gensWithoutPhotos = [...allGenIds].filter(id => !gensWithPhotos.has(id));
  
  console.log(`\n` + '═'.repeat(60));
  console.log(`📷 ORPHELINS PHOTOS: ${gensWithoutPhotos.length} générations sans photos`);
  console.log('═'.repeat(60));
  
  if (gensWithoutPhotos.length > 0) {
    const { data: orphans } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .in('id', gensWithoutPhotos);
    
    // Group by brand
    const byBrand: Record<string, string[]> = {};
    orphans?.forEach(g => {
      const m = g.model as any;
      const brand = m?.brand?.name || 'Unknown';
      if (!byBrand[brand]) byBrand[brand] = [];
      byBrand[brand].push(`${m?.name} ${g.name}`);
    });
    
    Object.entries(byBrand).sort((a, b) => b[1].length - a[1].length).forEach(([brand, models]) => {
      console.log(`\n   ${brand} (${models.length}):`);
      models.slice(0, 10).forEach(m => console.log(`      - ${m}`));
      if (models.length > 10) console.log(`      ... +${models.length - 10} more`);
    });
  }
  
  console.log(`\n` + '═'.repeat(60));
  console.log('🔍 AUDIT COMPLETE');
  console.log('═'.repeat(60));
}

audit().catch(console.error);
