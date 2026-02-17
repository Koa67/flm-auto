import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function importPhotos() {
  console.log('📷 MEGA PHOTO IMPORT v2\n');
  console.log('═'.repeat(60));
  
  // Load photo data
  const photosPath = '/Users/koa/Dev/flm-auto/data/photos-all-merged.json';
  const rawPhotos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
  
  console.log(`\n📁 Loaded ${rawPhotos.length} photos from merged file`);
  
  // Get all generations from DB
  let allGenerations: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(id, name, brand:brands(id, name))')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (!data || data.length === 0) break;
    allGenerations = [...allGenerations, ...data];
    if (data.length < pageSize) break;
    page++;
  }
  
  console.log(`📊 Total generations in DB: ${allGenerations.length}`);
  
  // Build lookup maps with multiple strategies
  const genByBrandModel = new Map<string, any>();
  const genByBrandModelGen = new Map<string, any>();
  
  for (const gen of allGenerations) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brandName = model.brand.name.toLowerCase().trim();
    const modelName = model.name.toLowerCase().trim();
    const genName = gen.name.toLowerCase().trim();
    
    // Exact match with generation
    genByBrandModelGen.set(`${brandName}|${modelName}|${genName}`, gen);
    
    // Brand + Model only (keep first/newest)
    const bmKey = `${brandName}|${modelName}`;
    if (!genByBrandModel.has(bmKey)) {
      genByBrandModel.set(bmKey, gen);
    }
  }
  
  // Match photos to generations - group by generation
  const photosByGen = new Map<string, any[]>();
  const matchedGens = new Set<string>();
  let unmatchedCount = 0;
  
  for (const photo of rawPhotos) {
    const brand = (photo.brand || '').toLowerCase().trim();
    let model = (photo.model || '').toLowerCase().trim();
    const generation = (photo.generation || '').toLowerCase().trim();
    
    // Clean model name (sometimes it includes brand)
    if (model.startsWith(brand + ' ')) {
      model = model.substring(brand.length + 1);
    }
    
    // Try matching strategies
    let gen = genByBrandModelGen.get(`${brand}|${model}|${generation}`) ||
              genByBrandModel.get(`${brand}|${model}`);
    
    // Fuzzy match if no exact match
    if (!gen) {
      for (const [key, g] of genByBrandModel.entries()) {
        const [keyBrand, keyModel] = key.split('|');
        if (keyBrand === brand && (keyModel.includes(model) || model.includes(keyModel))) {
          gen = g;
          break;
        }
      }
    }
    
    if (gen) {
      matchedGens.add(gen.id);
      
      if (!photosByGen.has(gen.id)) {
        photosByGen.set(gen.id, []);
      }
      photosByGen.get(gen.id)!.push(photo);
    } else {
      unmatchedCount++;
    }
  }
  
  console.log(`\n✅ Matched photos to ${matchedGens.size} generations`);
  console.log(`❌ Unmatched: ${unmatchedCount} photos`);
  
  // Build specs - one spec per generation with ALL photos in raw_data
  const specsToInsert: any[] = [];
  
  for (const [genId, photos] of photosByGen.entries()) {
    // Create one spec with array of photos
    specsToInsert.push({
      generation_id: genId,
      source: 'Wikimedia Commons',
      spec_type: 'photos',  // plural - contains array
      spec_value: photos.length,
      raw_data: {
        count: photos.length,
        photos: photos.map((p, idx) => ({
          index: idx,
          url: p.url,
          thumbnail_url: p.thumbnail_url,
          width: p.width,
          height: p.height,
          license: p.license,
          author: p.author,
          source_url: p.source_url,
        })),
      },
    });
  }
  
  // Show coverage
  const coveragePct = ((matchedGens.size / allGenerations.length) * 100).toFixed(1);
  console.log(`\n📈 Photo coverage: ${matchedGens.size}/${allGenerations.length} generations (${coveragePct}%)`);
  console.log(`📷 Total photos matched: ${Array.from(photosByGen.values()).reduce((sum, arr) => sum + arr.length, 0)}`);
  console.log(`📦 Specs to insert: ${specsToInsert.length}`);
  
  // Insert photos
  if (specsToInsert.length > 0) {
    console.log(`\n📤 Inserting ${specsToInsert.length} photo specs...`);
    
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < specsToInsert.length; i += batchSize) {
      const batch = specsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('third_party_specs')
        .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted += batch.length;
      } else {
        console.error(`\nError: ${error.message}`);
        errors++;
      }
      
      process.stdout.write(`\r   Progress: ${inserted}/${specsToInsert.length}`);
    }
    
    console.log(`\n   Errors: ${errors}`);
  }
  
  // Final stats
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  // Count photo specs
  const { data: photoSpecs } = await supabase
    .from('third_party_specs')
    .select('spec_value')
    .eq('spec_type', 'photos');
  
  const totalPhotos = photoSpecs?.reduce((sum, s) => sum + (s.spec_value || 0), 0) || 0;
  const gensWithPhotos = photoSpecs?.length || 0;
  
  console.log('\n' + '═'.repeat(60));
  console.log('📷 PHOTO IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Generations with photos: ${gensWithPhotos}`);
  console.log(`   Total photos: ${totalPhotos}`);
  console.log(`   Photo coverage: ${((gensWithPhotos / allGenerations.length) * 100).toFixed(1)}%`);
  console.log(`   Total third_party_specs: ${count}`);
}

importPhotos().catch(console.error);
