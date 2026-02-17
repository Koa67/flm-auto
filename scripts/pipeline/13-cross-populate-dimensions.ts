/**
 * 13-cross-populate-dimensions.ts — Fill interior_dimensions from third_party_specs
 *
 * Extracts dimensional data (headroom, legroom, shoulder room, hip room,
 * trunk volume, fuel tank) from third_party_specs and populates
 * interior_dimensions rows — either creating new ones or filling NULLs.
 *
 * US measurements (inches) are auto-converted to mm.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/13-cross-populate-dimensions.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/13-cross-populate-dimensions.ts
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
const IN_TO_MM = 25.4;

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

// Mapping: spec_type → { column in interior_dimensions, conversion type }
const SPEC_TO_COLUMN: Record<string, { column: string; isInches: boolean }> = {
  // Metric (mm) — from ADAC/EU sources
  'headroom_front_mm':       { column: 'front_headroom_mm', isInches: false },
  'headroom_rear_mm':        { column: 'rear_headroom_mm', isInches: false },
  'legroom_front_mm':        { column: 'front_legroom_mm', isInches: false },
  'legroom_rear_mm':         { column: 'rear_legroom_mm', isInches: false },
  'shoulder_room_front_mm':  { column: 'front_shoulder_room_mm', isInches: false },
  'shoulder_room_rear_mm':   { column: 'rear_shoulder_room_mm', isInches: false },
  'rear_hip_room_mm':        { column: 'rear_hip_room_mm', isInches: false },

  // US (inches → mm)
  'us_front_head_room':      { column: 'front_headroom_mm', isInches: true },
  'us_rear_head_room':       { column: 'rear_headroom_mm', isInches: true },
  'us_front_legroom':        { column: 'front_legroom_mm', isInches: true },
  'us_rear_seat_legroom':    { column: 'rear_legroom_mm', isInches: true },
  'us_front_shoulder_room':  { column: 'front_shoulder_room_mm', isInches: true },
  'us_rear_shoulder_room':   { column: 'rear_shoulder_room_mm', isInches: true },
  'us_front_hip_room':       { column: 'front_hip_room_mm', isInches: true },
  'us_rear_hip_room':        { column: 'rear_hip_room_mm', isInches: true },

  // Volumes (liters, direct)
  'trunk_boot_space_minimum': { column: 'trunk_volume_liters', isInches: false },
  'cargo_volume_liters':      { column: 'trunk_volume_liters', isInches: false },
  'fuel_tank_capacity':       { column: 'fuel_tank_liters', isInches: false },
};

// Pattern for "how_much_trunk_boot_space_*" UltimateSpecs types
const TRUNK_PATTERN = /^how_much_trunk_boot_space_/;

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  13-CROSS-POPULATE-DIMENSIONS');
  console.log('  Fill interior_dimensions from third_party_specs');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Load existing interior_dimensions
  console.log('\n  Loading interior_dimensions...');
  const dims = await paginateAll('interior_dimensions', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of dims) dimsByGenId.set(d.generation_id, d);
  console.log(`  Existing: ${dims.length}`);

  // 2. Load relevant specs — known types via .in(), trunk patterns via .ilike()
  console.log('  Loading dimensional specs from third_party_specs...');
  const knownTypes = Object.keys(SPEC_TO_COLUMN);
  const knownSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value',
    (q: any) => q.in('spec_type', knownTypes)
  );
  console.log(`  Known-type specs: ${knownSpecs.length}`);

  // Load trunk_boot_space patterns
  const trunkSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value',
    (q: any) => q.ilike('spec_type', 'how_much_trunk_boot_space_%')
  );
  console.log(`  Trunk-pattern specs: ${trunkSpecs.length}`);

  const allSpecs = [...knownSpecs, ...trunkSpecs];
  console.log(`  Total relevant specs: ${allSpecs.length}`);

  // 3. Group by generation_id → column → best value
  // Priority: metric > US-converted, and first valid value wins per source priority
  const genData = new Map<string, Map<string, number>>();

  for (const spec of allSpecs) {
    const st = spec.spec_type as string;
    const val = parseFloat(spec.spec_value);
    if (isNaN(val) || val <= 0) continue;

    let mapping = SPEC_TO_COLUMN[st];
    if (!mapping && TRUNK_PATTERN.test(st)) {
      mapping = { column: 'trunk_volume_liters', isInches: false };
    }
    if (!mapping) continue;

    const gid = spec.generation_id;
    if (!genData.has(gid)) genData.set(gid, new Map());
    const colMap = genData.get(gid)!;

    // Convert
    const converted = mapping.isInches ? Math.round(val * IN_TO_MM) : Math.round(val);

    // Sanity checks
    if (mapping.column.includes('_mm') && (converted < 100 || converted > 5000)) continue;
    if (mapping.column === 'trunk_volume_liters' && (converted < 10 || converted > 3000)) continue;
    if (mapping.column === 'fuel_tank_liters' && (converted < 5 || converted > 200)) continue;

    // Prefer metric (non-inch) over inch-converted
    if (colMap.has(mapping.column) && mapping.isInches) continue;
    colMap.set(mapping.column, converted);
  }

  console.log(`  Generations with usable dim data: ${genData.size}`);

  // 4. Build upsert list
  const stats = {
    newRows: 0,
    updatedRows: 0,
    fieldsAdded: 0,
    alreadyComplete: 0,
  };

  const toUpsert: any[] = [];

  for (const [genId, colMap] of Array.from(genData.entries())) {
    const existing = dimsByGenId.get(genId);

    if (!existing) {
      // New row
      const row: any = { generation_id: genId };
      for (const [col, val] of Array.from(colMap.entries())) {
        row[col] = val;
        stats.fieldsAdded++;
      }
      toUpsert.push(row);
      stats.newRows++;
    } else {
      // Fill NULLs only
      const updates: any = { generation_id: genId };
      let hasUpdates = false;
      for (const [col, val] of Array.from(colMap.entries())) {
        if (existing[col] === null || existing[col] === undefined) {
          updates[col] = val;
          hasUpdates = true;
          stats.fieldsAdded++;
        }
      }
      if (hasUpdates) {
        toUpsert.push(updates);
        stats.updatedRows++;
      } else {
        stats.alreadyComplete++;
      }
    }
  }

  console.log(`\n  New rows:     ${stats.newRows}`);
  console.log(`  Updated rows: ${stats.updatedRows}`);
  console.log(`  Fields added: ${stats.fieldsAdded}`);
  console.log(`  Already OK:   ${stats.alreadyComplete}`);

  // 5. Upsert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Upserting ${toUpsert.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // 6. Results
  const genCount = 4268;
  const newTotal = dims.length + stats.newRows;
  console.log('\n' + '='.repeat(60));
  console.log('  CROSS-POPULATE DIMENSIONS RESULTS');
  console.log('='.repeat(60));
  console.log(`  Before:      ${dims.length} / ${genCount} (${(dims.length / genCount * 100).toFixed(1)}%)`);
  console.log(`  New rows:    +${stats.newRows}`);
  console.log(`  Updated:     ${stats.updatedRows} rows (${stats.fieldsAdded} fields filled)`);
  console.log(`  After:       ${newTotal} / ${genCount} (${(newTotal / genCount * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'cross-populate-dims-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: dims.length, after: newTotal }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
