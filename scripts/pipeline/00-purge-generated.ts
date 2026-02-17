/**
 * 00-purge-generated.ts — Remove duplicate and orphan rows from DB
 *
 * What it does:
 * 1. Dedup vehicle_images (same generation_id + url)
 * 2. Dedup third_party_specs (same generation_id + spec_type + source)
 * 3. Dedup vehicle_videos (same generation_id + url)
 * 4. Remove orphan images/specs/videos pointing to deleted generations
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/00-purge-generated.ts
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const DRY_RUN = process.argv.includes('--dry-run');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function fmt(n: number): string { return n.toLocaleString('fr-FR'); }

async function dedupTable(
  table: string,
  keyFn: (row: any) => string,
  select: string = 'id, generation_id, url'
) {
  console.log(`\n--- Dedup ${table} ---`);
  const rows = await paginateAll(table, select);
  console.log(`  Total rows: ${fmt(rows.length)}`);

  const seen = new Map<string, string>(); // key -> first id
  const dupeIds: string[] = [];

  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) {
      dupeIds.push(row.id);
    } else {
      seen.set(key, row.id);
    }
  }

  console.log(`  Duplicates found: ${fmt(dupeIds.length)}`);

  if (dupeIds.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete: ${fmt(dupeIds.length)}`);
    return 0;
  }

  // Delete in batches of 500
  let deleted = 0;
  for (let i = 0; i < dupeIds.length; i += 500) {
    const batch = dupeIds.slice(i, i + 500);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) {
      console.error(`  Delete error: ${error.message}`);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`  Deleted: ${fmt(deleted)}`);
  return deleted;
}

async function removeOrphans(table: string, fkColumn: string = 'generation_id') {
  console.log(`\n--- Remove orphans from ${table} ---`);

  // Get all valid generation IDs
  const gens = await paginateAll('generations', 'id');
  const validIds = new Set(gens.map((g: any) => g.id));
  console.log(`  Valid generations: ${fmt(validIds.size)}`);

  // Get all FK values from target table
  const rows = await paginateAll(table, `id, ${fkColumn}`);
  const orphanIds = rows
    .filter((r: any) => r[fkColumn] && !validIds.has(r[fkColumn]))
    .map((r: any) => r.id);

  console.log(`  Orphan rows found: ${fmt(orphanIds.length)}`);

  if (orphanIds.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete: ${fmt(orphanIds.length)}`);
    return 0;
  }

  let deleted = 0;
  for (let i = 0; i < orphanIds.length; i += 500) {
    const batch = orphanIds.slice(i, i + 500);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) {
      console.error(`  Delete error: ${error.message}`);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`  Deleted: ${fmt(deleted)}`);
  return deleted;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  00-PURGE-GENERATED — Database Cleanup');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'} — ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  let totalDeleted = 0;

  // 1. Dedup vehicle_images
  totalDeleted += await dedupTable(
    'vehicle_images',
    (row) => `${row.generation_id}|${row.url}`,
    'id, generation_id, url'
  );

  // 2. Dedup third_party_specs
  totalDeleted += await dedupTable(
    'third_party_specs',
    (row) => `${row.generation_id}|${row.spec_type}|${row.source}|${row.spec_value}`,
    'id, generation_id, spec_type, source, spec_value'
  );

  // 3. Dedup vehicle_videos (uses video_id, not url)
  totalDeleted += await dedupTable(
    'vehicle_videos',
    (row) => `${row.generation_id}|${row.video_id}`,
    'id, generation_id, video_id'
  );

  // 4. Remove orphans
  totalDeleted += await removeOrphans('vehicle_images');
  totalDeleted += await removeOrphans('third_party_specs');
  totalDeleted += await removeOrphans('vehicle_videos');
  totalDeleted += await removeOrphans('interior_dimensions');

  console.log('\n' + '='.repeat(60));
  console.log(`  TOTAL ROWS PURGED: ${fmt(totalDeleted)}`);
  console.log('='.repeat(60));
  console.log('');
}

main().catch(console.error);
