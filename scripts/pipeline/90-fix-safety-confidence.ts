/**
 * 90-fix-safety-confidence.ts — Fix safety_ratings confidence tiers
 *
 * Rules:
 *   1. WITH source_url:
 *      - euroncap.com  → A
 *      - nhtsa.gov     → A
 *      - ancap.com.au  → A
 *      - iihs.org      → A
 *      - jncap         → B
 *      - non-empty + stars >= 1 → minimum B
 *   2. WITHOUT source_url:
 *      - euroncap_id not null → B (propagated from euroncap source)
 *      - confidence D or E + stars null + all pct null → DELETE (empty data)
 *   3. Never downgrade: only upgrade (A > B > C > D > E)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/90-fix-safety-confidence.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/90-fix-safety-confidence.ts
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

// Confidence tier ranking: lower index = better
const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

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

function isBetter(newConf: string, oldConf: string): boolean {
  const newRank = TIER_RANK[newConf] ?? 5;
  const oldRank = TIER_RANK[oldConf] ?? 5;
  return newRank < oldRank;
}

function hasAnyPct(row: any): boolean {
  return (
    row.adult_occupant_pct != null ||
    row.child_occupant_pct != null ||
    row.pedestrian_pct != null ||
    row.safety_assist_pct != null
  );
}

function isEmpty(row: any): boolean {
  return row.stars == null && !hasAnyPct(row);
}

function classifySafetyConfidence(row: any): { action: 'upgrade' | 'delete' | 'skip'; newConf?: string } {
  const sourceUrl = (row.source_url || '').trim();
  const oldConf = row.confidence || 'E';

  // --- Rule 1: WITH source_url ---
  if (sourceUrl.length > 0) {
    let targetConf: string | null = null;

    if (sourceUrl.includes('euroncap.com')) {
      targetConf = 'A';
    } else if (sourceUrl.includes('nhtsa.gov')) {
      targetConf = 'A';
    } else if (sourceUrl.includes('ancap.com.au')) {
      targetConf = 'A';
    } else if (sourceUrl.includes('iihs.org')) {
      targetConf = 'A';
    } else if (sourceUrl.includes('jncap')) {
      targetConf = 'B';
    }

    // If a known source matched, apply if it's an upgrade
    if (targetConf) {
      if (isBetter(targetConf, oldConf)) {
        return { action: 'upgrade', newConf: targetConf };
      }
      return { action: 'skip' };
    }

    // source_url exists, non-empty, not a known authority, but stars >= 1 → minimum B
    if (row.stars != null && row.stars >= 1) {
      if (isBetter('B', oldConf)) {
        return { action: 'upgrade', newConf: 'B' };
      }
    }

    return { action: 'skip' };
  }

  // --- Rule 2: WITHOUT source_url ---
  // euroncap_id not null → B (propagated from euroncap source)
  if (row.euroncap_id != null && String(row.euroncap_id).trim().length > 0) {
    if (isBetter('B', oldConf)) {
      return { action: 'upgrade', newConf: 'B' };
    }
    return { action: 'skip' };
  }

  // confidence D or E + stars null + all pct null → DELETE (empty data)
  if ((oldConf === 'D' || oldConf === 'E') && isEmpty(row)) {
    return { action: 'delete' };
  }

  return { action: 'skip' };
}

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('  90-FIX-SAFETY-CONFIDENCE — Fix safety_ratings confidence tiers');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(70));

  // --- Step 1: Load all safety_ratings ---
  console.log('\n  Step 1: Loading safety_ratings...');
  const rows = await paginateAll(
    'safety_ratings',
    'id, generation_id, stars, source_url, euroncap_id, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, confidence'
  );
  console.log(`  Loaded: ${rows.length} safety ratings`);

  // --- Step 2: Classify each row ---
  console.log('\n  Step 2: Classifying...');

  const upgrades: { id: string; newConf: string; oldConf: string }[] = [];
  const deletes: string[] = [];
  let skipCount = 0;

  // Track tier changes for summary
  const tierChanges: Record<string, number> = {};
  // Track before/after distribution
  const before: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null: 0 };
  const after: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null: 0 };

  for (const row of rows) {
    const oldConf = row.confidence || 'null';
    before[oldConf] = (before[oldConf] || 0) + 1;

    const result = classifySafetyConfidence(row);

    if (result.action === 'upgrade' && result.newConf) {
      upgrades.push({ id: row.id, newConf: result.newConf, oldConf });
      after[result.newConf] = (after[result.newConf] || 0) + 1;

      const key = `${oldConf}->${result.newConf}`;
      tierChanges[key] = (tierChanges[key] || 0) + 1;
    } else if (result.action === 'delete') {
      deletes.push(row.id);
      // deleted rows don't appear in after
      const key = `${oldConf}->DELETED`;
      tierChanges[key] = (tierChanges[key] || 0) + 1;
    } else {
      skipCount++;
      after[oldConf] = (after[oldConf] || 0) + 1;
    }
  }

  // --- Step 3: Print summary ---
  console.log('\n  Step 3: Summary');
  console.log('  ' + '-'.repeat(50));
  console.log(`  Total rows:    ${rows.length}`);
  console.log(`  Upgrades:      ${upgrades.length}`);
  console.log(`  Deletes:       ${deletes.length}`);
  console.log(`  Skipped:       ${skipCount}`);

  console.log('\n  Confidence distribution:');
  console.log('              BEFORE    AFTER');
  for (const c of ['A', 'B', 'C', 'D', 'E', 'null']) {
    const b = before[c] || 0;
    const a = after[c] || 0;
    const delta = a - b;
    const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '  0';
    console.log(`    ${c.padEnd(6)} ${String(b).padStart(6)}   ${String(a).padStart(6)}  (${deltaStr})`);
  }

  console.log('\n  Tier changes breakdown:');
  const sortedChanges = Object.entries(tierChanges).sort((a, b) => b[1] - a[1]);
  if (sortedChanges.length === 0) {
    console.log('    (none)');
  }
  for (const [change, count] of sortedChanges) {
    console.log(`    ${change.padEnd(20)} ${count}`);
  }

  // --- Step 4: Apply changes (if not dry run) ---
  if (!DRY_RUN) {
    console.log('\n  Step 4: Applying changes...');

    // Group upgrades by target confidence for batch efficiency
    const byConf: Record<string, string[]> = {};
    for (const u of upgrades) {
      if (!byConf[u.newConf]) byConf[u.newConf] = [];
      byConf[u.newConf].push(u.id);
    }

    let updatedCount = 0;
    for (const [conf, ids] of Object.entries(byConf)) {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('safety_ratings')
          .update({ confidence: conf })
          .in('id', batch);
        if (error) {
          console.error(`    Batch error conf=${conf} at ${i}: ${error.message}`);
        } else {
          updatedCount += batch.length;
        }
      }
      console.log(`    Updated ${ids.length} rows to confidence=${conf}`);
    }
    console.log(`  Total updated: ${updatedCount}`);

    // Delete empty rows
    if (deletes.length > 0) {
      let deletedCount = 0;
      for (let i = 0; i < deletes.length; i += BATCH_SIZE) {
        const batch = deletes.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('safety_ratings')
          .delete()
          .in('id', batch);
        if (error) {
          console.error(`    Delete batch error at ${i}: ${error.message}`);
        } else {
          deletedCount += batch.length;
        }
      }
      console.log(`  Total deleted: ${deletedCount}`);
    }
  } else {
    console.log('\n  Step 4: SKIPPED (dry run)');
  }

  // --- Step 5: Save report ---
  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    totalRows: rows.length,
    upgrades: upgrades.length,
    deletes: deletes.length,
    skipped: skipCount,
    before,
    after,
    tierChanges,
    upgradeDetails: upgrades.slice(0, 50).map(u => ({
      id: u.id,
      from: u.oldConf,
      to: u.newConf,
    })),
    deleteIds: deletes.slice(0, 50),
  };

  const reportPath = path.join(DATA_DIR, 'phase19-confidence-fix-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: ${reportPath}`);

  console.log('\n  Done.');
}

main().catch(console.error);
