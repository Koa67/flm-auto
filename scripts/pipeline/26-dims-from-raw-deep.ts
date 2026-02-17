/**
 * 26-dims-from-raw-deep.ts — Deep mining of raw_data JSONB for dimensions
 *
 * Extracts interior dimensions from rich JSONB in third_party_specs where
 * spec_type is 'interior_dimensions', 'exterior_dimensions', 'weight_capacities'.
 *
 * These records contain structured data like:
 *   interior_dimensions: { cargo_l, rear_legroom_mm, front_headroom_mm, ... }
 *   exterior_dimensions: { length_mm, width_mm, height_mm, wheelbase_mm }
 *   weight_capacities: { curb_weight_kg, payload_kg, towing_kg }
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/26-dims-from-raw-deep.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/26-dims-from-raw-deep.ts
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

// Interior dimensions column mapping from raw_data keys
const INT_DIM_MAP: Record<string, { column: string; min: number; max: number }> = {
  'front_headroom_mm': { column: 'front_headroom_mm', min: 800, max: 1300 },
  'rear_headroom_mm': { column: 'rear_headroom_mm', min: 800, max: 1300 },
  'front_legroom_mm': { column: 'front_legroom_mm', min: 700, max: 1400 },
  'rear_legroom_mm': { column: 'rear_legroom_mm', min: 600, max: 1200 },
  'front_shoulder_room_mm': { column: 'front_shoulder_room_mm', min: 1000, max: 1700 },
  'rear_shoulder_room_mm': { column: 'rear_shoulder_room_mm', min: 1000, max: 1700 },
  'front_hip_room_mm': { column: 'front_hip_room_mm', min: 1000, max: 1700 },
  'rear_hip_room_mm': { column: 'rear_hip_room_mm', min: 1000, max: 1700 },
  'cargo_l': { column: 'trunk_volume_liters', min: 10, max: 3000 },
  'cargo_max_l': { column: 'trunk_volume_max_liters', min: 10, max: 3000 },
  'trunk_volume_liters': { column: 'trunk_volume_liters', min: 10, max: 3000 },
  'trunk_volume_max_liters': { column: 'trunk_volume_max_liters', min: 10, max: 3000 },
  'fuel_tank_liters': { column: 'fuel_tank_liters', min: 5, max: 200 },
  'fuel_tank_l': { column: 'fuel_tank_liters', min: 5, max: 200 },
  'seating_capacity': { column: 'seating_capacity', min: 1, max: 12 },
  'seats': { column: 'seating_capacity', min: 1, max: 12 },
  'rear_bench_width_mm': { column: 'rear_bench_width_mm', min: 800, max: 1800 },
  'rear_bench_width_total_mm': { column: 'rear_bench_width_total_mm', min: 800, max: 1800 },
};

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  26-DIMS-FROM-RAW-DEEP');
  console.log('  Deep mining of JSONB raw_data for dimensions');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load existing dims
  const existingDims = await paginateAll('interior_dimensions', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of existingDims) dimsByGenId.set(d.generation_id, d);
  console.log(`  Existing interior_dims: ${dimsByGenId.size}`);

  // Load rich spec_types
  console.log('  Loading rich JSONB specs...');
  const intDimSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, raw_data',
    (q: any) => q.in('spec_type', ['interior_dimensions', 'exterior_dimensions', 'weight_capacities']).not('raw_data', 'is', null)
  );
  console.log(`  Rich JSONB specs: ${intDimSpecs.length}`);

  // Group by generation
  const specsByGen = new Map<string, any[]>();
  for (const s of intDimSpecs) {
    if (!specsByGen.has(s.generation_id)) specsByGen.set(s.generation_id, []);
    specsByGen.get(s.generation_id)!.push(s);
  }
  console.log(`  Unique gens with rich specs: ${specsByGen.size}`);

  const stats = {
    newRows: 0,
    updatedRows: 0,
    fieldsAdded: 0,
    trunkFilled: 0,
    headroomFilled: 0,
    legroomFilled: 0,
    fuelTankFilled: 0,
    seatsFilled: 0,
  };

  const toUpsert: any[] = [];

  for (const [genId, genSpecs] of Array.from(specsByGen.entries())) {
    const existing = dimsByGenId.get(genId);
    const row: any = { generation_id: genId };
    let fields = 0;

    for (const spec of genSpecs) {
      const rd = spec.raw_data;
      if (!rd || typeof rd !== 'object') continue;

      // Extract from interior_dimensions raw_data
      if (spec.spec_type === 'interior_dimensions') {
        for (const [rawKey, mapping] of Object.entries(INT_DIM_MAP)) {
          if (rd[rawKey] !== undefined && rd[rawKey] !== null) {
            const val = typeof rd[rawKey] === 'number' ? rd[rawKey] : parseFloat(rd[rawKey]);
            if (isNaN(val) || val < mapping.min || val > mapping.max) continue;
            // Only fill if existing is NULL
            if (existing && existing[mapping.column] !== null && existing[mapping.column] !== undefined) continue;
            if (row[mapping.column] !== undefined) continue; // Already set from another spec
            row[mapping.column] = Math.round(val);
            fields++;
            if (mapping.column === 'trunk_volume_liters') stats.trunkFilled++;
            if (mapping.column.includes('headroom')) stats.headroomFilled++;
            if (mapping.column.includes('legroom')) stats.legroomFilled++;
            if (mapping.column === 'fuel_tank_liters') stats.fuelTankFilled++;
            if (mapping.column === 'seating_capacity') stats.seatsFilled++;
          }
        }
      }

      // Extract from exterior_dimensions — we can't write to generations table exterior columns
      // but we can extract trunk/fuel if present
      if (spec.spec_type === 'exterior_dimensions') {
        // Some exterior specs may contain cargo info
        if (rd.cargo_l && !existing?.trunk_volume_liters && !row.trunk_volume_liters) {
          const val = typeof rd.cargo_l === 'number' ? rd.cargo_l : parseFloat(rd.cargo_l);
          if (!isNaN(val) && val >= 10 && val <= 3000) {
            row.trunk_volume_liters = Math.round(val);
            fields++;
            stats.trunkFilled++;
          }
        }
      }

      // Extract from weight_capacities — fuel tank
      if (spec.spec_type === 'weight_capacities') {
        if (rd.fuel_tank_l && !existing?.fuel_tank_liters && !row.fuel_tank_liters) {
          const val = typeof rd.fuel_tank_l === 'number' ? rd.fuel_tank_l : parseFloat(rd.fuel_tank_l);
          if (!isNaN(val) && val >= 5 && val <= 200) {
            row.fuel_tank_liters = Math.round(val);
            fields++;
            stats.fuelTankFilled++;
          }
        }
      }
    }

    if (fields > 0) {
      toUpsert.push(row);
      if (existing) stats.updatedRows++;
      else stats.newRows++;
      stats.fieldsAdded += fields;
    }
  }

  console.log(`\n  Results:`);
  console.log(`    New rows:     ${stats.newRows}`);
  console.log(`    Updated rows: ${stats.updatedRows}`);
  console.log(`    Fields added: ${stats.fieldsAdded}`);
  console.log(`    Trunk:        +${stats.trunkFilled}`);
  console.log(`    Headroom:     +${stats.headroomFilled}`);
  console.log(`    Legroom:      +${stats.legroomFilled}`);
  console.log(`    Fuel tank:    +${stats.fuelTankFilled}`);
  console.log(`    Seats:        +${stats.seatsFilled}`);

  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Upserting ${toUpsert.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  const totalDims = dimsByGenId.size + stats.newRows;
  console.log('\n' + '='.repeat(60));
  console.log('  DEEP MINING RESULTS');
  console.log('='.repeat(60));
  console.log(`  New rows:     ${stats.newRows}`);
  console.log(`  Updated rows: ${stats.updatedRows}`);
  console.log(`  Fields added: ${stats.fieldsAdded}`);
  console.log(`  Coverage:     ${dimsByGenId.size} → ${totalDims} / 4268 (${(totalDims / 4268 * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'dims-raw-deep-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: dimsByGenId.size, after: totalDims }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
