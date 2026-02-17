/**
 * 27-family-fit-from-dims.ts — Recalculate Family Fit from fresh dimensions
 *
 * Phase 1: Create family_fit for gens that have interior_dimensions but no family_fit
 * Phase 2: Enrich existing family_fit NULL fields from child_safety raw_data (isofix)
 * Phase 3: Propagate family_fit within model families (wider tolerance)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/27-family-fit-from-dims.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/27-family-fit-from-dims.ts
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
const YEAR_TOLERANCE = 7;
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

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  27-FAMILY-FIT-FROM-DIMS');
  console.log('  Recalculate Family Fit from fresh dimensions');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const stats = { phase1Created: 0, phase2Enriched: 0, phase2Fields: 0, phase3Propagated: 0 };

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const dims = await paginateAll('interior_dimensions', '*');
  const fits = await paginateAll('family_fit_compatibility', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of dims) dimsByGenId.set(d.generation_id, d);
  const fitsByGenId = new Map<string, any>();
  for (const f of fits) fitsByGenId.set(f.generation_id, f);

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Interior dims: ${dims.length}`);
  console.log(`  Family fit: ${fits.length}`);

  // ── Phase 1: Create family_fit from interior_dimensions ──
  console.log('\n  ── Phase 1: Create family_fit from dimensions ──');
  const phase1Upsert: any[] = [];

  for (const gen of gens) {
    if (fitsByGenId.has(gen.id)) continue;
    const dim = dimsByGenId.get(gen.id);
    if (!dim) continue;

    // Need at least one meaningful field
    if (!dim.rear_headroom_mm && !dim.rear_legroom_mm && !dim.rear_bench_width_mm &&
        !dim.rear_bench_width_total_mm && !dim.rear_shoulder_room_mm) continue;

    const row: any = { generation_id: gen.id, source: 'derived_from_dims' };
    let fields = 0;

    if (dim.rear_headroom_mm) { row.rear_headroom_mm = dim.rear_headroom_mm; fields++; }
    if (dim.rear_legroom_mm) { row.rear_legroom_max_mm = dim.rear_legroom_mm; fields++; }

    // Use shoulder room or bench width for three-across
    const benchWidth = dim.rear_bench_width_total_mm || dim.rear_bench_width_mm || dim.rear_shoulder_room_mm;
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

    // Default ISOFIX for post-2014 EU vehicles
    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (prodYear && prodYear >= 2014) {
      row.isofix_points = 2;
      row.isofix_positions = ['rear_outboard'];
      fields += 2;
    }

    if (fields > 0) {
      phase1Upsert.push(row);
      fitsByGenId.set(gen.id, row);
      stats.phase1Created++;
    }
  }
  console.log(`  Phase 1: ${stats.phase1Created} new family_fit rows`);

  // ── Phase 2: Enrich from child_safety raw_data ──
  console.log('\n  ── Phase 2: Enrich from child_safety JSONB ──');
  const childSafetySpecs = await paginateAll(
    'third_party_specs',
    'generation_id, raw_data',
    (q: any) => q.eq('spec_type', 'child_safety').not('raw_data', 'is', null)
  );
  console.log(`  child_safety specs: ${childSafetySpecs.length}`);

  const phase2Upsert: any[] = [];

  for (const spec of childSafetySpecs) {
    const rd = spec.raw_data;
    if (!rd || typeof rd !== 'object') continue;

    const existing = fitsByGenId.get(spec.generation_id);
    if (!existing) continue; // Only enrich existing rows

    const updates: any = { generation_id: spec.generation_id, source: existing.source || 'enriched' };
    let fields = 0;

    // ISOFIX from child_safety
    if (rd.isofix_points !== undefined && (existing.isofix_points === null || existing.isofix_points === undefined)) {
      const val = typeof rd.isofix_points === 'number' ? rd.isofix_points : parseInt(rd.isofix_points);
      if (!isNaN(val) && val >= 0 && val <= 8) {
        updates.isofix_points = val;
        fields++;
      }
    }

    if (rd.i_size !== undefined && (existing.center_isofix === null || existing.center_isofix === undefined)) {
      updates.center_isofix = !!rd.i_size;
      fields++;
    }

    if (rd.top_tether_points !== undefined && (existing.top_tether_points === null || existing.top_tether_points === undefined)) {
      const val = typeof rd.top_tether_points === 'number' ? rd.top_tether_points : parseInt(rd.top_tether_points);
      if (!isNaN(val) && val >= 0 && val <= 8) {
        updates.top_tether_points = val;
        fields++;
      }
    }

    if (fields > 0) {
      phase2Upsert.push(updates);
      stats.phase2Enriched++;
      stats.phase2Fields += fields;
    }
  }
  console.log(`  Phase 2: ${stats.phase2Enriched} rows enriched (${stats.phase2Fields} fields)`);

  // ── Phase 3: Wider family propagation ──
  console.log('\n  ── Phase 3: Wider model-family propagation ──');

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  const phase3Upsert: any[] = [];
  const processedGens = new Set<string>();

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
        phase3Upsert.push(row);
        processedGens.add(uGen.id);
        fitsByGenId.set(uGen.id, row);
        stats.phase3Propagated++;
      }
    }
  }
  console.log(`  Phase 3: ${stats.phase3Propagated} propagated`);

  // Merge all upserts — deduplicate by generation_id, merging fields
  const mergedMap = new Map<string, any>();
  for (const row of [...phase1Upsert, ...phase2Upsert, ...phase3Upsert]) {
    const genId = row.generation_id;
    if (mergedMap.has(genId)) {
      const existing = mergedMap.get(genId)!;
      for (const [k, v] of Object.entries(row)) {
        if (k === 'generation_id') continue;
        if (v !== null && v !== undefined && (existing[k] === null || existing[k] === undefined)) {
          existing[k] = v;
        }
      }
    } else {
      mergedMap.set(genId, { ...row });
    }
  }
  const allUpserts = Array.from(mergedMap.values());
  console.log(`\n  Merged: ${phase1Upsert.length + phase2Upsert.length + phase3Upsert.length} → ${allUpserts.length} unique rows`);

  if (!DRY_RUN && allUpserts.length > 0) {
    console.log(`  Upserting ${allUpserts.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < allUpserts.length; i += BATCH_SIZE) {
      const batch = allUpserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('family_fit_compatibility').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  const totalFit = fits.length + stats.phase1Created + stats.phase3Propagated;
  console.log('\n' + '='.repeat(60));
  console.log('  FAMILY FIT FROM DIMS RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (from dims):        ${stats.phase1Created}`);
  console.log(`  Phase 2 (child_safety):      ${stats.phase2Enriched} rows, ${stats.phase2Fields} fields`);
  console.log(`  Phase 3 (propagation):       ${stats.phase3Propagated}`);
  console.log(`  Coverage:                    ${fits.length} → ${totalFit} / ${gens.length} (${(totalFit / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'family-fit-from-dims-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: fits.length, after: totalFit }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
