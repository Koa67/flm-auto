/**
 * audit-final.ts — Comprehensive final coverage audit
 *
 * Weighted scoring formula:
 *   Photos 25% + Videos 15% + Safety 20% + Interior Dims 20% + Family Fit 10% + Exterior 10%
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final.ts
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
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  FINAL COVERAGE AUDIT — FLM AUTO                        ║');
  console.log('║  ' + new Date().toISOString().substring(0, 19) + '                                 ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  // ── Load base data ──
  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name');
  const totalGens = gens.length;

  console.log(`  Brands: ${brands.length} | Models: ${models.length} | Generations: ${totalGens}`);

  // ── Photos ──
  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const imgGens = new Set(imgs.map((r: any) => r.generation_id));
  const imgCoverage = imgGens.size;
  const imgTotal = imgs.length;

  // ── Videos ──
  const vids = await paginateAll('vehicle_videos', 'generation_id');
  const vidGens = new Set(vids.map((r: any) => r.generation_id));
  const vidCoverage = vidGens.size;
  const vidTotal = vids.length;

  // ── Safety ──
  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const safetyGens = new Set(safety.map((r: any) => r.generation_id));
  const safetyCoverage = safetyGens.size;

  // Safety by source
  const safetyBySource: Record<string, number> = {};
  for (const r of safety) {
    const url = (r as any).source_url || '';
    let source = 'unknown';
    if (url.includes('euroncap')) source = 'euroncap';
    else if (url.includes('nhtsa')) source = 'nhtsa';
    else if (url.includes('nasva') || url.includes('jncap')) source = 'jncap';
    else if (url.startsWith('propagated_from:')) source = 'propagated_model';
    else if (url.startsWith('propagated_platform:')) source = 'propagated_platform';
    safetyBySource[source] = (safetyBySource[source] || 0) + 1;
  }

  // Star distribution
  const starDist: Record<number, number> = {};
  for (const r of safety) {
    const stars = (r as any).stars || 0;
    starDist[stars] = (starDist[stars] || 0) + 1;
  }

  // ── Interior Dimensions ──
  const dims = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, fuel_tank_liters');
  const dimGens = new Set(dims.map((r: any) => r.generation_id));
  const dimCoverage = dimGens.size;

  let dimsWithHeadroom = 0, dimsWithLegroom = 0, dimsWithTrunk = 0, dimsWithFuel = 0;
  for (const d of dims) {
    if ((d as any).front_headroom_mm || (d as any).rear_headroom_mm) dimsWithHeadroom++;
    if ((d as any).front_legroom_mm || (d as any).rear_legroom_mm) dimsWithLegroom++;
    if ((d as any).trunk_volume_liters) dimsWithTrunk++;
    if ((d as any).fuel_tank_liters) dimsWithFuel++;
  }

  // ── Family Fit ──
  const fits = await paginateAll('family_fit_compatibility', 'generation_id');
  const fitGens = new Set(fits.map((r: any) => r.generation_id));
  const fitCoverage = fitGens.size;

  // ── Exterior Dimensions (from third_party_specs) ──
  const extSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type');
  const extByType: Record<string, Set<string>> = {
    length: new Set(), width: new Set(), height: new Set(),
    wheelbase: new Set(), weight: new Set()
  };
  for (const s of extSpecs) {
    const st = (s as any).spec_type as string;
    if (st === 'length_mm' || st === 'length' || st.startsWith('how_long_is_')) extByType.length.add((s as any).generation_id);
    else if (st === 'width_mm' || st === 'width' || st.startsWith('how_wide_is_')) extByType.width.add((s as any).generation_id);
    else if (st === 'height_mm' || st === 'height' || st.startsWith('how_tall_is_')) extByType.height.add((s as any).generation_id);
    else if (st === 'wheelbase_mm' || st === 'wheelbase' || st.startsWith('what_is_the_wheelbase_')) extByType.wheelbase.add((s as any).generation_id);
    else if (st === 'curb_weight_kg' || st === 'weight_kg' || st === 'kerb_weight' || st.startsWith('what_is_the_gross_weight_')) extByType.weight.add((s as any).generation_id);
  }

  // ── Specs & Recalls ──
  const specsTotal = await countTable('third_party_specs');
  const recallsTotal = await countTable('vehicle_recalls');

  // ═══════════ DASHBOARD ═══════════
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║  COVERAGE DASHBOARD                                      ║');
  console.log('╠' + '═'.repeat(58) + '╣');

  const metrics = [
    { label: 'Photos',              covered: imgCoverage,        total: totalGens, weight: 25, extra: `${imgTotal.toLocaleString()} images` },
    { label: 'Videos',              covered: vidCoverage,        total: totalGens, weight: 15, extra: `${vidTotal.toLocaleString()} videos` },
    { label: 'Safety Ratings',      covered: safetyCoverage,     total: totalGens, weight: 20, extra: '' },
    { label: 'Interior Dimensions', covered: dimCoverage,        total: totalGens, weight: 20, extra: '' },
    { label: 'Family Fit',          covered: fitCoverage,        total: totalGens, weight: 10, extra: '' },
    { label: 'Ext: Length',         covered: extByType.length.size,    total: totalGens, weight: 10, extra: '' },
    { label: 'Ext: Width',          covered: extByType.width.size,     total: totalGens, weight: 0,  extra: '' },
    { label: 'Ext: Height',         covered: extByType.height.size,    total: totalGens, weight: 0,  extra: '' },
    { label: 'Ext: Wheelbase',      covered: extByType.wheelbase.size, total: totalGens, weight: 0,  extra: '' },
    { label: 'Ext: Weight',         covered: extByType.weight.size,    total: totalGens, weight: 0,  extra: '' },
  ];

  for (const m of metrics) {
    const p = pct(m.covered, m.total);
    const b = bar(m.covered, m.total, 25);
    const w = m.weight > 0 ? ` (w${m.weight})` : '';
    console.log(`║  ${m.label.padEnd(20)} ${b} ${String(m.covered).padStart(5)}/${m.total} ${p.padStart(6)}${w.padEnd(6)} ${m.extra}`);
  }

  console.log('╠' + '═'.repeat(58) + '╣');
  console.log(`║  Third-party specs:   ${specsTotal.toLocaleString().padStart(8)} rows                    ║`);
  console.log(`║  Vehicle recalls:     ${recallsTotal.toLocaleString().padStart(8)} rows                    ║`);

  // Safety breakdown
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log('║  Safety Rating Sources                                    ║');
  for (const [src, count] of Object.entries(safetyBySource).sort((a, b) => b[1] - a[1])) {
    console.log(`║    ${src.padEnd(25)} ${String(count).padStart(5)}                    ║`);
  }

  console.log('║  Star Distribution                                        ║');
  for (let s = 5; s >= 1; s--) {
    const count = starDist[s] || 0;
    if (count > 0) console.log(`║    ${s}★ ${'★'.repeat(s)}${'☆'.repeat(5-s)}  ${String(count).padStart(5)}                               ║`);
  }

  // Interior dims sub-metrics
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log('║  Interior Dims Detail                                     ║');
  console.log(`║    Headroom:  ${dimsWithHeadroom}/${dimCoverage} (${pct(dimsWithHeadroom, dimCoverage)})                            ║`);
  console.log(`║    Legroom:   ${dimsWithLegroom}/${dimCoverage} (${pct(dimsWithLegroom, dimCoverage)})                            ║`);
  console.log(`║    Trunk vol: ${dimsWithTrunk}/${dimCoverage} (${pct(dimsWithTrunk, dimCoverage)})                            ║`);
  console.log(`║    Fuel tank: ${dimsWithFuel}/${dimCoverage} (${pct(dimsWithFuel, dimCoverage)})                            ║`);

  // ── Coverage Score ──
  const weightedMetrics = metrics.filter(m => m.weight > 0);
  let score = 0;
  for (const m of weightedMetrics) {
    const contribution = (m.covered / (m.total || 1)) * m.weight;
    score += contribution;
  }

  console.log('╠' + '═'.repeat(58) + '╣');
  console.log('║  Score Breakdown                                          ║');
  for (const m of weightedMetrics) {
    const contribution = (m.covered / (m.total || 1)) * m.weight;
    console.log(`║    ${m.label.padEnd(20)} ${pct(m.covered, m.total).padStart(6)} × ${String(m.weight).padStart(2)}% = ${contribution.toFixed(1).padStart(5)}          ║`);
  }

  console.log('╠' + '═'.repeat(58) + '╣');

  // Before/after comparison
  const before = {
    photos: 99.9, videos: 28.6, safety: 40.7, dims: 83.4, fit: 80.3, score: 69.5
  };
  const after = {
    photos: totalGens > 0 ? imgCoverage / totalGens * 100 : 0,
    videos: totalGens > 0 ? vidCoverage / totalGens * 100 : 0,
    safety: totalGens > 0 ? safetyCoverage / totalGens * 100 : 0,
    dims: totalGens > 0 ? dimCoverage / totalGens * 100 : 0,
    fit: totalGens > 0 ? fitCoverage / totalGens * 100 : 0,
    score,
  };

  console.log('║  BEFORE → AFTER                                           ║');
  console.log(`║    Photos:    ${before.photos.toFixed(1)}% → ${after.photos.toFixed(1)}%  (${after.photos > before.photos ? '+' : ''}${(after.photos - before.photos).toFixed(1)})             ║`);
  console.log(`║    Videos:    ${before.videos.toFixed(1)}% → ${after.videos.toFixed(1)}%  (${after.videos > before.videos ? '+' : ''}${(after.videos - before.videos).toFixed(1)})             ║`);
  console.log(`║    Safety:    ${before.safety.toFixed(1)}% → ${after.safety.toFixed(1)}%  (+${(after.safety - before.safety).toFixed(1)})             ║`);
  console.log(`║    Dims:      ${before.dims.toFixed(1)}% → ${after.dims.toFixed(1)}%  (+${(after.dims - before.dims).toFixed(1)})              ║`);
  console.log(`║    Fit:       ${before.fit.toFixed(1)}% → ${after.fit.toFixed(1)}%  (+${(after.fit - before.fit).toFixed(1)})              ║`);
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log(`║                                                            ║`);
  console.log(`║  OVERALL SCORE: ${score.toFixed(1)} / 100  (was ${before.score.toFixed(1)})               ║`);
  console.log(`║  DELTA: +${(score - before.score).toFixed(1)} points                                   ║`);
  console.log(`║                                                            ║`);
  console.log('╚' + '═'.repeat(58) + '╝');

  // Brand-level coverage
  console.log('\n  ── Top 15 Brands by Generation Count ──');
  const brandStats: Record<string, { total: number; photos: number; safety: number; dims: number; fit: number }> = {};
  for (const g of gens) {
    const brandName = ((g as any).model as any)?.brand?.name || 'unknown';
    if (!brandStats[brandName]) brandStats[brandName] = { total: 0, photos: 0, safety: 0, dims: 0, fit: 0 };
    brandStats[brandName].total++;
    if (imgGens.has((g as any).id)) brandStats[brandName].photos++;
    if (safetyGens.has((g as any).id)) brandStats[brandName].safety++;
    if (dimGens.has((g as any).id)) brandStats[brandName].dims++;
    if (fitGens.has((g as any).id)) brandStats[brandName].fit++;
  }

  const sortedBrands = Object.entries(brandStats).sort((a, b) => b[1].total - a[1].total).slice(0, 15);
  console.log('  ' + 'Brand'.padEnd(18) + 'Gens'.padStart(5) + '  Photos  Safety   Dims    Fit');
  for (const [brand, st] of sortedBrands) {
    console.log(`  ${brand.padEnd(18)} ${String(st.total).padStart(4)}  ${pct(st.photos, st.total).padStart(6)}  ${pct(st.safety, st.total).padStart(6)}  ${pct(st.dims, st.total).padStart(6)}  ${pct(st.fit, st.total).padStart(6)}`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totals: { brands: brands.length, models: models.length, generations: totalGens },
    coverage: {
      photos: { covered: imgCoverage, total: totalGens, pct: totalGens ? imgCoverage / totalGens : 0, totalImages: imgTotal },
      videos: { covered: vidCoverage, total: totalGens, pct: totalGens ? vidCoverage / totalGens : 0, totalVideos: vidTotal },
      safety: { covered: safetyCoverage, total: totalGens, pct: totalGens ? safetyCoverage / totalGens : 0, bySource: safetyBySource, starDist },
      interiorDims: { covered: dimCoverage, total: totalGens, pct: totalGens ? dimCoverage / totalGens : 0 },
      familyFit: { covered: fitCoverage, total: totalGens, pct: totalGens ? fitCoverage / totalGens : 0 },
      exterior: {
        length: { covered: extByType.length.size, total: totalGens },
        width: { covered: extByType.width.size, total: totalGens },
        height: { covered: extByType.height.size, total: totalGens },
        wheelbase: { covered: extByType.wheelbase.size, total: totalGens },
        weight: { covered: extByType.weight.size, total: totalGens },
      },
      specs: specsTotal,
      recalls: recallsTotal,
    },
    score,
    before,
    delta: score - before.score,
  };

  const reportPath = path.join(DATA_DIR, 'final-coverage-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: ${reportPath}`);
}

main().catch(console.error);
