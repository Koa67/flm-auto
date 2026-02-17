/**
 * audit-final-v2.ts — Final comprehensive coverage audit
 *
 * Score formula (from mega-prompt):
 *   (specs×15 + photos×15 + safety×25 + dims×15 + family×15 + videos×15) / 100
 *
 * Shows the full journey: 12 Feb AM → 12 Feb PM → 13 Feb
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final-v2.ts
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

function bar(n: number, total: number, width: number = 25): string {
  if (total === 0) return ' '.repeat(width);
  const filled = Math.round(n / total * width);
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(70) + '╗');
  console.log('║  FLM AUTO — COVERAGE JOURNEY (12-13 Feb 2026)                        ║');
  console.log('║  ' + new Date().toISOString().substring(0, 19) + '                                               ║');
  console.log('╚' + '═'.repeat(70) + '╝');

  // Load all data
  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name');
  const totalGens = gens.length;

  // Photos
  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const imgGens = new Set(imgs.map((r: any) => r.generation_id));

  // Videos
  const vids = await paginateAll('vehicle_videos', 'generation_id');
  const vidGens = new Set(vids.map((r: any) => r.generation_id));

  // Safety
  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const safetyGens = new Set(safety.map((r: any) => r.generation_id));

  // Dims
  const dims = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, fuel_tank_liters');
  const dimGens = new Set(dims.map((r: any) => r.generation_id));

  // Family fit
  const fits = await paginateAll('family_fit_compatibility', 'generation_id');
  const fitGens = new Set(fits.map((r: any) => r.generation_id));

  // Specs
  const specsTotal = await countTable('third_party_specs');
  const specsGens = await paginateAll('third_party_specs', 'generation_id');
  const specsGenSet = new Set(specsGens.map((r: any) => r.generation_id));

  // Exterior
  const extSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type');
  const extLength = new Set<string>();
  for (const s of extSpecs) {
    const st = (s as any).spec_type as string;
    if (st === 'length_mm' || st === 'length' || st.startsWith('how_long_is_')) extLength.add((s as any).generation_id);
  }

  // Recalls
  const recallsTotal = await countTable('vehicle_recalls');

  console.log(`  Brands: ${brands.length} | Models: ${models.length} | Gens: ${totalGens}`);
  console.log(`  Photos: ${imgs.length.toLocaleString()} | Videos: ${vids.length.toLocaleString()} | Specs: ${specsTotal.toLocaleString()}`);

  // Current percentages
  const current = {
    specs: totalGens > 0 ? specsGenSet.size / totalGens * 100 : 0,
    photos: totalGens > 0 ? imgGens.size / totalGens * 100 : 0,
    safety: totalGens > 0 ? safetyGens.size / totalGens * 100 : 0,
    dims: totalGens > 0 ? dimGens.size / totalGens * 100 : 0,
    family: totalGens > 0 ? fitGens.size / totalGens * 100 : 0,
    videos: totalGens > 0 ? vidGens.size / totalGens * 100 : 0,
  };

  // Score: (specs×15 + photos×15 + safety×25 + dims×15 + family×15 + videos×15) / 100
  const score = (
    current.specs * 0.15 +
    current.photos * 0.15 +
    current.safety * 0.25 +
    current.dims * 0.15 +
    current.family * 0.15 +
    current.videos * 0.15
  );

  // Historical data
  const before12am = { specs: 22.0, photos: 56.6, safety: 5.1, dims: 83.2, family: 80.3, videos: 28.6 };
  const before12pm = { specs: 99.2, photos: 99.9, safety: 46.8, dims: 86.3, family: 82.8, videos: 28.6 };

  const score12am = before12am.specs * 0.15 + before12am.photos * 0.15 + before12am.safety * 0.25 + before12am.dims * 0.15 + before12am.family * 0.15 + before12am.videos * 0.15;
  const score12pm = before12pm.specs * 0.15 + before12pm.photos * 0.15 + before12pm.safety * 0.25 + before12pm.dims * 0.15 + before12pm.family * 0.15 + before12pm.videos * 0.15;

  // Journey table
  console.log('\n╔' + '═'.repeat(70) + '╗');
  console.log('║  COVERAGE JOURNEY                                                    ║');
  console.log('╠' + '═'.repeat(70) + '╣');
  console.log('║                      12 Feb AM    12 Feb PM    13 Feb Now    Δ Total  ║');
  console.log('╠' + '─'.repeat(70) + '╣');

  const rows = [
    { label: 'Specs',      a: before12am.specs,  b: before12pm.specs,  c: current.specs },
    { label: 'Photos',     a: before12am.photos, b: before12pm.photos, c: current.photos },
    { label: 'Safety',     a: before12am.safety, b: before12pm.safety, c: current.safety },
    { label: 'Dims',       a: before12am.dims,   b: before12pm.dims,   c: current.dims },
    { label: 'Family Fit', a: before12am.family, b: before12pm.family, c: current.family },
    { label: 'Videos',     a: before12am.videos, b: before12pm.videos, c: current.videos },
  ];

  for (const r of rows) {
    const delta = r.c - r.a;
    const sign = delta >= 0 ? '+' : '';
    console.log(`║  ${r.label.padEnd(12)} ${r.a.toFixed(1).padStart(6)}%     ${r.b.toFixed(1).padStart(6)}%     ${r.c.toFixed(1).padStart(6)}%     ${sign}${delta.toFixed(1).padStart(5)}  ║`);
  }

  console.log('╠' + '─'.repeat(70) + '╣');
  console.log(`║  SCORE        ${score12am.toFixed(1).padStart(6)}       ${score12pm.toFixed(1).padStart(6)}       ${score.toFixed(1).padStart(6)}       +${(score - score12am).toFixed(1).padStart(5)}  ║`);
  console.log('╚' + '═'.repeat(70) + '╝');

  // Coverage bars
  console.log('\n  ── Current Coverage Bars ──');
  const barMetrics = [
    { label: 'Specs',      covered: specsGenSet.size, total: totalGens },
    { label: 'Photos',     covered: imgGens.size,     total: totalGens },
    { label: 'Safety',     covered: safetyGens.size,  total: totalGens },
    { label: 'Dimensions', covered: dimGens.size,     total: totalGens },
    { label: 'Family Fit', covered: fitGens.size,     total: totalGens },
    { label: 'Videos',     covered: vidGens.size,     total: totalGens },
    { label: 'Ext Length', covered: extLength.size,   total: totalGens },
  ];

  for (const m of barMetrics) {
    console.log(`  ${m.label.padEnd(12)} ${bar(m.covered, m.total)} ${String(m.covered).padStart(5)}/${m.total} (${pct(m.covered, m.total).padStart(6)})`);
  }

  // Safety sources
  console.log('\n  ── Safety Sources ──');
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
  for (const [src, count] of Object.entries(safetyBySource).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(25)} ${count}`);
  }

  // Interior dims detail
  console.log('\n  ── Interior Dims Completeness ──');
  let withHeadroom = 0, withLegroom = 0, withTrunk = 0, withFuel = 0;
  for (const d of dims) {
    if ((d as any).front_headroom_mm || (d as any).rear_headroom_mm) withHeadroom++;
    if ((d as any).front_legroom_mm || (d as any).rear_legroom_mm) withLegroom++;
    if ((d as any).trunk_volume_liters) withTrunk++;
    if ((d as any).fuel_tank_liters) withFuel++;
  }
  console.log(`    Headroom:  ${withHeadroom}/${dimGens.size} (${pct(withHeadroom, dimGens.size)})`);
  console.log(`    Legroom:   ${withLegroom}/${dimGens.size} (${pct(withLegroom, dimGens.size)})`);
  console.log(`    Trunk vol: ${withTrunk}/${dimGens.size} (${pct(withTrunk, dimGens.size)})`);
  console.log(`    Fuel tank: ${withFuel}/${dimGens.size} (${pct(withFuel, dimGens.size)})`);

  // Brand coverage table
  console.log('\n  ── Brand Coverage (all 32) ──');
  const brandStats: Record<string, { total: number; specs: number; photos: number; safety: number; dims: number; family: number; videos: number }> = {};
  for (const g of gens) {
    const bn = ((g as any).model as any)?.brand?.name || 'unknown';
    if (!brandStats[bn]) brandStats[bn] = { total: 0, specs: 0, photos: 0, safety: 0, dims: 0, family: 0, videos: 0 };
    brandStats[bn].total++;
    if (specsGenSet.has((g as any).id)) brandStats[bn].specs++;
    if (imgGens.has((g as any).id)) brandStats[bn].photos++;
    if (safetyGens.has((g as any).id)) brandStats[bn].safety++;
    if (dimGens.has((g as any).id)) brandStats[bn].dims++;
    if (fitGens.has((g as any).id)) brandStats[bn].family++;
    if (vidGens.has((g as any).id)) brandStats[bn].videos++;
  }

  console.log('  ' + 'Brand'.padEnd(16) + 'Gens'.padStart(5) + '  Specs   Photos  Safety   Dims   Family  Videos   AVG');
  const sortedBrands = Object.entries(brandStats).sort((a, b) => b[1].total - a[1].total);
  for (const [brand, st] of sortedBrands) {
    const avg = ((st.specs + st.photos + st.safety + st.dims + st.family + st.videos) / (st.total * 6) * 100);
    console.log(`  ${brand.padEnd(16)} ${String(st.total).padStart(4)}  ${pct(st.specs, st.total).padStart(6)}  ${pct(st.photos, st.total).padStart(6)}  ${pct(st.safety, st.total).padStart(6)}  ${pct(st.dims, st.total).padStart(6)}  ${pct(st.family, st.total).padStart(6)}  ${pct(st.videos, st.total).padStart(6)}  ${avg.toFixed(1).padStart(5)}%`);
  }

  // Final score
  console.log('\n╔' + '═'.repeat(70) + '╗');
  console.log(`║  FINAL SCORE: ${score.toFixed(1)} / 100                                             ║`);
  console.log(`║  Delta from start: +${(score - score12am).toFixed(1)} points                                      ║`);
  console.log(`║  Delta from last session: +${(score - score12pm).toFixed(1)} points                                ║`);
  console.log('╚' + '═'.repeat(70) + '╝');

  // Raw numbers
  console.log('\n  Raw counts:');
  console.log(`    Images:         ${imgs.length.toLocaleString()}`);
  console.log(`    Videos:         ${vids.length.toLocaleString()}`);
  console.log(`    Safety ratings: ${safety.length.toLocaleString()}`);
  console.log(`    Interior dims:  ${dims.length.toLocaleString()}`);
  console.log(`    Family fit:     ${fits.length.toLocaleString()}`);
  console.log(`    Specs:          ${specsTotal.toLocaleString()}`);
  console.log(`    Recalls:        ${recallsTotal.toLocaleString()}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totals: { brands: brands.length, models: models.length, generations: totalGens },
    coverage: {
      specs: { covered: specsGenSet.size, total: totalGens, pct: current.specs },
      photos: { covered: imgGens.size, total: totalGens, pct: current.photos, totalImages: imgs.length },
      safety: { covered: safetyGens.size, total: totalGens, pct: current.safety, bySource: safetyBySource },
      dims: { covered: dimGens.size, total: totalGens, pct: current.dims },
      family: { covered: fitGens.size, total: totalGens, pct: current.family },
      videos: { covered: vidGens.size, total: totalGens, pct: current.videos, totalVideos: vids.length },
      extLength: { covered: extLength.size, total: totalGens },
    },
    score,
    journey: { am12: score12am, pm12: score12pm, now: score },
    rawCounts: { images: imgs.length, videos: vids.length, safety: safety.length, dims: dims.length, fits: fits.length, specs: specsTotal, recalls: recallsTotal },
    brandCoverage: brandStats,
  };

  const reportPath = path.join(DATA_DIR, 'final-coverage-v2-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
