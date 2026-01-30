/**
 * FLM AUTO - Scrape Photos for generations WITHOUT photos
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
}

const results: PhotoResult[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function searchWikimedia(query: string): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' car automobile')}&srnamespace=6&srlimit=5&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.query?.search) return photos;

    for (const result of searchData.query.search.slice(0, 3)) {
      const title = result.title;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
      const infoRes = await fetch(infoUrl);
      const infoData = await infoRes.json();
      
      const pages = infoData.query?.pages;
      if (!pages) continue;
      
      const page = Object.values(pages)[0] as any;
      const imageInfo = page?.imageinfo?.[0];
      if (!imageInfo) continue;

      const license = imageInfo.extmetadata?.LicenseShortName?.value || '';
      if (license.includes('©')) continue;

      photos.push({
        generation_id: '', brand: '', model: '', generation: '',
        source: 'wikimedia',
        url: imageInfo.url,
        thumbnail_url: imageInfo.url,
      });
    }
  } catch (err) {}
  return photos;
}

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
        generation_id: '', brand: '', model: '', generation: '',
        source: 'unsplash',
        url: photo.urls.regular,
        thumbnail_url: photo.urls.small,
      });
    }
  } catch (err) {}
  return photos;
}

async function searchPexels(query: string): Promise<PhotoResult[]> {
  if (!PEXELS_API_KEY) return [];
  const photos: PhotoResult[] = [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' car')}&per_page=3`;
    const res = await fetch(url, { headers: { 'Authorization': PEXELS_API_KEY } });
    const data = await res.json();
    if (!data.photos) return photos;
    for (const photo of data.photos) {
      photos.push({
        generation_id: '', brand: '', model: '', generation: '',
        source: 'pexels',
        url: photo.src.large,
        thumbnail_url: photo.src.medium,
      });
    }
  } catch (err) {}
  return photos;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Photos for Missing Generations              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get generations that DON'T have photos
  const { data: allGens } = await supabase
    .from('generations')
    .select(`id, name, internal_code, models!inner(name, brands!inner(name))`);

  const { data: photosExist } = await supabase
    .from('vehicle_images')
    .select('generation_id');

  const existingIds = new Set(photosExist?.map(p => p.generation_id) || []);
  
  const missingGens = allGens?.filter(g => !existingIds.has(g.id)) || [];

  console.log(`Total generations: ${allGens?.length}`);
  console.log(`With photos: ${existingIds.size}`);
  console.log(`Missing photos: ${missingGens.length}\n`);

  if (missingGens.length === 0) {
    console.log('✅ All generations have photos!');
    return;
  }

  let processed = 0;
  let found = 0;

  for (const gen of missingGens) {
    const brand = (gen.models as any).brands.name;
    const model = (gen.models as any).name;
    const genCode = gen.internal_code || gen.name;
    const query = `${brand} ${model} ${genCode}`;

    process.stdout.write(`\r[${processed + 1}/${missingGens.length}] ${query.padEnd(50)}`);

    const allPhotos = [
      ...(await searchWikimedia(query)),
      ...(await searchUnsplash(query)),
      ...(await searchPexels(query)),
    ];
    await delay(150);

    for (const p of allPhotos.slice(0, 3)) {
      results.push({ ...p, generation_id: gen.id, brand, model, generation: genCode });
      found++;
    }

    processed++;
  }

  // Save
  const outputFile = path.join(__dirname, '../data/vehicle-photos-missing.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log(`Photos found: ${found}`);
  console.log(`Output: ${outputFile}`);

  // Import directly
  if (results.length > 0) {
    console.log('\nImporting to DB...');
    
    const toInsert = results.map((p, i) => ({
      generation_id: p.generation_id,
      image_type: 'exterior',
      url: p.url,
      thumbnail_url: p.thumbnail_url,
      is_primary: i % 3 === 0,
      display_order: i % 3,
    }));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase.from('vehicle_images').insert(batch);
      if (!error) inserted += batch.length;
    }

    const { count } = await supabase.from('vehicle_images').select('*', { count: 'exact', head: true });
    console.log(`Inserted: ${inserted}`);
    console.log(`Total photos in DB: ${count}`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
