/**
 * FLM AUTO — Import YouTube Videos to DB
 * 
 * Reads youtube_videos.json and inserts into third_party_specs
 * with source='YouTube' and appropriate spec_types
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
  console.log('🎬 FLM AUTO — Import YouTube Videos to DB\n');

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
  let matched = 0, unmatched = 0, inserted = 0, skipped = 0;
  const specs: any[] = [];

  for (const vehicle of data.vehicles) {
    const brandId = brandByName.get(norm(vehicle.brand));
    if (!brandId) {
      console.log(`  ⚠️  Brand not found: ${vehicle.brand}`);
      unmatched++;
      continue;
    }

    const brandModels = modelsByBrand.get(brandId);
    if (!brandModels) {
      console.log(`  ⚠️  No models for brand: ${vehicle.brand}`);
      unmatched++;
      continue;
    }

    // Try to find model - handle variations like "3 Series" vs "3" or "Classe C" vs "C-Class"
    let modelId: string | undefined;
    const modelNorm = norm(vehicle.model);
    
    // Direct match
    modelId = brandModels.get(modelNorm);
    
    // Try without "series", "class", etc
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

    // Insert videos for all generations of this model
    for (const video of vehicle.videos) {
      for (const genId of genIds) {
        specs.push({
          generation_id: genId,
          source: 'YouTube',
          spec_type: 'video',
          spec_value: null,
          raw_data: {
            videoId: video.videoId,
            title: video.title,
            channelId: video.channelId,
            channelTitle: video.channelTitle,
            publishedAt: video.publishedAt,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            duration: video.duration,
            url: `https://www.youtube.com/watch?v=${video.videoId}`
          }
        });
      }
    }
  }

  console.log(`\n  Matched: ${matched} models`);
  console.log(`  Unmatched: ${unmatched} models`);
  console.log(`  Specs to insert: ${specs.length}\n`);

  // Check for existing videos to avoid duplicates (use raw_data->videoId)
  const { data: existing } = await supabase
    .from('third_party_specs')
    .select('raw_data')
    .eq('source', 'YouTube')
    .eq('spec_type', 'video');

  const existingIds = new Set((existing || []).map(e => e.raw_data?.videoId).filter(Boolean));
  const newSpecs = specs.filter(s => !existingIds.has(s.raw_data?.videoId));
  skipped = specs.length - newSpecs.length;

  console.log(`  Already in DB: ${skipped}`);
  console.log(`  New to insert: ${newSpecs.length}\n`);

  if (newSpecs.length === 0) {
    console.log('  ✅ Nothing new to insert');
    return;
  }

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < newSpecs.length; i += batchSize) {
    const batch = newSpecs.slice(i, i + batchSize);
    const { error } = await supabase.from('third_party_specs').insert(batch);
    if (error) {
      console.log(`  ❌ Insert error at batch ${i}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`  Inserted: ${inserted}/${newSpecs.length}\r`);
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════════════════════`);
  console.log(`  ✅ Import complete: ${inserted} video specs inserted`);
  console.log(`═══════════════════════════════════════════════════════════════`);
}

main().catch(console.error);
