/**
 * FLM AUTO — Check & Fix 0% Coverage Brands
 * 
 * Diagnoses why certain brands show 0% real specs,
 * then attempts to scrape them via Auto-Data & UltimateSpecs.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const ZERO_BRANDS = [
  'Lamborghini', 'Ferrari', 'Land Rover', 'Opel', 'Seat', 'Citroen',
  'Alfa Romeo', 'Maserati', 'Aston Martin', 'Bentley', 'Rolls-Royce'
];

async function main() {
  console.log('🔍 FLM AUTO — 0% Coverage Brand Audit\n');

  const { data: brands } = await supabase.from('brands').select('id, name').in('name', ZERO_BRANDS);
  if (!brands) { console.log('❌ Failed to load brands'); return; }

  for (const b of brands.sort((a, b) => a.name.localeCompare(b.name))) {
    const { data: models } = await supabase.from('models').select('id, name').eq('brand_id', b.id);
    if (!models || models.length === 0) { console.log(`  ${b.name}: 0 models — EMPTY`); continue; }

    const modelIds = models.map(m => m.id);
    const { data: gens } = await supabase.from('generations').select('id, name, model_id').in('model_id', modelIds);
    if (!gens || gens.length === 0) { console.log(`  ${b.name}: ${models.length} models, 0 gens`); continue; }

    // Batch-query specs
    const genIds = gens.map(g => g.id);
    let allSpecs: any[] = [];
    for (let i = 0; i < genIds.length; i += 200) {
      const batch = genIds.slice(i, i + 200);
      const { data: specs } = await supabase
        .from('third_party_specs')
        .select('source, spec_type, generation_id')
        .in('generation_id', batch)
        .limit(5000);
      if (specs) allSpecs.push(...specs);
    }

    // Categorize sources
    const sources: Record<string, number> = {};
    const gensWithReal = new Set<string>();
    const gensWithGenerated = new Set<string>();
    for (const s of allSpecs) {
      sources[s.source] = (sources[s.source] || 0) + 1;
      if (['generated', 'ai_enrichment'].includes(s.source)) {
        gensWithGenerated.add(s.generation_id);
      } else {
        gensWithReal.add(s.generation_id);
      }
    }

    const realPct = Math.round(gensWithReal.size / gens.length * 100);
    const genPct = Math.round(gensWithGenerated.size / gens.length * 100);
    const bar = (pct: number) => '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

    console.log(`  ${b.name.padEnd(16)} ${String(models.length).padStart(3)} models  ${String(gens.length).padStart(4)} gens  ${bar(realPct)} ${realPct}% real  ${genPct}% gen'd`);
    console.log(`    Sources: ${Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ') || 'NONE'}`);
    
    // Show which models have specs
    const modelGenMap = new Map<string, string>();
    for (const m of models) modelGenMap.set(m.id, m.name);
    
    const modelsWithSpecs = new Set<string>();
    const modelsWithoutSpecs = new Set<string>();
    for (const g of gens) {
      const modelName = modelGenMap.get(g.model_id) || '?';
      if (gensWithReal.has(g.id)) modelsWithSpecs.add(modelName);
      else modelsWithoutSpecs.add(modelName);
    }
    
    if (modelsWithoutSpecs.size > 0 && modelsWithoutSpecs.size <= 20) {
      const missing = [...modelsWithoutSpecs].filter(m => !modelsWithSpecs.has(m));
      if (missing.length > 0) {
        console.log(`    Missing real specs: ${missing.join(', ')}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
