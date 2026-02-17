/**
 * FLM AUTO - ULTIMATE Photo Scraper with Triple Fallback
 * 
 * Sources (in priority order):
 * 1. Wikimedia Commons (best quality, free, no API key)
 * 2. Wikipedia article images (curated, reliable)
 * 3. Unsplash (high quality, needs API key)
 * 4. Pexels (high quality, needs API key)
 * 5. Pixabay (fallback, needs API key)
 * 
 * Strategy: For each vehicle, try sources until we get at least 3 good photos
 * 
 * Usage: npx tsx scripts/scrape-photos-ultimate.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// API Keys (set in .env.local or here)
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'YOUR_UNSPLASH_KEY';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'YOUR_PEXELS_KEY';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || 'YOUR_PIXABAY_KEY';

// How many photos minimum per vehicle generation
const MIN_PHOTOS_PER_GENERATION = 3;
const MAX_PHOTOS_PER_GENERATION = 8;

// Rate limits (ms between requests)
const RATE_LIMITS = {
  wikimedia: 100,
  wikipedia: 150,
  unsplash: 200,
  pexels: 200,
  pixabay: 200,
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PhotoResult {
  brand: string;
  model: string;
  generation: string | null;
  variant: string;
  source: 'wikimedia' | 'wikipedia' | 'unsplash' | 'pexels' | 'pixabay';
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
  search_query: string;
}

interface VehicleSpec {
  brand: string;
  model: string;
  variant: string;
  generation: string | null;
  year_start?: number | null;
}

interface GenerationGroup {
  brand: string;
  model: string;
  generation: string;
  variants: VehicleSpec[];
  year_start?: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 1: WIKIMEDIA COMMONS
// ═══════════════════════════════════════════════════════════════════════════

async function searchWikimedia(query: string, brand: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Multiple search strategies
    const searchQueries = [
      `${query} car`,
      `${query} automobile`,
      `${query}`,
      `${brand} ${generation || ''} car`.trim(),
    ];
    
    for (const searchQuery of searchQueries) {
      if (photos.length >= MAX_PHOTOS_PER_GENERATION) break;
      
      const searchUrl = `https://commons.wikimedia.org/w/api.php?` +
        `action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}` +
        `&srnamespace=6&srlimit=15&format=json&origin=*`;
      
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'FLM-AUTO-Bot/1.0 (contact@example.com)' }
      });
      
      if (!searchRes.ok) continue;
      
      const searchData = await searchRes.json();
      if (!searchData.query?.search) continue;

      for (const result of searchData.query.search) {
        if (photos.length >= MAX_PHOTOS_PER_GENERATION) break;
        
        const title = result.title;
        
        // Only images
        if (!title.match(/\.(jpg|jpeg|png|webp)$/i)) continue;
        
        // Skip unwanted content
        if (title.match(/logo|badge|emblem|interior|engine|wheel|dashboard|cockpit/i)) continue;
        
        // Get image info
        const infoUrl = `https://commons.wikimedia.org/w/api.php?` +
          `action=query&titles=${encodeURIComponent(title)}` +
          `&prop=imageinfo&iiprop=url|size|user|extmetadata&format=json&origin=*`;
        
        const infoRes = await fetch(infoUrl, {
          headers: { 'User-Agent': 'FLM-AUTO-Bot/1.0' }
        });
        
        if (!infoRes.ok) continue;
        
        const infoData = await infoRes.json();
        const pages = infoData.query?.pages;
        if (!pages) continue;
        
        const page = Object.values(pages)[0] as any;
        const imageInfo = page?.imageinfo?.[0];
        if (!imageInfo?.url) continue;

        // Check license (skip non-free)
        const license = imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown';
        if (license.includes('©') || license.toLowerCase().includes('all rights reserved')) continue;

        // Quality check
        if (imageInfo.width < 600 || imageInfo.height < 400) continue;
        
        // Aspect ratio check (skip weird crops)
        const aspectRatio = imageInfo.width / imageInfo.height;
        if (aspectRatio < 0.5 || aspectRatio > 3) continue;

        // Build thumbnail URL
        const fileName = title.replace('File:', '');
        const thumbUrl = imageInfo.url.includes('/commons/')
          ? imageInfo.url.replace('/commons/', '/commons/thumb/') + '/800px-' + fileName
          : imageInfo.url;

        photos.push({
          brand,
          model: '',
          generation,
          variant: query,
          source: 'wikimedia',
          url: imageInfo.url,
          thumbnail_url: thumbUrl,
          width: imageInfo.width,
          height: imageInfo.height,
          license,
          author: imageInfo.user || 'Unknown',
          source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
          search_query: searchQuery,
        });
        
        await delay(RATE_LIMITS.wikimedia);
      }
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 2: WIKIPEDIA ARTICLE IMAGES
// ═══════════════════════════════════════════════════════════════════════════

async function searchWikipedia(query: string, brand: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Search for Wikipedia article
    const searchQueries = [
      query.replace(/\s+/g, '_'),
      `${brand}_${(generation || '').replace(/\s+/g, '_')}`,
    ];
    
    for (const articleTitle of searchQueries) {
      if (photos.length >= 3) break;
      
      // Get article images
      const apiUrl = `https://en.wikipedia.org/w/api.php?` +
        `action=query&titles=${encodeURIComponent(articleTitle)}` +
        `&prop=images|pageimages&piprop=original&pilimit=5&imlimit=10&format=json&origin=*`;
      
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'FLM-AUTO-Bot/1.0' }
      });
      
      if (!res.ok) continue;
      
      const data = await res.json();
      const pages = data.query?.pages;
      if (!pages) continue;
      
      for (const page of Object.values(pages) as any[]) {
        // Main image (pageimage)
        if (page.original?.source) {
          photos.push({
            brand,
            model: '',
            generation,
            variant: query,
            source: 'wikipedia',
            url: page.original.source,
            thumbnail_url: page.original.source,
            width: page.original.width || 800,
            height: page.original.height || 600,
            license: 'Wikipedia',
            author: 'Wikipedia',
            source_url: `https://en.wikipedia.org/wiki/${articleTitle}`,
            search_query: articleTitle,
          });
        }
        
        // Other images
        if (page.images) {
          for (const img of page.images.slice(0, 5)) {
            if (!img.title.match(/\.(jpg|jpeg|png)$/i)) continue;
            if (img.title.match(/logo|icon|flag|map|diagram/i)) continue;
            
            // Get image URL
            const imgInfoUrl = `https://en.wikipedia.org/w/api.php?` +
              `action=query&titles=${encodeURIComponent(img.title)}` +
              `&prop=imageinfo&iiprop=url|size&format=json&origin=*`;
            
            const imgRes = await fetch(imgInfoUrl);
            if (!imgRes.ok) continue;
            
            const imgData = await imgRes.json();
            const imgPages = imgData.query?.pages;
            if (!imgPages) continue;
            
            const imgPage = Object.values(imgPages)[0] as any;
            const imgInfo = imgPage?.imageinfo?.[0];
            
            if (imgInfo?.url && imgInfo.width > 500) {
              photos.push({
                brand,
                model: '',
                generation,
                variant: query,
                source: 'wikipedia',
                url: imgInfo.url,
                thumbnail_url: imgInfo.url,
                width: imgInfo.width,
                height: imgInfo.height,
                license: 'Wikipedia',
                author: 'Wikipedia',
                source_url: `https://en.wikipedia.org/wiki/${articleTitle}`,
                search_query: articleTitle,
              });
            }
            
            await delay(50);
          }
        }
      }
      
      await delay(RATE_LIMITS.wikipedia);
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 3: UNSPLASH
// ═══════════════════════════════════════════════════════════════════════════

async function searchUnsplash(query: string, brand: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_KEY') {
    return photos;
  }
  
  try {
    const searchUrl = `https://api.unsplash.com/search/photos?` +
      `query=${encodeURIComponent(query + ' car')}&per_page=10&orientation=landscape`;
    
    const res = await fetch(searchUrl, {
      headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    
    if (!res.ok) return photos;
    
    const data = await res.json();
    
    for (const photo of data.results || []) {
      if (photos.length >= 5) break;
      
      photos.push({
        brand,
        model: '',
        generation,
        variant: query,
        source: 'unsplash',
        url: photo.urls.regular,
        thumbnail_url: photo.urls.small,
        width: photo.width,
        height: photo.height,
        license: 'Unsplash License',
        author: photo.user?.name || 'Unknown',
        source_url: photo.links.html,
        search_query: query,
      });
    }
    
    await delay(RATE_LIMITS.unsplash);
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 4: PEXELS
// ═══════════════════════════════════════════════════════════════════════════

async function searchPexels(query: string, brand: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  if (!PEXELS_API_KEY || PEXELS_API_KEY === 'YOUR_PEXELS_KEY') {
    return photos;
  }
  
  try {
    const searchUrl = `https://api.pexels.com/v1/search?` +
      `query=${encodeURIComponent(query + ' car')}&per_page=10&orientation=landscape`;
    
    const res = await fetch(searchUrl, {
      headers: { 'Authorization': PEXELS_API_KEY }
    });
    
    if (!res.ok) return photos;
    
    const data = await res.json();
    
    for (const photo of data.photos || []) {
      if (photos.length >= 5) break;
      
      photos.push({
        brand,
        model: '',
        generation,
        variant: query,
        source: 'pexels',
        url: photo.src.large2x || photo.src.large,
        thumbnail_url: photo.src.medium,
        width: photo.width,
        height: photo.height,
        license: 'Pexels License',
        author: photo.photographer || 'Unknown',
        source_url: photo.url,
        search_query: query,
      });
    }
    
    await delay(RATE_LIMITS.pexels);
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 5: PIXABAY (Ultimate fallback)
// ═══════════════════════════════════════════════════════════════════════════

async function searchPixabay(query: string, brand: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  if (!PIXABAY_API_KEY || PIXABAY_API_KEY === 'YOUR_PIXABAY_KEY') {
    return photos;
  }
  
  try {
    const searchUrl = `https://pixabay.com/api/?` +
      `key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query + ' car')}` +
      `&image_type=photo&orientation=horizontal&per_page=10&safesearch=true`;
    
    const res = await fetch(searchUrl);
    
    if (!res.ok) return photos;
    
    const data = await res.json();
    
    for (const photo of data.hits || []) {
      if (photos.length >= 5) break;
      
      photos.push({
        brand,
        model: '',
        generation,
        variant: query,
        source: 'pixabay',
        url: photo.largeImageURL,
        thumbnail_url: photo.webformatURL,
        width: photo.imageWidth,
        height: photo.imageHeight,
        license: 'Pixabay License',
        author: photo.user || 'Unknown',
        source_url: photo.pageURL,
        search_query: query,
      });
    }
    
    await delay(RATE_LIMITS.pixabay);
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-SOURCE SEARCH WITH FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

async function searchAllSources(
  query: string,
  brand: string,
  generation: string | null,
  existingCount: number = 0
): Promise<PhotoResult[]> {
  const allPhotos: PhotoResult[] = [];
  const needed = MIN_PHOTOS_PER_GENERATION - existingCount;
  
  if (needed <= 0) return allPhotos;
  
  // Build multiple search queries for better coverage
  const searchQueries = [
    query,
    `${brand} ${generation || ''}`.trim(),
    `${brand} ${generation || ''} exterior`.trim(),
  ].filter(q => q.length > 3);
  
  // Source 1: Wikimedia (always try first - best quality, free)
  for (const q of searchQueries) {
    if (allPhotos.length >= needed) break;
    const wikimediaPhotos = await searchWikimedia(q, brand, generation);
    allPhotos.push(...wikimediaPhotos);
  }
  
  // Source 2: Wikipedia (curated article images)
  if (allPhotos.length < needed) {
    for (const q of searchQueries.slice(0, 2)) {
      if (allPhotos.length >= needed) break;
      const wikiPhotos = await searchWikipedia(q, brand, generation);
      allPhotos.push(...wikiPhotos);
    }
  }
  
  // Source 3: Unsplash (high quality, needs API key)
  if (allPhotos.length < needed) {
    const unsplashPhotos = await searchUnsplash(searchQueries[0], brand, generation);
    allPhotos.push(...unsplashPhotos);
  }
  
  // Source 4: Pexels (high quality, needs API key)
  if (allPhotos.length < needed) {
    const pexelsPhotos = await searchPexels(searchQueries[0], brand, generation);
    allPhotos.push(...pexelsPhotos);
  }
  
  // Source 5: Pixabay (fallback)
  if (allPhotos.length < needed) {
    const pixabayPhotos = await searchPixabay(searchQueries[0], brand, generation);
    allPhotos.push(...pixabayPhotos);
  }
  
  // Deduplicate by URL
  const seen = new Set<string>();
  return allPhotos.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  }).slice(0, MAX_PHOTOS_PER_GENERATION);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD VEHICLES FROM DATA FILES
// ═══════════════════════════════════════════════════════════════════════════

function loadAllVehicles(dataDir: string): GenerationGroup[] {
  const groups: GenerationGroup[] = [];
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.includes('missing'));
  
  for (const file of files) {
    try {
      const filePath = path.join(dataDir, file);
      const vehicles: VehicleSpec[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (!vehicles.length) continue;
      
      // Group by generation
      const genMap = new Map<string, GenerationGroup>();
      
      for (const v of vehicles) {
        const genKey = v.generation || v.variant?.split(' ').slice(1, 3).join(' ') || 'Default';
        
        if (!genMap.has(genKey)) {
          genMap.set(genKey, {
            brand: v.brand,
            model: v.model || v.brand,
            generation: genKey,
            variants: [],
            year_start: v.year_start,
          });
        }
        
        genMap.get(genKey)!.variants.push(v);
      }
      
      groups.push(...Array.from(genMap.values()));
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }
  
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD EXISTING PHOTOS
// ═══════════════════════════════════════════════════════════════════════════

function loadExistingPhotos(dataDir: string): Map<string, PhotoResult[]> {
  const photoMap = new Map<string, PhotoResult[]>();
  
  const photoFiles = [
    'vehicle-photos.json',
    'photos-mega-batch.json',
    'photos-premium-batch.json',
    'vehicle-photos-new-brands.json',
  ];
  
  for (const file of photoFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    try {
      const photos: PhotoResult[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      for (const photo of photos) {
        const key = `${photo.brand}|${photo.generation || 'default'}`.toLowerCase();
        if (!photoMap.has(key)) {
          photoMap.set(key, []);
        }
        photoMap.get(key)!.push(photo);
      }
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }
  
  return photoMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FLM AUTO - ULTIMATE Photo Scraper                        ║');
  console.log('║   Triple Fallback: Wikimedia → Wikipedia → Unsplash →      ║');
  console.log('║                    Pexels → Pixabay                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const dataDir = path.join(__dirname, '../data');
  const specsDir = path.join(dataDir, 'ultimatespecs');
  const outputFile = path.join(dataDir, 'photos-ultimate.json');
  const progressFile = path.join(dataDir, 'photos-ultimate-progress.json');
  
  // Load existing photos
  console.log('📂 Loading existing photos...');
  const existingPhotos = loadExistingPhotos(dataDir);
  let existingCount = 0;
  existingPhotos.forEach(photos => existingCount += photos.length);
  console.log(`   Found ${existingCount} existing photos\n`);
  
  // Load all vehicles
  console.log('📂 Loading vehicle data...');
  const allGenerations = loadAllVehicles(specsDir);
  console.log(`   Found ${allGenerations.length} unique generations\n`);
  
  // Load progress
  let processedKeys = new Set<string>();
  let newPhotos: PhotoResult[] = [];
  
  if (fs.existsSync(progressFile)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      processedKeys = new Set(progress.processedKeys || []);
      newPhotos = progress.photos || [];
      console.log(`📂 Resuming from progress: ${processedKeys.size} already processed\n`);
    } catch (err) {
      // Start fresh
    }
  }
  
  // Stats
  const stats = {
    total: allGenerations.length,
    processed: 0,
    skipped: 0,
    withPhotos: 0,
    newPhotos: 0,
    bySource: { wikimedia: 0, wikipedia: 0, unsplash: 0, pexels: 0, pixabay: 0 } as Record<string, number>,
  };
  
  const startTime = Date.now();
  
  // Process each generation
  for (let i = 0; i < allGenerations.length; i++) {
    const gen = allGenerations[i];
    const genKey = `${gen.brand}|${gen.generation}`.toLowerCase();
    
    // Progress display
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
    const pct = Math.round((i / allGenerations.length) * 100);
    
    process.stdout.write(
      `\r[${pct.toString().padStart(3)}%] ${gen.brand.padEnd(15)} ${gen.generation?.substring(0, 20).padEnd(20) || 'Default'.padEnd(20)} (${elapsedStr})`
    );
    
    // Skip if already processed
    if (processedKeys.has(genKey)) {
      stats.skipped++;
      continue;
    }
    
    // Check existing photos
    const existing = existingPhotos.get(genKey) || [];
    
    if (existing.length >= MIN_PHOTOS_PER_GENERATION) {
      stats.withPhotos++;
      processedKeys.add(genKey);
      continue;
    }
    
    // Search for photos
    const searchQuery = `${gen.brand} ${gen.generation || gen.model}`.trim();
    const photos = await searchAllSources(searchQuery, gen.brand, gen.generation, existing.length);
    
    if (photos.length > 0) {
      newPhotos.push(...photos);
      stats.withPhotos++;
      stats.newPhotos += photos.length;
      
      // Track by source
      for (const p of photos) {
        stats.bySource[p.source] = (stats.bySource[p.source] || 0) + 1;
      }
    }
    
    processedKeys.add(genKey);
    stats.processed++;
    
    // Save progress every 50 generations
    if (stats.processed % 50 === 0) {
      fs.writeFileSync(progressFile, JSON.stringify({
        processedKeys: Array.from(processedKeys),
        photos: newPhotos,
        stats,
      }, null, 2));
      
      process.stdout.write(` 💾 Saved (${newPhotos.length} new)`);
    }
    
    // Small delay between generations
    await delay(100);
  }
  
  // Final save
  console.log('\n\n📝 Saving final results...');
  
  // Merge with existing
  const allPhotos = [...newPhotos];
  existingPhotos.forEach(photos => allPhotos.push(...photos));
  
  fs.writeFileSync(outputFile, JSON.stringify(newPhotos, null, 2));
  
  // Clean up progress file
  if (fs.existsSync(progressFile)) {
    fs.unlinkSync(progressFile);
  }
  
  // Summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  📊 Generations processed: ${stats.processed}`);
  console.log(`  ⏭️  Skipped (already had photos): ${stats.skipped}`);
  console.log(`  ✅ Generations with photos: ${stats.withPhotos}`);
  console.log(`  📸 New photos found: ${stats.newPhotos}`);
  console.log('');
  console.log('  📷 By Source:');
  for (const [source, count] of Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])) {
    if (count > 0) {
      console.log(`     ${source.padEnd(12)} ${count}`);
    }
  }
  console.log('');
  console.log(`  ⏱️  Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`  📁 Output: ${outputFile}`);
  
  // Coverage report
  const totalGens = allGenerations.length;
  const withPhotos = stats.withPhotos + stats.skipped;
  const coverage = Math.round((withPhotos / totalGens) * 100);
  
  console.log('');
  console.log('═'.repeat(60));
  console.log('COVERAGE');
  console.log('═'.repeat(60));
  console.log(`  Total generations: ${totalGens}`);
  console.log(`  With photos: ${withPhotos} (${coverage}%)`);
  console.log(`  Missing: ${totalGens - withPhotos}`);
  
  if (coverage < 80) {
    console.log('\n⚠️  Coverage below 80%. Consider:');
    console.log('   - Adding API keys for Unsplash/Pexels/Pixabay');
    console.log('   - Running the script again for missed generations');
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
