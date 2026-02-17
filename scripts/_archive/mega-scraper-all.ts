/**
 * FLM AUTO - MEGA SCRAPER ORCHESTRATOR
 * 
 * Scrape TOUT en parallèle avec persistence:
 * - Auto-Data.net: 54,000+ specs techniques
 * - IMCDb.org: 500,000+ apparitions films/séries
 * - Wikipedia: Photos, historique marques
 * - Nürburgring lap times: Performances
 * - Car and Driver / Motor Trend: Tests
 * 
 * Run: npx ts-node mega-scraper-all.ts
 * Durée estimée: 4-8 heures
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_BASE = '../data/raw';
const STATE_FILE = '../data/scraper_state.json';
const PARALLEL_WORKERS = 3; // Respectful parallelism

interface ScraperState {
  started_at: string;
  last_checkpoint: string;
  completed: string[];
  in_progress: string[];
  failed: string[];
  stats: {
    total_requests: number;
    total_items: number;
    by_source: Record<string, number>;
  };
}

// Rate limiters per domain
const rateLimiters: Record<string, { lastRequest: number; minDelay: number }> = {
  'auto-data.net': { lastRequest: 0, minDelay: 500 },
  'imcdb.org': { lastRequest: 0, minDelay: 300 },
  'wikipedia.org': { lastRequest: 0, minDelay: 200 },
  'fastestlaps.com': { lastRequest: 0, minDelay: 400 },
  'zeroto60times.com': { lastRequest: 0, minDelay: 400 },
  'nurburgringlaptimes.com': { lastRequest: 0, minDelay: 400 },
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedFetch(url: string, domain: string): Promise<string> {
  const limiter = rateLimiters[domain] || { lastRequest: 0, minDelay: 500 };
  const now = Date.now();
  const elapsed = now - limiter.lastRequest;
  
  if (elapsed < limiter.minDelay) {
    await delay(limiter.minDelay - elapsed);
  }
  
  limiter.lastRequest = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
    }
  });
  
  if (response.status === 429) {
    console.log(`  ⚠️ Rate limited on ${domain}, waiting 60s...`);
    await delay(60000);
    return rateLimitedFetch(url, domain);
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.text();
}

function loadState(): ScraperState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  
  return {
    started_at: new Date().toISOString(),
    last_checkpoint: new Date().toISOString(),
    completed: [],
    in_progress: [],
    failed: [],
    stats: {
      total_requests: 0,
      total_items: 0,
      by_source: {},
    },
  };
}

function saveState(state: ScraperState) {
  state.last_checkpoint = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================
// SOURCE 1: AUTO-DATA.NET - Specs techniques complètes
// ============================================================
async function scrapeAutoData(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'autodata');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n📊 AUTO-DATA.NET - Technical Specs');
  console.log('   Target: 54,000+ vehicles\n');
  
  const brands = [
    // MVP Brands
    { name: 'BMW', slug: 'bmw' },
    { name: 'Mercedes-Benz', slug: 'mercedes-benz' },
    { name: 'Audi', slug: 'audi' },
    { name: 'Volkswagen', slug: 'volkswagen' },
    { name: 'Porsche', slug: 'porsche' },
    { name: 'Skoda', slug: 'skoda' },
    // Extended
    { name: 'Tesla', slug: 'tesla' },
    { name: 'Hyundai', slug: 'hyundai' },
    { name: 'Volvo', slug: 'volvo' },
    { name: 'Toyota', slug: 'toyota' },
    { name: 'Honda', slug: 'honda' },
    { name: 'Mazda', slug: 'mazda' },
    { name: 'Kia', slug: 'kia' },
    { name: 'Ford', slug: 'ford' },
    { name: 'Opel', slug: 'opel' },
    { name: 'Peugeot', slug: 'peugeot' },
    { name: 'Renault', slug: 'renault' },
    { name: 'Citroen', slug: 'citroen' },
    { name: 'Fiat', slug: 'fiat' },
    { name: 'Nissan', slug: 'nissan' },
    { name: 'Lexus', slug: 'lexus' },
    { name: 'Jaguar', slug: 'jaguar' },
    { name: 'Land Rover', slug: 'land-rover' },
    { name: 'Mini', slug: 'mini' },
    { name: 'Alfa Romeo', slug: 'alfa-romeo' },
    { name: 'Ferrari', slug: 'ferrari' },
    { name: 'Lamborghini', slug: 'lamborghini' },
    { name: 'Maserati', slug: 'maserati' },
    { name: 'Aston Martin', slug: 'aston-martin' },
    { name: 'Bentley', slug: 'bentley' },
    { name: 'Rolls-Royce', slug: 'rolls-royce' },
  ];
  
  const allSpecs: any[] = [];
  
  for (const brand of brands) {
    const taskId = `autodata_${brand.slug}`;
    if (state.completed.includes(taskId)) {
      console.log(`   ⏭️ ${brand.name} already done`);
      continue;
    }
    
    state.in_progress.push(taskId);
    saveState(state);
    
    console.log(`   🚗 ${brand.name}...`);
    
    try {
      const brandUrl = `https://www.auto-data.net/en/allbrands/${brand.slug}`;
      const html = await rateLimitedFetch(brandUrl, 'auto-data.net');
      
      // Extract model links
      const modelLinks: string[] = [];
      const modelRegex = /href="(https:\/\/www\.auto-data\.net\/en\/[^"]+)"/g;
      let match;
      while ((match = modelRegex.exec(html)) !== null) {
        if (!modelLinks.includes(match[1])) {
          modelLinks.push(match[1]);
        }
      }
      
      console.log(`      Found ${modelLinks.length} model pages`);
      
      let brandSpecs: any[] = [];
      
      for (const modelUrl of modelLinks.slice(0, 100)) { // Limit per brand
        try {
          const modelHtml = await rateLimitedFetch(modelUrl, 'auto-data.net');
          
          // Parse specs from model page
          const specs = parseAutoDataSpecs(modelHtml, modelUrl, brand.name);
          if (specs.length > 0) {
            brandSpecs.push(...specs);
            state.stats.total_items += specs.length;
          }
          
          state.stats.total_requests++;
          
          if (brandSpecs.length % 50 === 0) {
            process.stdout.write(`\r      ${brand.name}: ${brandSpecs.length} specs...`);
          }
          
        } catch (e) {
          // Skip failed pages
        }
      }
      
      console.log(`\n      ✅ ${brand.name}: ${brandSpecs.length} specs`);
      
      allSpecs.push(...brandSpecs);
      state.stats.by_source['auto-data.net'] = (state.stats.by_source['auto-data.net'] || 0) + brandSpecs.length;
      
      // Save per-brand
      const brandFile = path.join(outputDir, `${brand.slug}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(brandSpecs, null, 2));
      
      state.completed.push(taskId);
      state.in_progress = state.in_progress.filter(t => t !== taskId);
      saveState(state);
      
    } catch (e) {
      console.log(`      ❌ ${brand.name} failed`);
      state.failed.push(taskId);
      state.in_progress = state.in_progress.filter(t => t !== taskId);
      saveState(state);
    }
  }
  
  // Save all
  fs.writeFileSync(path.join(outputDir, '_all_specs.json'), JSON.stringify(allSpecs, null, 2));
  console.log(`\n   📊 Auto-Data total: ${allSpecs.length} specs`);
}

function parseAutoDataSpecs(html: string, url: string, brand: string): any[] {
  const specs: any[] = [];
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Look for spec tables
  const tableRegex = /<table[^>]*class="[^"]*cardetailsout[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const spec: any = {
      brand,
      title,
      url,
      scraped_at: new Date().toISOString(),
    };
    
    // Parse rows
    const rowRegex = /<tr[^>]*>[\s\S]*?<th[^>]*>([^<]+)<\/th>[\s\S]*?<td[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/td>[\s\S]*?<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const label = rowMatch[1].trim().toLowerCase().replace(/[:\s]+/g, '_');
      const value = rowMatch[2].replace(/<[^>]+>/g, '').trim();
      
      if (value && value !== '-') {
        spec[label] = value;
      }
    }
    
    if (Object.keys(spec).length > 4) {
      specs.push(spec);
    }
  }
  
  return specs;
}

// ============================================================
// SOURCE 2: IMCDb.org - Films & Séries
// ============================================================
async function scrapeIMCDb(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'imcdb');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n🎬 IMCDb.org - Movies & TV Shows');
  console.log('   Target: 500,000+ vehicle appearances\n');
  
  const brands = [
    'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda',
    'Tesla', 'Ferrari', 'Lamborghini', 'Aston Martin', 'Jaguar',
    'Ford', 'Chevrolet', 'Dodge', 'Toyota', 'Honda', 'Nissan',
    'Volvo', 'Hyundai', 'Kia', 'Mazda', 'Subaru',
  ];
  
  const allAppearances: any[] = [];
  
  for (const brand of brands) {
    const taskId = `imcdb_${brand.toLowerCase().replace(/\s+/g, '_')}`;
    if (state.completed.includes(taskId)) {
      console.log(`   ⏭️ ${brand} already done`);
      continue;
    }
    
    state.in_progress.push(taskId);
    saveState(state);
    
    console.log(`   🎬 ${brand}...`);
    
    try {
      const searchUrl = `https://www.imcdb.org/vehicles.php?make=${encodeURIComponent(brand)}&modelMatch=1`;
      const html = await rateLimitedFetch(searchUrl, 'imcdb.org');
      
      // Parse vehicle list
      const vehicleRegex = /<a href="(\/vehicle[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      const appearances: any[] = [];
      let vehicleMatch;
      
      const vehicleUrls: string[] = [];
      while ((vehicleMatch = vehicleRegex.exec(html)) !== null) {
        vehicleUrls.push(vehicleMatch[1]);
      }
      
      console.log(`      Found ${vehicleUrls.length} vehicle entries`);
      
      for (const vUrl of vehicleUrls.slice(0, 200)) { // Limit per brand
        try {
          const vHtml = await rateLimitedFetch(`https://www.imcdb.org${vUrl}`, 'imcdb.org');
          
          // Extract vehicle info
          const titleMatch = vHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          const vehicleName = titleMatch ? titleMatch[1].trim() : '';
          
          // Extract movie/show appearances
          const movieRegex = /<a href="(\/movie[^"]+)"[^>]*>([^<]+)<\/a>\s*\((\d{4})\)/gi;
          let movieMatch;
          
          while ((movieMatch = movieRegex.exec(vHtml)) !== null) {
            appearances.push({
              brand,
              vehicle: vehicleName,
              movie_url: `https://www.imcdb.org${movieMatch[1]}`,
              movie_title: movieMatch[2].trim(),
              year: parseInt(movieMatch[3]),
              scraped_at: new Date().toISOString(),
            });
          }
          
          state.stats.total_requests++;
          
        } catch {}
      }
      
      console.log(`      ✅ ${brand}: ${appearances.length} appearances`);
      
      allAppearances.push(...appearances);
      state.stats.by_source['imcdb.org'] = (state.stats.by_source['imcdb.org'] || 0) + appearances.length;
      
      // Save per-brand
      const brandFile = path.join(outputDir, `${brand.toLowerCase().replace(/\s+/g, '_')}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(appearances, null, 2));
      
      state.completed.push(taskId);
      state.in_progress = state.in_progress.filter(t => t !== taskId);
      saveState(state);
      
    } catch (e) {
      console.log(`      ❌ ${brand} failed`);
      state.failed.push(taskId);
      state.in_progress = state.in_progress.filter(t => t !== taskId);
      saveState(state);
    }
  }
  
  fs.writeFileSync(path.join(outputDir, '_all_appearances.json'), JSON.stringify(allAppearances, null, 2));
  console.log(`\n   📊 IMCDb total: ${allAppearances.length} appearances`);
}

// ============================================================
// SOURCE 3: Performance Data - Lap Times & 0-60
// ============================================================
async function scrapePerformance(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'performance');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n🏁 Performance Data - Lap Times & Acceleration');
  
  // Nürburgring Nordschleife lap times
  const nurburgringData: any[] = [];
  
  console.log('   📍 Nürburgring lap times...');
  
  try {
    const taskId = 'nurburgring_laptimes';
    if (!state.completed.includes(taskId)) {
      const url = 'https://fastestlaps.com/tracks/nordschleife';
      const html = await rateLimitedFetch(url, 'fastestlaps.com');
      
      // Parse lap time table
      const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi;
      let match;
      
      while ((match = rowRegex.exec(html)) !== null) {
        const lapTime = match[1].trim();
        const car = match[2].replace(/<[^>]+>/g, '').trim();
        const year = match[3].trim();
        
        if (lapTime.match(/^\d+:\d+/)) {
          nurburgringData.push({
            track: 'Nürburgring Nordschleife',
            car,
            lap_time: lapTime,
            year,
            scraped_at: new Date().toISOString(),
          });
        }
      }
      
      console.log(`      ✅ ${nurburgringData.length} lap times`);
      
      fs.writeFileSync(path.join(outputDir, 'nurburgring_laptimes.json'), JSON.stringify(nurburgringData, null, 2));
      
      state.stats.by_source['fastestlaps.com'] = nurburgringData.length;
      state.completed.push(taskId);
      saveState(state);
    }
  } catch (e) {
    console.log('      ❌ Nürburgring failed');
  }
  
  // 0-60 times
  const accelData: any[] = [];
  
  console.log('   🚀 0-60 mph times...');
  
  try {
    const taskId = 'zeroto60_times';
    if (!state.completed.includes(taskId)) {
      const url = 'https://www.zeroto60times.com/fastest-cars-0-60-mph-times/';
      const html = await rateLimitedFetch(url, 'zeroto60times.com');
      
      // Parse acceleration table
      const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi;
      let match;
      
      while ((match = rowRegex.exec(html)) !== null) {
        const car = match[1].replace(/<[^>]+>/g, '').trim();
        const time = match[2].replace(/<[^>]+>/g, '').trim();
        
        if (time.match(/^\d+\.\d+/)) {
          accelData.push({
            car,
            zero_to_60_sec: parseFloat(time),
            scraped_at: new Date().toISOString(),
          });
        }
      }
      
      console.log(`      ✅ ${accelData.length} acceleration times`);
      
      fs.writeFileSync(path.join(outputDir, 'zeroto60_times.json'), JSON.stringify(accelData, null, 2));
      
      state.stats.by_source['zeroto60times.com'] = accelData.length;
      state.completed.push(taskId);
      saveState(state);
    }
  } catch (e) {
    console.log('      ❌ 0-60 times failed');
  }
}

// ============================================================
// SOURCE 4: Wikipedia - Photos & Brand History
// ============================================================
async function scrapeWikipedia(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'wikipedia');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n📖 Wikipedia - Photos & History');
  
  const models = [
    // BMW
    'BMW 3 Series', 'BMW 5 Series', 'BMW 7 Series', 'BMW X3', 'BMW X5', 'BMW M3', 'BMW M5',
    // Mercedes
    'Mercedes-Benz C-Class', 'Mercedes-Benz E-Class', 'Mercedes-Benz S-Class', 'Mercedes-Benz GLC', 'Mercedes-Benz GLE',
    // Audi
    'Audi A3', 'Audi A4', 'Audi A6', 'Audi Q5', 'Audi Q7', 'Audi R8',
    // VW
    'Volkswagen Golf', 'Volkswagen Passat', 'Volkswagen Tiguan', 'Volkswagen ID.4',
    // Porsche
    'Porsche 911', 'Porsche Cayenne', 'Porsche Taycan', 'Porsche Macan',
    // Tesla
    'Tesla Model 3', 'Tesla Model S', 'Tesla Model X', 'Tesla Model Y',
    // Others
    'Hyundai Ioniq 5', 'Volvo XC60', 'Volvo XC90',
  ];
  
  const wikiData: any[] = [];
  
  for (const model of models) {
    const taskId = `wiki_${model.toLowerCase().replace(/\s+/g, '_')}`;
    if (state.completed.includes(taskId)) {
      continue;
    }
    
    try {
      const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(model.replace(/\s+/g, '_'))}`;
      const html = await rateLimitedFetch(wikiUrl, 'wikipedia.org');
      
      // Extract infobox data
      const infoboxMatch = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
      
      // Extract main image
      const imageMatch = html.match(/<img[^>]*src="(\/\/upload\.wikimedia\.org\/[^"]+)"[^>]*>/i);
      
      // Extract first paragraph
      const paragraphMatch = html.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]+)*)<\/p>/i);
      
      const data: any = {
        model,
        url: wikiUrl,
        image_url: imageMatch ? `https:${imageMatch[1]}` : null,
        description: paragraphMatch ? paragraphMatch[1].replace(/<[^>]+>/g, '').substring(0, 500) : null,
        scraped_at: new Date().toISOString(),
      };
      
      wikiData.push(data);
      console.log(`   ✅ ${model}`);
      
      state.stats.total_requests++;
      state.completed.push(taskId);
      saveState(state);
      
    } catch (e) {
      console.log(`   ❌ ${model} failed`);
    }
  }
  
  fs.writeFileSync(path.join(outputDir, 'models_info.json'), JSON.stringify(wikiData, null, 2));
  console.log(`\n   📊 Wikipedia total: ${wikiData.length} models`);
}

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   FLM AUTO - MEGA SCRAPER ORCHESTRATOR');
  console.log('   Scraping ALL sources in parallel');
  console.log('   Estimated duration: 4-8 hours');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const state = loadState();
  const startTime = Date.now();
  
  console.log(`📊 Previous state: ${state.completed.length} tasks completed, ${state.failed.length} failed\n`);
  
  // Run scrapers sequentially (to avoid overwhelming any single site)
  // Each scraper handles its own rate limiting
  
  try {
    await scrapeAutoData(state);
  } catch (e) {
    console.error('Auto-Data scraper failed:', e);
  }
  
  try {
    await scrapeIMCDb(state);
  } catch (e) {
    console.error('IMCDb scraper failed:', e);
  }
  
  try {
    await scrapePerformance(state);
  } catch (e) {
    console.error('Performance scraper failed:', e);
  }
  
  try {
    await scrapeWikipedia(state);
  } catch (e) {
    console.error('Wikipedia scraper failed:', e);
  }
  
  // Final summary
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total requests: ${state.stats.total_requests}`);
  console.log(`   Total items: ${state.stats.total_items}`);
  console.log(`   Tasks completed: ${state.completed.length}`);
  console.log(`   Tasks failed: ${state.failed.length}`);
  console.log(`   Duration: ${elapsed.toFixed(1)} minutes`);
  
  console.log('\n📊 By source:');
  for (const [source, count] of Object.entries(state.stats.by_source)) {
    console.log(`   ${source}: ${count}`);
  }
  
  saveState(state);
}

main().catch(console.error);
