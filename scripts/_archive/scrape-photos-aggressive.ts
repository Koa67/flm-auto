/**
 * FLM AUTO - AGGRESSIVE Photo Scraper (Puppeteer-based)
 * For generations that couldn't find photos via APIs
 * 
 * Sources:
 * 1. NetCarShow.com (huge car photo database)
 * 2. Car-Images.com (press photos)
 * 3. AutoEvolution.com (car galleries)
 * 4. CarPixel.net (high-res car photos)
 * 5. Google Images (last resort, filtered)
 * 
 * Usage: npx tsx scripts/scrape-photos-aggressive.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface PhotoResult {
  brand: string;
  model: string;
  generation: string | null;
  variant: string;
  source: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  license: string;
  author: string;
  source_url: string;
  search_query: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 1: NETCARSHOW.COM
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeNetCarShow(page: Page, brand: string, model: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Build search URL
    const searchTerm = `${brand} ${generation || model}`.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.netcarshow.com/${searchTerm}/`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1000);
    
    // Extract image URLs
    const images = await page.evaluate(() => {
      const imgs: { url: string; thumb: string }[] = [];
      
      // Main gallery images
      document.querySelectorAll('img[src*="/img/"], img[data-src*="/img/"]').forEach(img => {
        const src = (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src;
        if (src && src.includes('/img/') && !src.includes('logo') && !src.includes('icon')) {
          // Convert thumbnail to full size
          const fullUrl = src.replace(/-\d+x\d+\./, '.').replace('/thumbs/', '/');
          imgs.push({ url: fullUrl, thumb: src });
        }
      });
      
      return imgs.slice(0, 10);
    });
    
    for (const img of images) {
      photos.push({
        brand,
        model,
        generation,
        variant: `${brand} ${generation || model}`,
        source: 'netcarshow',
        url: img.url,
        thumbnail_url: img.thumb,
        width: 1920,
        height: 1080,
        license: 'Press Photo',
        author: 'NetCarShow',
        source_url: url,
        search_query: searchTerm,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 2: AUTOEVOLUTION.COM
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeAutoEvolution(page: Page, brand: string, model: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    // Build search URL
    const searchTerm = `${brand} ${generation || model}`.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.autoevolution.com/cars/${searchTerm}/`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1000);
    
    // Try to find gallery page
    const galleryLink = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/gallery/"]');
      return link ? (link as HTMLAnchorElement).href : null;
    });
    
    if (galleryLink) {
      await page.goto(galleryLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(500);
    }
    
    // Extract image URLs
    const images = await page.evaluate(() => {
      const imgs: { url: string; thumb: string }[] = [];
      
      document.querySelectorAll('img[src*="autoevolution.com"], img[data-src*="autoevolution.com"]').forEach(img => {
        const src = (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src;
        if (src && src.match(/\.(jpg|jpeg|png)/i) && !src.includes('logo') && !src.includes('avatar')) {
          const fullUrl = src.replace(/-thumb/, '').replace(/\d+x\d+/, '1920x1080');
          imgs.push({ url: fullUrl, thumb: src });
        }
      });
      
      return imgs.slice(0, 8);
    });
    
    for (const img of images) {
      photos.push({
        brand,
        model,
        generation,
        variant: `${brand} ${generation || model}`,
        source: 'autoevolution',
        url: img.url,
        thumbnail_url: img.thumb,
        width: 1920,
        height: 1080,
        license: 'Press Photo',
        author: 'AutoEvolution',
        source_url: url,
        search_query: searchTerm,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 3: CARPIXEL.NET
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCarPixel(page: Page, brand: string, model: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  try {
    const searchTerm = `${brand} ${generation || model}`;
    const url = `https://www.carpixel.net/search/?q=${encodeURIComponent(searchTerm)}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1000);
    
    const images = await page.evaluate(() => {
      const imgs: { url: string; thumb: string; pageUrl: string }[] = [];
      
      document.querySelectorAll('.photo-item img, .wallpaper-item img').forEach(img => {
        const src = (img as HTMLImageElement).src;
        const link = (img.closest('a') as HTMLAnchorElement)?.href;
        
        if (src && src.match(/\.(jpg|jpeg|png)/i)) {
          const fullUrl = src.replace(/\/thumbs\//, '/').replace(/-\d+x\d+/, '');
          imgs.push({ url: fullUrl, thumb: src, pageUrl: link || '' });
        }
      });
      
      return imgs.slice(0, 8);
    });
    
    for (const img of images) {
      photos.push({
        brand,
        model,
        generation,
        variant: `${brand} ${generation || model}`,
        source: 'carpixel',
        url: img.url,
        thumbnail_url: img.thumb,
        width: 1920,
        height: 1200,
        license: 'Wallpaper',
        author: 'CarPixel',
        source_url: img.pageUrl || url,
        search_query: searchTerm,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 4: MANUFACTURER PRESS SITES (Direct)
// ═══════════════════════════════════════════════════════════════════════════

const MANUFACTURER_PRESS_SITES: Record<string, string> = {
  'BMW': 'https://www.press.bmwgroup.com',
  'Mercedes-Benz': 'https://media.mercedes-benz.com',
  'Audi': 'https://www.audi-mediacenter.com',
  'Porsche': 'https://newsroom.porsche.com',
  'Volkswagen': 'https://www.volkswagen-newsroom.com',
  'Ferrari': 'https://mediacentre.ferrari.com',
  'Lamborghini': 'https://media.lamborghini.com',
};

async function scrapeManufacturerSite(page: Page, brand: string, model: string, generation: string | null): Promise<PhotoResult[]> {
  const photos: PhotoResult[] = [];
  
  const pressUrl = MANUFACTURER_PRESS_SITES[brand];
  if (!pressUrl) return photos;
  
  try {
    const searchTerm = generation || model;
    const url = `${pressUrl}/search?q=${encodeURIComponent(searchTerm)}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1500);
    
    const images = await page.evaluate(() => {
      const imgs: { url: string; thumb: string }[] = [];
      
      document.querySelectorAll('img[src*="media"], img[src*="press"], img[src*="image"]').forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src && src.match(/\.(jpg|jpeg|png)/i) && (img as HTMLImageElement).width > 200) {
          const fullUrl = src.replace(/\/thumb\//, '/').replace(/-\d+x\d+\./, '.');
          imgs.push({ url: fullUrl, thumb: src });
        }
      });
      
      return imgs.slice(0, 6);
    });
    
    for (const img of images) {
      photos.push({
        brand,
        model,
        generation,
        variant: `${brand} ${generation || model}`,
        source: 'manufacturer',
        url: img.url,
        thumbnail_url: img.thumb,
        width: 1920,
        height: 1080,
        license: 'Press Photo',
        author: brand,
        source_url: url,
        search_query: searchTerm,
      });
    }
  } catch (err) {
    // Silent fail
  }
  
  return photos;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-SOURCE AGGRESSIVE SEARCH
// ═══════════════════════════════════════════════════════════════════════════

async function searchAggressively(
  browser: Browser,
  brand: string,
  model: string,
  generation: string | null
): Promise<PhotoResult[]> {
  const allPhotos: PhotoResult[] = [];
  let page: Page | null = null;
  
  try {
    page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Try each source until we have enough photos
    const sources = [
      () => scrapeNetCarShow(page!, brand, model, generation),
      () => scrapeAutoEvolution(page!, brand, model, generation),
      () => scrapeCarPixel(page!, brand, model, generation),
      () => scrapeManufacturerSite(page!, brand, model, generation),
    ];
    
    for (const source of sources) {
      if (allPhotos.length >= 5) break;
      
      try {
        const photos = await source();
        allPhotos.push(...photos);
      } catch (err) {
        // Continue to next source
      }
      
      await delay(500);
    }
    
  } catch (err) {
    // Silent fail
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return allPhotos.filter(p => {
    const key = p.url.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD MISSING GENERATIONS
// ═══════════════════════════════════════════════════════════════════════════

interface GenerationInfo {
  brand: string;
  model: string;
  generation: string | null;
}

function loadMissingGenerations(dataDir: string): GenerationInfo[] {
  const missing: GenerationInfo[] = [];
  
  // Load existing photos
  const existingPhotos = new Set<string>();
  const photoFiles = ['vehicle-photos.json', 'photos-mega-batch.json', 'photos-premium-batch.json', 'photos-ultimate.json'];
  
  for (const file of photoFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    try {
      const photos: PhotoResult[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const p of photos) {
        existingPhotos.add(`${p.brand}|${p.generation || 'default'}`.toLowerCase());
      }
    } catch (err) {}
  }
  
  // Load all generations from vehicle specs
  const specsDir = path.join(dataDir, 'ultimatespecs');
  const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.json') && !f.includes('missing'));
  
  for (const file of files) {
    try {
      const vehicles = JSON.parse(fs.readFileSync(path.join(specsDir, file), 'utf-8'));
      const seenGens = new Set<string>();
      
      for (const v of vehicles) {
        const gen = v.generation || 'Default';
        const key = `${v.brand}|${gen}`.toLowerCase();
        
        if (!seenGens.has(key) && !existingPhotos.has(key)) {
          seenGens.add(key);
          missing.push({
            brand: v.brand,
            model: v.model || v.brand,
            generation: gen === 'Default' ? null : gen,
          });
        }
      }
    } catch (err) {}
  }
  
  return missing;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FLM AUTO - AGGRESSIVE Photo Scraper (Puppeteer)          ║');
  console.log('║   NetCarShow → AutoEvolution → CarPixel → Manufacturer     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const dataDir = path.join(__dirname, '../data');
  const outputFile = path.join(dataDir, 'photos-aggressive.json');
  
  // Load generations without photos
  console.log('📂 Finding generations without photos...');
  const missingGenerations = loadMissingGenerations(dataDir);
  console.log(`   Found ${missingGenerations.length} generations without photos\n`);
  
  if (missingGenerations.length === 0) {
    console.log('✅ All generations have photos!');
    return;
  }
  
  // Launch browser
  console.log('🌐 Launching browser...\n');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  
  const allPhotos: PhotoResult[] = [];
  const stats = {
    processed: 0,
    withPhotos: 0,
    totalPhotos: 0,
  };
  
  const startTime = Date.now();
  
  try {
    for (let i = 0; i < missingGenerations.length; i++) {
      const gen = missingGenerations[i];
      
      // Progress
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const pct = Math.round((i / missingGenerations.length) * 100);
      process.stdout.write(
        `\r[${pct.toString().padStart(3)}%] ${gen.brand.padEnd(15)} ${(gen.generation || 'Default').substring(0, 20).padEnd(20)} (${Math.floor(elapsed/60)}m${elapsed%60}s)`
      );
      
      // Search
      const photos = await searchAggressively(browser, gen.brand, gen.model, gen.generation);
      
      if (photos.length > 0) {
        allPhotos.push(...photos);
        stats.withPhotos++;
        stats.totalPhotos += photos.length;
      }
      
      stats.processed++;
      
      // Save every 25 generations
      if (stats.processed % 25 === 0) {
        fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
        process.stdout.write(` 💾`);
      }
      
      // Rate limiting
      await delay(1000);
    }
  } finally {
    await browser.close();
  }
  
  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
  
  // Summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Found photos for: ${stats.withPhotos} generations`);
  console.log(`  Total new photos: ${stats.totalPhotos}`);
  console.log(`  Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`  Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
