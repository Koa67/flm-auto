/**
 * FLM AUTO — Import YouTube Videos to dedicated table
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

interface Video {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  duration: string;
}

interface VehicleVideos {
  brand: string;
  model: string;
  videos: Video[];
}

interface YouTubeData {
  metadata: any;
  vehicles: VehicleVideos[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function main() {
  console.log('🎬 FLM AUTO — Import YouTube Videos (v2)\n');

  // Check if table exists
  const { error: tableCheck } = await supabase.from('youtube_videos').select('id').limit(1);
  if (tableCheck?.message?.includes('does not exist')) {
    console.log('❌ youtube_videos table missing. Run this SQL first:');
    console.log('   See scripts/sql/create-youtube-table.sql');
    return;
  }

  // Load YouTube data
  const dataPath = path.join(__dirname, '../data/youtube_videos.json');
  if (!fs.existsSync(dataPath)) {
    console.log('❌ youtube_videos.json not found');
    return;
  }
  const data: YouTubeData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`  Loaded ${data.metadata.totalVideos} videos for ${data.vehicles.length} models\n`);

  // Load brands and models from DB
  const { data: brands } = await supabase.from('brands').select('id, name');
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, name, model_id');

  if (!brands || !models || !generations) {
    console.log('❌ Failed to load DB data');
    return;
  }

  // Build lookup maps
  const brandByName = new Map<string, string>();
  for (const b of brands) {
    brandByName.set(norm(b.name), b.id);
  }

  const modelsByBrand = new Map<string, Map<string, string>>();
  for (const m of models) {
    const brandId = m.brand_id;
    if (!modelsByBrand.has(brandId)) modelsByBrand.set(brandId, new Map());
    modelsByBrand.get(brandId)!.set(norm(m.name), m.id);
  }

  const gensByModel = new Map<string, string[]>();
  for (const g of generations) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g.id);
  }

  // Process each vehicle
  let matched = 0, unmatched = 0, inserted = 0;
  const rows: any[] = [];

  for (const vehicle of data.vehicles) {
    const brandId = brandByName.get(norm(vehicle.brand));
    if (!brandId) {
      console.log(`  ⚠️  Brand not found: ${vehicle.brand}`);
      unmatched++;
      continue;
    }

    const brandModels = modelsByBrand.get(brandId);
    if (!brandModels) {
      unmatched++;
      continue;
    }

    // Try to find model
    let modelId: string | undefined;
    const modelNorm = norm(vehicle.model);
    
    modelId = brandModels.get(modelNorm);
    
    if (!modelId) {
      const simplified = modelNorm.replace(/series|class|classe/g, '').trim();
      for (const [key, id] of brandModels) {
        if (key.includes(simplified) || simplified.includes(key)) {
          modelId = id;
          break;
        }
      }
    }

    if (!modelId) {
      console.log(`  ⚠️  Model not found: ${vehicle.brand} ${vehicle.model}`);
      unmatched++;
      continue;
    }

    const genIds = gensByModel.get(modelId) || [];
    if (genIds.length === 0) {
      console.log(`  ⚠️  No generations for: ${vehicle.brand} ${vehicle.model}`);
      unmatched++;
      continue;
    }

    matched++;

    // Create rows for all generations of this model
    for (const video of vehicle.videos) {
      for (const genId of genIds) {
        rows.push({
          generation_id: genId,
          video_id: video.videoId,
          title: video.title,
          channel_id: video.channelId,
          channel_title: video.channelTitle,
          published_at: video.publishedAt,
          description: video.description,
          thumbnail_url: video.thumbnailUrl,
          view_count: video.viewCount,
          like_count: video.likeCount,
          duration: video.duration
        });
      }
    }
  }

  console.log(`\n  Matched: ${matched} models`);
  console.log(`  Unmatched: ${unmatched} models`);
  console.log(`  Rows to insert: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log('  ✅ Nothing to insert');
    return;
  }

  // Insert with upsert (ignore duplicates)
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('youtube_videos')
      .upsert(batch, { onConflict: 'generation_id,video_id', ignoreDuplicates: true });
    
    if (error) {
      console.log(`  ❌ Insert error at batch ${i}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`  Inserted: ${inserted}/${rows.length}\r`);
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════════════════════`);
  console.log(`  ✅ Import complete: ${inserted} video rows inserted`);
  console.log(`═══════════════════════════════════════════════════════════════`);
}

main().catch(console.error);
