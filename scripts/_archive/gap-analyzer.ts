/**
 * FLM AUTO — Gap Analyzer
 * 
 * Drills into the coverage dashboard gaps:
 * 1. Generations with no production_start (the "Unknown" decade)
 * 2. Generations with zero specs (the "531 holes")
 * 3. Duplicate/suspicious generation names
 * 
 * Read-only — does not modify anything.
 * Usage: npx ts-node gap-analyzer.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function paginate(table: string, select: string, filter?: (q: any) => any): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            FLM AUTO — GAP ANALYZER                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load data
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, name, slug, model_id, production_start, production_end');
  const specs = await paginate('third_party_specs', 'generation_id, source');

  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const modelMap = new Map(models.map((m: any) => [m.id, { name: m.name, brandId: m.brand_id }]));
  const genSpecs = new Set(specs.map((s: any) => s.generation_id));

  // ─────────────────────────────────────────────
  // 1. UNKNOWN DECADE — gens without production_start
  // ─────────────────────────────────────────────
  const unknownDate = gens.filter((g: any) => !g.production_start);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  1. MISSING PRODUCTION DATES: ${unknownDate.length} generations`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Group by brand
  const unknownByBrand: Record<string, { model: string; gen: string; hasSpecs: boolean }[]> = {};
  for (const g of unknownDate) {
    const m = modelMap.get(g.model_id);
    if (!m) continue;
    const brand = brandMap.get(m.brandId) || '???';
    if (!unknownByBrand[brand]) unknownByBrand[brand] = [];
    unknownByBrand[brand].push({ model: m.name, gen: g.name, hasSpecs: genSpecs.has(g.id) });
  }

  const sortedUnknown = Object.entries(unknownByBrand).sort((a, b) => b[1].length - a[1].length);
  for (const [brand, items] of sortedUnknown.slice(0, 15)) {
    const withSpecs = items.filter(i => i.hasSpecs).length;
    console.log(`\n  ${brand} (${items.length} gens, ${withSpecs} with specs)`);
    // Show first 5 examples
    for (const item of items.slice(0, 5)) {
      console.log(`    ${item.hasSpecs ? '✅' : '❌'} ${item.model} → "${item.gen}"`);
    }
    if (items.length > 5) console.log(`    ... +${items.length - 5} more`);
  }

  // ─────────────────────────────────────────────
  // 2. ZERO SPECS — gens with absolutely nothing
  // ─────────────────────────────────────────────
  const zeroSpecs = gens.filter((g: any) => !genSpecs.has(g.id));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  2. ZERO SPECS: ${zeroSpecs.length} generations`);
  console.log('═══════════════════════════════════════════════════════════════');

  const zeroByBrand: Record<string, { model: string; gen: string; year: string }[]> = {};
  for (const g of zeroSpecs) {
    const m = modelMap.get(g.model_id);
    if (!m) continue;
    const brand = brandMap.get(m.brandId) || '???';
    if (!zeroByBrand[brand]) zeroByBrand[brand] = [];
    const year = g.production_start ? String(g.production_start).slice(0, 4) : '?';
    zeroByBrand[brand].push({ model: m.name, gen: g.name, year });
  }

  const sortedZero = Object.entries(zeroByBrand).sort((a, b) => b[1].length - a[1].length);
  for (const [brand, items] of sortedZero) {
    console.log(`\n  ${brand} (${items.length} empty gens)`);
    for (const item of items.slice(0, 5)) {
      console.log(`    ❌ ${item.model} → "${item.gen}" (${item.year})`);
    }
    if (items.length > 5) console.log(`    ... +${items.length - 5} more`);
  }

  // ─────────────────────────────────────────────
  // 3. SUSPICIOUS NAMES — Default, duplicates, corrupt
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  3. SUSPICIOUS GENERATION NAMES');
  console.log('═══════════════════════════════════════════════════════════════');

  const suspicious: { brand: string; model: string; gen: string; reason: string }[] = [];

  for (const g of gens) {
    const m = modelMap.get(g.model_id);
    if (!m) continue;
    const brand = brandMap.get(m.brandId) || '???';
    const name = g.name.toLowerCase();

    if (name === 'default' || name === 'unknown') {
      suspicious.push({ brand, model: m.name, gen: g.name, reason: 'Default/Unknown' });
    } else if (name.includes(m.name.toLowerCase()) && name !== m.name.toLowerCase()) {
      // Gen name contains model name (e.g., "A1 A1 Citycarver")
      suspicious.push({ brand, model: m.name, gen: g.name, reason: 'Contains model name' });
    } else if (/^auto[- ]data/i.test(name) || /^us /i.test(name)) {
      suspicious.push({ brand, model: m.name, gen: g.name, reason: 'Auto-generated placeholder' });
    } else if (name.length > 60) {
      suspicious.push({ brand, model: m.name, gen: g.name, reason: 'Too long' });
    }
  }

  // Group by reason
  const byReason: Record<string, typeof suspicious> = {};
  for (const s of suspicious) {
    if (!byReason[s.reason]) byReason[s.reason] = [];
    byReason[s.reason].push(s);
  }

  for (const [reason, items] of Object.entries(byReason)) {
    console.log(`\n  ${reason}: ${items.length}`);
    for (const item of items.slice(0, 8)) {
      console.log(`    ⚠️  ${item.brand} ${item.model} → "${item.gen}"`);
    }
    if (items.length > 8) console.log(`    ... +${items.length - 8} more`);
  }

  // ─────────────────────────────────────────────
  // 4. POTENTIAL DUPLICATES — same model, similar gen names
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  4. POTENTIAL DUPLICATE GENERATIONS');
  console.log('═══════════════════════════════════════════════════════════════');

  // Group gens by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  let dupeCount = 0;
  const dupeExamples: string[] = [];

  for (const [modelId, modelGens] of gensByModel) {
    if (modelGens.length < 2) continue;
    const m = modelMap.get(modelId);
    if (!m) continue;
    const brand = brandMap.get(m.brandId) || '???';

    // Check for gens with very similar names
    for (let i = 0; i < modelGens.length; i++) {
      for (let j = i + 1; j < modelGens.length; j++) {
        const a = modelGens[i].name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const b = modelGens[j].name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Same normalized name, or one contains the other
        if (a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)))) {
          dupeCount++;
          if (dupeExamples.length < 20) {
            const specA = genSpecs.has(modelGens[i].id) ? '✅' : '❌';
            const specB = genSpecs.has(modelGens[j].id) ? '✅' : '❌';
            dupeExamples.push(`  ${brand} ${m.name}: "${modelGens[i].name}" ${specA} ↔ "${modelGens[j].name}" ${specB}`);
          }
        }
      }
    }
  }

  console.log(`\n  Potential duplicates found: ${dupeCount}`);
  for (const ex of dupeExamples) console.log(ex);
  if (dupeCount > 20) console.log(`  ... +${dupeCount - 20} more`);

  // ─────────────────────────────────────────────
  // 5. MODELS WITH EXCESSIVE GENS (possible scraper pollution)
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  5. MODELS WITH EXCESSIVE GENERATIONS (>15)');
  console.log('═══════════════════════════════════════════════════════════════');

  const excessive = [...gensByModel.entries()]
    .map(([modelId, g]) => {
      const m = modelMap.get(modelId);
      return { brand: m ? brandMap.get(m.brandId) : '?', model: m?.name || '?', count: g.length };
    })
    .filter(x => x.count > 15)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  for (const x of excessive) {
    console.log(`  ${String(x.count).padStart(4)} gens  ${x.brand} ${x.model}`);
  }

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP PRIORITIES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  1. ${unknownDate.length} gens without production dates → extract from specs/names`);
  console.log(`  2. ${zeroSpecs.length} gens with zero specs → delete or fill via scraper`);
  console.log(`  3. ${suspicious.length} suspicious gen names → rename or merge`);
  console.log(`  4. ${dupeCount} potential duplicates → merge + transfer specs`);
  console.log(`  5. ${excessive.length} models with >15 gens → audit for scraper pollution`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
