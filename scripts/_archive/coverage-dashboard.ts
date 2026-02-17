/**
 * FLM AUTO — Coverage Dashboard
 * 
 * Crosses brands × models × generations × data sources
 * Outputs a gap analysis: what's covered, what's missing, where to focus next
 * 
 * Usage: npx ts-node coverage-dashboard.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

// Key source categories
const SOURCE_BUCKETS: Record<string, string[]> = {
  'Real Specs':    ['Auto-Data.net', 'UltimateSpecs'],
  'Generated':     ['Generated', 'Estimated'],
  'Safety':        ['EuroNCAP', 'TÜV Report'],
  'Family':        ['FamilyFit', 'family_fit_scrape'],
  'Media':         ['YouTube', 'Wikimedia Commons', 'Pexels'],
  'EV':            ['EV Database', 'EVDatabase', 'EVDatabaseRaw'],
  'Pricing':       ['Price Database', 'MarketPrices'],
  'Interior':      ['ADAC', 'CarSized'],
};

function bar(pct: number, width: number = 20): string {
  const filled = Math.round(pct / 100 * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function pct(n: number, total: number): string {
  if (total === 0) return '  0%';
  return `${Math.round(n / total * 100).toString().padStart(3)}%`;
}

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            FLM AUTO — COVERAGE DASHBOARD                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  ${new Date().toISOString().slice(0, 19)}\n`);

  // ─── Load everything ───
  process.stdout.write('  Loading brands...');
  const brands = await paginate('brands', 'id, name');
  console.log(` ${brands.length}`);
  
  process.stdout.write('  Loading models...');
  const models = await paginate('models', 'id, name, brand_id');
  console.log(` ${models.length}`);
  
  process.stdout.write('  Loading generations...');
  const gens = await paginate('generations', 'id, name, model_id, production_start, production_end');
  console.log(` ${gens.length}`);
  
  process.stdout.write('  Loading specs index...');
  const specs = await paginate('third_party_specs', 'generation_id, source');
  console.log(` ${specs.length}\n`);

  // ─── Index maps ───
  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const modelBrand = new Map(models.map((m: any) => [m.id, m.brand_id]));
  const modelName = new Map(models.map((m: any) => [m.id, m.name]));
  const genModel = new Map(gens.map((g: any) => [g.id, g.model_id]));
  
  // gen → set of sources
  const genSources = new Map<string, Set<string>>();
  for (const s of specs) {
    if (!genSources.has(s.generation_id)) genSources.set(s.generation_id, new Set());
    genSources.get(s.generation_id)!.add(s.source);
  }

  // gen → brand
  function genToBrand(genId: string): string | undefined {
    const modelId = genModel.get(genId);
    if (!modelId) return undefined;
    const brandId = modelBrand.get(modelId);
    if (!brandId) return undefined;
    return brandMap.get(brandId);
  }

  // ─────────────────────────────────────────────
  // 1. GLOBAL SUMMARY
  // ─────────────────────────────────────────────
  const gensWithRealSpecs = new Set<string>();
  const gensWithAnySpecs = new Set<string>();
  const gensWithGenerated = new Set<string>();
  
  for (const [genId, sources] of genSources) {
    gensWithAnySpecs.add(genId);
    const GENERATED_SOURCES = ['Generated', 'Estimated', 'ai_enrichment'];
    const hasReal = [...sources].some(s => !GENERATED_SOURCES.includes(s));
    const hasGenerated = [...sources].some(s => GENERATED_SOURCES.includes(s));
    if (hasReal) gensWithRealSpecs.add(genId);
    if (hasGenerated && !hasReal) gensWithGenerated.add(genId);
  }
  
  const noSpecs = gens.filter((g: any) => !gensWithAnySpecs.has(g.id)).length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GLOBAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Brands:       ${brands.length}`);
  console.log(`  Models:       ${models.length}`);
  console.log(`  Generations:  ${gens.length}`);
  console.log(`  Specs rows:   ${specs.length.toLocaleString()}`);
  console.log('');
  console.log(`  Real specs:   ${gensWithRealSpecs.size}/${gens.length} gens  ${bar(gensWithRealSpecs.size / gens.length * 100)} ${pct(gensWithRealSpecs.size, gens.length)}`);
  console.log(`  Generated:    ${gensWithGenerated.size}/${gens.length} gens  ${bar(gensWithGenerated.size / gens.length * 100)} ${pct(gensWithGenerated.size, gens.length)}`);
  console.log(`  No specs:     ${noSpecs}/${gens.length} gens  ${bar(noSpecs / gens.length * 100)} ${pct(noSpecs, gens.length)}`);

  // ─────────────────────────────────────────────
  // 2. PER-BRAND BREAKDOWN
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PER-BRAND COVERAGE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Brand              Models  Gens   Real   Gen\'d  None   Cover');
  console.log('  ' + '─'.repeat(59));

  type BrandStats = {
    name: string; models: number; gens: number;
    real: number; generated: number; none: number;
  };
  const brandStats: BrandStats[] = [];

  for (const brand of brands) {
    const bModels = models.filter((m: any) => m.brand_id === brand.id);
    const bModelIds = new Set(bModels.map((m: any) => m.id));
    const bGens = gens.filter((g: any) => bModelIds.has(g.model_id));
    
    let real = 0, generated = 0, none = 0;
    for (const g of bGens) {
      const sources = genSources.get(g.id);
      if (!sources) { none++; continue; }
      const GENERATED_SOURCES = ['Generated', 'Estimated', 'ai_enrichment'];
      const hasReal = [...sources].some(s => !GENERATED_SOURCES.includes(s));
      const hasGen = [...sources].some(s => GENERATED_SOURCES.includes(s));
      if (hasReal) real++;
      else if (hasGen) generated++;
      else none++;
    }
    
    brandStats.push({ name: brand.name, models: bModels.length, gens: bGens.length, real, generated, none });
    
    const coverage = bGens.length > 0 ? Math.round(real / bGens.length * 100) : 0;
    const barStr = bar(coverage, 12);
    
    console.log(`  ${brand.name.padEnd(18)} ${String(bModels.length).padStart(5)}  ${String(bGens.length).padStart(5)}  ${String(real).padStart(5)}  ${String(generated).padStart(5)}  ${String(none).padStart(5)}   ${barStr} ${pct(real, bGens.length)}`);
  }

  // ─────────────────────────────────────────────
  // 3. SOURCE COVERAGE MATRIX
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SOURCE COVERAGE (gens with data from each source bucket)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [bucket, sources] of Object.entries(SOURCE_BUCKETS)) {
    let count = 0;
    for (const [, srcSet] of genSources) {
      if ([...srcSet].some(s => sources.includes(s))) count++;
    }
    console.log(`  ${bucket.padEnd(16)} ${String(count).padStart(5)} gens  ${bar(count / gens.length * 100)} ${pct(count, gens.length)}`);
  }

  // ─────────────────────────────────────────────
  // 4. TOP GAPS — brands with worst real coverage
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TOP GAPS (brands with most uncovered generations)');
  console.log('═══════════════════════════════════════════════════════════════');

  const gaps = brandStats
    .map(b => ({ ...b, gap: b.gens - b.real, coverPct: b.gens > 0 ? b.real / b.gens : 1 }))
    .filter(b => b.gens > 0)
    .sort((a, b) => a.coverPct - b.coverPct)
    .slice(0, 15);

  for (const g of gaps) {
    console.log(`  ${g.name.padEnd(18)} ${String(g.gap).padStart(4)} uncovered / ${String(g.gens).padStart(4)} total  ${bar(g.coverPct * 100, 15)} ${pct(g.real, g.gens)}`);
  }

  // ─────────────────────────────────────────────
  // 5. ORPHAN GENERATIONS (no model or brand link)
  // ─────────────────────────────────────────────
  const orphanGens = gens.filter((g: any) => !genModel.has(g.id) || !modelBrand.has(genModel.get(g.id)!));
  if (orphanGens.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  ⚠️  ORPHAN GENERATIONS: ${orphanGens.length} (no valid brand/model link)`);
    console.log('═══════════════════════════════════════════════════════════════');
  }

  // ─────────────────────────────────────────────
  // 6. DATA FRESHNESS — gens by production decade
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DATA BY DECADE (production_start)');
  console.log('═══════════════════════════════════════════════════════════════');

  const decades: Record<string, { total: number; real: number }> = {};
  for (const g of gens) {
    const year = g.production_start ? parseInt(String(g.production_start).slice(0, 4)) : null;
    const decade = year ? `${Math.floor(year / 10) * 10}s` : 'Unknown';
    if (!decades[decade]) decades[decade] = { total: 0, real: 0 };
    decades[decade].total++;
    if (gensWithRealSpecs.has(g.id)) decades[decade].real++;
  }

  Object.entries(decades)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([decade, data]) => {
      console.log(`  ${decade.padEnd(10)} ${String(data.real).padStart(4)}/${String(data.total).padStart(4)}  ${bar(data.real / data.total * 100, 15)} ${pct(data.real, data.total)}`);
    });

  // ─────────────────────────────────────────────
  // 7. QUALITY — specs depth per generation
  // ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SPECS DEPTH (rows per generation)');
  console.log('═══════════════════════════════════════════════════════════════');

  const specsPerGen: Record<string, number> = {};
  for (const s of specs) {
    specsPerGen[s.generation_id] = (specsPerGen[s.generation_id] || 0) + 1;
  }
  const depths = Object.values(specsPerGen);
  if (depths.length > 0) {
    depths.sort((a, b) => a - b);
    const p25 = depths[Math.floor(depths.length * 0.25)];
    const p50 = depths[Math.floor(depths.length * 0.50)];
    const p75 = depths[Math.floor(depths.length * 0.75)];
    const p95 = depths[Math.floor(depths.length * 0.95)];
    
    console.log(`  Min:   ${Math.min(...depths)}`);
    console.log(`  P25:   ${p25}`);
    console.log(`  P50:   ${p50}  (median)`);
    console.log(`  P75:   ${p75}`);
    console.log(`  P95:   ${p95}`);
    console.log(`  Max:   ${Math.max(...depths)}`);
    console.log(`  Avg:   ${(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)}`);
    
    // Distribution buckets
    const buckets = [1, 10, 25, 50, 100, 200, 500, Infinity];
    console.log('\n  Distribution:');
    let prev = 0;
    for (const limit of buckets) {
      const count = depths.filter(d => d > prev && d <= limit).length;
      const label = limit === Infinity ? `${prev + 1}+` : `${prev + 1}-${limit}`;
      console.log(`    ${label.padEnd(10)} ${String(count).padStart(5)} gens  ${bar(count / depths.length * 100, 15)}`);
      prev = limit;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Dashboard complete');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
