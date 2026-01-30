/**
 * FLM AUTO - Photo Scraper (Unsplash + Pexels)
 * Complète les photos Wikimedia avec des sources premium
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

interface PhotoResult {
  brand: string;
  model: string;
  generation: string | null;
  source: 'unsplash' | 'pexels';
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Brands that need more photos (low count from Wikimedia)
const BRANDS_NEED_PHOTOS = [
  'Alpina', 'Cupra', 'Smart', 'Acura', 'Dacia', 'DS', 'Genesis', 
  'Aiways', 'XPeng', 'Donkervoort', 'Zenvo', 'Plymouth', 'DeLorean',
  'Polestar', 'VinFast', 'ZEEKR', 'Caterham', 'Spyker',
  // Popular brands for more variety
  'BMW', 'Mercedes', 'Audi', 'Porsche', 'Ferrari', 'Lamborghini',
  'Tesla', 'Ford Mustang', 'Chevrolet Corvette', 'Dodge Challenger',
  'Nissan GTR', 'Toyota Supra', 'Mazda MX-5', 'Honda NSX',
  'Jaguar F-Type', 'Aston Martin', 'McLaren', 'Bugatti',
  'Rolls-Royce', 'Bentley', 'Maserati', 'Alfa Romeo',
];

async function searchUnsplash(query: string): Promise<PhotoResult[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
  const photos: PhotoResult[] = [];
  
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    
    const res = await fetch(url);
    if (!res.ok) return photos;
    
    const data = await res.json();
    
    for (const photo of data.results || []) {
      photos.push({
        brand: '',
        model: '',
        generation: null,
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
    // Ignore
  }
  
  return photos;
}

async function searchPexels(query: string): Promise<PhotoResult[]> {
  if (!PEXELS_API_KEY) return [];
  const photos: PhotoResult[] = [];
  
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    if (!res.ok) return photos;
    
    const data = await res.json();
    
    for (const photo of data.photos || []) {
      photos.push({
        brand: '',
        model: '',
        generation: null,
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
    // Ignore
  }
  
  return photos;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Photo Scraper (Unsplash + Pexels)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!UNSPLASH_ACCESS_KEY) console.log('⚠️  No Unsplash API key');
  if (!PEXELS_API_KEY) console.log('⚠️  No Pexels API key');

  const outputFile = path.join(__dirname, '../data/photos-premium-batch.json');
  const allPhotos: PhotoResult[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allPhotos.push(...existing);
    console.log(`Loaded ${existing.length} existing photos\n`);
  }

  const processedQueries = new Set(allPhotos.map(p => `${p.brand}-${p.source}`));

  for (let i = 0; i < BRANDS_NEED_PHOTOS.length; i++) {
    const brand = BRANDS_NEED_PHOTOS[i];
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
    
    process.stdout.write(`[${i + 1}/${BRANDS_NEED_PHOTOS.length}] ${brand.padEnd(20)} (${elapsedStr})`);
    
    let brandPhotoCount = 0;
    const query = `${brand} car`;
    
    // Skip if already processed
    if (!processedQueries.has(`${brand}-unsplash`)) {
      const unsplashPhotos = await searchUnsplash(query);
      for (const p of unsplashPhotos) {
        p.brand = brand;
        p.model = brand;
        allPhotos.push(p);
        brandPhotoCount++;
      }
      processedQueries.add(`${brand}-unsplash`);
      await delay(1000); // Unsplash rate limit: 50/hour
    }
    
    if (!processedQueries.has(`${brand}-pexels`)) {
      const pexelsPhotos = await searchPexels(query);
      for (const p of pexelsPhotos) {
        p.brand = brand;
        p.model = brand;
        allPhotos.push(p);
        brandPhotoCount++;
      }
      processedQueries.add(`${brand}-pexels`);
      await delay(200); // Pexels more lenient
    }
    
    console.log(` → ${brandPhotoCount} photos ✅`);
    
    // Save progress
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
    }
  }
  
  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
  
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`Total photos: ${allPhotos.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
