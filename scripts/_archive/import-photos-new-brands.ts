/**
 * FLM AUTO - Import NEW brand photos to Database
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

async function importPhotos() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Photos (New Brands)                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const photosFile = path.join(__dirname, '../data/vehicle-photos-new-brands.json');
  const photos = JSON.parse(fs.readFileSync(photosFile, 'utf-8'));

  console.log(`Loaded ${photos.length} photos\n`);

  // Group by generation_id (keep best 3 per generation)
  const byGeneration = new Map<string, any[]>();
  
  for (const photo of photos) {
    if (!byGeneration.has(photo.generation_id)) {
      byGeneration.set(photo.generation_id, []);
    }
    const existing = byGeneration.get(photo.generation_id)!;
    if (existing.length < 3) {
      existing.push(photo);
    }
  }

  console.log(`Unique generations with photos: ${byGeneration.size}`);

  // Prepare for insert
  const toInsert: any[] = [];

  for (const [genId, genPhotos] of byGeneration) {
    for (let i = 0; i < genPhotos.length; i++) {
      const p = genPhotos[i];
      toInsert.push({
        generation_id: p.generation_id,
        image_type: 'exterior',
        url: p.url,
        thumbnail_url: p.thumbnail_url,
        is_primary: i === 0,
        display_order: i,
      });
    }
  }

  console.log(`Photos to insert: ${toInsert.length}`);

  // Insert in batches
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('vehicle_images')
      .insert(batch);

    if (error) {
      console.error(`❌ Batch error at ${i}: ${error.message}`);
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

  // Count total
  const { count } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  New photos inserted: ${inserted}`);
  console.log(`  Total photos in DB: ${count}`);
  console.log(`  Generations covered: ${byGeneration.size}`);
  console.log('\n✅ Done!');
}

importPhotos().catch(console.error);
