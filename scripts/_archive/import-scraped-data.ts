/**
 * FLM AUTO - Import Wikipedia + Photos data into Supabase
 * Fixed: spec_value is numeric, not text
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importWikipediaData() {
  console.log('\n📖 Importing Wikipedia data...\n');
  
  const wikiDir = '../data/raw/ultra/wikipedia';
  
  if (!fs.existsSync(wikiDir)) {
    console.log('   ❌ Wikipedia data not found');
    return;
  }
  
  const files = fs.readdirSync(wikiDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  
  // Get existing data from DB
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    if (b.name === 'Mercedes-Benz') {
      brandMap.set('mercedes-benz', b.id);
      brandMap.set('mercedes', b.id);
    }
    if (b.name === 'Volkswagen') brandMap.set('vw', b.id);
    if (b.name === 'Skoda') brandMap.set('škoda', b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  let totalArticles = 0;
  let matched = 0;
  let specsInserted = 0;
  let errors = 0;
  
  for (const file of files) {
    const brandName = file.replace('.json', '').replace(/_/g, ' ');
    const filePath = path.join(wikiDir, file);
    
    try {
      const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      totalArticles += articles.length;
      
      const brandId = brandMap.get(brandName.toLowerCase());
      if (!brandId) {
        console.log(`   ⚠️ ${brandName}: brand not in DB`);
        continue;
      }
      
      let brandMatched = 0;
      
      const brandModels = models?.filter(m => m.brand_id === brandId) || [];
      
      for (const article of articles) {
        if (!article.title) continue;
        
        // Try to find matching model
        for (const model of brandModels) {
          const modelNameLower = model.name.toLowerCase();
          const titleLower = article.title.toLowerCase();
          
          if (titleLower.includes(modelNameLower) || 
              titleLower.includes(modelNameLower.replace(/-/g, ' '))) {
            
            // Find generation
            const modelGens = generations?.filter(g => g.model_id === model.id) || [];
            const gen = modelGens[0];
            
            if (gen) {
              matched++;
              brandMatched++;
              
              // Insert with numeric spec_value
              const { error } = await supabase
                .from('third_party_specs')
                .upsert({
                  generation_id: gen.id,
                  source: 'Wikipedia',
                  source_url: article.url || '',
                  spec_type: 'wiki_info',
                  spec_value: 1, // Flag that data exists
                  raw_data: {
                    title: article.title,
                    description: article.description,
                    image_url: article.image_url,
                    categories: article.categories?.slice(0, 10),
                  },
                }, { onConflict: 'generation_id,source,spec_type' });
              
              if (error) {
                errors++;
                if (errors < 5) console.log(`   ⚠️ Insert error: ${error.message}`);
              } else {
                specsInserted++;
              }
              
              break;
            }
          }
        }
      }
      
      console.log(`   ${brandName}: ${articles.length} articles → ${brandMatched} matched`);
      
    } catch (e) {
      console.log(`   ❌ Error processing ${file}`);
    }
  }
  
  console.log(`\n   📊 Total articles: ${totalArticles}`);
  console.log(`   ✅ Matched to DB: ${matched}`);
  console.log(`   💾 Specs inserted: ${specsInserted}`);
  console.log(`   ❌ Errors: ${errors}`);
}

async function importPhotoData() {
  console.log('\n📷 Importing photo data...\n');
  
  const photoFile = '../data/raw/photos/_all_photos.json';
  
  if (!fs.existsSync(photoFile)) {
    console.log('   ❌ Photo data not found');
    return;
  }
  
  const photos = JSON.parse(fs.readFileSync(photoFile, 'utf-8'));
  console.log(`   Loaded ${photos.length} photos`);
  
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace('-', ''), b.id);
    brandMap.set(b.name.toLowerCase().split(' ')[0], b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id');
  
  let inserted = 0;
  let errors = 0;
  const seen = new Set<string>();
  
  for (const photo of photos) {
    if (!photo.image_url || photo.brand === 'Various') continue;
    
    // Dedupe by URL
    const urlKey = photo.image_url.substring(0, 200);
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);
    
    // Find brand
    const brandLower = photo.brand.toLowerCase();
    const brandId = brandMap.get(brandLower) || 
                    brandMap.get(brandLower.split('-')[0]) ||
                    brandMap.get(brandLower.split(' ')[0]);
    
    if (!brandId) continue;
    
    // Find model
    const brandModels = models?.filter(m => m.brand_id === brandId) || [];
    let matchedGen: string | null = null;
    
    const photoModelLower = photo.model.toLowerCase();
    
    for (const model of brandModels) {
      const modelNameLower = model.name.toLowerCase();
      
      if (photoModelLower.includes(modelNameLower) || 
          photoModelLower.includes(modelNameLower.replace(/-/g, ' '))) {
        const gens = generations?.filter(g => g.model_id === model.id) || [];
        if (gens.length > 0) {
          matchedGen = gens[0].id;
          break;
        }
      }
    }
    
    if (!matchedGen) continue;
    
    // Insert - use unique spec_type per photo to allow multiple
    const specType = `photo_${inserted + 1}`;
    
    const { error } = await supabase
      .from('third_party_specs')
      .insert({
        generation_id: matchedGen,
        source: photo.source || 'Unknown',
        source_url: photo.image_url.substring(0, 500),
        spec_type: specType,
        spec_value: photo.width || 0,
        raw_data: {
          width: photo.width,
          height: photo.height,
          license: photo.license,
          thumbnail: photo.thumbnail_url,
          model: photo.model,
        },
      });
    
    if (error) {
      errors++;
      if (errors < 5) console.log(`   ⚠️ Photo error: ${error.message}`);
    } else {
      inserted++;
    }
    
    if (inserted % 50 === 0) {
      process.stdout.write(`\r   Progress: ${inserted} photos inserted...`);
    }
  }
  
  console.log(`\n   ✅ Photos inserted: ${inserted}`);
  console.log(`   ❌ Errors: ${errors}`);
}

async function main() {
  console.log('🚀 FLM AUTO - Import Scraped Data (Fixed)\n');
  
  await importWikipediaData();
  await importPhotoData();
  
  // Get final counts
  const { count: specCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  const { count: wikiCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'Wikipedia');
  
  const { count: photoCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .like('spec_type', 'photo_%');
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Final DB Stats:');
  console.log('═'.repeat(50));
  console.log(`   Total third_party_specs: ${specCount}`);
  console.log(`   Wikipedia entries: ${wikiCount}`);
  console.log(`   Photos: ${photoCount}`);
}

main().catch(console.error);
