/**
 * FLM AUTO - Scrape Vehicle Photos
 * Sources: Wikimedia Commons, Unsplash, Pexels
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

// API Keys (free tiers)
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

interface PhotoResult {
  generation_id: string;
  brand: string;
  model: string;
  generation: string;
  source: 'wikimedia' | 'unsplash' | 'pexels';
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
}

const results: PhotoResult[] = [];
const errors: string[] = [];

// Rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wikimedia Commons API
 */
async function searchWikimedia(query: string): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Search for images
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' car')}&srnamespace=6&srlimit=5&format=json&origin=*`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.query?.search) return photos;

    for (const result of searchData.query.search.slice(0, 3)) {
      const title = result.title;
      
      // Get image info
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|user|extmetadata&format=json&origin=*`;
      
      const infoRes = await fetch(infoUrl);
      const infoData = await infoRes.json();
      
      const pages = infoData.query?.pages;
      if (!pages) continue;
      
      const page = Object.values(pages)[0] as any;
      const imageInfo = page?.imageinfo?.[0];
      
      if (!imageInfo) continue;
      
      // Check if it's actually a car image (basic filter)
      const desc = imageInfo.extmetadata?.ImageDescription?.value || '';
      const categories = imageInfo.extmetadata?.Categories?.value || '';
      
      if (!categories.toLowerCase().includes('automobile') && 
          !categories.toLowerCase().includes('car') &&
          !desc.toLowerCase().includes('car')) {
        continue;
      }

      // Get license
      const license = imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown';
      
      // Skip non-free licenses
      if (license.includes('©') || license.includes('All rights reserved')) {
        continue;
      }

      photos.push({
        generation_id: '', // Will be filled later
        brand: '',
        model: '',
        generation: '',
        source: 'wikimedia',
        url: imageInfo.url,
        thumbnail_url: imageInfo.url.replace(/\/commons\//, '/commons/thumb/') + '/800px-' + title.replace('File:', ''),
        width: imageInfo.width,
        height: imageInfo.height,
        license: license,
        author: imageInfo.user || 'Unknown',
        source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      });
    }
  } catch (err) {
    // Silent fail, try next source
  }
  
  return photos;
}

/**
 * Unsplash API
 */
async function searchUnsplash(query: string): Promise<PhotoResult[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
  
  const photos: PhotoResult[] = [];
  
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' car')}&per_page=3&client_id=${UNSPLASH_ACCESS_KEY}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.results) return photos;

    for (const photo of data.results) {
      photos.push({
        generation_id: '',
        brand: '',
        model: '',
        generation: '',
        source: 'unsplash',
        url: photo.urls.regular,
        thumbnail_url: photo.urls.small,
        width: photo.width,
        height: photo.height,
        license: 'Unsplash License',
        author: photo.user?.name || 'Unknown',
        source_url: photo.links.html,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

/**
 * Pexels API
 */
async function searchPexels(query: string): Promise<PhotoResult[]> {
  if (!PEXELS_API_KEY) return [];
  
  const photos: PhotoResult[] = [];
  
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' car')}&per_page=3`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    const data = await res.json();
    
    if (!data.photos) return photos;

    for (const photo of data.photos) {
      photos.push({
        generation_id: '',
        brand: '',
        model: '',
        generation: '',
        source: 'pexels',
        url: photo.src.large,
        thumbnail_url: photo.src.medium,
        width: photo.width,
        height: photo.height,
        license: 'Pexels License',
        author: photo.photographer || 'Unknown',
        source_url: photo.url,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

/**
 * Main scraper
 */
async function scrapePhotos() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Photo Scraper                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check API keys
  console.log('API Keys:');
  console.log(`  Wikimedia: ✅ (no key needed)`);
  console.log(`  Unsplash:  ${UNSPLASH_ACCESS_KEY ? '✅' : '❌ Missing UNSPLASH_ACCESS_KEY'}`);
  console.log(`  Pexels:    ${PEXELS_API_KEY ? '✅' : '❌ Missing PEXELS_API_KEY'}`);
  console.log('');

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

  console.log(`Found ${generations.length} generations to process\n`);

  let processed = 0;
  let found = 0;

  for (const gen of generations) {
    const brand = (gen.models as any).brands.name;
    const model = (gen.models as any).name;
    const genCode = gen.internal_code || gen.name;
    
    const query = `${brand} ${model} ${genCode}`;
    
    process.stdout.write(`\r[${processed + 1}/${generations.length}] ${query.padEnd(50)}`);

    // Search all sources
    const wikimediaPhotos = await searchWikimedia(query);
    await delay(100); // Rate limit
    
    const unsplashPhotos = await searchUnsplash(query);
    await delay(100);
    
    const pexelsPhotos = await searchPexels(query);
    await delay(100);

    // Combine and dedupe
    const allPhotos = [...wikimediaPhotos, ...unsplashPhotos, ...pexelsPhotos];
    
    // Take best 3 (prioritize wikimedia for car-specific results)
    const bestPhotos = allPhotos.slice(0, 3).map(p => ({
      ...p,
      generation_id: gen.id,
      brand,
      model,
      generation: genCode,
    }));

    if (bestPhotos.length > 0) {
      results.push(...bestPhotos);
      found += bestPhotos.length;
    }

    processed++;

    // Save progress every 50 generations
    if (processed % 50 === 0) {
      const progressFile = path.join(__dirname, '../data/photos-progress.json');
      fs.writeFileSync(progressFile, JSON.stringify(results, null, 2));
      console.log(`\n   💾 Saved progress: ${results.length} photos`);
    }
  }

  // Save final results
  const outputFile = path.join(__dirname, '../data/vehicle-photos.json');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Generations processed: ${processed}`);
  console.log(`  Photos found: ${found}`);
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

scrapePhotos().catch(console.error);
