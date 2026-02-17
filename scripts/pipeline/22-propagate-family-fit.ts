/**
 * 22-propagate-family-fit.ts — Propagate family_fit within model families
 *
 * Phase 1: Same model, ±5 years, same body_type → copy family_fit
 * Phase 2: Same model, ±5 years, any body_type → copy family_fit
 * Phase 3: Create family_fit from freshly propagated interior_dimensions
 *
 * Never overwrites existing values.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/22-propagate-family-fit.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/22-propagate-family-fit.ts
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
const BATCH_SIZE = 50;
const YEAR_TOLERANCE = 5;
const DATA_DIR = path.resolve(__dirname, '../../data');

// Columns to propagate from family_fit_compatibility
const FIT_COLUMNS = [
  'isofix_points', 'isofix_positions', 'center_isofix', 'top_tether_points',
  'rear_bench_width_total_mm', 'rear_bench_width_usable_mm',
  'rear_bench_depth_mm', 'rear_bench_angle_deg',
  'rear_headroom_mm', 'rear_legroom_min_mm', 'rear_legroom_max_mm',
  'front_seat_back_clearance_mm',
  'rear_door_opening_width_mm', 'rear_door_opening_height_mm', 'door_sill_height_mm',
  'center_tunnel_height_mm', 'center_tunnel_width_mm',
  'fold_flat_front_seat', 'sliding_rear_bench',
  'infant_seat_fit', 'toddler_seat_fit', 'booster_seat_fit',
  'three_across_possible', 'three_across_fit_score', 'three_across_notes',
];

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

function seatFitRating(headroomMm: number | null, legroomMm: number | null): string | null {
  if (!headroomMm && !legroomMm) return null;
  const h = headroomMm || 950;
  const l = legroomMm || 800;
  if (h >= 980 && l >= 850) return 'excellent';
  if (h >= 950 && l >= 780) return 'good';
  if (h >= 920 && l >= 700) return 'tight';
  return 'not_recommended';
}

function threeAcrossScore(benchWidthMm: number): { possible: boolean; score: string } {
  if (benchWidthMm >= 1450) return { possible: true, score: 'excellent' };
  if (benchWidthMm >= 1380) return { possible: true, score: 'good' };
  if (benchWidthMm >= 1320) return { possible: true, score: 'tight' };
  return { possible: false, score: 'not_recommended' };
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  22-PROPAGATE-FAMILY-FIT');
  console.log('  Propagate family_fit within model families');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, production_end, model_id');
  console.log(`  Generations: ${gens.length}`);

  const fits = await paginateAll('family_fit_compatibility', '*');
  const fitsByGenId = new Map<string, any>();
  for (const f of fits) fitsByGenId.set(f.generation_id, f);
  console.log(`  With family_fit: ${fits.length}`);
  console.log(`  Without: ${gens.length - fits.length}`);

  const dims = await paginateAll('interior_dimensions', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of dims) dimsByGenId.set(d.generation_id, d);
  console.log(`  With interior_dims: ${dims.length}`);

  // Group by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  const stats = { phase1: 0, phase2: 0, phase3: 0, fieldsTotal: 0, tooFarApart: 0 };
  const toUpsert: any[] = [];
  const processedGens = new Set<string>();

  // ── Phase 1: Same model + same body_type ──
  console.log('\n  ── Phase 1: Same model + same body_type ──');
  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withFit = modelGens.filter((g: any) => fitsByGenId.has(g.id));
    const withoutFit = modelGens.filter((g: any) => !fitsByGenId.has(g.id));
    if (withFit.length === 0 || withoutFit.length === 0) continue;

    for (const uGen of withoutFit) {
      if (processedGens.has(uGen.id)) continue;
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withFit) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        if (uGen.body_type && rGen.body_type && uGen.body_type !== rGen.body_type) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= YEAR_TOLERANCE && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const sourceFit = fitsByGenId.get(bestSource.id);
      if (!sourceFit) continue;

      const row: any = { generation_id: uGen.id, source: 'propagated' };
      let fields = 0;
      for (const col of FIT_COLUMNS) {
        if (sourceFit[col] !== null && sourceFit[col] !== undefined) {
          row[col] = sourceFit[col];
          fields++;
        }
      }
      if (fields > 0) {
        toUpsert.push(row);
        processedGens.add(uGen.id);
        fitsByGenId.set(uGen.id, row);
        stats.phase1++;
        stats.fieldsTotal += fields;
      }
    }
  }
  console.log(`  Phase 1: ${stats.phase1}`);

  // ── Phase 2: Same model, any body_type ──
  console.log('\n  ── Phase 2: Same model (any body_type) ──');
  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withFit = modelGens.filter((g: any) => fitsByGenId.has(g.id));
    const withoutFit = modelGens.filter((g: any) => !fitsByGenId.has(g.id) && !processedGens.has(g.id));
    if (withFit.length === 0 || withoutFit.length === 0) continue;

    for (const uGen of withoutFit) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;
      for (const rGen of withFit) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= YEAR_TOLERANCE && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }
      if (!bestSource) { stats.tooFarApart++; continue; }

      const sourceFit = fitsByGenId.get(bestSource.id);
      if (!sourceFit) continue;

      const row: any = { generation_id: uGen.id, source: 'propagated' };
      let fields = 0;
      for (const col of FIT_COLUMNS) {
        if (sourceFit[col] !== null && sourceFit[col] !== undefined) {
          row[col] = sourceFit[col];
          fields++;
        }
      }
      if (fields > 0) {
        toUpsert.push(row);
        processedGens.add(uGen.id);
        fitsByGenId.set(uGen.id, row);
        stats.phase2++;
        stats.fieldsTotal += fields;
      }
    }
  }
  console.log(`  Phase 2: ${stats.phase2}`);

  // ── Phase 3: Create from interior_dimensions ──
  console.log('\n  ── Phase 3: Create from interior_dimensions ──');
  for (const gen of gens) {
    if (fitsByGenId.has(gen.id) || processedGens.has(gen.id)) continue;
    const dim = dimsByGenId.get(gen.id);
    if (!dim) continue;

    // Need at least rear_headroom or rear_legroom or bench width
    if (!dim.rear_headroom_mm && !dim.rear_legroom_mm && !dim.rear_bench_width_mm && !dim.rear_bench_width_total_mm) continue;

    const row: any = { generation_id: gen.id, source: 'derived_from_dims' };
    let fields = 0;

    if (dim.rear_headroom_mm) { row.rear_headroom_mm = dim.rear_headroom_mm; fields++; }
    if (dim.rear_legroom_mm) { row.rear_legroom_max_mm = dim.rear_legroom_mm; fields++; }

    const benchWidth = dim.rear_bench_width_total_mm || dim.rear_bench_width_mm;
    if (benchWidth) {
      row.rear_bench_width_usable_mm = benchWidth;
      row.rear_bench_width_total_mm = benchWidth;
      fields += 2;
      const ta = threeAcrossScore(benchWidth);
      row.three_across_possible = ta.possible;
      row.three_across_fit_score = ta.score;
      fields += 2;
    }

    const fit = seatFitRating(dim.rear_headroom_mm, dim.rear_legroom_mm);
    if (fit) {
      row.infant_seat_fit = fit;
      row.toddler_seat_fit = fit;
      row.booster_seat_fit = fit;
      fields += 3;
    }

    if (dim.step_in_height_rear_mm) { row.door_sill_height_mm = dim.step_in_height_rear_mm; fields++; }

    if (fields > 0) {
      toUpsert.push(row);
      processedGens.add(gen.id);
      stats.phase3++;
      stats.fieldsTotal += fields;
    }
  }
  console.log(`  Phase 3: ${stats.phase3}`);

  // Upsert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Upserting ${toUpsert.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('family_fit_compatibility').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // Results
  const total = stats.phase1 + stats.phase2 + stats.phase3;
  const newCoverage = fits.length + total;
  console.log('\n' + '='.repeat(60));
  console.log('  PROPAGATE FAMILY-FIT RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (same body):   ${stats.phase1}`);
  console.log(`  Phase 2 (any body):    ${stats.phase2}`);
  console.log(`  Phase 3 (from dims):   ${stats.phase3}`);
  console.log(`  Total propagated:      ${total}`);
  console.log(`  Too far apart:         ${stats.tooFarApart}`);
  console.log(`  Coverage:              ${fits.length} → ${newCoverage} / ${gens.length} (${(newCoverage / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'propagate-family-fit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: fits.length, after: newCoverage, total: gens.length }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
