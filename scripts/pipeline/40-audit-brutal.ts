/**
 * 40-audit-brutal.ts — Brutally honest data quality audit
 *
 * READ-ONLY. Modifies NOTHING. Just counts and displays facts.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/40-audit-brutal.ts
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

async function paginateAll(table: string, select: string, filter?: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function countTable(table: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
  return count || 0;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

function bar(n: number, total: number, w: number = 25): string {
  const f = Math.round(n / total * w);
  return '█'.repeat(Math.min(f, w)) + '░'.repeat(Math.max(w - f, 0));
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(72) + '╗');
  console.log('║  40-AUDIT-BRUTAL — THE TRUTH                                           ║');
  console.log('║  READ-ONLY. This script modifies NOTHING.                               ║');
  console.log('║  ' + new Date().toISOString().substring(0, 19) + '                                                    ║');
  console.log('╚' + '═'.repeat(72) + '╝');

  // ═══════════════════════════════════════════════════════
  // LOAD ALL DATA
  // ═══════════════════════════════════════════════════════
  console.log('\n  Loading ALL data...');
  const gens = await paginateAll('generations', 'id, name, production_start, production_end, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const safety = await paginateAll('safety_ratings', 'id, generation_id, stars, source_url');
  const videos = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, title, published_at, view_count');
  const images = await paginateAll('vehicle_images', 'id, generation_id, width, height, source');
  const dims = await paginateAll('interior_dimensions', 'id, generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, rear_bench_width_total_mm, rear_shoulder_room_mm');
  const fits = await paginateAll('family_fit_compatibility', 'id, generation_id, source, three_across_possible, rear_bench_width_usable_mm, isofix_points');
  const specsTotal = await countTable('third_party_specs');
  const specsGens = await paginateAll('third_party_specs', 'generation_id');

  const totalGens = gens.length;
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);

  // Gen lookup
  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);

  console.log(`  Gens: ${totalGens} | Brands: ${brands.length} | Models: ${models.length}`);

  // ═══════════════════════════════════════════════════════
  // 1A. SAFETY — Source breakdown
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1A. SAFETY — Source breakdown');
  console.log('═'.repeat(72));

  const safetyBySource: Record<string, { count: number; stars: Record<number, number> }> = {};
  const safetyByGenId = new Map<string, any>();

  for (const s of safety) {
    safetyByGenId.set(s.generation_id, s);
    const url = s.source_url || '';
    let src = 'unknown';
    if (url.startsWith('https://www.euroncap') || url.includes('euroncap.com')) src = 'euroncap';
    else if (url.includes('nhtsa')) src = 'nhtsa';
    else if (url.startsWith('iihs:')) src = 'iihs';
    else if (url.includes('nasva') || url.includes('jncap')) src = 'jncap';
    else if (url.startsWith('propagated_from:')) src = 'propagated_from';
    else if (url.startsWith('propagated_platform:')) src = 'propagated_platform';
    else if (url.startsWith('inferred:premium_post2020')) src = 'inferred:premium_post2020_5star';
    else if (url.startsWith('inferred:premium_post2018')) src = 'inferred:premium_post2018';
    else if (url.startsWith('inferred:premium_post2012')) src = 'inferred:premium_post2012';
    else if (url.startsWith('inferred:premium_post2005')) src = 'inferred:premium_post2005';
    else if (url.startsWith('inferred:premium_pre2005')) src = 'inferred:premium_pre2005';
    else if (url.startsWith('inferred:mainstream_post2020')) src = 'inferred:mainstream_post2020';
    else if (url.startsWith('inferred:mainstream_post2015')) src = 'inferred:mainstream_post2015';
    else if (url.startsWith('inferred:mainstream_post2010')) src = 'inferred:mainstream_post2010';
    else if (url.startsWith('inferred:mainstream_pre2010')) src = 'inferred:mainstream_pre2010';
    else if (url.startsWith('inferred:secondary')) src = 'inferred:secondary';
    else if (url.startsWith('inferred:old_known_brand')) src = 'inferred:old_known_brand';
    else if (url.startsWith('inferred:niche')) src = 'inferred:niche';
    else if (url.startsWith('inferred:model_sibling')) src = 'inferred:model_sibling_median';
    else if (url.startsWith('inferred:')) src = 'inferred:other';

    if (!safetyBySource[src]) safetyBySource[src] = { count: 0, stars: {} };
    safetyBySource[src].count++;
    safetyBySource[src].stars[s.stars] = (safetyBySource[src].stars[s.stars] || 0) + 1;
  }

  // Categorize
  const VERIFIED_SOURCES = new Set(['euroncap', 'nhtsa', 'iihs', 'jncap']);
  const PROPAGATED_SOURCES = new Set(['propagated_from', 'propagated_platform']);

  let verifiedCount = 0, propagatedCount = 0, inferredCount = 0;

  console.log(`\n  Total safety ratings: ${safety.length}`);
  console.log(`  Unique gens with safety: ${safetyByGenId.size} / ${totalGens} (${pct(safetyByGenId.size, totalGens)})`);
  console.log(`  Gens WITHOUT safety: ${totalGens - safetyByGenId.size}`);

  console.log('\n  Source                              Count    1★    2★    3★    4★    5★');
  console.log('  ' + '─'.repeat(70));
  for (const [src, data] of Object.entries(safetyBySource).sort((a, b) => b[1].count - a[1].count)) {
    const isVerified = VERIFIED_SOURCES.has(src);
    const isPropagated = PROPAGATED_SOURCES.has(src);
    if (isVerified) verifiedCount += data.count;
    else if (isPropagated) propagatedCount += data.count;
    else inferredCount += data.count;

    const tag = isVerified ? ' ✓' : isPropagated ? ' →' : ' ⚡';
    const stars = [1, 2, 3, 4, 5].map(s => String(data.stars[s] || 0).padStart(5)).join(' ');
    console.log(`  ${(src + tag).padEnd(38)} ${String(data.count).padStart(5)}  ${stars}`);
  }

  console.log('\n  ── Summary ──');
  console.log(`  ✓ VERIFIED (EuroNCAP/NHTSA/IIHS/JNCAP):  ${verifiedCount} (${pct(verifiedCount, safety.length)} of ratings, ${pct(verifiedCount, totalGens)} of gens)`);
  console.log(`  → PROPAGATED (from verified):             ${propagatedCount} (${pct(propagatedCount, safety.length)})`);
  console.log(`  ⚡ INFERRED (heuristic):                   ${inferredCount} (${pct(inferredCount, safety.length)})`);

  // ═══════════════════════════════════════════════════════
  // 1B. SAFETY — Propagation chain depth
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1B. SAFETY — Propagation chain depth');
  console.log('═'.repeat(72));

  // Build a map: genId → source_url
  const safetySourceByGen = new Map<string, string>();
  for (const s of safety) safetySourceByGen.set(s.generation_id, s.source_url || '');

  function getDepth(genId: string, visited: Set<string> = new Set()): number {
    if (visited.has(genId)) return 99; // circular
    visited.add(genId);
    const src = safetySourceByGen.get(genId) || '';
    if (!src) return -1;

    // Verified sources
    if (src.startsWith('https://') || src.startsWith('iihs:') || src.includes('nhtsa') || src.includes('nasva') || src.includes('jncap')) return 0;
    // Inferred
    if (src.startsWith('inferred:')) return -2; // separate category

    // Propagated
    const match = src.match(/^propagated_(?:from|platform):(.+)$/);
    if (match) {
      const sourceGenId = match[1];
      const sourceDepth = getDepth(sourceGenId, visited);
      if (sourceDepth === -2) return -2; // propagated from inferred
      if (sourceDepth >= 0) return sourceDepth + 1;
      return 99; // broken chain
    }
    return -1;
  }

  const depthCounts: Record<number, number> = {};
  const inferredAsDepth: number[] = [];
  for (const s of safety) {
    const d = getDepth(s.generation_id);
    if (d === -2) {
      depthCounts[-2] = (depthCounts[-2] || 0) + 1;
    } else if (d >= 0) {
      depthCounts[d] = (depthCounts[d] || 0) + 1;
    } else {
      depthCounts[-1] = (depthCounts[-1] || 0) + 1;
    }
  }

  console.log('\n  Depth     Count   Description');
  console.log('  ' + '─'.repeat(60));
  console.log(`  Depth 0:  ${String(depthCounts[0] || 0).padStart(5)}   Verified (EuroNCAP/NHTSA/IIHS/JNCAP)`);
  console.log(`  Depth 1:  ${String(depthCounts[1] || 0).padStart(5)}   Propagated from verified`);
  console.log(`  Depth 2:  ${String(depthCounts[2] || 0).padStart(5)}   Copy of copy (propagated from propagated)`);
  console.log(`  Depth 3+: ${String(Object.entries(depthCounts).filter(([k]) => Number(k) >= 3 && Number(k) < 99).reduce((s, [, v]) => s + v, 0)).padStart(5)}   Telephone game (3+ hops)`);
  console.log(`  Inferred: ${String(depthCounts[-2] || 0).padStart(5)}   No source data at all (heuristic)`);
  console.log(`  Broken:   ${String((depthCounts[-1] || 0) + (depthCounts[99] || 0)).padStart(5)}   Broken chain / unknown`);

  // ═══════════════════════════════════════════════════════
  // 1C. SAFETY — Counter-examples for inferences
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1C. SAFETY — Counter-examples (inference validation)');
  console.log('═'.repeat(72));

  // Find verified ratings for premium post-2018 with < 4★
  const premiumBrands = new Set(['BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Lexus', 'Porsche', 'Land Rover', 'Jaguar', 'Tesla']);
  const mainstreamBrands = new Set(['Toyota', 'Honda', 'Hyundai', 'Kia', 'Volkswagen', 'Mazda', 'Nissan', 'Ford', 'Skoda', 'Renault', 'Peugeot']);

  const counterPremium: string[] = [];
  const counterMainstream: string[] = [];

  for (const s of safety) {
    const src = s.source_url || '';
    const isVerified = src.startsWith('https://') || src.startsWith('iihs:') || src.includes('nhtsa') || src.includes('nasva');
    if (!isVerified) continue;

    const gen = genById.get(s.generation_id);
    if (!gen) continue;
    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;
    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (!prodYear) continue;

    if (premiumBrands.has(brand.name) && prodYear >= 2018 && s.stars < 4) {
      counterPremium.push(`  ${brand.name} ${model.name} ${gen.name} (${prodYear}) = ${s.stars}★ [${src.substring(0, 40)}]`);
    }
    if (mainstreamBrands.has(brand.name) && prodYear >= 2020 && s.stars < 4) {
      counterMainstream.push(`  ${brand.name} ${model.name} ${gen.name} (${prodYear}) = ${s.stars}★ [${src.substring(0, 40)}]`);
    }
  }

  console.log(`\n  Premium brands post-2018 with VERIFIED < 4★: ${counterPremium.length}`);
  for (const c of counterPremium.slice(0, 15)) console.log(`    ${c}`);
  if (counterPremium.length > 15) console.log(`    ... +${counterPremium.length - 15} more`);

  console.log(`\n  Mainstream brands post-2020 with VERIFIED < 4★: ${counterMainstream.length}`);
  for (const c of counterMainstream.slice(0, 15)) console.log(`    ${c}`);
  if (counterMainstream.length > 15) console.log(`    ... +${counterMainstream.length - 15} more`);

  if (counterPremium.length === 0 && counterMainstream.length === 0) {
    console.log('  → No counter-examples found. Inferences are consistent with verified data.');
  }

  // ═══════════════════════════════════════════════════════
  // 1D. VIDEOS — Duplication & relevance
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1D. VIDEOS — Duplication & relevance analysis');
  console.log('═'.repeat(72));

  const totalVideoRows = videos.length;
  const uniqueVideoIds = new Set(videos.map((v: any) => v.video_id));
  const dupeRatio = totalVideoRows / uniqueVideoIds.size;

  console.log(`\n  Total video rows:     ${totalVideoRows.toLocaleString()}`);
  console.log(`  Unique video_ids:     ${uniqueVideoIds.size.toLocaleString()}`);
  console.log(`  Duplication ratio:    ${dupeRatio.toFixed(1)}:1`);

  // Year gap analysis
  let gapLt2 = 0, gap2to5 = 0, gap5to10 = 0, gap10plus = 0, noGapInfo = 0;
  const genVideoRelevance = new Map<string, { native: number; close: number; far: number; absurd: number }>();

  for (const v of videos) {
    const gen = genById.get(v.generation_id);
    if (!gen || !gen.production_start || !v.published_at) { noGapInfo++; continue; }

    const prodYear = new Date(gen.production_start).getFullYear();
    const vidYear = new Date(v.published_at).getFullYear();
    const gap = Math.abs(vidYear - prodYear);

    if (gap <= 2) gapLt2++;
    else if (gap <= 5) gap2to5++;
    else if (gap <= 10) gap5to10++;
    else gap10plus++;

    if (!genVideoRelevance.has(v.generation_id)) {
      genVideoRelevance.set(v.generation_id, { native: 0, close: 0, far: 0, absurd: 0 });
    }
    const r = genVideoRelevance.get(v.generation_id)!;
    if (gap <= 2) r.native++;
    else if (gap <= 5) r.close++;
    else if (gap <= 10) r.far++;
    else r.absurd++;
  }

  console.log('\n  Year gap distribution (|published_year - production_year|):');
  console.log(`    ≤2 years (relevant):   ${gapLt2.toLocaleString()} (${pct(gapLt2, totalVideoRows)})`);
  console.log(`    3-5 years (ok):        ${gap2to5.toLocaleString()} (${pct(gap2to5, totalVideoRows)})`);
  console.log(`    6-10 years (stretch):  ${gap5to10.toLocaleString()} (${pct(gap5to10, totalVideoRows)})`);
  console.log(`    >10 years (ABSURD):    ${gap10plus.toLocaleString()} (${pct(gap10plus, totalVideoRows)})`);
  console.log(`    No date info:          ${noGapInfo.toLocaleString()} (${pct(noGapInfo, totalVideoRows)})`);

  // Gens with ONLY absurd videos
  const vidGens = new Set(videos.map((v: any) => v.generation_id));
  let gensOnlyAbsurd = 0, gensOnlyFar = 0;
  for (const [genId, r] of Array.from(genVideoRelevance.entries())) {
    if (r.native === 0 && r.close === 0 && r.far === 0 && r.absurd > 0) gensOnlyAbsurd++;
    if (r.native === 0 && r.close === 0 && r.absurd > 0) gensOnlyFar++;
  }

  console.log(`\n  Gens with ONLY >10yr gap videos:   ${gensOnlyAbsurd}`);
  console.log(`  Gens with ONLY >5yr gap videos:    ${gensOnlyFar}`);
  console.log(`  Gens with at least 1 ≤2yr video:   ${Array.from(genVideoRelevance.values()).filter(r => r.native > 0).length}`);

  // ═══════════════════════════════════════════════════════
  // 1E. PHOTOS — Quality analysis
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1E. PHOTOS — Quality & resolution analysis');
  console.log('═'.repeat(72));

  const imgGens = new Set(images.map((i: any) => i.generation_id));
  let hdPlus = 0, hd = 0, medium = 0, low = 0, noRes = 0;
  const imgBySource: Record<string, number> = {};

  for (const img of images) {
    const w = img.width;
    if (!w) noRes++;
    else if (w >= 1920) hdPlus++;
    else if (w >= 1280) hd++;
    else if (w >= 800) medium++;
    else low++;

    const src = img.source || 'unknown';
    imgBySource[src] = (imgBySource[src] || 0) + 1;
  }

  console.log(`\n  Total images:     ${images.length.toLocaleString()}`);
  console.log(`  Gens with photos: ${imgGens.size} / ${totalGens} (${pct(imgGens.size, totalGens)})`);
  console.log('\n  Resolution:');
  console.log(`    FHD+ (≥1920px):   ${hdPlus.toLocaleString()} (${pct(hdPlus, images.length)})`);
  console.log(`    HD (1280-1919):   ${hd.toLocaleString()} (${pct(hd, images.length)})`);
  console.log(`    Medium (800-1279): ${medium.toLocaleString()} (${pct(medium, images.length)})`);
  console.log(`    Low (<800px):     ${low.toLocaleString()} (${pct(low, images.length)})`);
  console.log(`    Unknown res:      ${noRes.toLocaleString()} (${pct(noRes, images.length)})`);

  console.log('\n  By source:');
  for (const [src, count] of Object.entries(imgBySource).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${src.padEnd(30)} ${count.toLocaleString().padStart(8)} (${pct(count, images.length)})`);
  }

  // Photos per gen distribution
  const photosPerGen = new Map<string, number>();
  for (const img of images) {
    photosPerGen.set(img.generation_id, (photosPerGen.get(img.generation_id) || 0) + 1);
  }
  const photoCounts = Array.from(photosPerGen.values()).sort((a, b) => a - b);
  const gen1Photo = photoCounts.filter(c => c === 1).length;
  const genLt5Photo = photoCounts.filter(c => c < 5).length;

  console.log(`\n  Gens with exactly 1 photo:  ${gen1Photo}`);
  console.log(`  Gens with <5 photos:        ${genLt5Photo}`);
  console.log(`  Median photos/gen:          ${photoCounts[Math.floor(photoCounts.length / 2)]}`);

  // ═══════════════════════════════════════════════════════
  // 1F. DIMENSIONS — What's real vs estimated
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1F. DIMENSIONS — Real vs estimated');
  console.log('═'.repeat(72));

  const dimGens = new Set(dims.map((d: any) => d.generation_id));
  console.log(`\n  Total dim rows:    ${dims.length}`);
  console.log(`  Gens with dims:    ${dimGens.size} / ${totalGens} (${pct(dimGens.size, totalGens)})`);

  // interior_dimensions has NO source column — check what fields are populated
  let withHeadroom = 0, withLegroom = 0, withTrunk = 0, withBench = 0, withShoulder = 0;
  let withAnyReal = 0;

  for (const d of dims) {
    const hasH = d.front_headroom_mm || d.rear_headroom_mm;
    const hasL = d.front_legroom_mm || d.rear_legroom_mm;
    const hasT = d.trunk_volume_liters;
    const hasB = d.rear_bench_width_total_mm;
    const hasS = d.rear_shoulder_room_mm;
    if (hasH) withHeadroom++;
    if (hasL) withLegroom++;
    if (hasT) withTrunk++;
    if (hasB) withBench++;
    if (hasS) withShoulder++;
    if (hasH || hasL || hasT) withAnyReal++;
  }

  console.log('\n  Field completeness (of dims rows):');
  console.log(`    Headroom:     ${withHeadroom}/${dims.length} (${pct(withHeadroom, dims.length)})`);
  console.log(`    Legroom:      ${withLegroom}/${dims.length} (${pct(withLegroom, dims.length)})`);
  console.log(`    Trunk volume: ${withTrunk}/${dims.length} (${pct(withTrunk, dims.length)})`);
  console.log(`    Bench width:  ${withBench}/${dims.length} (${pct(withBench, dims.length)})`);
  console.log(`    Shoulder room: ${withShoulder}/${dims.length} (${pct(withShoulder, dims.length)})`);
  console.log(`    Has ≥1 real field: ${withAnyReal}/${dims.length} (${pct(withAnyReal, dims.length)})`);

  // NOTE: interior_dimensions has no 'source' column.
  // We can't distinguish estimated vs real from the table itself.
  // The estimation came from script 36 which derived from exterior specs.
  // But those rows are NOT marked. This is a data lineage gap.
  console.log('\n  ⚠ interior_dimensions has NO source column.');
  console.log('    Cannot distinguish real measurements from estimates.');
  console.log('    Rows from script 36 (estimated from exterior) are unmarked.');

  // ═══════════════════════════════════════════════════════
  // 1G. FAMILY FIT — Source breakdown
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1G. FAMILY FIT — Source breakdown');
  console.log('═'.repeat(72));

  const fitGens = new Set(fits.map((f: any) => f.generation_id));
  const fitBySource: Record<string, number> = {};
  let threeAcrossTrue = 0, threeAcrossFalse = 0, threeAcrossNull = 0;
  let isofixDefault = 0, isofixReal = 0, isofixNull = 0;

  for (const f of fits) {
    const src = f.source || 'unknown';
    fitBySource[src] = (fitBySource[src] || 0) + 1;

    if (f.three_across_possible === true) threeAcrossTrue++;
    else if (f.three_across_possible === false) threeAcrossFalse++;
    else threeAcrossNull++;

    if (f.isofix_points === 2) isofixDefault++;
    else if (f.isofix_points !== null && f.isofix_points !== undefined) isofixReal++;
    else isofixNull++;
  }

  console.log(`\n  Total fit rows:  ${fits.length}`);
  console.log(`  Gens with fit:   ${fitGens.size} / ${totalGens} (${pct(fitGens.size, totalGens)})`);

  console.log('\n  By source:');
  for (const [src, count] of Object.entries(fitBySource).sort((a, b) => b[1] - a[1])) {
    const tag = src.includes('propagat') ? ' →' : src.includes('derived') ? ' ⚡' : src.includes('enriched') ? ' +' : ' ✓';
    console.log(`    ${(src + tag).padEnd(35)} ${count} (${pct(count, fits.length)})`);
  }

  console.log(`\n  Three-across data:`);
  console.log(`    possible=true:   ${threeAcrossTrue} (${pct(threeAcrossTrue, fits.length)})`);
  console.log(`    possible=false:  ${threeAcrossFalse} (${pct(threeAcrossFalse, fits.length)})`);
  console.log(`    NULL:            ${threeAcrossNull} (${pct(threeAcrossNull, fits.length)})`);

  console.log(`\n  ISOFIX data:`);
  console.log(`    isofix_points=2 (default):  ${isofixDefault} (${pct(isofixDefault, fits.length)})`);
  console.log(`    isofix_points other:        ${isofixReal} (${pct(isofixReal, fits.length)})`);
  console.log(`    isofix_points NULL:         ${isofixNull} (${pct(isofixNull, fits.length)})`);

  // Fits derived from estimated dims
  const fitFromDerived = fits.filter((f: any) => {
    const src = f.source || '';
    return src.includes('derived_from_dims') || src.includes('propagated');
  });
  console.log(`\n  ⚠ Family fit rows from derived/propagated sources: ${fitFromDerived.length} (${pct(fitFromDerived.length, fits.length)})`);
  const threeAcrossFromDerived = fitFromDerived.filter((f: any) => f.three_across_possible === true).length;
  console.log(`  ⚠ three_across=true from derived/propagated: ${threeAcrossFromDerived}`);

  // ═══════════════════════════════════════════════════════
  // 1H. SPECS — quick check
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  1H. SPECS — overview');
  console.log('═'.repeat(72));

  const specsGenSet = new Set(specsGens.map((s: any) => s.generation_id));
  console.log(`\n  Total spec rows:   ${specsTotal.toLocaleString()}`);
  console.log(`  Gens with specs:   ${specsGenSet.size} / ${totalGens} (${pct(specsGenSet.size, totalGens)})`);

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(72));
  console.log('  SUMMARY — THE HONEST TRUTH');
  console.log('═'.repeat(72));

  const safetyVerifiedGens = new Set<string>();
  const safetyPropagatedGens = new Set<string>();
  const safetyInferredGens = new Set<string>();
  for (const s of safety) {
    const src = s.source_url || '';
    if (src.startsWith('https://') || src.startsWith('iihs:') || src.includes('nhtsa') || src.includes('nasva') || src.includes('jncap')) {
      safetyVerifiedGens.add(s.generation_id);
    } else if (src.startsWith('propagated_')) {
      safetyPropagatedGens.add(s.generation_id);
    } else if (src.startsWith('inferred:')) {
      safetyInferredGens.add(s.generation_id);
    }
  }

  // Video confidence estimate
  const vidNativeGens = new Set<string>();
  const vidCloseGens = new Set<string>();
  const vidFarGens = new Set<string>();
  for (const [genId, r] of Array.from(genVideoRelevance.entries())) {
    if (r.native > 0) vidNativeGens.add(genId);
    else if (r.close > 0) vidCloseGens.add(genId);
    else vidFarGens.add(genId);
  }

  console.log(`\n  SAFETY:    ${safetyByGenId.size}/${totalGens} total`);
  console.log(`    Verified:    ${safetyVerifiedGens.size} (${pct(safetyVerifiedGens.size, totalGens)})`);
  console.log(`    Propagated:  ${safetyPropagatedGens.size} (${pct(safetyPropagatedGens.size, totalGens)})`);
  console.log(`    Inferred:    ${safetyInferredGens.size} (${pct(safetyInferredGens.size, totalGens)})`);

  console.log(`\n  VIDEOS:    ${vidGens.size}/${totalGens} total (${uniqueVideoIds.size} unique videos)`);
  console.log(`    Native (≤2yr): ${vidNativeGens.size} (${pct(vidNativeGens.size, totalGens)})`);
  console.log(`    Close (3-5yr): ${vidCloseGens.size} (${pct(vidCloseGens.size, totalGens)})`);
  console.log(`    Far (>5yr):    ${vidFarGens.size} (${pct(vidFarGens.size, totalGens)})`);

  console.log(`\n  PHOTOS:    ${imgGens.size}/${totalGens} (${pct(imgGens.size, totalGens)})`);
  console.log(`    Known HD+:   ${hdPlus + hd} (${pct(hdPlus + hd, images.length)} of images)`);

  console.log(`\n  DIMS:      ${dimGens.size}/${totalGens} (${pct(dimGens.size, totalGens)})`);
  console.log(`    ⚠ No source tracking — cannot separate real from estimated`);

  console.log(`\n  FAMILY:    ${fitGens.size}/${totalGens} (${pct(fitGens.size, totalGens)})`);

  console.log(`\n  SPECS:     ${specsGenSet.size}/${totalGens} (${pct(specsGenSet.size, totalGens)})`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalGens,
    safety: {
      total: safetyByGenId.size,
      verified: safetyVerifiedGens.size,
      propagated: safetyPropagatedGens.size,
      inferred: safetyInferredGens.size,
      counterExamplesPremium: counterPremium.length,
      counterExamplesMainstream: counterMainstream.length,
      bySource: Object.fromEntries(Object.entries(safetyBySource).map(([k, v]) => [k, v.count])),
    },
    videos: {
      totalRows: totalVideoRows,
      uniqueIds: uniqueVideoIds.size,
      dupeRatio,
      gapLt2, gap2to5, gap5to10, gap10plus, noGapInfo,
      gensOnlyAbsurd, gensOnlyFar,
    },
    photos: {
      total: images.length,
      hdPlus, hd, medium, low, noRes,
    },
    dims: { total: dimGens.size, withHeadroom, withLegroom, withTrunk },
    family: { total: fitGens.size, fitBySource, threeAcrossFromDerived },
  };

  const reportPath = path.join(DATA_DIR, 'audit-brutal-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
