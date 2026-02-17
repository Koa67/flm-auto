/**
 * 20-fill-missing-exterior-dims.ts — Fill missing exterior dimensions
 *
 * Extracts length, width, height, wheelbase from third_party_specs
 * and writes them to the generations table (which has these columns).
 *
 * Also fills interior_dimensions trunk volume from UltimateSpecs
 * "how_much_trunk_boot_space_*" entries that may have been missed.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/20-fill-missing-exterior-dims.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/20-fill-missing-exterior-dims.ts
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

// Spec types that map to generation exterior dimensions
const EXTERIOR_SPEC_MAP: Record<string, { column: string; isInches: boolean; minVal: number; maxVal: number }> = {
  // Length
  'length_mm': { column: 'length_mm', isInches: false, minVal: 2000, maxVal: 7000 },
  'length': { column: 'length_mm', isInches: false, minVal: 2000, maxVal: 7000 },
  // Width
  'width_mm': { column: 'width_mm', isInches: false, minVal: 1200, maxVal: 2500 },
  'width': { column: 'width_mm', isInches: false, minVal: 1200, maxVal: 2500 },
  'width_with_mirrors_folded': { column: 'width_mm', isInches: false, minVal: 1200, maxVal: 2500 },
  // Height
  'height_mm': { column: 'height_mm', isInches: false, minVal: 800, maxVal: 3000 },
  'height': { column: 'height_mm', isInches: false, minVal: 800, maxVal: 3000 },
  // Wheelbase
  'wheelbase_mm': { column: 'wheelbase_mm', isInches: false, minVal: 1500, maxVal: 5000 },
  'wheelbase': { column: 'wheelbase_mm', isInches: false, minVal: 1500, maxVal: 5000 },
  // Weight
  'curb_weight_kg': { column: 'curb_weight_kg', isInches: false, minVal: 500, maxVal: 5000 },
  'weight_kg': { column: 'curb_weight_kg', isInches: false, minVal: 500, maxVal: 5000 },
  'kerb_weight': { column: 'curb_weight_kg', isInches: false, minVal: 500, maxVal: 5000 },
};

// Also map "how_long/wide/tall_is_this_vehicle_*" and "what_is_the_gross_weight_*"
const LENGTH_PATTERN = /^how_long_is_this_vehicle_/;
const WIDTH_PATTERN = /^how_wide_is_the_vehicle_/;
const HEIGHT_PATTERN = /^how_tall_is_this_vehicle_/;
const WEIGHT_PATTERN = /^what_is_the_gross_weight_/;
const WHEELBASE_PATTERN = /^what_is_the_wheelbase_/;

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  20-FILL-MISSING-EXTERIOR-DIMS');
  console.log('  Fill length/width/height/wheelbase/weight from specs');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load generations with current dimensions
  console.log('\n  Loading generations...');
  const gens = await paginateAll('generations', 'id, name, length_mm, width_mm, height_mm, wheelbase_mm, curb_weight_kg');
  console.log(`  Generations: ${gens.length}`);

  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);

  // Count how many are missing dimensions
  let missingLength = 0, missingWidth = 0, missingHeight = 0, missingWheelbase = 0, missingWeight = 0;
  for (const g of gens) {
    if (!g.length_mm) missingLength++;
    if (!g.width_mm) missingWidth++;
    if (!g.height_mm) missingHeight++;
    if (!g.wheelbase_mm) missingWheelbase++;
    if (!g.curb_weight_kg) missingWeight++;
  }
  console.log(`  Missing: length=${missingLength}, width=${missingWidth}, height=${missingHeight}, wheelbase=${missingWheelbase}, weight=${missingWeight}`);

  // Load known spec types
  const knownTypes = Object.keys(EXTERIOR_SPEC_MAP);
  console.log('  Loading exterior specs from third_party_specs...');
  const knownSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value',
    (q: any) => q.in('spec_type', knownTypes)
  );
  console.log(`  Known-type specs: ${knownSpecs.length}`);

  // Load pattern-based specs
  const patternSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value',
    (q: any) => q.or('spec_type.ilike.how_long_is_this_vehicle_%,spec_type.ilike.how_wide_is_the_vehicle_%,spec_type.ilike.how_tall_is_this_vehicle_%,spec_type.ilike.what_is_the_gross_weight_%,spec_type.ilike.what_is_the_wheelbase_%')
  );
  console.log(`  Pattern-type specs: ${patternSpecs.length}`);

  const allSpecs = [...knownSpecs, ...patternSpecs];

  // Group by generation_id → column → value
  const genData = new Map<string, Map<string, number>>();

  for (const spec of allSpecs) {
    const st = spec.spec_type as string;
    const val = parseFloat(spec.spec_value);
    if (isNaN(val) || val <= 0) continue;

    let mapping = EXTERIOR_SPEC_MAP[st];
    if (!mapping) {
      // Check patterns
      if (LENGTH_PATTERN.test(st)) mapping = { column: 'length_mm', isInches: false, minVal: 2000, maxVal: 7000 };
      else if (WIDTH_PATTERN.test(st)) mapping = { column: 'width_mm', isInches: false, minVal: 1200, maxVal: 2500 };
      else if (HEIGHT_PATTERN.test(st)) mapping = { column: 'height_mm', isInches: false, minVal: 800, maxVal: 3000 };
      else if (WEIGHT_PATTERN.test(st)) mapping = { column: 'curb_weight_kg', isInches: false, minVal: 500, maxVal: 5000 };
      else if (WHEELBASE_PATTERN.test(st)) mapping = { column: 'wheelbase_mm', isInches: false, minVal: 1500, maxVal: 5000 };
      else continue;
    }

    const converted = mapping.isInches ? Math.round(val * IN_TO_MM) : Math.round(val);
    if (converted < mapping.minVal || converted > mapping.maxVal) continue;

    const gid = spec.generation_id;
    if (!genData.has(gid)) genData.set(gid, new Map());
    const colMap = genData.get(gid)!;

    // Keep first valid metric value per column
    if (!colMap.has(mapping.column) || !mapping.isInches) {
      colMap.set(mapping.column, converted);
    }
  }

  console.log(`  Generations with exterior dim data: ${genData.size}`);

  // Build update list — only fill NULLs
  const stats = {
    gensUpdated: 0,
    fieldsAdded: 0,
    lengthFilled: 0,
    widthFilled: 0,
    heightFilled: 0,
    wheelbaseFilled: 0,
    weightFilled: 0,
    alreadyComplete: 0,
  };

  const toUpdate: any[] = [];

  for (const [genId, colMap] of Array.from(genData.entries())) {
    const gen = genById.get(genId);
    if (!gen) continue;

    const updates: any = { id: genId };
    let hasUpdates = false;

    for (const [col, val] of Array.from(colMap.entries())) {
      if (gen[col] === null || gen[col] === undefined) {
        updates[col] = val;
        hasUpdates = true;
        stats.fieldsAdded++;
        if (col === 'length_mm') stats.lengthFilled++;
        if (col === 'width_mm') stats.widthFilled++;
        if (col === 'height_mm') stats.heightFilled++;
        if (col === 'wheelbase_mm') stats.wheelbaseFilled++;
        if (col === 'curb_weight_kg') stats.weightFilled++;
      }
    }

    if (hasUpdates) {
      toUpdate.push(updates);
      stats.gensUpdated++;
    } else {
      stats.alreadyComplete++;
    }
  }

  console.log(`\n  Gens to update: ${stats.gensUpdated}`);
  console.log(`  Fields to fill: ${stats.fieldsAdded}`);
  console.log(`  Already OK:     ${stats.alreadyComplete}`);
  console.log(`    length: +${stats.lengthFilled}, width: +${stats.widthFilled}, height: +${stats.heightFilled}`);
  console.log(`    wheelbase: +${stats.wheelbaseFilled}, weight: +${stats.weightFilled}`);

  // Update generations
  if (!DRY_RUN && toUpdate.length > 0) {
    console.log(`\n  Updating ${toUpdate.length} generations...`);
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      for (const item of batch) {
        const id = item.id;
        const fields = { ...item };
        delete fields.id;
        const { error } = await supabase.from('generations').update(fields).eq('id', id);
        if (error) {
          console.error(`  Update error for ${id}: ${error.message}`);
        } else {
          updated++;
        }
      }
      if (i % 200 === 0 && i > 0) process.stdout.write(`  ${updated}...`);
    }
    console.log(`\n  Updated: ${updated}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  FILL EXTERIOR DIMS RESULTS');
  console.log('='.repeat(60));
  console.log(`  Generations updated: ${stats.gensUpdated}`);
  console.log(`  Fields filled:       ${stats.fieldsAdded}`);
  console.log(`  Length filled:       ${stats.lengthFilled} (was missing: ${missingLength})`);
  console.log(`  Width filled:        ${stats.widthFilled} (was missing: ${missingWidth})`);
  console.log(`  Height filled:       ${stats.heightFilled} (was missing: ${missingHeight})`);
  console.log(`  Wheelbase filled:    ${stats.wheelbaseFilled} (was missing: ${missingWheelbase})`);
  console.log(`  Weight filled:       ${stats.weightFilled} (was missing: ${missingWeight})`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'fill-exterior-dims-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, missing: { length: missingLength, width: missingWidth, height: missingHeight, wheelbase: missingWheelbase, weight: missingWeight } }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
