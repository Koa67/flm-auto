/**
 * FLM AUTO - Scrape Vehicle Blueprints/Dimensions
 * Sources: drawingdatabase.com, dimensions.com
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
  source: 'drawingdatabase' | 'dimensions' | 'the-blueprints';
  url: string;
  thumbnail_url: string;
  view: 'side' | 'front' | 'rear' | 'top' | 'multi';
  source_url: string;
}

const results: BlueprintResult[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search drawingdatabase.com
 */
async function searchDrawingDatabase(brand: string, model: string): Promise<BlueprintResult[]> {
  const blueprints: BlueprintResult[] = [];
  
  try {
    // Search URL pattern
    const searchQuery = `${brand} ${model}`.toLowerCase().replace(/\s+/g, '-');
    const searchUrl = `https://drawingdatabase.com/search/?q=${encodeURIComponent(brand + ' ' + model)}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!res.ok) return blueprints;
    
    const html = await res.text();
    
    // Extract image URLs from search results (basic pattern matching)
    const imgPattern = /data-src="([^"]+\.(?:png|jpg|svg))"/gi;
    const matches = html.matchAll(imgPattern);
    
    for (const match of Array.from(matches).slice(0, 2)) {
      const imgUrl = match[1];
      if (imgUrl && (imgUrl.includes('car') || imgUrl.includes('auto') || imgUrl.includes(brand.toLowerCase()))) {
        blueprints.push({
          generation_id: '',
          brand,
          model,
          generation: '',
          source: 'drawingdatabase',
          url: imgUrl.startsWith('http') ? imgUrl : `https://drawingdatabase.com${imgUrl}`,
          thumbnail_url: imgUrl.startsWith('http') ? imgUrl : `https://drawingdatabase.com${imgUrl}`,
          view: 'side',
          source_url: searchUrl,
        });
      }
    }
  } catch (err) {
    // Silent fail
  }
  
  return blueprints;
}

/**
 * Search dimensions.com (car-dimensions.com)
 */
async function searchDimensions(brand: string, model: string, genCode: string): Promise<BlueprintResult[]> {
  const blueprints: BlueprintResult[] = [];
  
  try {
    // car-dimensions.com URL pattern
    const brandSlug = brand.toLowerCase().replace(/\s+/g, '-').replace('mercedes-benz', 'mercedes');
    const modelSlug = model.toLowerCase().replace(/\s+/g, '-');
    
    const url = `https://www.car-dimensions.com/${brandSlug}/${modelSlug}/`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!res.ok) return blueprints;
    
    const html = await res.text();
    
    // Look for SVG or dimension images
    const svgPattern = /src="([^"]+dimensions[^"]*\.(?:svg|png|jpg))"/gi;
    const matches = html.matchAll(svgPattern);
    
    for (const match of Array.from(matches).slice(0, 2)) {
      const imgUrl = match[1];
      blueprints.push({
        generation_id: '',
        brand,
        model,
        generation: genCode,
        source: 'dimensions',
        url: imgUrl.startsWith('http') ? imgUrl : `https://www.car-dimensions.com${imgUrl}`,
        thumbnail_url: imgUrl.startsWith('http') ? imgUrl : `https://www.car-dimensions.com${imgUrl}`,
        view: 'multi',
        source_url: url,
      });
    }
    
    // Also check for specific generation pages
    const genUrl = `https://www.car-dimensions.com/${brandSlug}/${modelSlug}/${genCode.toLowerCase()}/`;
    const genRes = await fetch(genUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (genRes.ok) {
      const genHtml = await genRes.text();
      const genMatches = genHtml.matchAll(svgPattern);
      
      for (const match of Array.from(genMatches).slice(0, 2)) {
        const imgUrl = match[1];
        if (!blueprints.find(b => b.url === imgUrl)) {
          blueprints.push({
            generation_id: '',
            brand,
            model,
            generation: genCode,
            source: 'dimensions',
            url: imgUrl.startsWith('http') ? imgUrl : `https://www.car-dimensions.com${imgUrl}`,
            thumbnail_url: imgUrl.startsWith('http') ? imgUrl : `https://www.car-dimensions.com${imgUrl}`,
            view: 'multi',
            source_url: genUrl,
          });
        }
      }
    }
  } catch (err) {
    // Silent fail
  }
  
  return blueprints;
}

/**
 * Search the-blueprints.com (index page only, no direct downloads)
 */
async function searchTheBlueprints(brand: string, model: string): Promise<BlueprintResult[]> {
  const blueprints: BlueprintResult[] = [];
  
  try {
    const searchUrl = `https://www.the-blueprints.com/blueprints/cars/${brand.toLowerCase()}/${model.toLowerCase().replace(/\s+/g, '_')}/`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!res.ok) return blueprints;
    
    const html = await res.text();
    
    // Look for thumbnail images (not full blueprints - those are paid)
    const thumbPattern = /src="(\/blueprints[^"]+_thumb[^"]+\.(?:gif|jpg|png))"/gi;
    const matches = html.matchAll(thumbPattern);
    
    for (const match of Array.from(matches).slice(0, 3)) {
      const imgUrl = match[1];
      blueprints.push({
        generation_id: '',
        brand,
        model,
        generation: '',
        source: 'the-blueprints',
        url: `https://www.the-blueprints.com${imgUrl}`,
        thumbnail_url: `https://www.the-blueprints.com${imgUrl}`,
        view: 'side',
        source_url: searchUrl,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return blueprints;
}

/**
 * Main scraper
 */
async function scrapeBlueprints() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Blueprint Scraper                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get all generations
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

  // Get unique brand/model combinations (not per generation)
  const uniqueModels = new Map<string, { brand: string; model: string; generations: typeof generations }>();
  
  for (const gen of generations) {
    const brand = (gen.models as any).brands.name;
    const model = (gen.models as any).name;
    const key = `${brand}-${model}`;
    
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, { brand, model, generations: [] });
    }
    uniqueModels.get(key)!.generations.push(gen);
  }

  console.log(`Found ${uniqueModels.size} unique models to process\n`);

  let processed = 0;
  let found = 0;

  for (const [key, { brand, model, generations: gens }] of uniqueModels) {
    process.stdout.write(`\r[${processed + 1}/${uniqueModels.size}] ${brand} ${model}`.padEnd(60));

    // Search all sources
    const drawingDbResults = await searchDrawingDatabase(brand, model);
    await delay(200);
    
    const dimensionsResults = await searchDimensions(brand, model, gens[0]?.internal_code || '');
    await delay(200);
    
    const blueprintsResults = await searchTheBlueprints(brand, model);
    await delay(200);

    // Combine results
    const allBlueprints = [...drawingDbResults, ...dimensionsResults, ...blueprintsResults];
    
    // Assign to first generation of this model (or spread across)
    if (allBlueprints.length > 0 && gens.length > 0) {
      const primaryGen = gens[0];
      
      for (const bp of allBlueprints.slice(0, 3)) {
        bp.generation_id = primaryGen.id;
        bp.generation = primaryGen.internal_code || primaryGen.name;
        results.push(bp);
        found++;
      }
    }

    processed++;

    // Save progress every 20 models
    if (processed % 20 === 0) {
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
  console.log(`  By source:`);
  
  const bySource = results.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`    - ${source}: ${count}`);
  });

  console.log(`\n  Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

scrapeBlueprints().catch(console.error);
