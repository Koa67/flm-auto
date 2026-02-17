/**
 * PHOTO HUNTER v2 - Pexels API (free, no strict quota)
 * 
 * Get API key: https://www.pexels.com/api/
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

function fetchPexels(query: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;
    
    const req = https.get(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const photos = (json.photos || []).map((p: any) => ({
            url: p.src.original,
            thumbnail_url: p.src.medium,
            width: p.width,
            height: p.height,
            photographer: p.photographer,
            pexels_url: p.url,
          }));
          resolve(photos);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
  });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function photoHunterPexels() {
  if (!PEXELS_API_KEY) {
    console.log('❌ PEXELS_API_KEY required');
    console.log('   Get one at: https://www.pexels.com/api/');
    console.log('   Usage: PEXELS_API_KEY=xxx npx ts-node photo-hunter-pexels.ts');
    return;
  }
  
  console.log('📷 PHOTO HUNTER v2 - Pexels API\n');
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
  
  console.log(`\n📊 Missing photos: ${missing.length} generations`);
  console.log(`\n🎯 Hunting with Pexels API...\n`);
  
  let found = 0;
  let notFound = 0;
  const specsToInsert: any[] = [];
  
  for (let i = 0; i < missing.length; i++) {
    const gen = missing[i];
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brand = model.brand.name;
    const modelName = model.name;
    
    // Search queries
    const queries = [
      `${brand} ${modelName} car`,
      `${brand} ${modelName}`,
      `${brand} car`,
    ];
    
    let photos: any[] = [];
    for (const q of queries) {
      photos = await fetchPexels(q);
      if (photos.length > 0) break;
      await sleep(100);
    }
    
    if (photos.length > 0) {
      found++;
      specsToInsert.push({
        generation_id: gen.id,
        source: 'Pexels',
        spec_type: 'photos',
        spec_value: photos.length,
        raw_data: { count: photos.length, photos },
      });
    } else {
      notFound++;
    }
    
    const pct = (((i + 1) / missing.length) * 100).toFixed(1);
    process.stdout.write(`\r   [${pct}%] ${i + 1}/${missing.length} | Found: ${found} | Current: ${brand} ${modelName}        `);
    
    await sleep(200); // Rate limit
    
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
  
  const { data: finalPhotos } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('spec_type', 'photos');
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('📷 PHOTO HUNT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Found: ${found}`);
  console.log(`   Total with photos: ${finalPhotos?.length || 0}/${allGens.length}`);
}

photoHunterPexels().catch(console.error);
