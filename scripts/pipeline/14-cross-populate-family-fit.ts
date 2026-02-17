/**
 * 14-cross-populate-family-fit.ts — Fill family_fit_compatibility from interior_dimensions
 *
 * For generations that have interior_dimensions but no family_fit row,
 * creates a family_fit_compatibility entry using available measurements.
 *
 * Derives:
 *   - rear_headroom_mm from interior_dimensions.rear_headroom_mm
 *   - rear_legroom_max_mm from interior_dimensions.rear_legroom_mm
 *   - rear_bench_width_usable_mm from interior_dimensions.rear_bench_width_mm
 *   - three_across scoring based on bench width thresholds
 *   - seat fit ratings based on headroom/legroom
 *
 * For existing family_fit rows, fills NULL fields only.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/14-cross-populate-family-fit.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/14-cross-populate-family-fit.ts
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

// Three-across scoring by usable bench width
function threeAcrossScore(benchWidthMm: number): { possible: boolean; score: string } {
  if (benchWidthMm >= 1450) return { possible: true, score: 'excellent' };
  if (benchWidthMm >= 1380) return { possible: true, score: 'good' };
  if (benchWidthMm >= 1320) return { possible: true, score: 'tight' };
  return { possible: false, score: 'not_recommended' };
}

// Seat fit rating based on headroom and legroom
function seatFitRating(headroomMm: number | null, legroomMm: number | null): string | null {
  if (!headroomMm && !legroomMm) return null;
  const h = headroomMm || 950; // default OK
  const l = legroomMm || 800;
  if (h >= 980 && l >= 850) return 'excellent';
  if (h >= 950 && l >= 780) return 'good';
  if (h >= 920 && l >= 700) return 'tight';
  return 'not_recommended';
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  14-CROSS-POPULATE-FAMILY-FIT');
  console.log('  Fill family_fit from interior_dimensions');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load existing data
  console.log('\n  Loading DB...');
  const dims = await paginateAll('interior_dimensions', '*');
  const dimsByGenId = new Map<string, any>();
  for (const d of dims) dimsByGenId.set(d.generation_id, d);
  console.log(`  Interior dimensions: ${dims.length}`);

  const fits = await paginateAll('family_fit_compatibility', '*');
  const fitsByGenId = new Map<string, any>();
  for (const f of fits) fitsByGenId.set(f.generation_id, f);
  console.log(`  Existing family_fit: ${fits.length}`);

  // Process
  const stats = {
    newRows: 0,
    updatedRows: 0,
    fieldsAdded: 0,
    alreadyComplete: 0,
    noDimsData: 0,
  };

  const toUpsert: any[] = [];

  for (const dim of dims) {
    const genId = dim.generation_id;
    const existing = fitsByGenId.get(genId);

    // Derive family_fit fields from interior_dimensions
    const derived: Record<string, any> = {};

    if (dim.rear_headroom_mm) derived.rear_headroom_mm = dim.rear_headroom_mm;
    if (dim.rear_legroom_mm) derived.rear_legroom_max_mm = dim.rear_legroom_mm;

    // Bench width: prefer rear_bench_width_total_mm, fallback to rear_bench_width_mm
    const benchWidth = dim.rear_bench_width_total_mm || dim.rear_bench_width_mm;
    if (benchWidth) {
      derived.rear_bench_width_usable_mm = benchWidth;
      derived.rear_bench_width_total_mm = benchWidth;
    }

    // Seat fit ratings
    const infantFit = seatFitRating(dim.rear_headroom_mm, dim.rear_legroom_mm);
    const toddlerFit = seatFitRating(dim.rear_headroom_mm, dim.rear_legroom_mm);
    const boosterFit = seatFitRating(dim.rear_headroom_mm, dim.rear_legroom_mm);
    if (infantFit) derived.infant_seat_fit = infantFit;
    if (toddlerFit) derived.toddler_seat_fit = toddlerFit;
    if (boosterFit) derived.booster_seat_fit = boosterFit;

    // Three-across
    if (benchWidth) {
      const ta = threeAcrossScore(benchWidth);
      derived.three_across_possible = ta.possible;
      derived.three_across_fit_score = ta.score;
    }

    // Step-in / door access
    if (dim.step_in_height_rear_mm) derived.door_sill_height_mm = dim.step_in_height_rear_mm;

    // Check if we have anything useful
    const derivedKeys = Object.keys(derived);
    if (derivedKeys.length === 0) { stats.noDimsData++; continue; }

    if (!existing) {
      // New row
      const row: any = {
        generation_id: genId,
        source: 'cross_populated',
        ...derived,
      };
      toUpsert.push(row);
      stats.newRows++;
      stats.fieldsAdded += derivedKeys.length;
    } else {
      // Fill NULLs only
      const updates: any = { generation_id: genId };
      let hasUpdates = false;
      for (const [col, val] of Object.entries(derived)) {
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
  console.log(`  No dims data: ${stats.noDimsData}`);

  // Upsert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Upserting ${toUpsert.length} rows...`);
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('family_fit_compatibility').upsert(batch, {
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

  // Results
  const genCount = 4268;
  const newTotal = fits.length + stats.newRows;
  console.log('\n' + '='.repeat(60));
  console.log('  CROSS-POPULATE FAMILY-FIT RESULTS');
  console.log('='.repeat(60));
  console.log(`  Before:      ${fits.length} / ${genCount} (${(fits.length / genCount * 100).toFixed(1)}%)`);
  console.log(`  New rows:    +${stats.newRows}`);
  console.log(`  Updated:     ${stats.updatedRows} rows (${stats.fieldsAdded} fields filled)`);
  console.log(`  After:       ${newTotal} / ${genCount} (${(newTotal / genCount * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'cross-populate-family-fit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: fits.length, after: newTotal }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
