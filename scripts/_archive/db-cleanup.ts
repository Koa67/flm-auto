/**
 * FLM AUTO — Database Cleanup & Audit Script
 * Reports orphans, duplicates, and table statistics
 * Run with --execute to actually delete orphans (default: dry-run)
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/db-cleanup.ts [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = !process.argv.includes('--execute');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) { console.error(`  Error querying ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return -1;
  return count || 0;
}

async function main() {
  console.log('🧹 FLM AUTO — Database Cleanup & Audit');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (use --execute to delete)' : '⚠️  EXECUTE MODE'}\n`);

  // ─── Table Statistics ──────────────────────────────────
  console.log('═══ TABLE STATISTICS ═══\n');

  const tables = [
    'brands', 'models', 'generations', 'engine_variants',
    'vehicle_images', 'vehicle_videos', 'safety_ratings',
    'third_party_specs', 'interior_dimensions',
    'family_fit_compatibility', 'child_seats',
    'vehicle_appearances', 'media_references',
    'trims', 'equipment', 'trim_equipment',
    'ux_ratings', 'reliability_issues',
    'vehicle_pricing', 'newsletter_subscribers',
  ];

  for (const table of tables) {
    const count = await countRows(table);
    const emoji = count > 10000 ? '🔥' : count > 1000 ? '📊' : count > 0 ? '✅' : '⚪';
    console.log(`  ${emoji} ${table.padEnd(30)} ${count.toLocaleString().padStart(10)} rows`);
  }

  // ─── Orphan Images ─────────────────────────────────────
  console.log('\n═══ ORPHAN CHECK ═══\n');

  // Get all generation IDs
  const gens = await paginateAll('generations', 'id');
  const genIds = new Set(gens.map(g => g.id));
  console.log(`  📋 Total generations: ${genIds.size}`);

  // Check orphan images (sample)
  const { count: orphanImages } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true })
    .not('generation_id', 'is', null)
    .filter('generation_id', 'not.in', `(${[...genIds].slice(0, 100).join(',')})`);
  // Note: This is an approximation — full orphan check requires RPC for large datasets

  // Check orphan specs
  console.log('  📋 Checking third_party_specs...');
  const specSample = await paginateAll('third_party_specs', 'id, generation_id');
  const orphanSpecs = specSample.filter(s => s.generation_id && !genIds.has(s.generation_id));
  console.log(`  ${orphanSpecs.length > 0 ? '⚠️' : '✅'} Orphan specs: ${orphanSpecs.length}`);

  if (orphanSpecs.length > 0 && !DRY_RUN) {
    const ids = orphanSpecs.map(s => s.id);
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      await supabase.from('third_party_specs').delete().in('id', batch);
    }
    console.log(`  🗑️  Deleted ${orphanSpecs.length} orphan specs`);
  }

  // ─── Duplicate Generations ─────────────────────────────
  console.log('\n═══ DUPLICATE CHECK ═══\n');

  const allGens = await paginateAll('generations', 'id, name, slug, model_id, internal_code');
  const dupeMap = new Map<string, any[]>();

  for (const g of allGens) {
    const key = `${g.model_id}_${g.slug}`;
    if (!dupeMap.has(key)) dupeMap.set(key, []);
    dupeMap.get(key)!.push(g);
  }

  const dupes = [...dupeMap.entries()].filter(([, v]) => v.length > 1);
  console.log(`  ${dupes.length > 0 ? '⚠️' : '✅'} Duplicate generations (same model+slug): ${dupes.length}`);

  if (dupes.length > 0) {
    for (const [key, entries] of dupes.slice(0, 10)) {
      console.log(`    ${key}: ${entries.map((e: any) => e.internal_code || e.name).join(', ')}`);
    }
    if (dupes.length > 10) console.log(`    ... and ${dupes.length - 10} more`);
  }

  // ─── Empty tables check ────────────────────────────────
  console.log('\n═══ EMPTY FEATURE TABLES ═══\n');

  const featureTables = ['trims', 'ux_ratings', 'reliability_issues', 'vehicle_pricing'];
  for (const table of featureTables) {
    const count = await countRows(table);
    const status = count === 0 ? '⚪ EMPTY — needs seeding' : `✅ ${count} rows`;
    console.log(`  ${table.padEnd(25)} ${status}`);
  }

  // ─── Summary ───────────────────────────────────────────
  console.log('\n═══ SUMMARY ═══\n');
  console.log(`  Generations: ${genIds.size}`);
  console.log(`  Orphan specs: ${orphanSpecs.length}`);
  console.log(`  Duplicate generations: ${dupes.length}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);

  if (DRY_RUN && (orphanSpecs.length > 0 || dupes.length > 0)) {
    console.log('\n  ℹ️  Run with --execute to clean up');
  }

  console.log('\n🎉 Audit complete!');
}

main().catch(console.error);
