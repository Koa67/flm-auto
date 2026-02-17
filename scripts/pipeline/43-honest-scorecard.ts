/**
 * 43-honest-scorecard.ts — THE HONEST SCORECARD
 *
 * Three scores:
 *   VERIFIED (A+B only) — Real data you can trust
 *   TRUSTWORTHY (A+B+C) — Including reasonable propagation
 *   ALL (A+B+C+D)       — Including heuristic inferences (excluding E)
 *
 * Score formula:
 *   (specs×15 + photos×15 + safety×25 + dims×15 + family×15 + videos×15) / 100
 *
 * Videos scored by gen coverage (does gen have ≥1 video at tier?)
 * Photos scored by gen coverage (does gen have ≥1 photo at tier?)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/43-honest-scorecard.ts
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

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

function bar(n: number, total: number, width: number = 30): string {
  if (total === 0) return ' '.repeat(width);
  const filled = Math.round(n / total * width);
  return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
}

type Tier = 'verified' | 'trustworthy' | 'all';

const TIER_CONF: Record<Tier, Set<string>> = {
  verified: new Set(['A', 'B']),
  trustworthy: new Set(['A', 'B', 'C']),
  all: new Set(['A', 'B', 'C', 'D']),
};

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║                                                                              ║');
  console.log('║  FLM AUTO — THE HONEST SCORECARD                                             ║');
  console.log('║  No lies. No inflation. Just facts.                                          ║');
  console.log('║  ' + new Date().toISOString().substring(0, 19) + '                                                       ║');
  console.log('║                                                                              ║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log('\n  Loading data...');

  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const totalGens = gens.length;
  console.log(`  Generations: ${totalGens}`);

  // ── Load all tables with confidence ──
  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url, confidence');
  const dims = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, fuel_tank_liters, confidence');
  const fits = await paginateAll('family_fit_compatibility', 'generation_id, source, confidence');
  const specs = await paginateAll('third_party_specs', 'generation_id');

  // Photos — paginated reads for confidence grouping
  console.log('  Loading photos...');
  const photoGensByConf = new Map<string, Set<string>>();
  for (const conf of ['A', 'B', 'C', 'D', 'E']) photoGensByConf.set(conf, new Set());
  let totalPhotos = 0;
  let photoPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_images')
      .select('generation_id, confidence')
      .range(photoPage * 1000, (photoPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      totalPhotos++;
      const conf = row.confidence || 'D';
      photoGensByConf.get(conf)?.add(row.generation_id);
    }
    if (data.length < 1000) break;
    photoPage++;
  }

  // Videos — paginated reads
  console.log('  Loading videos...');
  const videoGensByConf = new Map<string, Set<string>>();
  for (const conf of ['A', 'B', 'C', 'D', 'E']) videoGensByConf.set(conf, new Set());
  let totalVideos = 0;
  let videoPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_videos')
      .select('generation_id, confidence')
      .range(videoPage * 1000, (videoPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      totalVideos++;
      const conf = row.confidence || 'D';
      videoGensByConf.get(conf)?.add(row.generation_id);
    }
    if (data.length < 1000) break;
    videoPage++;
  }

  console.log(`  Data loaded.`);

  // ── Build gen coverage sets per confidence tier ──
  function genSetForTier(rows: any[], tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const gSet = new Set<string>();
    for (const row of rows) {
      if (confSet.has(row.confidence || 'D')) {
        gSet.add(row.generation_id);
      }
    }
    return gSet;
  }

  function photoGenSetForTier(tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const result = new Set<string>();
    for (const [conf, genSet] of Array.from(photoGensByConf.entries())) {
      if (confSet.has(conf)) {
        for (const gid of genSet) result.add(gid);
      }
    }
    return result;
  }

  function videoGenSetForTier(tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const result = new Set<string>();
    for (const [conf, genSet] of Array.from(videoGensByConf.entries())) {
      if (confSet.has(conf)) {
        for (const gid of genSet) result.add(gid);
      }
    }
    return result;
  }

  // Specs have no confidence column — always count as A
  const specsGenSet = new Set(specs.map((r: any) => r.generation_id));

  const tiers: Tier[] = ['verified', 'trustworthy', 'all'];
  const results: Record<Tier, {
    specs: number; photos: number; safety: number;
    dims: number; family: number; videos: number;
    score: number;
  }> = {} as any;

  for (const tier of tiers) {
    const safetySet = genSetForTier(safety, tier);
    const dimsSet = genSetForTier(dims, tier);
    const fitSet = genSetForTier(fits, tier);
    const photoSet = photoGenSetForTier(tier);
    const videoSet = videoGenSetForTier(tier);

    const specsPct = totalGens > 0 ? specsGenSet.size / totalGens * 100 : 0;
    const photosPct = totalGens > 0 ? photoSet.size / totalGens * 100 : 0;
    const safetyPct = totalGens > 0 ? safetySet.size / totalGens * 100 : 0;
    const dimsPct = totalGens > 0 ? dimsSet.size / totalGens * 100 : 0;
    const familyPct = totalGens > 0 ? fitSet.size / totalGens * 100 : 0;
    const videosPct = totalGens > 0 ? videoSet.size / totalGens * 100 : 0;

    const score = specsPct * 0.15 + photosPct * 0.15 + safetyPct * 0.25 +
                  dimsPct * 0.15 + familyPct * 0.15 + videosPct * 0.15;

    results[tier] = {
      specs: specsPct, photos: photosPct, safety: safetyPct,
      dims: dimsPct, family: familyPct, videos: videosPct, score,
    };
  }

  // ── DISPLAY ──
  console.log('\n');
  console.log('╔' + '═'.repeat(90) + '╗');
  console.log('║  THE THREE SCORES                                                                        ║');
  console.log('╠' + '═'.repeat(90) + '╣');
  console.log('║                     VERIFIED (A+B)    TRUSTWORTHY (A-C)    ALL (A-D)         Weight       ║');
  console.log('╠' + '─'.repeat(90) + '╣');

  const metrics = [
    { label: 'Specs', key: 'specs', w: 15 },
    { label: 'Photos', key: 'photos', w: 15 },
    { label: 'Safety', key: 'safety', w: 25 },
    { label: 'Dims', key: 'dims', w: 15 },
    { label: 'Family Fit', key: 'family', w: 15 },
    { label: 'Videos', key: 'videos', w: 15 },
  ];

  for (const m of metrics) {
    const v = (results.verified as any)[m.key] as number;
    const t = (results.trustworthy as any)[m.key] as number;
    const a = (results.all as any)[m.key] as number;
    console.log(`║  ${m.label.padEnd(14)} ${(v.toFixed(1) + '%').padStart(8)}            ${(t.toFixed(1) + '%').padStart(8)}            ${(a.toFixed(1) + '%').padStart(8)}            ×${m.w}       ║`);
  }

  console.log('╠' + '═'.repeat(90) + '╣');
  console.log(`║  SCORE         ${results.verified.score.toFixed(1).padStart(7)} / 100     ${results.trustworthy.score.toFixed(1).padStart(7)} / 100     ${results.all.score.toFixed(1).padStart(7)} / 100                      ║`);
  console.log('╚' + '═'.repeat(90) + '╝');

  // ── Detailed confidence breakdown ──
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('  CONFIDENCE BREAKDOWN BY TABLE');
  console.log('═'.repeat(80));

  // Safety
  const safetyConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const s of safety) safetyConf[s.confidence || 'D']++;
  console.log('\n  Safety Ratings:');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const count = safetyConf[c] || 0;
    const genSet = genSetForTier(safety.filter((s: any) => s.confidence === c), 'all');
    console.log(`    ${c}: ${bar(count, safety.length, 25)} ${String(count).padStart(5)} (${pct(count, safety.length).padStart(6)}) → ${genSet.size} gens`);
  }

  // Dims
  const dimsConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const d of dims) dimsConf[d.confidence || 'D']++;
  console.log('\n  Interior Dimensions:');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const count = dimsConf[c] || 0;
    console.log(`    ${c}: ${bar(count, dims.length, 25)} ${String(count).padStart(5)} (${pct(count, dims.length).padStart(6)})`);
  }

  // Family fit
  const fitConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const f of fits) fitConf[f.confidence || 'D']++;
  console.log('\n  Family Fit:');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const count = fitConf[c] || 0;
    console.log(`    ${c}: ${bar(count, fits.length, 25)} ${String(count).padStart(5)} (${pct(count, fits.length).padStart(6)})`);
  }

  // Videos
  const videoConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const [conf, genSet] of Array.from(videoGensByConf.entries())) {
    videoConf[conf] = genSet.size;
  }
  console.log('\n  Videos (gens covered):');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const count = videoConf[c] || 0;
    console.log(`    ${c}: ${bar(count, totalGens, 25)} ${String(count).padStart(5)} (${pct(count, totalGens).padStart(6)})`);
  }

  // Photos
  const photoConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const [conf, genSet] of Array.from(photoGensByConf.entries())) {
    photoConf[conf] = genSet.size;
  }
  console.log('\n  Photos (gens covered):');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const count = photoConf[c] || 0;
    console.log(`    ${c}: ${bar(count, totalGens, 25)} ${String(count).padStart(5)} (${pct(count, totalGens).padStart(6)})`);
  }

  // ── Safety source x confidence ──
  console.log('\n  ── Safety: Source × Confidence ──');
  const safetySourceConf: Record<string, Record<string, number>> = {};
  for (const s of safety) {
    const url = s.source_url || '';
    let src = 'unknown';
    if (url.includes('euroncap')) src = 'euroncap';
    else if (url.includes('nhtsa')) src = 'nhtsa';
    else if (url.includes('iihs')) src = 'iihs';
    else if (url.includes('jncap') || url.includes('nasva')) src = 'jncap';
    else if (url.startsWith('propagated_from:')) src = 'propagated_from';
    else if (url.startsWith('propagated_platform:')) src = 'propagated_platform';
    else if (url.startsWith('inferred:')) src = url.split(':').slice(0, 2).join(':');
    if (!safetySourceConf[src]) safetySourceConf[src] = {};
    const conf = s.confidence || 'D';
    safetySourceConf[src][conf] = (safetySourceConf[src][conf] || 0) + 1;
  }

  console.log('  ' + 'Source'.padEnd(35) + 'A      B      C      D      E');
  for (const [src, confs] of Object.entries(safetySourceConf).sort((a, b) => {
    const totA = Object.values(a[1]).reduce((x, y) => x + y, 0);
    const totB = Object.values(b[1]).reduce((x, y) => x + y, 0);
    return totB - totA;
  })) {
    const vals = ['A', 'B', 'C', 'D', 'E'].map(c => String(confs[c] || 0).padStart(5));
    console.log(`  ${src.padEnd(35)} ${vals.join('  ')}`);
  }

  // ── Journey comparison ──
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  JOURNEY: INFLATED vs HONEST                                                 ║');
  console.log('╠' + '═'.repeat(78) + '╣');

  const inflated = {
    specs: 99.2, photos: 99.9, safety: 85.6,
    dims: 98.1, family: 96.0, videos: 100.0,
    score: 95.4,
  };

  console.log('║                     Inflated    Verified    Trustworthy    ALL (no E)         ║');
  console.log('╠' + '─'.repeat(78) + '╣');
  for (const m of metrics) {
    const inf = (inflated as any)[m.key] as number;
    const v = (results.verified as any)[m.key] as number;
    const t = (results.trustworthy as any)[m.key] as number;
    const a = (results.all as any)[m.key] as number;
    const drop = (a - inf);
    console.log(`║  ${m.label.padEnd(14)} ${(inf.toFixed(1) + '%').padStart(7)}     ${(v.toFixed(1) + '%').padStart(7)}      ${(t.toFixed(1) + '%').padStart(7)}        ${(a.toFixed(1) + '%').padStart(7)}    (${drop >= 0 ? '+' : ''}${drop.toFixed(1)})    ║`);
  }
  console.log('╠' + '═'.repeat(78) + '╣');
  console.log(`║  SCORE       ${inflated.score.toFixed(1).padStart(6)}     ${results.verified.score.toFixed(1).padStart(6)}       ${results.trustworthy.score.toFixed(1).padStart(6)}         ${results.all.score.toFixed(1).padStart(6)}    (${(results.all.score - inflated.score) >= 0 ? '+' : ''}${(results.all.score - inflated.score).toFixed(1)})    ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  // ── Raw counts ──
  console.log('\n  Raw counts:');
  console.log(`    Total generations:  ${totalGens.toLocaleString()}`);
  console.log(`    Total images:       ${totalPhotos.toLocaleString()}`);
  console.log(`    Total videos:       ${totalVideos.toLocaleString()}`);
  console.log(`    Safety ratings:     ${safety.length.toLocaleString()}`);
  console.log(`    Interior dims:      ${dims.length.toLocaleString()}`);
  console.log(`    Family fit:         ${fits.length.toLocaleString()}`);
  console.log(`    Specs:              ${specsGenSet.size.toLocaleString()} gens covered`);

  // ── Brand breakdown (verified tier) ──
  console.log('\n  ── Brand Coverage (Verified A+B) ──');
  const brandStats: Record<string, { total: number; specs: number; photos: number; safety: number; dims: number; family: number; videos: number }> = {};

  const safetyVerified = genSetForTier(safety, 'verified');
  const dimsVerified = genSetForTier(dims, 'verified');
  const fitVerified = genSetForTier(fits, 'verified');
  const photoVerified = photoGenSetForTier('verified');
  const videoVerified = videoGenSetForTier('verified');

  for (const g of gens) {
    const bn = (g as any).model?.brand?.name || 'unknown';
    if (!brandStats[bn]) brandStats[bn] = { total: 0, specs: 0, photos: 0, safety: 0, dims: 0, family: 0, videos: 0 };
    brandStats[bn].total++;
    if (specsGenSet.has(g.id)) brandStats[bn].specs++;
    if (photoVerified.has(g.id)) brandStats[bn].photos++;
    if (safetyVerified.has(g.id)) brandStats[bn].safety++;
    if (dimsVerified.has(g.id)) brandStats[bn].dims++;
    if (fitVerified.has(g.id)) brandStats[bn].family++;
    if (videoVerified.has(g.id)) brandStats[bn].videos++;
  }

  console.log('  ' + 'Brand'.padEnd(16) + 'Gens'.padStart(5) + '  Specs   Photos  Safety   Dims   Family  Videos   AVG');
  for (const [brand, st] of Object.entries(brandStats).sort((a, b) => b[1].total - a[1].total)) {
    const avg = ((st.specs + st.photos + st.safety + st.dims + st.family + st.videos) / (st.total * 6) * 100);
    console.log(`  ${brand.padEnd(16)} ${String(st.total).padStart(4)}  ${pct(st.specs, st.total).padStart(6)}  ${pct(st.photos, st.total).padStart(6)}  ${pct(st.safety, st.total).padStart(6)}  ${pct(st.dims, st.total).padStart(6)}  ${pct(st.family, st.total).padStart(6)}  ${pct(st.videos, st.total).padStart(6)}  ${avg.toFixed(1).padStart(5)}%`);
  }

  // ── Final verdict ──
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║                                                                              ║');
  console.log(`║  VERDICT                                                                     ║`);
  console.log('║                                                                              ║');
  console.log(`║  VERIFIED SCORE:     ${results.verified.score.toFixed(1).padStart(5)} / 100  (A+B only — data you can cite)         ║`);
  console.log(`║  TRUSTWORTHY SCORE:  ${results.trustworthy.score.toFixed(1).padStart(5)} / 100  (A+B+C — reasonable for display)     ║`);
  console.log(`║  ALL SCORE:          ${results.all.score.toFixed(1).padStart(5)} / 100  (A-D — everything except E)          ║`);
  console.log(`║  INFLATED SCORE:      95.4 / 100  (the lie we told before)                ║`);
  console.log('║                                                                              ║');
  console.log(`║  Reality check: We went from 95.4 → ${results.verified.score.toFixed(1)} verified.                        ║`);
  console.log(`║  That's what honest accounting looks like.                                    ║`);
  console.log('║                                                                              ║');
  console.log('╚' + '═'.repeat(78) + '╝');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalGens,
    scores: results,
    inflated: inflated.score,
    confidence: {
      safety: safetyConf,
      dims: dimsConf,
      family: fitConf,
      videos: videoConf,
      photos: photoConf,
    },
    rawCounts: {
      photos: totalPhotos,
      videos: totalVideos,
      safety: safety.length,
      dims: dims.length,
      fits: fits.length,
    },
  };

  const reportPath = path.join(DATA_DIR, 'honest-scorecard-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
