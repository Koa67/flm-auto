/**
 * 45-fix-confidence.ts — Fix broken confidence tagging
 *
 * 3 bugs fixed:
 *   1. Dims: counted only 5 fields, ignored 20+ other real measurement columns.
 *      interior_dimensions has NO source column. Use expanded field check.
 *   2. Videos: matched only on gen.name (chassis code), missed brand+model in title.
 *   3. Family Fit: 'calculated' from real dims should cascade confidence from dims.
 *
 * NO DELETIONS. Only re-tags confidence.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/45-fix-confidence.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/45-fix-confidence.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;
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

async function batchUpdate(table: string, updates: { id: string; confidence: string }[]): Promise<number> {
  if (DRY_RUN || updates.length === 0) return 0;
  let done = 0;
  const byConf: Record<string, string[]> = {};
  for (const u of updates) {
    if (!byConf[u.confidence]) byConf[u.confidence] = [];
    byConf[u.confidence].push(u.id);
  }
  for (const [conf, ids] of Object.entries(byConf)) {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from(table).update({ confidence: conf }).in('id', batch);
      if (error) console.error(`  Batch error ${table} conf=${conf}: ${error.message}`);
      else done += batch.length;
    }
  }
  return done;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

// ── DIMS: Expanded field counting ──
// interior_dimensions has NO source column. We classify by how many real measurement
// fields are populated. ALL measurement columns, not just 5.
const DIM_MEASUREMENT_FIELDS = [
  'front_headroom_mm', 'rear_headroom_mm',
  'front_legroom_mm', 'rear_legroom_mm',
  'front_shoulder_room_mm', 'rear_shoulder_room_mm',
  'front_hip_room_mm', 'rear_hip_room_mm',
  'trunk_volume_liters', 'trunk_volume_max_liters', 'frunk_volume_liters',
  'fuel_tank_liters',
  'rear_bench_width_mm', 'rear_bench_width_total_mm',
  'rear_bench_width_left_mm', 'rear_bench_width_center_mm', 'rear_bench_width_right_mm',
  'load_sill_height_mm', 'trunk_opening_width_mm',
  'trunk_loading_height_mm', 'trunk_loading_width_mm',
  'trunk_length_mm', 'trunk_width_mm', 'trunk_width_wheelhouses_mm', 'trunk_height_mm',
  'door_opening_angle_front', 'door_opening_angle_rear',
  'step_in_height_front_mm', 'step_in_height_rear_mm',
  'seating_capacity',
];

function countDimFields(row: any): number {
  let count = 0;
  for (const f of DIM_MEASUREMENT_FIELDS) {
    if (row[f] !== null && row[f] !== undefined && row[f] !== 0) count++;
  }
  return count;
}

function classifyDimsFixed(row: any): string {
  // No source column — classify by data richness
  const fields = countDimFields(row);
  if (fields >= 3) return 'A'; // Rich data — multiple real measurements
  if (fields >= 1) return 'B'; // At least one real measurement (trunk, fuel, etc.)
  return 'E'; // Empty shell — zero measurements
}

// ── VIDEOS: Match on brand + model name, not just gen name ──
function classifyVideoFixed(
  row: any,
  genById: Map<string, any>,
  modelById: Map<string, any>,
  brandById: Map<string, any>,
): string {
  const gen = genById.get(row.generation_id);
  if (!gen) return 'D';

  const model = gen.model_id ? modelById.get(gen.model_id) : null;
  const brand = model?.brand_id ? brandById.get(model.brand_id) : null;
  const title = (row.title || '').toLowerCase();

  // Extract production year
  const prodStart = gen.production_start;
  let prodYear: number | null = null;
  if (prodStart) {
    const s = String(prodStart);
    if (/^\d{4}$/.test(s)) prodYear = parseInt(s);
    else if (/^\d{4}-/.test(s)) prodYear = parseInt(s.substring(0, 4));
  }
  const pubYear = row.published_at ? new Date(row.published_at).getFullYear() : null;

  // Title relevance checks
  const brandName = brand?.name?.toLowerCase() || '';
  const modelName = model?.name?.toLowerCase() || '';
  const genName = (gen.name || '').toLowerCase();

  const brandMatch = brandName && title.includes(brandName);
  const modelMatch = modelName && title.includes(modelName);
  const genMatch = genName && genName.length > 1 && title.includes(genName);
  const titleRelevant = (brandMatch && modelMatch) || genMatch;

  // If we have both dates — use temporal gap
  if (prodYear && pubYear) {
    const gap = Math.abs(pubYear - prodYear);
    if (gap <= 3) return titleRelevant ? 'A' : 'B'; // Temporally relevant
    if (gap <= 6) return titleRelevant ? 'B' : 'C'; // Close enough
    if (gap <= 10) return 'C'; // Stretch
    return 'D'; // >10 year gap (script 42 may tag E)
  }

  // No date info — rely on title match
  if (brandMatch && modelMatch) return 'B'; // "BMW 3 Series review" = relevant
  if (brandMatch || modelMatch) return 'B'; // At least brand or model matches
  if (genMatch) return 'B'; // Chassis code in title
  return 'C'; // No match at all
}

// ── FAMILY FIT: Cascade from dims confidence ──
function classifyFitFixed(row: any, dimConfByGen: Map<string, string>): string {
  const source = (row.source || '').toLowerCase();

  // A = Scraped data (direct from real source)
  if (source === 'scraped' || source === 'manual') return 'A';

  // Calculated from dims — confidence depends on underlying dims quality
  if (source === 'calculated') {
    const dimConf = dimConfByGen.get(row.generation_id);
    if (dimConf === 'A') return 'A'; // Calculated from rich real dims = verified
    if (dimConf === 'B') return 'B'; // Calculated from partial real dims = close
    return 'C'; // Calculated from unknown/empty dims
  }

  // Derived from dims (different script, same logic)
  if (source.includes('derived_from_dims')) {
    const dimConf = dimConfByGen.get(row.generation_id);
    if (dimConf === 'A') return 'B'; // Derived (formula) from real dims
    if (dimConf === 'B') return 'C'; // Derived from partial
    return 'D'; // Derived from empty dims
  }

  // Propagated
  if (source.includes('propagated')) {
    return 'C'; // Propagated from another gen
  }

  // Unknown source
  return 'C';
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  45-FIX-CONFIDENCE — Repair broken tagging                                    ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                                    ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  // ── Step 1: Audit source values ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 1: SOURCE VALUE AUDIT (proof before any changes)');
  console.log('═══════════════════════════════════════════════════════════════');

  // interior_dimensions — check for source column
  console.log('\n  interior_dimensions.source:');
  const { data: dimSourceTest, error: dimSourceErr } = await supabase
    .from('interior_dimensions').select('source' as any).limit(1);
  if (dimSourceErr) {
    console.log('    ⚠ COLUMN DOES NOT EXIST: ' + dimSourceErr.message);
    console.log('    → Will classify by data richness (field count) instead');
  } else {
    console.log('    Column exists — checking values...');
  }

  // family_fit_compatibility.source
  console.log('\n  family_fit_compatibility.source:');
  const fitRows = await paginateAll('family_fit_compatibility', 'id, generation_id, source, confidence');
  const fitSourceCounts: Record<string, number> = {};
  for (const r of fitRows) {
    const s = r.source === null ? 'NULL' : r.source;
    fitSourceCounts[s] = (fitSourceCounts[s] || 0) + 1;
  }
  for (const [s, c] of Object.entries(fitSourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${JSON.stringify(s).padEnd(40)} ${c}`);
  }

  // safety_ratings — quick check (already correct)
  console.log('\n  safety_ratings.source_url (top 10):');
  const safetyRows = await paginateAll('safety_ratings', 'id, generation_id, source_url, confidence');
  const safetySrcCounts: Record<string, number> = {};
  for (const r of safetyRows) {
    const url = r.source_url || '';
    let src = 'empty';
    if (url.includes('euroncap')) src = 'euroncap';
    else if (url.includes('nhtsa')) src = 'nhtsa';
    else if (url.includes('iihs')) src = 'iihs';
    else if (url.includes('jncap') || url.includes('nasva')) src = 'jncap';
    else if (url.startsWith('propagated_from:')) src = 'propagated_from';
    else if (url.startsWith('propagated_platform:')) src = 'propagated_platform';
    else if (url.startsWith('inferred:')) src = url;
    safetySrcCounts[src] = (safetySrcCounts[src] || 0) + 1;
  }
  for (const [s, c] of Object.entries(safetySrcCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${s.padEnd(45)} ${c}`);
  }

  // ── Step 2: Load all data for re-tagging ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 2: LOADING DATA');
  console.log('═══════════════════════════════════════════════════════════════');

  const gens = await paginateAll('generations', 'id, name, model_id, production_start');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);

  console.log(`  Gens: ${gens.length} | Models: ${models.length} | Brands: ${brands.length}`);

  // ── Step 3: Re-tag DIMS ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 3: RE-TAG interior_dimensions');
  console.log('═══════════════════════════════════════════════════════════════');

  // Select ALL measurement columns
  const dimSelect = 'id, generation_id, confidence, ' + DIM_MEASUREMENT_FIELDS.join(', ');
  const dimRows = await paginateAll('interior_dimensions', dimSelect);
  console.log(`  Loaded: ${dimRows.length} dim rows`);

  const dimsBefore: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const dimsAfter: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const dimUpdates: { id: string; confidence: string }[] = [];
  const dimConfByGen = new Map<string, string>();

  for (const row of dimRows) {
    const oldConf = row.confidence || '?';
    dimsBefore[oldConf] = (dimsBefore[oldConf] || 0) + 1;

    const newConf = classifyDimsFixed(row);
    dimsAfter[newConf]++;
    dimConfByGen.set(row.generation_id, newConf);

    if (oldConf !== newConf) {
      dimUpdates.push({ id: row.id, confidence: newConf });
    }
  }

  console.log('\n  INTERIOR DIMS — BEFORE vs AFTER RETAG');
  console.log('               BEFORE    AFTER');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const arrow = dimsAfter[c] > (dimsBefore[c] || 0) ? '↑' : dimsAfter[c] < (dimsBefore[c] || 0) ? '↓' : '=';
    console.log(`  ${c} ${arrow}       ${String(dimsBefore[c] || 0).padStart(6)}   ${String(dimsAfter[c]).padStart(6)}`);
  }
  console.log(`  Updates: ${dimUpdates.length}`);

  if (!DRY_RUN && dimUpdates.length > 0) {
    const done = await batchUpdate('interior_dimensions', dimUpdates);
    console.log(`  Applied: ${done}`);
  }

  // ── Step 4: Re-tag VIDEOS ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 4: RE-TAG vehicle_videos');
  console.log('═══════════════════════════════════════════════════════════════');

  const videoBefore: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const videoAfter: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let videoUpdateCount = 0;

  // Process in pages (large table)
  let vPage = 0;
  while (true) {
    const { data: videoPage, error } = await supabase.from('vehicle_videos')
      .select('id, generation_id, title, published_at, confidence')
      .range(vPage * 1000, (vPage + 1) * 1000 - 1);
    if (error || !videoPage || videoPage.length === 0) break;

    const pageUpdates: { id: string; confidence: string }[] = [];
    for (const row of videoPage) {
      const oldConf = row.confidence || '?';
      videoBefore[oldConf] = (videoBefore[oldConf] || 0) + 1;

      // Preserve E tags from script 42 (absurd data stays E)
      if (oldConf === 'E') {
        videoAfter['E']++;
        continue;
      }

      const newConf = classifyVideoFixed(row, genById, modelById, brandById);
      videoAfter[newConf]++;

      if (oldConf !== newConf) {
        pageUpdates.push({ id: row.id, confidence: newConf });
      }
    }

    if (!DRY_RUN && pageUpdates.length > 0) {
      await batchUpdate('vehicle_videos', pageUpdates);
      videoUpdateCount += pageUpdates.length;
    }

    if (vPage % 10 === 0 && vPage > 0) {
      process.stdout.write(`  ... page ${vPage} (${vPage * 1000} rows)\r`);
    }
    if (videoPage.length < 1000) break;
    vPage++;
  }
  console.log(`  Processed: ${(vPage + 1) * 1000} video rows`);

  console.log('\n  VIDEOS — BEFORE vs AFTER RETAG');
  console.log('               BEFORE    AFTER');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const arrow = videoAfter[c] > (videoBefore[c] || 0) ? '↑' : videoAfter[c] < (videoBefore[c] || 0) ? '↓' : '=';
    console.log(`  ${c} ${arrow}       ${String(videoBefore[c] || 0).padStart(6)}   ${String(videoAfter[c]).padStart(6)}`);
  }
  console.log(`  Updates: ${videoUpdateCount}`);

  // ── Step 5: Re-tag FAMILY FIT ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 5: RE-TAG family_fit_compatibility');
  console.log('═══════════════════════════════════════════════════════════════');

  const fitBefore: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const fitAfter: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const fitUpdates: { id: string; confidence: string }[] = [];

  for (const row of fitRows) {
    const oldConf = row.confidence || '?';
    fitBefore[oldConf] = (fitBefore[oldConf] || 0) + 1;

    // Preserve E tags
    if (oldConf === 'E') {
      fitAfter['E']++;
      continue;
    }

    const newConf = classifyFitFixed(row, dimConfByGen);
    fitAfter[newConf]++;

    if (oldConf !== newConf) {
      fitUpdates.push({ id: row.id, confidence: newConf });
    }
  }

  console.log('\n  FAMILY FIT — BEFORE vs AFTER RETAG');
  console.log('               BEFORE    AFTER');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const arrow = fitAfter[c] > (fitBefore[c] || 0) ? '↑' : fitAfter[c] < (fitBefore[c] || 0) ? '↓' : '=';
    console.log(`  ${c} ${arrow}       ${String(fitBefore[c] || 0).padStart(6)}   ${String(fitAfter[c]).padStart(6)}`);
  }
  console.log(`  Updates: ${fitUpdates.length}`);

  if (!DRY_RUN && fitUpdates.length > 0) {
    const done = await batchUpdate('family_fit_compatibility', fitUpdates);
    console.log(`  Applied: ${done}`);
  }

  // Safety + Photos — keep existing tags (logic was correct)
  console.log('\n  Safety & Photos: keeping existing tags (logic was correct)');

  // ── Step 6: Re-calculate 3-tier scores ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  STEP 6: RE-CALCULATE SCORES');
  console.log('═══════════════════════════════════════════════════════════════');

  const totalGens = gens.length;

  // Reload fresh confidence data
  const safetyFresh = await paginateAll('safety_ratings', 'generation_id, confidence');
  const specsFresh = await paginateAll('third_party_specs', 'generation_id');
  const specsGenSet = new Set(specsFresh.map((r: any) => r.generation_id));

  type Tier = 'verified' | 'trustworthy' | 'all';
  const TIER_CONF: Record<Tier, Set<string>> = {
    verified: new Set(['A', 'B']),
    trustworthy: new Set(['A', 'B', 'C']),
    all: new Set(['A', 'B', 'C', 'D']),
  };

  function genSetForTier(rows: any[], tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const gSet = new Set<string>();
    for (const row of rows) {
      if (confSet.has(row.confidence || 'D')) gSet.add(row.generation_id);
    }
    return gSet;
  }

  // Use the AFTER confidence for dims and fit (already updated in DB or in memory)
  // For dims, build from dimRows with new confidence
  const dimRowsFixed = dimRows.map((r: any) => ({
    generation_id: r.generation_id,
    confidence: dimConfByGen.get(r.generation_id) || r.confidence || 'D',
  }));

  const fitRowsFixed = fitRows.map((r: any) => {
    if (r.confidence === 'E') return { generation_id: r.generation_id, confidence: 'E' };
    return { generation_id: r.generation_id, confidence: classifyFitFixed(r, dimConfByGen) };
  });

  // Photos — load fresh
  const photoGensByConf = new Map<string, Set<string>>();
  for (const c of ['A', 'B', 'C', 'D', 'E']) photoGensByConf.set(c, new Set());
  let pPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_images')
      .select('generation_id, confidence')
      .range(pPage * 1000, (pPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      photoGensByConf.get(row.confidence || 'D')?.add(row.generation_id);
    }
    if (data.length < 1000) break;
    pPage++;
  }

  // Videos — load fresh (after update)
  const videoGensByConf = new Map<string, Set<string>>();
  for (const c of ['A', 'B', 'C', 'D', 'E']) videoGensByConf.set(c, new Set());
  let vvPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_videos')
      .select('generation_id, confidence')
      .range(vvPage * 1000, (vvPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      videoGensByConf.get(row.confidence || 'D')?.add(row.generation_id);
    }
    if (data.length < 1000) break;
    vvPage++;
  }

  function photoGenSetForTier(tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const result = new Set<string>();
    for (const [conf, genSet] of Array.from(photoGensByConf.entries())) {
      if (confSet.has(conf)) for (const gid of genSet) result.add(gid);
    }
    return result;
  }

  function videoGenSetForTier(tier: Tier): Set<string> {
    const confSet = TIER_CONF[tier];
    const result = new Set<string>();
    for (const [conf, genSet] of Array.from(videoGensByConf.entries())) {
      if (confSet.has(conf)) for (const gid of genSet) result.add(gid);
    }
    return result;
  }

  const tiers: Tier[] = ['verified', 'trustworthy', 'all'];
  const beforeScores = { verified: 52.0, trustworthy: 70.9, all: 77.9 };

  const results: Record<Tier, {
    specs: number; photos: number; safety: number;
    dims: number; family: number; videos: number; score: number;
  }> = {} as any;

  for (const tier of tiers) {
    const safetySet = genSetForTier(safetyFresh, tier);
    const dimsSet = genSetForTier(dimRowsFixed, tier);
    const fitSet = genSetForTier(fitRowsFixed, tier);
    const photoSet = photoGenSetForTier(tier);
    const videoSet = videoGenSetForTier(tier);

    const specsPct = specsGenSet.size / totalGens * 100;
    const photosPct = photoSet.size / totalGens * 100;
    const safetyPct = safetySet.size / totalGens * 100;
    const dimsPct = dimsSet.size / totalGens * 100;
    const familyPct = fitSet.size / totalGens * 100;
    const videosPct = videoSet.size / totalGens * 100;

    const score = specsPct * 0.15 + photosPct * 0.15 + safetyPct * 0.25 +
                  dimsPct * 0.15 + familyPct * 0.15 + videosPct * 0.15;

    results[tier] = { specs: specsPct, photos: photosPct, safety: safetyPct,
      dims: dimsPct, family: familyPct, videos: videosPct, score };
  }

  // ── DISPLAY ──
  console.log('\n╔' + '═'.repeat(90) + '╗');
  console.log('║  SCORES — BEFORE vs AFTER FIX                                                            ║');
  console.log('╠' + '═'.repeat(90) + '╣');
  console.log('║                     VERIFIED (A+B)           TRUSTWORTHY (A-C)       ALL (A-D)            ║');
  console.log('║                     Before → After           Before → After           Before → After      ║');
  console.log('╠' + '─'.repeat(90) + '╣');

  const metrics = [
    { label: 'Specs', key: 'specs', w: 15 },
    { label: 'Photos', key: 'photos', w: 15 },
    { label: 'Safety', key: 'safety', w: 25 },
    { label: 'Dims', key: 'dims', w: 15 },
    { label: 'Family Fit', key: 'family', w: 15 },
    { label: 'Videos', key: 'videos', w: 15 },
  ];

  // Old (before fix) values from script 43
  const oldVerified: Record<string, number> = { specs: 99.2, photos: 72.3, safety: 32.8, dims: 18.2, family: 82.4, videos: 19.8 };
  const oldTrust: Record<string, number> = { specs: 99.2, photos: 75.0, safety: 51.0, dims: 47.7, family: 93.5, videos: 72.1 };
  const oldAll: Record<string, number> = { specs: 99.2, photos: 84.9, safety: 73.1, dims: 47.7, family: 93.5, videos: 72.1 };

  for (const m of metrics) {
    const ov = oldVerified[m.key];
    const nv = (results.verified as any)[m.key] as number;
    const ot = oldTrust[m.key];
    const nt = (results.trustworthy as any)[m.key] as number;
    const oa = oldAll[m.key];
    const na = (results.all as any)[m.key] as number;

    const dv = nv - ov; const dt = nt - ot; const da = na - oa;
    console.log(`║  ${m.label.padEnd(12)} ${ov.toFixed(1).padStart(5)}→${nv.toFixed(1).padStart(5)} (${dv >= 0 ? '+' : ''}${dv.toFixed(1).padStart(5)})   ${ot.toFixed(1).padStart(5)}→${nt.toFixed(1).padStart(5)} (${dt >= 0 ? '+' : ''}${dt.toFixed(1).padStart(5)})   ${oa.toFixed(1).padStart(5)}→${na.toFixed(1).padStart(5)} (${da >= 0 ? '+' : ''}${da.toFixed(1).padStart(5)})   ║`);
  }

  console.log('╠' + '═'.repeat(90) + '╣');
  const dv = results.verified.score - beforeScores.verified;
  const dt = results.trustworthy.score - beforeScores.trustworthy;
  const da = results.all.score - beforeScores.all;
  console.log(`║  SCORE      ${beforeScores.verified.toFixed(1).padStart(5)}→${results.verified.score.toFixed(1).padStart(5)} (${dv >= 0 ? '+' : ''}${dv.toFixed(1).padStart(5)})   ${beforeScores.trustworthy.toFixed(1).padStart(5)}→${results.trustworthy.score.toFixed(1).padStart(5)} (${dt >= 0 ? '+' : ''}${dt.toFixed(1).padStart(5)})   ${beforeScores.all.toFixed(1).padStart(5)}→${results.all.score.toFixed(1).padStart(5)} (${da >= 0 ? '+' : ''}${da.toFixed(1).padStart(5)})   ║`);
  console.log('╚' + '═'.repeat(90) + '╝');

  console.log('\n╔' + '═'.repeat(78) + '╗');
  console.log(`║  FINAL HONEST SCORES (after fix)                                             ║`);
  console.log(`║                                                                              ║`);
  console.log(`║  VERIFIED (A+B):     ${results.verified.score.toFixed(1).padStart(5)} / 100                                             ║`);
  console.log(`║  TRUSTWORTHY (A-C):  ${results.trustworthy.score.toFixed(1).padStart(5)} / 100                                             ║`);
  console.log(`║  ALL (A-D):          ${results.all.score.toFixed(1).padStart(5)} / 100                                             ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    scores: results,
    beforeScores,
    dimRetag: { before: dimsBefore, after: dimsAfter, updates: dimUpdates.length },
    videoRetag: { before: videoBefore, after: videoAfter, updates: videoUpdateCount },
    fitRetag: { before: fitBefore, after: fitAfter, updates: fitUpdates.length },
  };
  const reportPath = path.join(DATA_DIR, 'honest-scorecard-v2.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
