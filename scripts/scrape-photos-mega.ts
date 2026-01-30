/**
 * FLM AUTO - Scrape Photos for ALL new brands (mega batch)
 * Uses Wikimedia Commons API (free, no API key needed)
 */

import * as fs from 'fs';
import * as path from 'path';

interface PhotoResult {
  brand: string;
  model: string;
  generation: string | null;
  source: 'wikimedia';
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// All brands from mega scrape
const BRANDS_TO_PROCESS = [
  'Volvo', 'Bentley', 'Rolls-Royce', 'Bugatti', 'McLaren', 'Lotus', 'Alpina', 'Alpine',
  'Seat', 'Skoda', 'Smart', 'Cupra',
  'Subaru', 'Suzuki', 'Mitsubishi', 'Daihatsu', 'Infiniti', 'Acura',
  'Dodge', 'Jeep', 'Chrysler', 'Buick', 'Cadillac', 'Lincoln',
  'Dacia', 'Lancia', 'Abarth', 'DS', 'Saab', 'Rover', 'MG', 'Vauxhall',
  'Genesis', 'SsangYong',
  'BYD', 'Polestar', 'VinFast', 'XPeng', 'ZEEKR', 'Aiways',
  'TVR', 'Caterham', 'Morgan', 'Donkervoort', 'Zenvo', 'Koenigsegg', 'Pagani', 'Spyker',
  'De Tomaso', 'Austin', 'Triumph', 'Pontiac', 'Oldsmobile', 'Plymouth', 'DeLorean',
  // Also add brands from first batch that might be missing photos
  'Opel', 'Mini', 'Peugeot', 'Renault', 'Citroen', 'Ferrari', 'Alfa Romeo', 'Fiat', 'Maserati',
  'Toyota', 'Honda', 'Nissan', 'Mazda', 'Lexus', 'Ford', 'Chevrolet', 'Tesla',
  'Jaguar', 'Land Rover', 'Aston Martin', 'Hyundai', 'Kia',
];

async function searchWikimedia(query: string): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Search for images
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10&format=json&origin=*`;
    
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return photos;
    
    const searchData = await searchRes.json();
    
    if (!searchData.query?.search) return photos;

    for (const result of searchData.query.search.slice(0, 5)) {
      const title = result.title;
      
      // Skip non-image results
      if (!title.match(/\.(jpg|jpeg|png|webp)$/i)) continue;
      
      // Get image info
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|user|extmetadata&format=json&origin=*`;
      
      const infoRes = await fetch(infoUrl);
      if (!infoRes.ok) continue;
      
      const infoData = await infoRes.json();
      
      const pages = infoData.query?.pages;
      if (!pages) continue;
      
      const page = Object.values(pages)[0] as any;
      const imageInfo = page?.imageinfo?.[0];
      
      if (!imageInfo || !imageInfo.url) continue;

      // Check license
      const license = imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown';
      if (license.includes('©') || license.includes('All rights reserved')) continue;

      // Skip small images
      if (imageInfo.width < 400 || imageInfo.height < 300) continue;

      // Generate thumbnail URL
      const thumbUrl = imageInfo.url.replace(/\/commons\//, '/commons/thumb/') + '/800px-' + title.replace('File:', '');

      photos.push({
        brand: '',
        model: '',
        generation: null,
        source: 'wikimedia',
        url: imageInfo.url,
        thumbnail_url: thumbUrl,
        width: imageInfo.width,
        height: imageInfo.height,
        license: license,
        author: imageInfo.user || 'Unknown',
        source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      });
    }
  } catch (err) {
    // Ignore errors
  }
  
  return photos;
}

interface VehicleData {
  brand: string;
  variant: string;
  generation: string | null;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Photo Scraper (Wikimedia Commons)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const dataDir = path.join(__dirname, '../data/ultimatespecs');
  const outputFile = path.join(__dirname, '../data/photos-mega-batch.json');
  
  const allPhotos: PhotoResult[] = [];
  const processedQueries = new Set<string>();
  const startTime = Date.now();

  // Load existing photos to avoid duplicates
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allPhotos.push(...existing);
    existing.forEach((p: PhotoResult) => processedQueries.add(`${p.brand}-${p.model}`));
    console.log(`Loaded ${existing.length} existing photos\n`);
  }

  for (let i = 0; i < BRANDS_TO_PROCESS.length; i++) {
    const brand = BRANDS_TO_PROCESS[i];
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
    
    process.stdout.write(`[${i + 1}/${BRANDS_TO_PROCESS.length}] ${brand.padEnd(15)} (${elapsedStr})`);
    
    // Find the brand's JSON file
    const brandSlug = brand.toLowerCase().replace(/\s+/g, '-').replace('alfa-romeo', 'alfa-romeo');
    const possibleFiles = [
      `${brandSlug}.json`,
      `${brand.toLowerCase()}.json`,
      `${brand.toLowerCase().replace(/\s+/g, '')}.json`,
    ];
    
    let vehicleFile = '';
    for (const f of possibleFiles) {
      const fp = path.join(dataDir, f);
      if (fs.existsSync(fp)) {
        vehicleFile = fp;
        break;
      }
    }
    
    if (!vehicleFile) {
      console.log(` → No data file found ⚠️`);
      continue;
    }
    
    // Load vehicles
    const vehicles: VehicleData[] = JSON.parse(fs.readFileSync(vehicleFile, 'utf-8'));
    
    // Group by generation to reduce API calls
    const generations = new Map<string, VehicleData>();
    for (const v of vehicles) {
      const key = v.generation || v.variant.split(' ').slice(0, 3).join(' ');
      if (!generations.has(key)) {
        generations.set(key, v);
      }
    }
    
    let brandPhotoCount = 0;
    const gensToProcess = Array.from(generations.values()).slice(0, 30); // Limit per brand
    
    for (const vehicle of gensToProcess) {
      // Build search query
      const searchTerms = [
        `${brand} ${vehicle.generation || ''}`.trim(),
        vehicle.variant,
      ];
      
      for (const query of searchTerms) {
        const queryKey = `${brand}-${query}`;
        if (processedQueries.has(queryKey)) continue;
        processedQueries.add(queryKey);
        
        const photos = await searchWikimedia(query + ' automobile');
        
        for (const photo of photos) {
          photo.brand = brand;
          photo.model = vehicle.variant;
          photo.generation = vehicle.generation;
          allPhotos.push(photo);
          brandPhotoCount++;
        }
        
        await delay(200); // Rate limit
        
        if (brandPhotoCount >= 20) break; // Enough for this brand
      }
      
      if (brandPhotoCount >= 20) break;
    }
    
    console.log(` → ${brandPhotoCount} photos ✅`);
    
    // Save progress periodically
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
    }
    
    await delay(500); // Delay between brands
  }
  
  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
  
  // Summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total photos: ${allPhotos.length}`);
  console.log(`  Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`  Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
