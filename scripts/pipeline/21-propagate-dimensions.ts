/**
 * 21-propagate-dimensions.ts — Propagate interior_dimensions within model families
 *
 * For generations WITHOUT interior_dimensions:
 *   Phase 1: Same model, ±5 years, same body_type → copy dimensions
 *   Phase 2: Same model, ±5 years, no body_type check (fallback)
 *
 * Never overwrites existing values.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/21-propagate-dimensions.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/21-propagate-dimensions.ts
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

// Columns to propagate (all nullable INTEGER columns from interior_dimensions)
const DIM_COLUMNS = [
  'front_headroom_mm', 'rear_headroom_mm',
  'front_legroom_mm', 'rear_legroom_mm',
  'front_shoulder_room_mm', 'rear_shoulder_room_mm',
  'front_hip_room_mm', 'rear_hip_room_mm',
  'trunk_volume_liters', 'trunk_volume_max_liters', 'frunk_volume_liters',
  'fuel_tank_liters', 'seating_capacity',
  'rear_bench_width_mm', 'load_sill_height_mm', 'trunk_opening_width_mm',
  'trunk_loading_height_mm', 'trunk_loading_width_mm',
  'trunk_length_mm', 'trunk_width_mm', 'trunk_width_wheelhouses_mm', 'trunk_height_mm',
  'rear_bench_width_total_mm',
  'step_in_height_front_mm', 'step_in_height_rear_mm',
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

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  21-PROPAGATE-DIMENSIONS');
  console.log('  Propagate interior_dimensions within model families');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, body_type, production_start, production_end, model_id'
  );
  console.log(`  Generations: ${gens.length}`);

  const dims = await paginateAll('interior_dimensions', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of dims) dimsByGenId.set(d.generation_id, d);
  console.log(`  With interior_dims: ${dims.length}`);
  console.log(`  Without: ${gens.length - dims.length}`);

  // Group gens by model_id
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  const stats = {
    phase1: 0,
    phase2: 0,
    fieldsTotal: 0,
    tooFarApart: 0,
    noSourceInModel: 0,
  };

  const toUpsert: any[] = [];
  const processedGens = new Set<string>();

  // ── Phase 1: Same model, same body_type, ±5 years ──
  console.log('\n  ── Phase 1: Same model + same body_type ──');
  for (const [modelId, modelGens] of Array.from(gensByModel.entries())) {
    const withDims = modelGens.filter(g => dimsByGenId.has(g.id));
    const withoutDims = modelGens.filter(g => !dimsByGenId.has(g.id));
    if (withDims.length === 0 || withoutDims.length === 0) {
      if (withDims.length === 0 && withoutDims.length > 0) stats.noSourceInModel++;
      continue;
    }

    for (const uGen of withoutDims) {
      if (processedGens.has(uGen.id)) continue;
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withDims) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;

        // Body type match (Phase 1 requires it)
        if (uGen.body_type && rGen.body_type && uGen.body_type !== rGen.body_type) continue;

        const dist = Math.abs(uStart - rStart);
        if (dist <= YEAR_TOLERANCE && dist < bestDist) {
          bestDist = dist;
          bestSource = rGen;
        }
      }

      if (!bestSource) continue;

      const sourceDims = dimsByGenId.get(bestSource.id);
      if (!sourceDims) continue;

      const row: any = { generation_id: uGen.id };
      let fields = 0;
      for (const col of DIM_COLUMNS) {
        if (sourceDims[col] !== null && sourceDims[col] !== undefined) {
          row[col] = sourceDims[col];
          fields++;
        }
      }

      if (fields > 0) {
        toUpsert.push(row);
        processedGens.add(uGen.id);
        dimsByGenId.set(uGen.id, row); // prevent cascading issues
        stats.phase1++;
        stats.fieldsTotal += fields;
      }
    }
  }
  console.log(`  Phase 1: ${stats.phase1} propagated`);

  // ── Phase 2: Same model, ±5 years, no body_type check ──
  console.log('\n  ── Phase 2: Same model (any body_type) ──');
  for (const [modelId, modelGens] of Array.from(gensByModel.entries())) {
    const withDims = modelGens.filter(g => dimsByGenId.has(g.id));
    const withoutDims = modelGens.filter(g => !dimsByGenId.has(g.id) && !processedGens.has(g.id));
    if (withDims.length === 0 || withoutDims.length === 0) continue;

    for (const uGen of withoutDims) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withDims) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= YEAR_TOLERANCE && dist < bestDist) {
          bestDist = dist;
          bestSource = rGen;
        }
      }

      if (!bestSource) { stats.tooFarApart++; continue; }

      const sourceDims = dimsByGenId.get(bestSource.id);
      if (!sourceDims) continue;

      const row: any = { generation_id: uGen.id };
      let fields = 0;
      for (const col of DIM_COLUMNS) {
        if (sourceDims[col] !== null && sourceDims[col] !== undefined) {
          row[col] = sourceDims[col];
          fields++;
        }
      }

      if (fields > 0) {
        toUpsert.push(row);
        processedGens.add(uGen.id);
        dimsByGenId.set(uGen.id, row);
        stats.phase2++;
        stats.fieldsTotal += fields;
      }
    }
  }
  console.log(`  Phase 2: ${stats.phase2} propagated`);

  // Upsert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Upserting ${toUpsert.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // Results
  const total = stats.phase1 + stats.phase2;
  const newCoverage = dims.length + total;
  console.log('\n' + '='.repeat(60));
  console.log('  PROPAGATE DIMENSIONS RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (same body):  ${stats.phase1}`);
  console.log(`  Phase 2 (any body):   ${stats.phase2}`);
  console.log(`  Total propagated:     ${total}`);
  console.log(`  Fields total:         ${stats.fieldsTotal}`);
  console.log(`  Too far apart:        ${stats.tooFarApart}`);
  console.log(`  No source in model:   ${stats.noSourceInModel}`);
  console.log(`  Coverage:             ${dims.length} → ${newCoverage} / ${gens.length} (${(newCoverage / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'propagate-dims-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: dims.length, after: newCoverage, total: gens.length }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
