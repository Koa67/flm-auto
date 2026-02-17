/**
 * FLM AUTO - MEGA PHOTO SCRAPER
 * 
 * Scrape photos HD de:
 * - Wikimedia Commons
 * - Manufacturer press sites
 * - Car photography sites
 * 
 * Run: npx ts-node mega-photo-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/photos';
const DELAY_MS = 400;

interface PhotoEntry {
  brand: string;
  model: string;
  generation?: string;
  image_url: string;
  thumbnail_url?: string;
  source: string;
  license?: string;
  width?: number;
  height?: number;
  scraped_at: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FLM-Auto/1.0 (https://flm-auto.com; contact@flm-auto.com) Bot',
          'Accept': 'text/html,application/json',
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(2000 * (i + 1));
    }
  }
  throw new Error('Fetch failed');
}

// ============================================================
// Wikimedia Commons API - Free high-res photos
// ============================================================
async function scrapeWikimediaCommons(): Promise<PhotoEntry[]> {
  console.log('\n📷 Wikimedia Commons - Free HD Photos\n');
  
  const photos: PhotoEntry[] = [];
  
  const searchTerms = [
    // BMW
    'BMW 3 Series', 'BMW 5 Series', 'BMW 7 Series', 'BMW X3', 'BMW X5', 'BMW X7',
    'BMW M3', 'BMW M5', 'BMW i4', 'BMW iX', 'BMW Z4', 'BMW 8 Series',
    // Mercedes
    'Mercedes-Benz C-Class', 'Mercedes-Benz E-Class', 'Mercedes-Benz S-Class',
    'Mercedes-Benz GLC', 'Mercedes-Benz GLE', 'Mercedes-Benz GLS', 'Mercedes-Benz A-Class',
    'Mercedes-AMG GT', 'Mercedes-Benz EQS', 'Mercedes-Benz EQE',
    // Audi
    'Audi A3', 'Audi A4', 'Audi A6', 'Audi A8', 'Audi Q3', 'Audi Q5', 'Audi Q7', 'Audi Q8',
    'Audi e-tron', 'Audi R8', 'Audi RS6', 'Audi TT',
    // VW
    'Volkswagen Golf', 'Volkswagen Passat', 'Volkswagen Tiguan', 'Volkswagen Touareg',
    'Volkswagen ID.3', 'Volkswagen ID.4', 'Volkswagen ID.Buzz', 'Volkswagen Polo', 'Volkswagen T-Roc',
    // Porsche
    'Porsche 911', 'Porsche Cayenne', 'Porsche Macan', 'Porsche Panamera', 'Porsche Taycan',
    'Porsche 718 Cayman', 'Porsche 718 Boxster',
    // Skoda
    'Skoda Octavia', 'Skoda Superb', 'Skoda Kodiaq', 'Skoda Karoq', 'Skoda Enyaq',
    // Tesla
    'Tesla Model 3', 'Tesla Model S', 'Tesla Model X', 'Tesla Model Y', 'Tesla Cybertruck',
    // Hyundai
    'Hyundai Ioniq 5', 'Hyundai Ioniq 6', 'Hyundai Tucson', 'Hyundai Kona', 'Hyundai Santa Fe',
    // Volvo
    'Volvo XC40', 'Volvo XC60', 'Volvo XC90', 'Volvo S60', 'Volvo V60', 'Volvo EX30',
    // Supercars
    'Ferrari 296', 'Ferrari SF90', 'Ferrari Roma', 'Ferrari Purosangue',
    'Lamborghini Huracan', 'Lamborghini Urus', 'Lamborghini Revuelto',
    'McLaren 720S', 'McLaren Artura',
    'Aston Martin DB11', 'Aston Martin DBX', 'Aston Martin Vantage',
  ];
  
  for (const term of searchTerms) {
    await delay(DELAY_MS);
    
    try {
      // Wikimedia Commons API
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term + ' car')}&srnamespace=6&srlimit=10&format=json`;
      
      const response = await fetchWithRetry(apiUrl);
      const data = JSON.parse(response);
      
      if (!data.query?.search) continue;
      
      let count = 0;
      for (const result of data.query.search) {
        const title = result.title;
        
        // Get image info
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json`;
        
        try {
          const infoResponse = await fetchWithRetry(infoUrl);
          const infoData = JSON.parse(infoResponse);
          
          const pages = infoData.query?.pages;
          if (!pages) continue;
          
          const pageId = Object.keys(pages)[0];
          const imageInfo = pages[pageId]?.imageinfo?.[0];
          
          if (imageInfo?.url) {
            // Extract brand from search term
            const brandMatch = term.match(/^([A-Za-z-]+)/);
            const brand = brandMatch ? brandMatch[1] : 'Unknown';
            
            photos.push({
              brand,
              model: term,
              image_url: imageInfo.url,
              thumbnail_url: imageInfo.thumburl,
              source: 'Wikimedia Commons',
              license: imageInfo.extmetadata?.License?.value || 'Unknown',
              width: imageInfo.width,
              height: imageInfo.height,
              scraped_at: new Date().toISOString(),
            });
            count++;
          }
        } catch {}
        
        await delay(200);
      }
      
      console.log(`   ✅ ${term}: ${count} photos`);
      
    } catch (e) {
      console.log(`   ❌ ${term} failed`);
    }
  }
  
  return photos;
}

// ============================================================
// Unsplash API - High quality photos (if API key available)
// ============================================================
async function scrapeUnsplash(): Promise<PhotoEntry[]> {
  console.log('\n📷 Unsplash - High Quality Photos\n');
  
  // Note: Requires API key - using public access
  const photos: PhotoEntry[] = [];
  
  const searchTerms = [
    'BMW car', 'Mercedes Benz', 'Audi car', 'Porsche', 'Volkswagen',
    'Tesla Model', 'Ferrari', 'Lamborghini', 'supercar', 'luxury car',
  ];
  
  for (const term of searchTerms) {
    await delay(1000); // Unsplash rate limit
    
    try {
      // Public Unsplash search (limited)
      const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(term)}&per_page=20`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      let count = 0;
      for (const photo of data.results || []) {
        if (photo.urls?.regular) {
          photos.push({
            brand: 'Various',
            model: term,
            image_url: photo.urls.full || photo.urls.regular,
            thumbnail_url: photo.urls.thumb,
            source: 'Unsplash',
            license: 'Unsplash License',
            width: photo.width,
            height: photo.height,
            scraped_at: new Date().toISOString(),
          });
          count++;
        }
      }
      
      console.log(`   ✅ ${term}: ${count} photos`);
      
    } catch (e) {
      console.log(`   ❌ ${term} failed`);
    }
  }
  
  return photos;
}

// ============================================================
// Manufacturer Press Photos (via newsroom sites)
// ============================================================
async function scrapeManufacturerPress(): Promise<PhotoEntry[]> {
  console.log('\n📷 Manufacturer Press Sites\n');
  
  const photos: PhotoEntry[] = [];
  
  // BMW Press
  try {
    console.log('   🚗 BMW Press...');
    const bmwUrl = 'https://www.press.bmwgroup.com/global/photo/compilation';
    // Note: Most manufacturer sites require authentication or have JS rendering
    // This is a placeholder for when proper access is available
  } catch {}
  
  // For now, use Wikipedia images as fallback
  const wikiModels = [
    { brand: 'BMW', models: ['3 Series (E90)', '3 Series (F30)', '3 Series (G20)', '5 Series (G30)', 'X5 (G05)'] },
    { brand: 'Mercedes-Benz', models: ['C-Class (W205)', 'E-Class (W213)', 'S-Class (W223)'] },
    { brand: 'Audi', models: ['A4 (B9)', 'A6 (C8)', 'Q5 (FY)'] },
    { brand: 'Porsche', models: ['911 (992)', 'Cayenne (E3)', 'Taycan'] },
  ];
  
  for (const { brand, models } of wikiModels) {
    for (const model of models) {
      await delay(DELAY_MS);
      
      try {
        const wikiTitle = `${brand}_${model.replace(/\s+/g, '_')}`;
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&piprop=original&format=json`;
        
        const response = await fetchWithRetry(apiUrl);
        const data = JSON.parse(response);
        
        const pages = data.query?.pages;
        if (!pages) continue;
        
        const pageId = Object.keys(pages)[0];
        const original = pages[pageId]?.original;
        
        if (original?.source) {
          photos.push({
            brand,
            model,
            image_url: original.source,
            width: original.width,
            height: original.height,
            source: 'Wikipedia',
            license: 'CC BY-SA',
            scraped_at: new Date().toISOString(),
          });
          
          console.log(`   ✅ ${brand} ${model}`);
        }
        
      } catch {}
    }
  }
  
  return photos;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   FLM AUTO - MEGA PHOTO SCRAPER');
  console.log('   Scraping high-resolution vehicle photos');
  console.log('═══════════════════════════════════════════════════════════════');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const allPhotos: PhotoEntry[] = [];
  const startTime = Date.now();
  
  // Wikimedia Commons
  const wikimediaPhotos = await scrapeWikimediaCommons();
  allPhotos.push(...wikimediaPhotos);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'wikimedia_photos.json'), JSON.stringify(wikimediaPhotos, null, 2));
  
  // Unsplash
  const unsplashPhotos = await scrapeUnsplash();
  allPhotos.push(...unsplashPhotos);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'unsplash_photos.json'), JSON.stringify(unsplashPhotos, null, 2));
  
  // Manufacturer press
  const pressPhotos = await scrapeManufacturerPress();
  allPhotos.push(...pressPhotos);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'press_photos.json'), JSON.stringify(pressPhotos, null, 2));
  
  // Save all
  fs.writeFileSync(path.join(OUTPUT_DIR, '_all_photos.json'), JSON.stringify(allPhotos, null, 2));
  
  // Summary
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   PHOTO SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📊 Total photos: ${allPhotos.length}`);
  console.log(`   Wikimedia: ${wikimediaPhotos.length}`);
  console.log(`   Unsplash: ${unsplashPhotos.length}`);
  console.log(`   Press: ${pressPhotos.length}`);
  console.log(`\n⏱️ Duration: ${elapsed.toFixed(1)} minutes`);
  
  // By brand
  const byBrand = new Map<string, number>();
  for (const photo of allPhotos) {
    byBrand.set(photo.brand, (byBrand.get(photo.brand) || 0) + 1);
  }
  
  console.log('\n📊 By brand:');
  [...byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([brand, count]) => {
    console.log(`   ${brand}: ${count}`);
  });
}

main().catch(console.error);
