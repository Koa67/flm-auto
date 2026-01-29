/**
 * FLM AUTO - Scrape Blueprints from Wikimedia Commons
 * Search for technical drawings, blueprints, dimension diagrams
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

interface BlueprintResult {
  generation_id: string;
  brand: string;
  model: string;
  generation: string;
  url: string;
  thumbnail_url: string;
  source_url: string;
  license: string;
}

const results: BlueprintResult[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search Wikimedia Commons for blueprints/technical drawings
 */
async function searchWikimediaBlueprints(brand: string, model: string): Promise<BlueprintResult[]> {
  const blueprints: BlueprintResult[] = [];
  
  // Try multiple search terms
  const searchTerms = [
    `${brand} ${model} blueprint`,
    `${brand} ${model} technical drawing`,
    `${brand} ${model} dimensions`,
    `${brand} ${model} diagram`,
    `${brand} ${model} schema`,
  ];

  for (const searchTerm of searchTerms) {
    try {
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&srlimit=5&format=json&origin=*`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.query?.search) continue;

      for (const result of searchData.query.search) {
        const title = result.title;
        
        // Skip if not an image file
        if (!title.match(/\.(svg|png|jpg|jpeg|gif)$/i)) continue;
        
        // Get image info
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`;
        
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();
        
        const pages = infoData.query?.pages;
        if (!pages) continue;
        
        const page = Object.values(pages)[0] as any;
        const imageInfo = page?.imageinfo?.[0];
        
        if (!imageInfo) continue;

        // Check if it looks like a blueprint/technical drawing
        const desc = (imageInfo.extmetadata?.ImageDescription?.value || '').toLowerCase();
        const categories = (imageInfo.extmetadata?.Categories?.value || '').toLowerCase();
        const titleLower = title.toLowerCase();
        
        const isTechnical = 
          titleLower.includes('blueprint') ||
          titleLower.includes('diagram') ||
          titleLower.includes('dimension') ||
          titleLower.includes('schema') ||
          titleLower.includes('drawing') ||
          titleLower.includes('technical') ||
          titleLower.includes('orthographic') ||
          titleLower.includes('side view') ||
          categories.includes('blueprint') ||
          categories.includes('diagram') ||
          desc.includes('blueprint') ||
          desc.includes('dimension');

        if (!isTechnical) continue;

        // Get license
        const license = imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown';
        
        // Skip non-free
        if (license.includes('©') || license.includes('All rights reserved')) continue;

        // Avoid duplicates
        if (blueprints.find(b => b.url === imageInfo.url)) continue;

        blueprints.push({
          generation_id: '',
          brand,
          model,
          generation: '',
          url: imageInfo.url,
          thumbnail_url: imageInfo.url,
          source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
          license,
        });

        if (blueprints.length >= 2) break;
      }

      if (blueprints.length >= 2) break;
      await delay(100);
      
    } catch (err) {
      // Silent fail
    }
  }
  
  return blueprints;
}

/**
 * Also try car-specific blueprint repositories
 */
async function searchCarBlueprints(brand: string, model: string): Promise<BlueprintResult[]> {
  const blueprints: BlueprintResult[] = [];
  
  // Try OpenClipart (public domain)
  try {
    const searchUrl = `https://openclipart.org/search/?query=${encodeURIComponent(brand + ' ' + model)}`;
    // Note: OpenClipart doesn't have a proper API, skip for now
  } catch (err) {
    // Silent fail
  }

  return blueprints;
}

async function scrapeBlueprints() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Blueprint Scraper v2                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get unique brand/model combinations
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id,
      name,
      internal_code,
      models!inner (
        name,
        brands!inner (name)
      )
    `)
    .order('id');

  if (!generations) {
    console.error('❌ Could not fetch generations');
    return;
  }

  const uniqueModels = new Map<string, { brand: string; model: string; genId: string; genCode: string }>();
  
  for (const gen of generations) {
    const brand = (gen.models as any).brands.name;
    const model = (gen.models as any).name;
    const key = `${brand}-${model}`;
    
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, { 
        brand, 
        model, 
        genId: gen.id,
        genCode: gen.internal_code || gen.name 
      });
    }
  }

  console.log(`Found ${uniqueModels.size} unique models to process\n`);

  let processed = 0;
  let found = 0;

  for (const [key, { brand, model, genId, genCode }] of uniqueModels) {
    process.stdout.write(`\r[${processed + 1}/${uniqueModels.size}] ${brand} ${model}`.padEnd(60));

    const wikimediaResults = await searchWikimediaBlueprints(brand, model);
    await delay(150);

    for (const bp of wikimediaResults) {
      bp.generation_id = genId;
      bp.generation = genCode;
      results.push(bp);
      found++;
    }

    processed++;

    if (processed % 20 === 0 && results.length > 0) {
      const progressFile = path.join(__dirname, '../data/blueprints-progress.json');
      fs.writeFileSync(progressFile, JSON.stringify(results, null, 2));
      console.log(`\n   💾 Saved progress: ${results.length} blueprints`);
    }
  }

  // Save final results
  const outputFile = path.join(__dirname, '../data/vehicle-blueprints.json');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Models processed: ${processed}`);
  console.log(`  Blueprints found: ${found}`);
  console.log(`\n  Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

scrapeBlueprints().catch(console.error);
