/**
 * PHOTO HUNTER - Scrape Wikimedia for MISSING generations only
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FLM-Auto-Bot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function searchWikimedia(query: string, limit = 5): Promise<any[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srnamespace=6&srlimit=${limit}&format=json`;
  
  try {
    const data = await fetchJSON(url);
    const results = data?.query?.search || [];
    
    const photos: any[] = [];
    for (const result of results) {
      const title = result.title;
      if (!title.match(/\.(jpg|jpeg|png)$/i)) continue;
      
      // Get image info
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json`;
      const infoData = await fetchJSON(infoUrl);
      
      const pages = infoData?.query?.pages || {};
      const page = Object.values(pages)[0] as any;
      const imageInfo = page?.imageinfo?.[0];
      
      if (imageInfo?.url) {
        photos.push({
          url: imageInfo.url,
          thumbnail_url: imageInfo.thumburl || imageInfo.url.replace('/commons/', '/commons/thumb/') + '/800px-' + title.replace('File:', ''),
          width: imageInfo.width,
          height: imageInfo.height,
          license: imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown',
          author: imageInfo.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') || 'Unknown',
        });
      }
    }
    
    return photos;
  } catch (e) {
    return [];
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function photoHunter() {
  console.log('🎯 PHOTO HUNTER - Targeting missing generations\n');
  console.log('═'.repeat(60));
  
  // Get all generations
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allGens = [...allGens, ...data];
    if (data.length < 1000) break;
    page++;
  }
  
  // Get generations WITH photos
  const { data: withPhotos } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('spec_type', 'photos');
  const hasPhotoSet = new Set(withPhotos?.map(p => p.generation_id) || []);
  
  // Filter to missing only
  const missing = allGens.filter(g => !hasPhotoSet.has(g.id));
  
  console.log(`\n📊 Generations: ${allGens.length} total, ${hasPhotoSet.size} with photos, ${missing.length} missing`);
  console.log(`\n🎯 Hunting photos for ${missing.length} generations...\n`);
  
  let found = 0;
  let notFound = 0;
  const specsToInsert: any[] = [];
  
  for (let i = 0; i < missing.length; i++) {
    const gen = missing[i];
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brand = model.brand.name;
    const modelName = model.name;
    const genName = gen.name;
    
    // Build search queries
    const queries = [
      `${brand} ${modelName} ${genName} car`,
      `${brand} ${modelName} automobile`,
      `${brand} ${modelName}`,
    ];
    
    let photos: any[] = [];
    
    for (const query of queries) {
      photos = await searchWikimedia(query, 5);
      if (photos.length > 0) break;
      await sleep(100); // Rate limit
    }
    
    if (photos.length > 0) {
      found++;
      specsToInsert.push({
        generation_id: gen.id,
        source: 'Wikimedia Commons',
        spec_type: 'photos',
        spec_value: photos.length,
        raw_data: {
          count: photos.length,
          photos: photos.map((p, idx) => ({ index: idx, ...p })),
        },
      });
    } else {
      notFound++;
    }
    
    // Progress
    const pct = (((i + 1) / missing.length) * 100).toFixed(1);
    process.stdout.write(`\r   [${pct}%] ${i + 1}/${missing.length} | Found: ${found} | Not found: ${notFound} | Current: ${brand} ${modelName}`);
    
    // Rate limiting
    await sleep(200);
    
    // Batch insert every 50
    if (specsToInsert.length >= 50) {
      const batch = specsToInsert.splice(0, 50);
      await supabase.from('third_party_specs').upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    }
  }
  
  // Final batch
  if (specsToInsert.length > 0) {
    await supabase.from('third_party_specs').upsert(specsToInsert, { onConflict: 'generation_id,source,spec_type' });
  }
  
  // Stats
  const { data: finalPhotos } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('spec_type', 'photos');
  
  const { count: totalSpecs } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🎯 PHOTO HUNT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Searched: ${missing.length}`);
  console.log(`   Found: ${found}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Total generations with photos: ${finalPhotos?.length || 0}/${allGens.length}`);
  console.log(`   Coverage: ${(((finalPhotos?.length || 0) / allGens.length) * 100).toFixed(1)}%`);
  console.log(`   Total specs: ${totalSpecs}`);
}

photoHunter().catch(console.error);
