/**
 * audit-safety.ts — Final safety data audit
 *
 * Reports:
 *   - Coverage by brand
 *   - Coverage by source (EuroNCAP vs NHTSA vs propagated)
 *   - Star distribution
 *   - Recalls by brand
 *   - Gap analysis: popular models without ratings
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-safety.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function fmt(n: number): string { return n.toLocaleString('fr-FR'); }
function pct(n: number, d: number): string { return d === 0 ? '0.0%' : `${(n / d * 100).toFixed(1)}%`; }

async function main() {
  console.log('');
  console.log('#'.repeat(60));
  console.log('#  SAFETY DATA AUDIT');
  console.log(`#  ${new Date().toISOString()}`);
  console.log('#'.repeat(60));

  // Load data
  console.log('\n  Loading data...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, brand:brands(id, name))'
  );

  const ratings = await paginateAll(
    'safety_ratings',
    'id, generation_id, stars, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, source_url, test_year'
  );

  const recalls = await paginateAll(
    'vehicle_recalls',
    'id, brand, model, source, component, recall_date, generation_id'
  );

  console.log(`  Generations:     ${fmt(gens.length)}`);
  console.log(`  Safety ratings:  ${fmt(ratings.length)}`);
  console.log(`  Vehicle recalls: ${fmt(recalls.length)}`);

  // ═══ Coverage by source ═══
  console.log('\n' + '='.repeat(60));
  console.log('  SAFETY RATINGS BY SOURCE');
  console.log('='.repeat(60));

  let euroncapCount = 0;
  let nhtsaCount = 0;
  let propagatedCount = 0;
  let otherCount = 0;

  for (const r of ratings) {
    const url = r.source_url || '';
    if (url.includes('propagated_from')) propagatedCount++;
    else if (url.includes('euroncap')) euroncapCount++;
    else if (url.includes('nhtsa')) nhtsaCount++;
    else otherCount++;
  }

  console.log(`  EuroNCAP:     ${fmt(euroncapCount)}`);
  console.log(`  NHTSA:        ${fmt(nhtsaCount)}`);
  console.log(`  Propagated:   ${fmt(propagatedCount)}`);
  console.log(`  Other:        ${fmt(otherCount)}`);
  console.log(`  TOTAL:        ${fmt(ratings.length)} / ${fmt(gens.length)} (${pct(ratings.length, gens.length)})`);

  // ═══ Star distribution ═══
  console.log('\n' + '='.repeat(60));
  console.log('  STAR DISTRIBUTION');
  console.log('='.repeat(60));

  const starDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    if (r.stars >= 1 && r.stars <= 5) starDist[r.stars]++;
  }
  for (let s = 5; s >= 1; s--) {
    const bar = '█'.repeat(Math.round(starDist[s] / Math.max(1, ratings.length) * 50));
    console.log(`  ${s}★  ${String(starDist[s]).padStart(5)}  ${bar}`);
  }

  // ═══ Coverage by brand ═══
  console.log('\n' + '='.repeat(60));
  console.log('  COVERAGE BY BRAND');
  console.log('='.repeat(60));

  const ratedGenIds = new Set(ratings.map(r => r.generation_id));
  const brandStats: Record<string, { total: number; rated: number }> = {};

  for (const gen of gens) {
    const model = gen.model as any;
    const brand = model?.brand?.name || '(unknown)';
    if (!brandStats[brand]) brandStats[brand] = { total: 0, rated: 0 };
    brandStats[brand].total++;
    if (ratedGenIds.has(gen.id)) brandStats[brand].rated++;
  }

  const sorted = Object.entries(brandStats).sort((a, b) => {
    const pctA = a[1].rated / a[1].total;
    const pctB = b[1].rated / b[1].total;
    return pctB - pctA;
  });

  console.log(`  ${'Brand'.padEnd(20)} ${'Total'.padStart(6)} ${'Rated'.padStart(6)} ${'Coverage'.padStart(10)}`);
  console.log(`  ${'-'.repeat(20)} ${'-'.repeat(6)} ${'-'.repeat(6)} ${'-'.repeat(10)}`);
  for (const [brand, data] of sorted) {
    console.log(
      `  ${brand.padEnd(20)} ${String(data.total).padStart(6)} ${String(data.rated).padStart(6)} ${pct(data.rated, data.total).padStart(10)}`
    );
  }

  // ═══ Recalls by source ═══
  console.log('\n' + '='.repeat(60));
  console.log('  RECALLS BY SOURCE');
  console.log('='.repeat(60));

  const recallSources: Record<string, number> = {};
  for (const r of recalls) {
    recallSources[r.source] = (recallSources[r.source] || 0) + 1;
  }
  for (const [source, count] of Object.entries(recallSources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(20)} ${fmt(count)}`);
  }

  // Recalls by brand
  console.log('\n  Top brands by recall count:');
  const recallBrands: Record<string, number> = {};
  for (const r of recalls) {
    recallBrands[r.brand] = (recallBrands[r.brand] || 0) + 1;
  }
  const sortedRecalls = Object.entries(recallBrands).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [brand, count] of sortedRecalls) {
    console.log(`    ${brand.padEnd(20)} ${fmt(count)}`);
  }

  // Recalls by component
  console.log('\n  Recalls by component:');
  const compCounts: Record<string, number> = {};
  for (const r of recalls) {
    compCounts[r.component] = (compCounts[r.component] || 0) + 1;
  }
  for (const [comp, count] of Object.entries(compCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${comp.padEnd(20)} ${fmt(count)}`);
  }

  // ═══ Gap analysis: models without ratings ═══
  console.log('\n' + '='.repeat(60));
  console.log('  GAP ANALYSIS — Popular models without safety ratings');
  console.log('='.repeat(60));

  // Find models with most unrated generations
  const modelGaps: Record<string, { brand: string; model: string; total: number; unrated: number }> = {};
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name}|${model.name}`;
    if (!modelGaps[key]) modelGaps[key] = { brand: model.brand.name, model: model.name, total: 0, unrated: 0 };
    modelGaps[key].total++;
    if (!ratedGenIds.has(gen.id)) modelGaps[key].unrated++;
  }

  const topGaps = Object.values(modelGaps)
    .filter(g => g.unrated > 0)
    .sort((a, b) => b.unrated - a.unrated)
    .slice(0, 25);

  console.log(`  ${'Brand'.padEnd(18)} ${'Model'.padEnd(20)} ${'Gens'.padStart(5)} ${'Unrated'.padStart(8)}`);
  console.log(`  ${'-'.repeat(18)} ${'-'.repeat(20)} ${'-'.repeat(5)} ${'-'.repeat(8)}`);
  for (const g of topGaps) {
    console.log(`  ${g.brand.padEnd(18)} ${g.model.padEnd(20)} ${String(g.total).padStart(5)} ${String(g.unrated).padStart(8)}`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    safety_ratings: {
      total: ratings.length,
      coverage_pct: parseFloat((ratings.length / gens.length * 100).toFixed(1)),
      by_source: { euroncap: euroncapCount, nhtsa: nhtsaCount, propagated: propagatedCount, other: otherCount },
      star_distribution: starDist,
    },
    recalls: {
      total: recalls.length,
      by_source: recallSources,
      by_brand: Object.fromEntries(sortedRecalls),
    },
    brand_coverage: Object.fromEntries(sorted),
    top_gaps: topGaps,
  };

  const reportPath = path.join(path.resolve(__dirname, '../../data'), 'safety-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: ${reportPath}`);
  console.log('');
}

main().catch(console.error);
