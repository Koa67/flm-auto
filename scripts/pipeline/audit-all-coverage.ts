/**
 * audit-all-coverage.ts — Comprehensive coverage audit across all data types
 *
 * Reports coverage for: photos, videos, safety ratings, interior dimensions,
 * family fit, exterior dimensions, specs, recalls.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-all-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DATA_DIR = path.resolve(__dirname, '../../data');

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

async function countTable(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

function bar(n: number, total: number, width: number = 30): string {
  if (total === 0) return '░'.repeat(width);
  const filled = Math.round(n / total * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  ALL COVERAGE AUDIT — FLM AUTO');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(60));

  // Load base data
  console.log('\n  Loading base data...');
  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name');
  const totalGens = gens.length;

  console.log(`  Brands: ${brands.length}`);
  console.log(`  Models: ${models.length}`);
  console.log(`  Generations: ${totalGens}`);

  // ── PHOTOS ──
  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const imgGens = new Set(imgs.map((r: any) => r.generation_id));
  const imgTotal = imgs.length;
  const imgCoverage = imgGens.size;

  // ── VIDEOS ──
  const vids = await paginateAll('vehicle_videos', 'generation_id');
  const vidGens = new Set(vids.map((r: any) => r.generation_id));
  const vidTotal = vids.length;
  const vidCoverage = vidGens.size;

  // ── SAFETY RATINGS ──
  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const safetyGens = new Set(safety.map((r: any) => r.generation_id));
  const safetyCoverage = safetyGens.size;

  // Safety breakdown by source
  const safetyBySource: Record<string, number> = {};
  for (const r of safety) {
    const url = r.source_url || '';
    let source = 'unknown';
    if (url.includes('euroncap')) source = 'euroncap';
    else if (url.includes('nhtsa')) source = 'nhtsa';
    else if (url.includes('ancap')) source = 'ancap';
    else if (url.startsWith('propagated_from:')) source = 'propagated_model';
    else if (url.startsWith('propagated_platform:')) source = 'propagated_platform';
    safetyBySource[source] = (safetyBySource[source] || 0) + 1;
  }

  // Star distribution
  const starDist: Record<number, number> = {};
  for (const r of safety) {
    const stars = r.stars || 0;
    starDist[stars] = (starDist[stars] || 0) + 1;
  }

  // ── INTERIOR DIMENSIONS ──
  const dims = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, fuel_tank_liters');
  const dimGens = new Set(dims.map((r: any) => r.generation_id));
  const dimCoverage = dimGens.size;

  // Interior dims completeness
  let dimsWithHeadroom = 0, dimsWithLegroom = 0, dimsWithTrunk = 0, dimsWithFuel = 0;
  for (const d of dims) {
    if (d.front_headroom_mm || d.rear_headroom_mm) dimsWithHeadroom++;
    if (d.front_legroom_mm || d.rear_legroom_mm) dimsWithLegroom++;
    if (d.trunk_volume_liters) dimsWithTrunk++;
    if (d.fuel_tank_liters) dimsWithFuel++;
  }

  // ── FAMILY FIT ──
  const fits = await paginateAll('family_fit_compatibility', 'generation_id, three_across_possible, rear_headroom_mm');
  const fitGens = new Set(fits.map((r: any) => r.generation_id));
  const fitCoverage = fitGens.size;

  // ── EXTERIOR DIMENSIONS (from third_party_specs) ──
  const extSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type');
  const extByType: Record<string, Set<string>> = { length: new Set(), width: new Set(), height: new Set(), wheelbase: new Set(), weight: new Set() };
  for (const s of extSpecs) {
    const st = s.spec_type as string;
    if (st === 'length_mm' || st === 'length' || st.startsWith('how_long_is_')) extByType.length.add(s.generation_id);
    else if (st === 'width_mm' || st === 'width' || st.startsWith('how_wide_is_')) extByType.width.add(s.generation_id);
    else if (st === 'height_mm' || st === 'height' || st.startsWith('how_tall_is_')) extByType.height.add(s.generation_id);
    else if (st === 'wheelbase_mm' || st === 'wheelbase' || st.startsWith('what_is_the_wheelbase_')) extByType.wheelbase.add(s.generation_id);
    else if (st === 'curb_weight_kg' || st === 'weight_kg' || st === 'kerb_weight' || st.startsWith('what_is_the_gross_weight_')) extByType.weight.add(s.generation_id);
  }
  const extLength = extByType.length.size;
  const extWidth = extByType.width.size;
  const extHeight = extByType.height.size;
  const extWheelbase = extByType.wheelbase.size;
  const extWeight = extByType.weight.size;

  // ── SPECS ──
  const specsTotal = await countTable('third_party_specs');

  // ── RECALLS ──
  const recallsTotal = await countTable('vehicle_recalls');

  // ═══════════ REPORT ═══════════
  console.log('\n' + '═'.repeat(60));
  console.log('  COVERAGE DASHBOARD');
  console.log('═'.repeat(60));

  const metrics = [
    { label: 'Photos',              covered: imgCoverage,    total: totalGens, extra: `(${imgTotal.toLocaleString()} images total)` },
    { label: 'Videos',              covered: vidCoverage,    total: totalGens, extra: `(${vidTotal.toLocaleString()} videos total)` },
    { label: 'Safety Ratings',      covered: safetyCoverage, total: totalGens, extra: '' },
    { label: 'Interior Dimensions', covered: dimCoverage,    total: totalGens, extra: '' },
    { label: 'Family Fit',          covered: fitCoverage,    total: totalGens, extra: '' },
    { label: 'Ext: Length',         covered: extLength,      total: totalGens, extra: '' },
    { label: 'Ext: Width',          covered: extWidth,       total: totalGens, extra: '' },
    { label: 'Ext: Height',         covered: extHeight,      total: totalGens, extra: '' },
    { label: 'Ext: Wheelbase',      covered: extWheelbase,   total: totalGens, extra: '' },
    { label: 'Ext: Weight',         covered: extWeight,      total: totalGens, extra: '' },
  ];

  for (const m of metrics) {
    const p = pct(m.covered, m.total);
    const b = bar(m.covered, m.total, 25);
    console.log(`  ${m.label.padEnd(22)} ${b} ${String(m.covered).padStart(5)}/${m.total} (${p.padStart(6)}) ${m.extra}`);
  }

  console.log(`\n  Third-party specs:   ${specsTotal.toLocaleString()} rows`);
  console.log(`  Vehicle recalls:     ${recallsTotal.toLocaleString()} rows`);

  // Safety breakdown
  console.log('\n  ── Safety Rating Sources ──');
  for (const [src, count] of Object.entries(safetyBySource).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(25)} ${count}`);
  }

  console.log('\n  ── Star Distribution ──');
  for (let s = 5; s >= 0; s--) {
    const count = starDist[s] || 0;
    if (count > 0) console.log(`    ${s} stars: ${'★'.repeat(s)}${'☆'.repeat(5-s)}  ${count}`);
  }

  // Interior dims sub-metrics
  console.log('\n  ── Interior Dims Completeness ──');
  console.log(`    With headroom:  ${dimsWithHeadroom} / ${dimCoverage} (${pct(dimsWithHeadroom, dimCoverage)})`);
  console.log(`    With legroom:   ${dimsWithLegroom} / ${dimCoverage} (${pct(dimsWithLegroom, dimCoverage)})`);
  console.log(`    With trunk vol: ${dimsWithTrunk} / ${dimCoverage} (${pct(dimsWithTrunk, dimCoverage)})`);
  console.log(`    With fuel tank: ${dimsWithFuel} / ${dimCoverage} (${pct(dimsWithFuel, dimCoverage)})`);

  // Brand-level coverage
  console.log('\n  ── Brand Coverage (photos / safety / dims) ──');
  const brandStats: Record<string, { total: number; photos: number; safety: number; dims: number }> = {};
  for (const g of gens) {
    const brandName = (g.model as any)?.brand?.name || 'unknown';
    if (!brandStats[brandName]) brandStats[brandName] = { total: 0, photos: 0, safety: 0, dims: 0 };
    brandStats[brandName].total++;
    if (imgGens.has(g.id)) brandStats[brandName].photos++;
    if (safetyGens.has(g.id)) brandStats[brandName].safety++;
    if (dimGens.has(g.id)) brandStats[brandName].dims++;
  }

  const sortedBrands = Object.entries(brandStats).sort((a, b) => b[1].total - a[1].total);
  for (const [brand, st] of sortedBrands) {
    console.log(`    ${brand.padEnd(18)} ${pct(st.photos, st.total).padStart(6)} / ${pct(st.safety, st.total).padStart(6)} / ${pct(st.dims, st.total).padStart(6)}  (${st.total} gens)`);
  }

  // Coverage score
  const overallScore = (
    (imgCoverage / totalGens) * 25 +
    (vidCoverage / totalGens) * 15 +
    (safetyCoverage / totalGens) * 20 +
    (dimCoverage / totalGens) * 20 +
    (fitCoverage / totalGens) * 10 +
    (extLength / totalGens) * 10
  );

  console.log('\n' + '═'.repeat(60));
  console.log(`  OVERALL COVERAGE SCORE: ${overallScore.toFixed(1)} / 100`);
  console.log('═'.repeat(60));

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totals: { brands: brands.length, models: models.length, generations: totalGens },
    coverage: {
      photos: { covered: imgCoverage, total: totalGens, pct: imgCoverage / totalGens, totalImages: imgTotal },
      videos: { covered: vidCoverage, total: totalGens, pct: vidCoverage / totalGens, totalVideos: vidTotal },
      safety: { covered: safetyCoverage, total: totalGens, pct: safetyCoverage / totalGens, bySource: safetyBySource, starDist },
      interiorDims: { covered: dimCoverage, total: totalGens, pct: dimCoverage / totalGens },
      familyFit: { covered: fitCoverage, total: totalGens, pct: fitCoverage / totalGens },
      exterior: {
        length: { covered: extLength, total: totalGens, pct: totalGens ? extLength / totalGens : 0 },
        width: { covered: extWidth, total: totalGens, pct: totalGens ? extWidth / totalGens : 0 },
        height: { covered: extHeight, total: totalGens, pct: totalGens ? extHeight / totalGens : 0 },
        wheelbase: { covered: extWheelbase, total: totalGens, pct: totalGens ? extWheelbase / totalGens : 0 },
        weight: { covered: extWeight, total: totalGens, pct: totalGens ? extWeight / totalGens : 0 },
      },
      specs: specsTotal,
      recalls: recallsTotal,
    },
    overallScore,
    brandCoverage: brandStats,
  };

  const reportPath = path.join(DATA_DIR, 'all-coverage-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
