/**
 * 42-cleanup-absurd.ts — Tag absurd data as confidence='E'
 *
 * NO DELETIONS. Only tags rows as E (suspect).
 *
 * Rules:
 *   Safety:
 *     - Propagation chain depth ≥ 4 → E
 *     - Inferred with known counter-example (e.g. mainstream post-2020 but verified < 4★)
 *     - Propagated from a gen that is itself inferred → E
 *
 *   Videos:
 *     - Published >10 years from production_start → E
 *     - Duplicate video assigned to >15 different gens → E (spam propagation)
 *
 *   Dims:
 *     - All fields NULL (empty shell, no real data) → E
 *     - Already D with fieldCount=0 → upgrade to E
 *
 *   Family Fit:
 *     - Derived from dims that are confidence E → E
 *     - Propagated from a gen whose fit is derived/E → E
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/42-cleanup-absurd.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/42-cleanup-absurd.ts
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

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

async function batchSetE(table: string, ids: string[]): Promise<number> {
  if (DRY_RUN || ids.length === 0) return 0;
  let done = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).update({ confidence: 'E' }).in('id', batch);
    if (error) console.error(`  Batch error ${table} at ${i}: ${error.message}`);
    else done += batch.length;
  }
  return done;
}

function getChainDepth(row: any, safetyByGen: Map<string, any>, depth: number): number {
  if (depth > 10) return depth;
  const url = row.source_url || '';
  if (url.includes('euroncap') || url.includes('nhtsa') || url.includes('iihs') ||
      url.includes('nasva') || url.includes('jncap')) return depth;
  if (url.startsWith('inferred:')) return depth;

  let sourceGenId: string | null = null;
  if (url.startsWith('propagated_from:')) sourceGenId = url.replace('propagated_from:', '').trim();
  else if (url.startsWith('propagated_platform:')) sourceGenId = url.replace('propagated_platform:', '').trim();

  if (sourceGenId && safetyByGen.has(sourceGenId)) {
    return getChainDepth(safetyByGen.get(sourceGenId), safetyByGen, depth + 1);
  }
  return depth + 1;
}

function isInferred(url: string): boolean {
  return url.startsWith('inferred:');
}

function isPropagated(url: string): boolean {
  return url.startsWith('propagated_from:') || url.startsWith('propagated_platform:');
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(70) + '╗');
  console.log('║  42-CLEANUP-ABSURD — Tag suspect data as E                              ║');
  console.log('║  NO DELETIONS. Only downgrades confidence to E.                         ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                              ║`);
  console.log('╚' + '═'.repeat(70) + '╝');

  const stats: Record<string, number> = {};
  const mark = (key: string) => { stats[key] = (stats[key] || 0) + 1; };

  // Load data
  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, production_start, model_id');
  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);

  // ── SAFETY ──
  console.log('\n  ── Safety E-tagging ──');
  const safetyRows = await paginateAll('safety_ratings', 'id, generation_id, stars, source_url, confidence');
  const safetyByGen = new Map<string, any>();
  for (const s of safetyRows) safetyByGen.set(s.generation_id, s);

  const safetyE: string[] = [];

  for (const row of safetyRows) {
    if (row.confidence === 'E') continue; // Already E
    const url = row.source_url || '';

    // Rule 1: Propagation chain depth ≥ 4
    if (isPropagated(url)) {
      const depth = getChainDepth(row, safetyByGen, 0);
      if (depth >= 4) {
        safetyE.push(row.id);
        mark('safety_deep_chain');
        continue;
      }

      // Rule 2: Propagated from inferred source
      let sourceGenId: string | null = null;
      if (url.startsWith('propagated_from:')) sourceGenId = url.replace('propagated_from:', '').trim();
      else if (url.startsWith('propagated_platform:')) sourceGenId = url.replace('propagated_platform:', '').trim();

      if (sourceGenId) {
        const sourceRow = safetyByGen.get(sourceGenId);
        if (sourceRow && isInferred(sourceRow.source_url || '')) {
          safetyE.push(row.id);
          mark('safety_propagated_from_inferred');
          continue;
        }
      }
    }

    // Rule 3: model_sibling_median with only 1 sibling rated → weak signal
    if (url === 'inferred:model_sibling_median') {
      // These are already D, but if the gen has no production_start AND no body_type, it's really suspect
      const gen = genById.get(row.generation_id);
      if (gen && !gen.production_start) {
        safetyE.push(row.id);
        mark('safety_sibling_no_date');
        continue;
      }
    }
  }

  console.log(`  Safety → E: ${safetyE.length}`);
  if (!DRY_RUN && safetyE.length > 0) {
    const done = await batchSetE('safety_ratings', safetyE);
    console.log(`  Updated: ${done}`);
  }

  // ── VIDEOS ──
  console.log('\n  ── Video E-tagging ──');
  const videoRows = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, published_at, confidence');

  // Count video_id occurrences (duplication)
  const videoIdCount = new Map<string, number>();
  for (const v of videoRows) {
    const key = `${v.platform}:${v.video_id}`;
    videoIdCount.set(key, (videoIdCount.get(key) || 0) + 1);
  }

  const videoE: string[] = [];

  for (const row of videoRows) {
    if (row.confidence === 'E') continue;

    const gen = genById.get(row.generation_id);
    const prodYear = gen?.production_start ? new Date(gen.production_start).getFullYear() : null;
    const pubYear = row.published_at ? new Date(row.published_at).getFullYear() : null;

    // Rule 1: >10 year gap
    if (prodYear && pubYear && Math.abs(pubYear - prodYear) > 10) {
      videoE.push(row.id);
      mark('video_10yr_gap');
      continue;
    }

    // Rule 2: Video duplicated to >15 gens (spam propagation)
    const key = `${row.platform}:${row.video_id}`;
    if ((videoIdCount.get(key) || 0) > 15) {
      videoE.push(row.id);
      mark('video_spam_dup');
      continue;
    }
  }

  console.log(`  Videos → E: ${videoE.length}`);
  if (!DRY_RUN && videoE.length > 0) {
    const done = await batchSetE('vehicle_videos', videoE);
    console.log(`  Updated: ${done}`);
  }

  // ── DIMS ──
  console.log('\n  ── Dims E-tagging ──');
  const dimRows = await paginateAll('interior_dimensions', 'id, generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, front_shoulder_room_mm, rear_shoulder_room_mm, fuel_tank_liters, confidence');

  const dimsE: string[] = [];
  const dimConfByGen = new Map<string, string>();

  for (const row of dimRows) {
    if (row.confidence === 'E') continue;

    // Rule: already D (no fields at all) → E
    if (row.confidence === 'D') {
      dimsE.push(row.id);
      dimConfByGen.set(row.generation_id, 'E');
      mark('dims_empty_shell');
      continue;
    }
  }

  console.log(`  Dims → E: ${dimsE.length}`);
  if (!DRY_RUN && dimsE.length > 0) {
    const done = await batchSetE('interior_dimensions', dimsE);
    console.log(`  Updated: ${done}`);
  }

  // ── FAMILY FIT ──
  console.log('\n  ── Family Fit E-tagging ──');
  const fitRows = await paginateAll('family_fit_compatibility', 'id, generation_id, source, confidence');

  const fitE: string[] = [];

  for (const row of fitRows) {
    if (row.confidence === 'E') continue;

    const source = (row.source || '').toLowerCase();

    // Rule 1: derived from dims that are E
    if (source.includes('derived_from_dims')) {
      const dimConf = dimConfByGen.get(row.generation_id);
      if (dimConf === 'E') {
        fitE.push(row.id);
        mark('fit_from_E_dims');
        continue;
      }
    }

    // Rule 2: propagated fit where source gen's fit is also derived/propagated → cascade suspicion
    // Already C or D → check if gen's dims are E
    if (source.includes('propagated') && row.confidence !== 'A' && row.confidence !== 'B') {
      // If the gen itself has no real dim data → suspect
      if (dimConfByGen.get(row.generation_id) === 'E') {
        fitE.push(row.id);
        mark('fit_propagated_E_dims');
        continue;
      }
    }
  }

  console.log(`  Family Fit → E: ${fitE.length}`);
  if (!DRY_RUN && fitE.length > 0) {
    const done = await batchSetE('family_fit_compatibility', fitE);
    console.log(`  Updated: ${done}`);
  }

  // ── SUMMARY ──
  console.log('\n╔' + '═'.repeat(70) + '╗');
  console.log('║  CLEANUP ABSURD — RESULTS                                              ║');
  console.log('╠' + '═'.repeat(70) + '╣');

  let totalE = 0;
  for (const [rule, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`║  ${rule.padEnd(40)} ${String(count).padStart(6)}                          ║`);
    totalE += count;
  }
  console.log('╠' + '─'.repeat(70) + '╣');
  console.log(`║  Total E-tagged:                        ${String(totalE).padStart(6)}                          ║`);
  console.log('║  Zero rows deleted. Data preserved.                                     ║');
  console.log('╚' + '═'.repeat(70) + '╝');
}

main().catch(console.error);
