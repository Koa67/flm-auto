/**
 * 91-safety-pre-ncap.ts — Mark pre-NCAP era vehicles
 *
 * NCAP crash testing started around 1993-1997. Vehicles whose production
 * ended before 1993 could never have been crash-tested by any NCAP programme.
 *
 * Logic:
 *   1. Load all generations from Supabase (paginateAll)
 *   2. Load all safety_ratings generation_ids to know which are already covered
 *   3. Find generations where:
 *      - production_end < '1993-01-01', OR
 *      - production_end IS NULL AND production_start < '1985-01-01'
 *   4. For those NOT already in safety_ratings, insert a placeholder row:
 *      - stars: null, source_url: null, confidence: 'B'
 *      - all pct fields null, test_year: null
 *   5. Default is --dry-run. Without flag, execute live.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/91-safety-pre-ncap.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/91-safety-pre-ncap.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

const PRE_NCAP_END_CUTOFF = '1993-01-01';       // production_end before this = pre-NCAP
const NULL_END_START_CUTOFF = '1985-01-01';      // if no end date, production_start before this = pre-NCAP

// ═══════════ DB helpers ═══════════

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error(`  paginateAll error on ${table} page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ═══════════ Main ═══════════

async function main() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  91 — Mark Pre-NCAP Era Vehicles             ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log();

  // Step 1: Load all generations
  console.log('  [1/4] Loading all generations...');
  const generations = await paginateAll('generations', 'id, name, production_start, production_end, model_id');
  console.log(`         ${generations.length} generations loaded`);

  // Step 2: Load existing safety_ratings generation_ids
  console.log('  [2/4] Loading existing safety_ratings...');
  const existingRatings = await paginateAll('safety_ratings', 'generation_id');
  const coveredIds = new Set(existingRatings.map((r: any) => r.generation_id));
  console.log(`         ${coveredIds.size} generations already have safety ratings`);

  // Step 3: Find pre-NCAP generations
  console.log('  [3/4] Identifying pre-NCAP generations...');

  const preNcapGens: any[] = [];
  let matchEndBefore1993 = 0;
  let matchNullEndStartBefore1985 = 0;
  let alreadyCovered = 0;

  for (const gen of generations) {
    let isPreNcap = false;

    // Case A: production_end exists and is before 1993-01-01
    if (gen.production_end) {
      const endDate = new Date(gen.production_end);
      if (endDate < new Date(PRE_NCAP_END_CUTOFF)) {
        isPreNcap = true;
        matchEndBefore1993++;
      }
    }
    // Case B: production_end is null AND production_start exists and is before 1985-01-01
    else if (!gen.production_end && gen.production_start) {
      const startDate = new Date(gen.production_start);
      if (startDate < new Date(NULL_END_START_CUTOFF)) {
        isPreNcap = true;
        matchNullEndStartBefore1985++;
      }
    }

    if (!isPreNcap) continue;

    // Skip if already covered
    if (coveredIds.has(gen.id)) {
      alreadyCovered++;
      continue;
    }

    preNcapGens.push(gen);
  }

  console.log(`         Matched (end < 1993): ${matchEndBefore1993}`);
  console.log(`         Matched (no end, start < 1985): ${matchNullEndStartBefore1985}`);
  console.log(`         Already in safety_ratings: ${alreadyCovered}`);
  console.log(`         To insert: ${preNcapGens.length}`);
  console.log();

  // Step 4: Insert
  console.log('  [4/4] Inserting pre-NCAP safety placeholders...');

  let inserted = 0;
  let errors = 0;

  if (!DRY_RUN && preNcapGens.length > 0) {
    for (let i = 0; i < preNcapGens.length; i += BATCH_SIZE) {
      const batch = preNcapGens.slice(i, i + BATCH_SIZE);
      const rows = batch.map((gen: any) => ({
        generation_id: gen.id,
        stars: null,
        source_url: null,
        confidence: 'B',
        adult_occupant_pct: null,
        child_occupant_pct: null,
        pedestrian_pct: null,
        safety_assist_pct: null,
        test_year: null,
      }));

      const { error } = await supabase
        .from('safety_ratings')
        .upsert(rows, { onConflict: 'generation_id', ignoreDuplicates: true });

      if (error) {
        console.error(`    Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
        errors++;
      } else {
        inserted += batch.length;
      }

      if (i % (BATCH_SIZE * 10) === 0 && i > 0) {
        console.log(`    ... ${inserted}/${preNcapGens.length} inserted`);
      }
    }
  } else if (DRY_RUN) {
    console.log(`         (dry-run: would insert ${preNcapGens.length} rows)`);
  }

  // Summary
  console.log();
  console.log('  ════════════════════════════════════════');
  console.log(`  Summary:`);
  console.log(`    Total generations: ${generations.length}`);
  console.log(`    Pre-NCAP candidates: ${matchEndBefore1993 + matchNullEndStartBefore1985}`);
  console.log(`    Already covered: ${alreadyCovered}`);
  console.log(`    Inserted: ${DRY_RUN ? '0 (dry-run)' : inserted}`);
  console.log(`    Errors: ${errors}`);
  console.log('  ════════════════════════════════════════');

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalGenerations: generations.length,
    existingSafetyRatings: coveredIds.size,
    preNcapCandidates: {
      endBefore1993: matchEndBefore1993,
      nullEndStartBefore1985: matchNullEndStartBefore1985,
      total: matchEndBefore1993 + matchNullEndStartBefore1985,
    },
    alreadyCovered,
    toInsert: preNcapGens.length,
    inserted: DRY_RUN ? 0 : inserted,
    errors,
    sampleGenerations: preNcapGens.slice(0, 20).map((g: any) => ({
      id: g.id,
      name: g.name,
      production_start: g.production_start,
      production_end: g.production_end,
    })),
  };

  const reportPath = path.join(DATA_DIR, 'phase19-prencap-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved to ${reportPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
