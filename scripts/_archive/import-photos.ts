/**
 * FLM AUTO - Import Photos to Database
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

interface PhotoData {
  generation_id: string;
  brand: string;
  model: string;
  generation: string;
  source: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
}

async function importPhotos() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Import Photos                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load photos
  const photosFile = path.join(__dirname, '../data/vehicle-photos.json');
  const photos: PhotoData[] = JSON.parse(fs.readFileSync(photosFile, 'utf-8'));

  console.log(`Loaded ${photos.length} photos\n`);

  // Group by generation_id (keep best 3 per generation)
  const byGeneration = new Map<string, PhotoData[]>();
  
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
        is_primary: i === 0, // First photo is primary
        display_order: i,
      });
    }
  }

  console.log(`Photos to insert: ${toInsert.length}`);

  // Clear existing photos (optional)
  const { error: deleteError } = await supabase
    .from('vehicle_images')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.log(`Note: Could not clear existing photos (${deleteError.message})`);
  }

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

  // Summary
  const { count } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Photos in database: ${count}`);
  console.log(`  Generations covered: ${byGeneration.size}/${340}`);
  console.log('\n✅ Done!');
}

importPhotos().catch(console.error);
