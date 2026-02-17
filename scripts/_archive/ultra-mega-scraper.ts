/**
 * FLM AUTO - ULTRA MEGA SCRAPER
 * 
 * Ce scraper va VRAIMENT durer des heures.
 * Il parse des milliers de pages en profondeur.
 * 
 * Run: npx ts-node ultra-mega-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_BASE = '../data/raw/ultra';
const STATE_FILE = '../data/ultra_scraper_state.json';

interface ScraperState {
  started_at: string;
  last_checkpoint: string;
  phase: string;
  completed_urls: string[];
  total_items: number;
  by_source: Record<string, number>;
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
    phase: 'init',
    completed_urls: [],
    total_items: 0,
    by_source: {},
  };
}

function saveState(state: ScraperState) {
  state.last_checkpoint = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        }
      });
      
      clearTimeout(timeout);
      
      if (response.status === 429) {
        console.log(`      ⚠️ Rate limited, waiting 2 minutes...`);
        await delay(120000);
        continue;
      }
      
      if (!response.ok) {
        if (i === retries - 1) return null;
        await delay(5000 * (i + 1));
        continue;
      }
      
      return await response.text();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log(`      ⚠️ Timeout, retrying...`);
      }
      if (i === retries - 1) return null;
      await delay(5000 * (i + 1));
    }
  }
  return null;
}

// ============================================================
// CARFOLIO.COM - Massive spec database
// ============================================================
async function scrapeCarfolio(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'carfolio');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CARFOLIO.COM - Comprehensive Specifications Database');
  console.log('═'.repeat(70));
  
  const BASE = 'https://www.carfolio.com';
  const allSpecs: any[] = [];
  
  // Get manufacturer list
  console.log('\n📋 Getting manufacturer list...');
  const mainPage = await fetchPage(`${BASE}/specifications`);
  if (!mainPage) {
    console.log('   ❌ Failed to fetch main page');
    return;
  }
  
  // Extract manufacturer links
  const mfrRegex = /href="(\/specifications\/models\/[^"]+)"/gi;
  const mfrLinks: string[] = [];
  let match;
  while ((match = mfrRegex.exec(mainPage)) !== null) {
    if (!mfrLinks.includes(match[1])) {
      mfrLinks.push(match[1]);
    }
  }
  
  console.log(`   Found ${mfrLinks.length} manufacturers\n`);
  
  // Priority manufacturers first
  const priorityBrands = ['bmw', 'mercedes', 'audi', 'volkswagen', 'porsche', 'skoda', 'tesla', 'hyundai', 'volvo', 'toyota', 'honda', 'ford'];
  const sortedLinks = mfrLinks.sort((a, b) => {
    const aP = priorityBrands.findIndex(p => a.toLowerCase().includes(p));
    const bP = priorityBrands.findIndex(p => b.toLowerCase().includes(p));
    if (aP >= 0 && bP < 0) return -1;
    if (bP >= 0 && aP < 0) return 1;
    return 0;
  });
  
  for (const mfrLink of sortedLinks) {
    const mfrUrl = `${BASE}${mfrLink}`;
    const mfrName = mfrLink.split('/').pop()?.replace(/-/g, ' ') || 'Unknown';
    
    if (state.completed_urls.includes(mfrUrl)) {
      console.log(`   ⏭️ ${mfrName} (already done)`);
      continue;
    }
    
    console.log(`\n🚗 ${mfrName.toUpperCase()}`);
    
    await delay(1500);
    const mfrPage = await fetchPage(mfrUrl);
    if (!mfrPage) {
      console.log(`   ❌ Failed to fetch`);
      continue;
    }
    
    // Extract model links
    const modelRegex = /href="(\/specifications\/models\/[^"]+\/[^"]+)"/gi;
    const modelLinks: string[] = [];
    while ((match = modelRegex.exec(mfrPage)) !== null) {
      if (!modelLinks.includes(match[1]) && match[1] !== mfrLink) {
        modelLinks.push(match[1]);
      }
    }
    
    console.log(`   Found ${modelLinks.length} models`);
    
    let mfrSpecs: any[] = [];
    let modelCount = 0;
    
    for (const modelLink of modelLinks) {
      const modelUrl = `${BASE}${modelLink}`;
      
      if (state.completed_urls.includes(modelUrl)) continue;
      
      await delay(800);
      const modelPage = await fetchPage(modelUrl);
      if (!modelPage) continue;
      
      // Extract variant/generation links
      const variantRegex = /href="(\/specifications\/models\/[^"]+\/[^"]+\/[^"]+)"/gi;
      const variantLinks: string[] = [];
      while ((match = variantRegex.exec(modelPage)) !== null) {
        if (!variantLinks.includes(match[1])) {
          variantLinks.push(match[1]);
        }
      }
      
      // Also try to parse specs from model page itself
      const modelSpecs = parseCarfolioSpecs(modelPage, modelUrl, mfrName);
      if (modelSpecs) {
        mfrSpecs.push(modelSpecs);
        state.total_items++;
      }
      
      // Visit each variant
      for (const variantLink of variantLinks.slice(0, 50)) {
        const variantUrl = `${BASE}${variantLink}`;
        
        if (state.completed_urls.includes(variantUrl)) continue;
        
        await delay(600);
        const variantPage = await fetchPage(variantUrl);
        if (!variantPage) continue;
        
        const specs = parseCarfolioSpecs(variantPage, variantUrl, mfrName);
        if (specs) {
          mfrSpecs.push(specs);
          state.total_items++;
        }
        
        state.completed_urls.push(variantUrl);
        
        if (mfrSpecs.length % 20 === 0) {
          process.stdout.write(`\r   Progress: ${mfrSpecs.length} specs...`);
          saveState(state);
        }
      }
      
      state.completed_urls.push(modelUrl);
      modelCount++;
    }
    
    console.log(`\n   ✅ ${mfrName}: ${mfrSpecs.length} specs from ${modelCount} models`);
    
    if (mfrSpecs.length > 0) {
      allSpecs.push(...mfrSpecs);
      state.by_source['carfolio'] = (state.by_source['carfolio'] || 0) + mfrSpecs.length;
      
      // Save per manufacturer
      const mfrFile = path.join(outputDir, `${mfrName.toLowerCase().replace(/\s+/g, '_')}.json`);
      fs.writeFileSync(mfrFile, JSON.stringify(mfrSpecs, null, 2));
    }
    
    state.completed_urls.push(mfrUrl);
    saveState(state);
  }
  
  // Save all
  fs.writeFileSync(path.join(outputDir, '_all_carfolio.json'), JSON.stringify(allSpecs, null, 2));
  console.log(`\n📊 Carfolio total: ${allSpecs.length} specs`);
}

function parseCarfolioSpecs(html: string, url: string, brand: string): any | null {
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  if (!title) return null;
  
  const spec: any = {
    brand,
    model: title,
    url,
    scraped_at: new Date().toISOString(),
  };
  
  // Parse spec tables - multiple patterns
  const patterns = [
    /<tr[^>]*>\s*<t[dh][^>]*>([^<]+)<\/t[dh]>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi,
    /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/gi,
    /<th[^>]*scope="row"[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const label = match[1].trim().toLowerCase()
        .replace(/[:\s]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      const value = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (value && value !== '-' && value !== 'N/A' && label.length > 1) {
        spec[label] = value;
      }
    }
  }
  
  return Object.keys(spec).length > 5 ? spec : null;
}

// ============================================================
// CAR.INFO - Another massive database
// ============================================================
async function scrapeCarInfo(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'carinfo');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CAR.INFO - Technical Database');
  console.log('═'.repeat(70));
  
  const brands = [
    { name: 'BMW', slug: 'bmw' },
    { name: 'Mercedes-Benz', slug: 'mercedes-benz' },
    { name: 'Audi', slug: 'audi' },
    { name: 'Volkswagen', slug: 'volkswagen' },
    { name: 'Porsche', slug: 'porsche' },
    { name: 'Skoda', slug: 'skoda' },
    { name: 'Tesla', slug: 'tesla' },
    { name: 'Hyundai', slug: 'hyundai' },
    { name: 'Volvo', slug: 'volvo' },
    { name: 'Toyota', slug: 'toyota' },
    { name: 'Honda', slug: 'honda' },
    { name: 'Mazda', slug: 'mazda' },
    { name: 'Kia', slug: 'kia' },
    { name: 'Ford', slug: 'ford' },
    { name: 'Nissan', slug: 'nissan' },
    { name: 'Peugeot', slug: 'peugeot' },
    { name: 'Renault', slug: 'renault' },
    { name: 'Opel', slug: 'opel' },
    { name: 'Fiat', slug: 'fiat' },
    { name: 'Citroen', slug: 'citroen' },
    { name: 'Seat', slug: 'seat' },
    { name: 'Mini', slug: 'mini' },
    { name: 'Jaguar', slug: 'jaguar' },
    { name: 'Land Rover', slug: 'land-rover' },
    { name: 'Lexus', slug: 'lexus' },
    { name: 'Alfa Romeo', slug: 'alfa-romeo' },
    { name: 'Ferrari', slug: 'ferrari' },
    { name: 'Lamborghini', slug: 'lamborghini' },
    { name: 'Maserati', slug: 'maserati' },
    { name: 'Aston Martin', slug: 'aston-martin' },
  ];
  
  const BASE = 'https://www.car.info';
  const allSpecs: any[] = [];
  
  for (const brand of brands) {
    const brandUrl = `${BASE}/en-se/${brand.slug}/`;
    
    if (state.completed_urls.includes(brandUrl)) {
      console.log(`   ⏭️ ${brand.name} (already done)`);
      continue;
    }
    
    console.log(`\n🚗 ${brand.name}...`);
    
    await delay(2000);
    const brandPage = await fetchPage(brandUrl);
    if (!brandPage) {
      console.log(`   ❌ Failed to fetch`);
      continue;
    }
    
    // Extract model links
    const modelRegex = /href="(\/en-se\/[^"]+\/[^"]+\/)"/gi;
    const modelLinks: string[] = [];
    let match;
    while ((match = modelRegex.exec(brandPage)) !== null) {
      if (match[1].includes(brand.slug) && !modelLinks.includes(match[1])) {
        modelLinks.push(match[1]);
      }
    }
    
    console.log(`   Found ${modelLinks.length} models`);
    
    let brandSpecs: any[] = [];
    
    for (const modelLink of modelLinks.slice(0, 30)) {
      const modelUrl = `${BASE}${modelLink}`;
      
      if (state.completed_urls.includes(modelUrl)) continue;
      
      await delay(1000);
      const modelPage = await fetchPage(modelUrl);
      if (!modelPage) continue;
      
      // Parse generations/variants
      const genRegex = /href="(\/en-se\/[^"]+\/[^"]+\/[^"]+\/)"/gi;
      const genLinks: string[] = [];
      while ((match = genRegex.exec(modelPage)) !== null) {
        if (!genLinks.includes(match[1])) {
          genLinks.push(match[1]);
        }
      }
      
      for (const genLink of genLinks.slice(0, 20)) {
        const genUrl = `${BASE}${genLink}`;
        
        if (state.completed_urls.includes(genUrl)) continue;
        
        await delay(800);
        const genPage = await fetchPage(genUrl);
        if (!genPage) continue;
        
        const specs = parseCarInfoSpecs(genPage, genUrl, brand.name);
        if (specs) {
          brandSpecs.push(specs);
          state.total_items++;
        }
        
        state.completed_urls.push(genUrl);
        
        if (brandSpecs.length % 10 === 0) {
          process.stdout.write(`\r   Progress: ${brandSpecs.length} specs...`);
        }
      }
      
      state.completed_urls.push(modelUrl);
    }
    
    console.log(`\n   ✅ ${brand.name}: ${brandSpecs.length} specs`);
    
    if (brandSpecs.length > 0) {
      allSpecs.push(...brandSpecs);
      state.by_source['carinfo'] = (state.by_source['carinfo'] || 0) + brandSpecs.length;
      
      const brandFile = path.join(outputDir, `${brand.slug}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(brandSpecs, null, 2));
    }
    
    state.completed_urls.push(brandUrl);
    saveState(state);
  }
  
  fs.writeFileSync(path.join(outputDir, '_all_carinfo.json'), JSON.stringify(allSpecs, null, 2));
  console.log(`\n📊 Car.info total: ${allSpecs.length} specs`);
}

function parseCarInfoSpecs(html: string, url: string, brand: string): any | null {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  if (!title) return null;
  
  const spec: any = {
    brand,
    model: title,
    url,
    scraped_at: new Date().toISOString(),
  };
  
  // Parse various table formats
  const rowRegex = /<tr[^>]*>[\s\S]*?<t[dh][^>]*>([^<]+)<\/t[dh]>[\s\S]*?<td[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/td>[\s\S]*?<\/tr>/gi;
  let match;
  
  while ((match = rowRegex.exec(html)) !== null) {
    const label = match[1].trim().toLowerCase().replace(/[:\s]+/g, '_').replace(/[^a-z0-9_]/g, '');
    const value = match[2].replace(/<[^>]+>/g, '').trim();
    
    if (value && value !== '-' && label.length > 1) {
      spec[label] = value;
    }
  }
  
  return Object.keys(spec).length > 5 ? spec : null;
}

// ============================================================
// AUTOMOBILE-CATALOG.COM - Huge historical database
// ============================================================
async function scrapeAutomobileCatalog(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'automobile_catalog');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 AUTOMOBILE-CATALOG.COM - Historical Database');
  console.log('═'.repeat(70));
  
  const BASE = 'https://www.automobile-catalog.com';
  const allSpecs: any[] = [];
  
  // Get brand list
  console.log('\n📋 Getting brand list...');
  const mainPage = await fetchPage(`${BASE}/`);
  if (!mainPage) {
    console.log('   ❌ Failed to fetch main page');
    return;
  }
  
  // Extract brand links
  const brandRegex = /href="(\/car\/[^"]+)"/gi;
  const brandLinks: string[] = [];
  let match;
  while ((match = brandRegex.exec(mainPage)) !== null) {
    if (!brandLinks.includes(match[1])) {
      brandLinks.push(match[1]);
    }
  }
  
  console.log(`   Found ${brandLinks.length} brands\n`);
  
  // Priority brands first
  const priority = ['bmw', 'mercedes', 'audi', 'volkswagen', 'porsche', 'skoda', 'tesla', 'hyundai', 'volvo', 'toyota'];
  const sortedBrands = brandLinks.sort((a, b) => {
    const aP = priority.findIndex(p => a.toLowerCase().includes(p));
    const bP = priority.findIndex(p => b.toLowerCase().includes(p));
    if (aP >= 0 && bP < 0) return -1;
    if (bP >= 0 && aP < 0) return 1;
    return 0;
  });
  
  for (const brandLink of sortedBrands.slice(0, 50)) {
    const brandUrl = `${BASE}${brandLink}`;
    const brandName = brandLink.split('/').filter(Boolean).pop() || 'Unknown';
    
    if (state.completed_urls.includes(brandUrl)) {
      console.log(`   ⏭️ ${brandName} (already done)`);
      continue;
    }
    
    console.log(`\n🚗 ${brandName.toUpperCase()}...`);
    
    await delay(2000);
    const brandPage = await fetchPage(brandUrl);
    if (!brandPage) {
      console.log(`   ❌ Failed to fetch`);
      continue;
    }
    
    // Find model links
    const modelRegex = /href="(\/car\/[^"]+\/[^"]+)"/gi;
    const modelLinks: string[] = [];
    while ((match = modelRegex.exec(brandPage)) !== null) {
      if (!modelLinks.includes(match[1]) && match[1] !== brandLink) {
        modelLinks.push(match[1]);
      }
    }
    
    console.log(`   Found ${modelLinks.length} models`);
    
    let brandSpecs: any[] = [];
    
    for (const modelLink of modelLinks.slice(0, 40)) {
      const modelUrl = `${BASE}${modelLink}`;
      
      if (state.completed_urls.includes(modelUrl)) continue;
      
      await delay(1000);
      const modelPage = await fetchPage(modelUrl);
      if (!modelPage) continue;
      
      // Find spec page links
      const specRegex = /href="([^"]*(?:specs|specification|data)[^"]*)"/gi;
      const specLinks: string[] = [];
      while ((match = specRegex.exec(modelPage)) !== null) {
        if (!specLinks.includes(match[1])) {
          specLinks.push(match[1]);
        }
      }
      
      // Parse model page itself
      const specs = parseAutoCatalogSpecs(modelPage, modelUrl, brandName);
      if (specs) {
        brandSpecs.push(specs);
        state.total_items++;
      }
      
      // Also visit spec pages
      for (const specLink of specLinks.slice(0, 10)) {
        const specUrl = specLink.startsWith('http') ? specLink : `${BASE}${specLink}`;
        
        if (state.completed_urls.includes(specUrl)) continue;
        
        await delay(700);
        const specPage = await fetchPage(specUrl);
        if (!specPage) continue;
        
        const s = parseAutoCatalogSpecs(specPage, specUrl, brandName);
        if (s) {
          brandSpecs.push(s);
          state.total_items++;
        }
        
        state.completed_urls.push(specUrl);
      }
      
      state.completed_urls.push(modelUrl);
      
      if (brandSpecs.length % 10 === 0) {
        process.stdout.write(`\r   Progress: ${brandSpecs.length} specs...`);
        saveState(state);
      }
    }
    
    console.log(`\n   ✅ ${brandName}: ${brandSpecs.length} specs`);
    
    if (brandSpecs.length > 0) {
      allSpecs.push(...brandSpecs);
      state.by_source['automobile-catalog'] = (state.by_source['automobile-catalog'] || 0) + brandSpecs.length;
      
      const brandFile = path.join(outputDir, `${brandName.toLowerCase()}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(brandSpecs, null, 2));
    }
    
    state.completed_urls.push(brandUrl);
    saveState(state);
  }
  
  fs.writeFileSync(path.join(outputDir, '_all_autocatalog.json'), JSON.stringify(allSpecs, null, 2));
  console.log(`\n📊 Automobile-catalog total: ${allSpecs.length} specs`);
}

function parseAutoCatalogSpecs(html: string, url: string, brand: string): any | null {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  if (!title || title.length < 3) return null;
  
  const spec: any = {
    brand,
    model: title,
    url,
    scraped_at: new Date().toISOString(),
  };
  
  // Multiple parsing strategies
  const patterns = [
    /<tr[^>]*>\s*<t[dh][^>]*[^>]*>([^<]+)<\/t[dh]>\s*<td[^>]*>([^<]*)<\/td>/gi,
    /<li[^>]*>([^:]+):\s*([^<]+)<\/li>/gi,
    /<span[^>]*class="[^"]*label[^"]*"[^>]*>([^<]+)<\/span>\s*<span[^>]*>([^<]+)<\/span>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const label = match[1].trim().toLowerCase().replace(/[:\s]+/g, '_').replace(/[^a-z0-9_]/g, '');
      const value = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (value && value.length > 0 && value !== '-' && label.length > 1 && label.length < 50) {
        spec[label] = value;
      }
    }
  }
  
  return Object.keys(spec).length > 5 ? spec : null;
}

// ============================================================
// WIKIPEDIA - Crawl ALL car articles
// ============================================================
async function scrapeWikipediaCars(state: ScraperState) {
  const outputDir = path.join(OUTPUT_BASE, 'wikipedia');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n' + '═'.repeat(70));
  console.log('📖 WIKIPEDIA - All Car Articles');
  console.log('═'.repeat(70));
  
  const allData: any[] = [];
  
  // Start from category pages
  const categoryUrls = [
    'https://en.wikipedia.org/wiki/Category:BMW_vehicles',
    'https://en.wikipedia.org/wiki/Category:Mercedes-Benz_vehicles',
    'https://en.wikipedia.org/wiki/Category:Audi_vehicles',
    'https://en.wikipedia.org/wiki/Category:Volkswagen_vehicles',
    'https://en.wikipedia.org/wiki/Category:Porsche_vehicles',
    'https://en.wikipedia.org/wiki/Category:%C5%A0koda_vehicles',
    'https://en.wikipedia.org/wiki/Category:Tesla_vehicles',
    'https://en.wikipedia.org/wiki/Category:Hyundai_vehicles',
    'https://en.wikipedia.org/wiki/Category:Volvo_cars',
    'https://en.wikipedia.org/wiki/Category:Toyota_vehicles',
    'https://en.wikipedia.org/wiki/Category:Honda_vehicles',
    'https://en.wikipedia.org/wiki/Category:Mazda_vehicles',
    'https://en.wikipedia.org/wiki/Category:Kia_vehicles',
    'https://en.wikipedia.org/wiki/Category:Ford_vehicles',
    'https://en.wikipedia.org/wiki/Category:Nissan_vehicles',
    'https://en.wikipedia.org/wiki/Category:Ferrari_vehicles',
    'https://en.wikipedia.org/wiki/Category:Lamborghini_vehicles',
    'https://en.wikipedia.org/wiki/Category:Jaguar_vehicles',
    'https://en.wikipedia.org/wiki/Category:Land_Rover_vehicles',
    'https://en.wikipedia.org/wiki/Category:Lexus_vehicles',
  ];
  
  for (const catUrl of categoryUrls) {
    const brandMatch = catUrl.match(/Category:([^_]+)_/);
    const brand = brandMatch ? decodeURIComponent(brandMatch[1].replace(/%C5%A0/, 'S')) : 'Unknown';
    
    if (state.completed_urls.includes(catUrl)) {
      console.log(`   ⏭️ ${brand} (already done)`);
      continue;
    }
    
    console.log(`\n📖 ${brand}...`);
    
    await delay(500);
    const catPage = await fetchPage(catUrl);
    if (!catPage) {
      console.log(`   ❌ Failed to fetch category`);
      continue;
    }
    
    // Extract article links
    const articleRegex = /href="(\/wiki\/[^":#]+)"[^>]*title="([^"]+)"/gi;
    const articles: { url: string; title: string }[] = [];
    let match;
    
    while ((match = articleRegex.exec(catPage)) !== null) {
      const url = match[1];
      const title = match[2];
      
      // Filter to car-related articles
      if (!url.includes('Category:') && 
          !url.includes('Wikipedia:') && 
          !url.includes('Template:') &&
          !url.includes('Portal:') &&
          !url.includes('File:') &&
          !url.includes('Help:')) {
        articles.push({ url: `https://en.wikipedia.org${url}`, title });
      }
    }
    
    console.log(`   Found ${articles.length} articles`);
    
    let brandData: any[] = [];
    
    for (const article of articles) {
      if (state.completed_urls.includes(article.url)) continue;
      
      await delay(300);
      const page = await fetchPage(article.url);
      if (!page) continue;
      
      const data = parseWikipediaArticle(page, article.url, article.title, brand);
      if (data) {
        brandData.push(data);
        state.total_items++;
      }
      
      state.completed_urls.push(article.url);
      
      if (brandData.length % 10 === 0) {
        process.stdout.write(`\r   Progress: ${brandData.length} articles...`);
      }
    }
    
    console.log(`\n   ✅ ${brand}: ${brandData.length} articles`);
    
    if (brandData.length > 0) {
      allData.push(...brandData);
      state.by_source['wikipedia'] = (state.by_source['wikipedia'] || 0) + brandData.length;
      
      const brandFile = path.join(outputDir, `${brand.toLowerCase().replace(/\s+/g, '_')}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(brandData, null, 2));
    }
    
    state.completed_urls.push(catUrl);
    saveState(state);
  }
  
  fs.writeFileSync(path.join(outputDir, '_all_wikipedia.json'), JSON.stringify(allData, null, 2));
  console.log(`\n📊 Wikipedia total: ${allData.length} articles`);
}

function parseWikipediaArticle(html: string, url: string, title: string, brand: string): any | null {
  const data: any = {
    brand,
    title,
    url,
    scraped_at: new Date().toISOString(),
  };
  
  // Extract infobox data
  const infoboxMatch = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (infoboxMatch) {
    const infobox = infoboxMatch[1];
    
    const rowRegex = /<tr[^>]*>\s*<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let match;
    
    while ((match = rowRegex.exec(infobox)) !== null) {
      const label = match[1].trim().toLowerCase().replace(/[:\s]+/g, '_').replace(/[^a-z0-9_]/g, '');
      const value = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (value && label.length > 1 && label.length < 30) {
        data[label] = value.substring(0, 500);
      }
    }
  }
  
  // Extract first paragraph
  const paragraphMatch = html.match(/<p[^>]*>(<b>[^<]+<\/b>[^<]*(?:<[^>]+>[^<]*)*)<\/p>/i);
  if (paragraphMatch) {
    data.description = paragraphMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 1000);
  }
  
  // Extract main image
  const imageMatch = html.match(/<img[^>]*src="(\/\/upload\.wikimedia\.org\/[^"]+)"[^>]*class="[^"]*mw-file-element[^"]*"/i);
  if (imageMatch) {
    data.image_url = `https:${imageMatch[1]}`;
  }
  
  // Extract categories
  const categories: string[] = [];
  const catRegex = /href="\/wiki\/Category:([^"]+)"/gi;
  let catMatch;
  while ((catMatch = catRegex.exec(html)) !== null) {
    categories.push(decodeURIComponent(catMatch[1].replace(/_/g, ' ')));
  }
  data.categories = categories.slice(0, 20);
  
  return Object.keys(data).length > 5 ? data : null;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('   FLM AUTO - ULTRA MEGA SCRAPER');
  console.log('   This WILL take hours. Go get some coffee ☕');
  console.log('═'.repeat(70));
  
  fs.mkdirSync(OUTPUT_BASE, { recursive: true });
  
  const state = loadState();
  const startTime = Date.now();
  
  console.log(`\n📊 Resuming from: ${state.completed_urls.length} URLs already processed`);
  console.log(`   Total items so far: ${state.total_items}\n`);
  
  // Run scrapers
  state.phase = 'carfolio';
  saveState(state);
  await scrapeCarfolio(state);
  
  state.phase = 'carinfo';
  saveState(state);
  await scrapeCarInfo(state);
  
  state.phase = 'automobile-catalog';
  saveState(state);
  await scrapeAutomobileCatalog(state);
  
  state.phase = 'wikipedia';
  saveState(state);
  await scrapeWikipediaCars(state);
  
  // Final summary
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  
  console.log('\n' + '═'.repeat(70));
  console.log('   ULTRA MEGA SCRAPING COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total URLs processed: ${state.completed_urls.length}`);
  console.log(`   Total items: ${state.total_items}`);
  console.log(`   Duration: ${elapsed.toFixed(1)} minutes (${(elapsed/60).toFixed(2)} hours)`);
  
  console.log('\n📊 By source:');
  for (const [source, count] of Object.entries(state.by_source)) {
    console.log(`   ${source}: ${count}`);
  }
  
  state.phase = 'complete';
  saveState(state);
}

main().catch(console.error);
