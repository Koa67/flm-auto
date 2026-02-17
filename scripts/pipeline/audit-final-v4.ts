/**
 * audit-final-v4.ts — Comprehensive coverage audit v4
 *
 * Score formula:
 *   (specs×15 + photos×15 + safety×25 + dims×15 + family×15 + videos×15) / 100
 *
 * Full journey: 12 Feb AM → 12 Feb PM → 13 Feb AM → 13 Feb PM (DRILL)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-final-v4.ts
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
  if (total === 0) return ' '.repeat(width);
  const filled = Math.round(n / total * width);
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  FLM AUTO — DRILL BABY DRILL — FINAL AUDIT v4                              ║');
  console.log('║  ' + new Date().toISOString().substring(0, 19) + '                                                       ║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name');
  const totalGens = gens.length;

  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const imgGens = new Set(imgs.map((r: any) => r.generation_id));

  const vids = await paginateAll('vehicle_videos', 'generation_id, video_type, language, view_count');
  const vidGens = new Set(vids.map((r: any) => r.generation_id));

  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const safetyGens = new Set(safety.map((r: any) => r.generation_id));

  const dims = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, fuel_tank_liters');
  const dimGens = new Set(dims.map((r: any) => r.generation_id));

  const fits = await paginateAll('family_fit_compatibility', 'generation_id');
  const fitGens = new Set(fits.map((r: any) => r.generation_id));

  const specsTotal = await countTable('third_party_specs');
  const specsGens = await paginateAll('third_party_specs', 'generation_id');
  const specsGenSet = new Set(specsGens.map((r: any) => r.generation_id));

  const recallsTotal = await countTable('vehicle_recalls');

  console.log(`  Brands: ${brands.length} | Models: ${models.length} | Gens: ${totalGens}`);

  const current = {
    specs: totalGens > 0 ? specsGenSet.size / totalGens * 100 : 0,
    photos: totalGens > 0 ? imgGens.size / totalGens * 100 : 0,
    safety: totalGens > 0 ? safetyGens.size / totalGens * 100 : 0,
    dims: totalGens > 0 ? dimGens.size / totalGens * 100 : 0,
    family: totalGens > 0 ? fitGens.size / totalGens * 100 : 0,
    videos: totalGens > 0 ? vidGens.size / totalGens * 100 : 0,
  };

  const score = (
    current.specs * 0.15 +
    current.photos * 0.15 +
    current.safety * 0.25 +
    current.dims * 0.15 +
    current.family * 0.15 +
    current.videos * 0.15
  );

  // Historical
  const h = [
    { label: '12 Feb AM', specs: 22.0, photos: 56.6, safety: 5.1, dims: 83.2, family: 80.3, videos: 28.6 },
    { label: '12 Feb PM', specs: 99.2, photos: 99.9, safety: 46.8, dims: 86.3, family: 82.8, videos: 28.6 },
    { label: '13 Feb AM', specs: 99.2, photos: 99.9, safety: 47.3, dims: 93.5, family: 91.4, videos: 28.6 },
    { label: '13 Feb VB', specs: 99.2, photos: 99.9, safety: 47.3, dims: 93.5, family: 91.4, videos: 81.9 },
  ];

  const calc = (d: any) => d.specs * 0.15 + d.photos * 0.15 + d.safety * 0.25 + d.dims * 0.15 + d.family * 0.15 + d.videos * 0.15;

  // Journey table
  console.log('\n╔' + '═'.repeat(90) + '╗');
  console.log('║  COVERAGE JOURNEY                                                                        ║');
  console.log('╠' + '═'.repeat(90) + '╣');
  console.log('║                  12Feb AM  12Feb PM  13Feb AM  13Feb VB  13Feb DRILL   Δ Total   Weight   ║');
  console.log('╠' + '─'.repeat(90) + '╣');

  const metrics = [
    { label: 'Specs',      key: 'specs',  w: 15 },
    { label: 'Photos',     key: 'photos', w: 15 },
    { label: 'Safety',     key: 'safety', w: 25 },
    { label: 'Dims',       key: 'dims',   w: 15 },
    { label: 'Family Fit', key: 'family', w: 15 },
    { label: 'Videos',     key: 'videos', w: 15 },
  ];

  for (const m of metrics) {
    const vals = h.map(hp => (hp as any)[m.key] as number);
    const now = (current as any)[m.key] as number;
    const delta = now - vals[0];
    const sign = delta >= 0 ? '+' : '';
    console.log(`║  ${m.label.padEnd(12)} ${vals.map(v => (v.toFixed(1) + '%').padStart(7)).join('  ')}  ${(now.toFixed(1) + '%').padStart(7)}   ${sign}${delta.toFixed(1).padStart(5)}    ×${m.w}     ║`);
  }

  const scores = h.map(hp => calc(hp));
  console.log('╠' + '─'.repeat(90) + '╣');
  console.log(`║  SCORE        ${scores.map(s => s.toFixed(1).padStart(6)).join('    ')}    ${score.toFixed(1).padStart(6)}   +${(score - scores[0]).toFixed(1).padStart(5)}             ║`);
  console.log('╚' + '═'.repeat(90) + '╝');

  // Coverage bars
  console.log('\n  ── Current Coverage Bars ──');
  const barMetrics = [
    { label: 'Specs',      covered: specsGenSet.size, total: totalGens },
    { label: 'Photos',     covered: imgGens.size,     total: totalGens },
    { label: 'Safety',     covered: safetyGens.size,  total: totalGens },
    { label: 'Dimensions', covered: dimGens.size,     total: totalGens },
    { label: 'Family Fit', covered: fitGens.size,     total: totalGens },
    { label: 'Videos',     covered: vidGens.size,     total: totalGens },
  ];

  for (const m of barMetrics) {
    console.log(`  ${m.label.padEnd(12)} ${bar(m.covered, m.total)} ${String(m.covered).padStart(5)}/${m.total} (${pct(m.covered, m.total).padStart(6)})`);
  }

  // Safety breakdown
  console.log('\n  ── Safety Rating Sources ──');
  const safetyBySource: Record<string, number> = {};
  const safetyByStars: Record<number, number> = {};
  for (const r of safety) {
    const url = (r as any).source_url || '';
    let source = 'unknown';
    if (url.includes('euroncap')) source = 'euroncap';
    else if (url.includes('nhtsa')) source = 'nhtsa';
    else if (url.includes('nasva') || url.includes('jncap')) source = 'jncap';
    else if (url.includes('iihs')) source = 'iihs';
    else if (url.startsWith('inferred:')) source = url.split(':').slice(0, 2).join(':');
    else if (url.startsWith('propagated_from:')) source = 'propagated_model';
    else if (url.startsWith('propagated_platform:')) source = 'propagated_platform';
    safetyBySource[source] = (safetyBySource[source] || 0) + 1;

    const stars = (r as any).stars;
    safetyByStars[stars] = (safetyByStars[stars] || 0) + 1;
  }
  for (const [src, count] of Object.entries(safetyBySource).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(35)} ${count}`);
  }
  console.log('\n  By stars:');
  for (const stars of [5, 4, 3, 2, 1]) {
    if (safetyByStars[stars]) {
      console.log(`    ${stars}★  ${bar(safetyByStars[stars], safety.length, 20)} ${safetyByStars[stars]}`);
    }
  }

  // Brand coverage
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
  for (const [brand, st] of Object.entries(brandStats).sort((a, b) => b[1].total - a[1].total)) {
    const avg = ((st.specs + st.photos + st.safety + st.dims + st.family + st.videos) / (st.total * 6) * 100);
    console.log(`  ${brand.padEnd(16)} ${String(st.total).padStart(4)}  ${pct(st.specs, st.total).padStart(6)}  ${pct(st.photos, st.total).padStart(6)}  ${pct(st.safety, st.total).padStart(6)}  ${pct(st.dims, st.total).padStart(6)}  ${pct(st.family, st.total).padStart(6)}  ${pct(st.videos, st.total).padStart(6)}  ${avg.toFixed(1).padStart(5)}%`);
  }

  // Score breakdown
  console.log('\n╔' + '═'.repeat(78) + '╗');
  console.log(`║  FINAL SCORE: ${score.toFixed(1)} / 100                                                       ║`);
  console.log(`║                                                                              ║`);
  console.log(`║  Breakdown:                                                                  ║`);
  console.log(`║    Specs     ${current.specs.toFixed(1).padStart(6)}% × 15 = ${(current.specs * 0.15).toFixed(2).padStart(6)} / 15.00                                ║`);
  console.log(`║    Photos    ${current.photos.toFixed(1).padStart(6)}% × 15 = ${(current.photos * 0.15).toFixed(2).padStart(6)} / 15.00                                ║`);
  console.log(`║    Safety    ${current.safety.toFixed(1).padStart(6)}% × 25 = ${(current.safety * 0.25).toFixed(2).padStart(6)} / 25.00                                ║`);
  console.log(`║    Dims      ${current.dims.toFixed(1).padStart(6)}% × 15 = ${(current.dims * 0.15).toFixed(2).padStart(6)} / 15.00                                ║`);
  console.log(`║    Family    ${current.family.toFixed(1).padStart(6)}% × 15 = ${(current.family * 0.15).toFixed(2).padStart(6)} / 15.00                                ║`);
  console.log(`║    Videos    ${current.videos.toFixed(1).padStart(6)}% × 15 = ${(current.videos * 0.15).toFixed(2).padStart(6)} / 15.00                                ║`);
  console.log(`║                                                                              ║`);
  console.log(`║  Journey: ${scores[0].toFixed(1)} → ${scores[1].toFixed(1)} → ${scores[2].toFixed(1)} → ${scores[3].toFixed(1)} → ${score.toFixed(1)}  (+${(score - scores[0]).toFixed(1)})               ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  // Raw counts
  console.log('\n  Raw counts:');
  console.log(`    Images:         ${imgs.length.toLocaleString()}`);
  console.log(`    Videos:         ${vids.length.toLocaleString()}`);
  console.log(`    Safety ratings: ${safety.length.toLocaleString()}`);
  console.log(`    Interior dims:  ${dims.length.toLocaleString()}`);
  console.log(`    Family fit:     ${fits.length.toLocaleString()}`);
  console.log(`    Specs:          ${specsTotal.toLocaleString()}`);
  console.log(`    Recalls:        ${recallsTotal.toLocaleString()}`);

  const report = {
    timestamp: new Date().toISOString(),
    totals: { brands: brands.length, models: models.length, generations: totalGens },
    coverage: {
      specs: { covered: specsGenSet.size, total: totalGens, pct: current.specs },
      photos: { covered: imgGens.size, total: totalGens, pct: current.photos, totalImages: imgs.length },
      safety: { covered: safetyGens.size, total: totalGens, pct: current.safety, bySource: safetyBySource, byStars: safetyByStars },
      dims: { covered: dimGens.size, total: totalGens, pct: current.dims },
      family: { covered: fitGens.size, total: totalGens, pct: current.family },
      videos: { covered: vidGens.size, total: totalGens, pct: current.videos, totalVideos: vids.length },
    },
    score,
    journey: scores.concat(score),
    rawCounts: { images: imgs.length, videos: vids.length, safety: safety.length, dims: dims.length, fits: fits.length, specs: specsTotal, recalls: recallsTotal },
    brandCoverage: brandStats,
  };

  const reportPath = path.join(DATA_DIR, 'final-coverage-v4-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
