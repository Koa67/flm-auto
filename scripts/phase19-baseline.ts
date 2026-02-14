/**
 * phase19-baseline.ts — Gather Phase 19 baseline stats
 *
 * Queries:
 *   1. Confidence breakdown from safety_ratings
 *   2. Ratings with source_url but low confidence (C/D/E)
 *   3. Pre-1997 generations without safety ratings
 *   4. Spritmonitor records breakdown by spec_type
 *   5. Gens with real consumption from Spritmonitor
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/phase19-baseline.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

/** Paginate all rows from a table with optional filters */
async function paginateAll(
  table: string,
  select: string,
  filters?: (q: any) => any,
  pageSize = 1000
): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw new Error(`paginateAll(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    queries: {},
  };

  // -- Query 1: Confidence breakdown --
  console.log('\n=== Query 1: Confidence breakdown from safety_ratings ===');
  const allSafety = await paginateAll('safety_ratings', 'confidence');
  const confidenceCounts: Record<string, number> = {};
  for (const row of allSafety) {
    const c = row.confidence || 'NULL';
    confidenceCounts[c] = (confidenceCounts[c] || 0) + 1;
  }
  console.table(confidenceCounts);
  results.queries['1_confidence_breakdown'] = {
    description: 'SELECT confidence, COUNT(*) FROM safety_ratings GROUP BY confidence',
    total_rows: allSafety.length,
    breakdown: confidenceCounts,
  };

  // -- Query 2: Low confidence ratings that have source_url --
  console.log('\n=== Query 2: Ratings with source_url but low confidence (C/D/E) ===');
  const lowConfWithUrl = await paginateAll(
    'safety_ratings',
    'confidence, source_url',
    (q: any) => q.in('confidence', ['C', 'D', 'E']).neq('source_url', '').not('source_url', 'is', null)
  );
  const lowConfCounts: Record<string, number> = {};
  for (const row of lowConfWithUrl) {
    const c = row.confidence || 'NULL';
    lowConfCounts[c] = (lowConfCounts[c] || 0) + 1;
  }
  console.table(lowConfCounts);
  results.queries['2_low_confidence_with_source_url'] = {
    description: 'Ratings with source_url but confidence IN (C, D, E)',
    total: lowConfWithUrl.length,
    breakdown: lowConfCounts,
  };

  // -- Query 3: Pre-1997 generations without safety ratings --
  console.log('\n=== Query 3: Pre-1997 generations without safety ratings ===');
  // Get all generation IDs that have safety ratings
  const safetyGenIds = await paginateAll('safety_ratings', 'generation_id');
  const safetyGenIdSet = new Set(safetyGenIds.map((r: any) => r.generation_id));

  // production_start/production_end are date columns, so compare with date string
  const pre1997 = await paginateAll(
    'generations',
    'id, production_start, production_end',
    (q: any) => q.lt('production_end', '1997-01-01')
  );
  const pre1997WithoutSafety = pre1997.filter((g: any) => !safetyGenIdSet.has(g.id));
  console.log(`Pre-1997 generations total: ${pre1997.length}`);
  console.log(`Pre-1997 generations WITHOUT safety: ${pre1997WithoutSafety.length}`);
  console.log(`Pre-1997 generations WITH safety: ${pre1997.length - pre1997WithoutSafety.length}`);
  results.queries['3_pre1997_without_safety'] = {
    description: 'Generations with production_end < 1997-01-01 and no safety_ratings',
    pre1997_total: pre1997.length,
    pre1997_without_safety: pre1997WithoutSafety.length,
    pre1997_with_safety: pre1997.length - pre1997WithoutSafety.length,
  };

  // -- Query 4: Spritmonitor records in third_party_specs --
  console.log('\n=== Query 4: Spritmonitor records in third_party_specs ===');
  const spritmonitor = await paginateAll(
    'third_party_specs',
    'spec_type, generation_id',
    (q: any) => q.eq('source', 'spritmonitor')
  );
  const specTypeCounts: Record<string, { count: number; unique_gens: Set<string> }> = {};
  for (const row of spritmonitor) {
    if (!specTypeCounts[row.spec_type]) {
      specTypeCounts[row.spec_type] = { count: 0, unique_gens: new Set() };
    }
    specTypeCounts[row.spec_type].count++;
    specTypeCounts[row.spec_type].unique_gens.add(row.generation_id);
  }
  const specTypeOutput: Record<string, { count: number; unique_generations: number }> = {};
  for (const [type, data] of Object.entries(specTypeCounts)) {
    specTypeOutput[type] = { count: data.count, unique_generations: data.unique_gens.size };
    console.log(`  ${type}: ${data.count} records, ${data.unique_gens.size} unique generations`);
  }
  results.queries['4_spritmonitor_breakdown'] = {
    description: 'Spritmonitor records by spec_type with distinct generation counts',
    total_records: spritmonitor.length,
    total_unique_generations: new Set(spritmonitor.map((r: any) => r.generation_id)).size,
    by_spec_type: specTypeOutput,
  };

  // -- Query 5: Gens with real consumption --
  console.log('\n=== Query 5: Gens with real consumption (Spritmonitor) ===');
  const realConsumption = spritmonitor.filter(
    (r: any) => r.spec_type === 'real_consumption_l100km'
  );
  const uniqueRealConsumptionGens = new Set(realConsumption.map((r: any) => r.generation_id));
  console.log(`Records with spec_type=real_consumption_l100km: ${realConsumption.length}`);
  console.log(`Unique generations with real consumption: ${uniqueRealConsumptionGens.size}`);
  results.queries['5_real_consumption_generations'] = {
    description: 'COUNT(DISTINCT generation_id) WHERE source=spritmonitor AND spec_type=real_consumption_l100km',
    records: realConsumption.length,
    unique_generations: uniqueRealConsumptionGens.size,
  };

  // -- Summary --
  console.log('\n=== PHASE 19 BASELINE SUMMARY ===');
  console.log(`Safety ratings total: ${allSafety.length}`);
  console.log(`Confidence breakdown: ${JSON.stringify(confidenceCounts)}`);
  console.log(`Low-conf with source_url: ${lowConfWithUrl.length}`);
  console.log(`Pre-1997 gens without safety: ${pre1997WithoutSafety.length}`);
  console.log(`Spritmonitor total records: ${spritmonitor.length}`);
  console.log(`Gens with real consumption: ${uniqueRealConsumptionGens.size}`);

  // Save to JSON
  const outPath = path.join(__dirname, '..', 'data', 'phase19-baseline.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
