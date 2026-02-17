/**
 * FLM AUTO - Import YouTube Videos into Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🎬 FLM AUTO - Import YouTube Videos to Supabase\n');
  
  // Load video data
  const videoFile = '../data/youtube_videos.json';
  if (!fs.existsSync(videoFile)) {
    console.log('❌ youtube_videos.json not found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(videoFile, 'utf-8'));
  console.log(`📊 Loaded ${data.metadata.totalVideos} videos for ${data.metadata.totalVehicles} vehicles\n`);
  
  // Get DB models/generations
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
    if (b.name === 'Volkswagen') brandMap.set('vw', b.id);
    if (b.name === 'Mercedes-Benz') brandMap.set('mercedes', b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  let totalInserted = 0;
  let vehiclesMatched = 0;
  
  for (const vehicle of data.vehicles) {
    const brandLower = vehicle.brand.toLowerCase().replace(/-/g, '');
    const brandId = brandMap.get(brandLower);
    
    if (!brandId) {
      console.log(`   ⚠️ Brand not found: ${vehicle.brand}`);
      continue;
    }
    
    // Find model
    const brandModels = models?.filter(m => m.brand_id === brandId) || [];
    let matchedModel: any = null;
    
    const modelLower = vehicle.model.toLowerCase().replace(/-/g, '');
    for (const model of brandModels) {
      const dbModelLower = model.name.toLowerCase().replace(/-/g, '');
      if (modelLower.includes(dbModelLower) || dbModelLower.includes(modelLower) ||
          modelLower === dbModelLower) {
        matchedModel = model;
        break;
      }
    }
    
    if (!matchedModel) {
      console.log(`   ⚠️ Model not found: ${vehicle.brand} ${vehicle.model}`);
      continue;
    }
    
    // Find generation
    const modelGens = generations?.filter(g => g.model_id === matchedModel.id) || [];
    if (modelGens.length === 0) {
      console.log(`   ⚠️ No generation for: ${vehicle.brand} ${vehicle.model}`);
      continue;
    }
    
    const gen = modelGens[0];
    vehiclesMatched++;
    
    // Insert top 10 videos per vehicle (to avoid bloat)
    const topVideos = vehicle.videos.slice(0, 10);
    
    for (let i = 0; i < topVideos.length; i++) {
      const video = topVideos[i];
      
      const { error } = await supabase
        .from('third_party_specs')
        .upsert({
          generation_id: gen.id,
          source: 'YouTube',
          source_url: `https://youtube.com/watch?v=${video.videoId}`,
          spec_type: `youtube_video_${i + 1}`,
          spec_value: video.viewCount || 0,
          raw_data: {
            video_id: video.videoId,
            title: video.title,
            channel_id: video.channelId,
            channel_title: video.channelTitle,
            published_at: video.publishedAt,
            view_count: video.viewCount,
            like_count: video.likeCount,
            duration: video.duration,
            thumbnail_url: video.thumbnailUrl,
          },
        }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) totalInserted++;
    }
    
    console.log(`   ✅ ${vehicle.brand} ${vehicle.model}: ${topVideos.length} videos`);
  }
  
  // Final counts
  const { count: ytCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'YouTube');
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Import Complete:');
  console.log('═'.repeat(50));
  console.log(`   Vehicles matched: ${vehiclesMatched}`);
  console.log(`   Videos inserted: ${totalInserted}`);
  console.log(`\n📊 DB Totals:`);
  console.log(`   YouTube records: ${ytCount}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
