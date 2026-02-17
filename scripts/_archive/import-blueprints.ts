/**
 * FLM AUTO - Import Blueprints to Database
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function importBlueprints() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Import Blueprints                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const blueprintsFile = path.join(__dirname, '../data/vehicle-blueprints.json');
  
  if (!fs.existsSync(blueprintsFile)) {
    console.log('❌ No blueprints file found. Run scrape-blueprints-v2.ts first.');
    return;
  }

  const blueprints = JSON.parse(fs.readFileSync(blueprintsFile, 'utf-8'));
  console.log(`Loaded ${blueprints.length} blueprints\n`);

  if (blueprints.length === 0) {
    console.log('No blueprints to import.');
    return;
  }

  // Prepare for insert (as vehicle_images with type 'blueprint')
  const toInsert = blueprints.map((bp: any, i: number) => ({
    generation_id: bp.generation_id,
    image_type: 'blueprint',
    url: bp.url,
    thumbnail_url: bp.thumbnail_url || bp.url,
    is_primary: false,
    display_order: 100 + i, // After regular photos
  }));

  // Insert
  let inserted = 0;
  const batchSize = 50;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('vehicle_images')
      .insert(batch);

    if (error) {
      console.error(`❌ Batch error: ${error.message}`);
      // Try one by one
      for (const item of batch) {
        const { error: singleError } = await supabase
          .from('vehicle_images')
          .insert(item);
        if (!singleError) inserted++;
      }
    } else {
      inserted += batch.length;
    }

    process.stdout.write(`\r  Inserted: ${inserted}/${toInsert.length}`);
  }

  console.log('\n');

  // Count by type
  const { count: photoCount } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true })
    .eq('image_type', 'exterior');

  const { count: blueprintCount } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true })
    .eq('image_type', 'blueprint');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Photos in DB: ${photoCount}`);
  console.log(`  Blueprints in DB: ${blueprintCount}`);
  console.log(`  Total images: ${(photoCount || 0) + (blueprintCount || 0)}`);
  console.log('\n✅ Done!');
}

importBlueprints().catch(console.error);
