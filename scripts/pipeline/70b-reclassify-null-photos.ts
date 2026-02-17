/**
 * 70b-reclassify-null-photos.ts — Reclassify null-confidence images
 *
 * 59K+ images from Wikimedia Commons have null confidence.
 * Since Wikimedia Commons is a legitimate CC-licensed source, these deserve A confidence.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/70b-reclassify-null-photos.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/70b-reclassify-null-photos.ts
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  70b-RECLASSIFY-NULL-PHOTOS');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Count null-confidence images by source
  console.log('\n  Counting null-confidence images...');

  // Wikimedia Commons (main source name)
  const { count: wikiCount } = await supabase
    .from('vehicle_images')
    .select('id', { count: 'exact', head: true })
    .is('confidence', null)
    .eq('source', 'Wikimedia Commons');

  const { count: wiki2Count } = await supabase
    .from('vehicle_images')
    .select('id', { count: 'exact', head: true })
    .is('confidence', null)
    .eq('source', 'wikimedia_commons');

  const { count: wikiPediaCount } = await supabase
    .from('vehicle_images')
    .select('id', { count: 'exact', head: true })
    .is('confidence', null)
    .eq('source', 'Wikipedia');

  const { count: pexelsCount } = await supabase
    .from('vehicle_images')
    .select('id', { count: 'exact', head: true })
    .is('confidence', null)
    .eq('source', 'Pexels');

  const { count: nullSrcCount } = await supabase
    .from('vehicle_images')
    .select('id', { count: 'exact', head: true })
    .is('confidence', null)
    .is('source', null);

  console.log(`  Wikimedia Commons: ${wikiCount}`);
  console.log(`  wikimedia_commons: ${wiki2Count}`);
  console.log(`  Wikipedia: ${wikiPediaCount}`);
  console.log(`  Pexels: ${pexelsCount}`);
  console.log(`  null source: ${nullSrcCount}`);

  const totalToUpdate = (wikiCount || 0) + (wiki2Count || 0) + (wikiPediaCount || 0) + (pexelsCount || 0);
  console.log(`\n  Total to reclassify as A: ${totalToUpdate}`);

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no writes');
    return;
  }

  // Batch update: Wikimedia Commons → A
  console.log('\n  Updating Wikimedia Commons → A...');
  const { error: e1, count: c1 } = await supabase
    .from('vehicle_images')
    .update({ confidence: 'A' })
    .is('confidence', null)
    .eq('source', 'Wikimedia Commons');
  if (e1) console.error(`  Error: ${e1.message}`);
  else console.log(`  Updated: ${c1 ?? 'unknown count'}`);

  // wikimedia_commons → A
  const { error: e2, count: c2 } = await supabase
    .from('vehicle_images')
    .update({ confidence: 'A' })
    .is('confidence', null)
    .eq('source', 'wikimedia_commons');
  if (e2) console.error(`  Error: ${e2.message}`);
  else console.log(`  Updated wikimedia_commons: ${c2 ?? 'unknown count'}`);

  // Wikipedia → A
  const { error: e3, count: c3 } = await supabase
    .from('vehicle_images')
    .update({ confidence: 'A' })
    .is('confidence', null)
    .eq('source', 'Wikipedia');
  if (e3) console.error(`  Error: ${e3.message}`);
  else console.log(`  Updated Wikipedia: ${c3 ?? 'unknown count'}`);

  // Pexels → B (stock photos, less reliable match)
  const { error: e4, count: c4 } = await supabase
    .from('vehicle_images')
    .update({ confidence: 'B' })
    .is('confidence', null)
    .eq('source', 'Pexels');
  if (e4) console.error(`  Error: ${e4.message}`);
  else console.log(`  Updated Pexels → B: ${c4 ?? 'unknown count'}`);

  console.log('\n  Done!');
}

main().catch(console.error);
