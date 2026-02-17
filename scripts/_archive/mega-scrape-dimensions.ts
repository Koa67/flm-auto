/**
 * MEGA SCRAPER - Interior Dimensions
 * Sources: A) ADAC PDFs, B) auto-data.net, C) carfolio.com
 * 
 * Run: npx ts-node scripts/mega-scrape-dimensions.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const MVP_BRANDS = ['Audi', 'BMW', 'Mercedes', 'Volkswagen', 'VW', 'Skoda', 'Porsche', 'Renault'];

interface VehicleDimensions {
  brand: string;
  model: string;
  generation?: string;
  year?: string;
  source: string;
  sourceUrl: string;
  // Interior dimensions (mm)
  frontHeadroom?: number;
  rearHeadroom?: number;
  frontLegroom?: number;
  rearLegroom?: number;
  frontShoulderRoom?: number;
  rearShoulderRoom?: number;
  cargoVolume?: number;
  cargoVolumeMax?: number;
  // Exterior for reference
  length?: number;
  width?: number;
  height?: number;
  wheelbase?: number;
  rawData?: any;
}

// ============================================
// SOURCE A: AUTO-DATA.NET
// ============================================
async function scrapeAutoDataNet(): Promise<VehicleDimensions[]> {
  console.log('\n📊 [A] Scraping auto-data.net...');
  const results: VehicleDimensions[] = [];
  
  // auto-data.net structure: /en/brand/model/generation
  const brandSlugs: Record<string, string> = {
    'Audi': 'audi',
    'BMW': 'bmw', 
    'Mercedes': 'mercedes-benz',
    'Volkswagen': 'volkswagen',
    'Skoda': 'skoda',
    'Porsche': 'porsche',
    'Renault': 'renault'
  };

  for (const [brand, slug] of Object.entries(brandSlugs)) {
    try {
      console.log(`  → Fetching ${brand}...`);
      const brandUrl = `https://www.auto-data.net/en/${slug}`;
      const response = await fetch(brandUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
      });
      
      if (!response.ok) {
        console.log(`    ⚠️ ${brand}: HTTP ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      
      // Extract model links
      const modelMatches = html.matchAll(/href="(\/en\/[^"]+)"[^>]*>([^<]+)</g);
      const modelUrls: string[] = [];
      
      for (const match of modelMatches) {
        if (match[1].includes(slug) && !match[1].includes('#')) {
          modelUrls.push(`https://www.auto-data.net${match[1]}`);
        }
      }
      
      console.log(`    Found ${modelUrls.length} model links`);
      
      // Limit to first 10 per brand for testing
      for (const modelUrl of modelUrls.slice(0, 10)) {
        await new Promise(r => setTimeout(r, 500)); // Rate limit
        
        try {
          const modelResp = await fetch(modelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
          });
          
          if (!modelResp.ok) continue;
          
          const modelHtml = await modelResp.text();
          
          // Parse dimensions from specs table
          const dims = parseAutoDataSpecs(modelHtml, brand, modelUrl);
          if (dims) {
            results.push(dims);
          }
        } catch (e) {
          // Skip individual model errors
        }
      }
      
    } catch (e) {
      console.log(`    ❌ ${brand}: ${e}`);
    }
  }
  
  console.log(`  ✅ auto-data.net: ${results.length} vehicles`);
  return results;
}

function parseAutoDataSpecs(html: string, brand: string, url: string): VehicleDimensions | null {
  // Extract model name from title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const model = titleMatch ? titleMatch[1].replace(/ - Technical Specs.*/, '').replace(brand, '').trim() : 'Unknown';
  
  const dims: VehicleDimensions = {
    brand,
    model,
    source: 'auto-data.net',
    sourceUrl: url
  };
  
  // Common dimension patterns in auto-data.net
  const patterns: Record<string, RegExp> = {
    length: /Length[^:]*:\s*(\d+)\s*mm/i,
    width: /Width[^:]*:\s*(\d+)\s*mm/i,
    height: /Height[^:]*:\s*(\d+)\s*mm/i,
    wheelbase: /Wheelbase[^:]*:\s*(\d+)\s*mm/i,
    frontHeadroom: /Front headroom[^:]*:\s*(\d+)\s*mm/i,
    rearHeadroom: /Rear headroom[^:]*:\s*(\d+)\s*mm/i,
    frontLegroom: /Front legroom[^:]*:\s*(\d+)\s*mm/i,
    rearLegroom: /Rear legroom[^:]*:\s*(\d+)\s*mm/i,
    cargoVolume: /(?:Trunk|Boot|Cargo)[^:]*:\s*(\d+)\s*l/i,
  };
  
  let hasData = false;
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) {
      (dims as any)[key] = parseInt(match[1]);
      hasData = true;
    }
  }
  
  return hasData ? dims : null;
}

// ============================================
// SOURCE B: CARFOLIO.COM  
// ============================================
async function scrapeCarfolio(): Promise<VehicleDimensions[]> {
  console.log('\n📊 [B] Scraping carfolio.com...');
  const results: VehicleDimensions[] = [];
  
  const brandSlugs: Record<string, string> = {
    'Audi': 'audi',
    'BMW': 'bmw',
    'Mercedes': 'mercedes-benz', 
    'Volkswagen': 'volkswagen',
    'Skoda': 'skoda',
    'Porsche': 'porsche',
    'Renault': 'renault'
  };

  for (const [brand, slug] of Object.entries(brandSlugs)) {
    try {
      console.log(`  → Fetching ${brand}...`);
      const brandUrl = `https://www.carfolio.com/specifications/models/?man=${slug}`;
      const response = await fetch(brandUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
      });
      
      if (!response.ok) {
        console.log(`    ⚠️ ${brand}: HTTP ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      
      // Extract model links from carfolio
      const modelMatches = html.matchAll(/href="(\/specifications\/models\/car\/\?car=\d+)"[^>]*>([^<]+)</g);
      const modelUrls: Array<{url: string, name: string}> = [];
      
      for (const match of modelMatches) {
        modelUrls.push({
          url: `https://www.carfolio.com${match[1]}`,
          name: match[2].trim()
        });
      }
      
      console.log(`    Found ${modelUrls.length} model links`);
      
      // Limit for testing
      for (const {url: modelUrl, name: modelName} of modelUrls.slice(0, 10)) {
        await new Promise(r => setTimeout(r, 500));
        
        try {
          const modelResp = await fetch(modelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
          });
          
          if (!modelResp.ok) continue;
          
          const modelHtml = await modelResp.text();
          const dims = parseCarfolioSpecs(modelHtml, brand, modelName, modelUrl);
          if (dims) {
            results.push(dims);
          }
        } catch (e) {
          // Skip
        }
      }
      
    } catch (e) {
      console.log(`    ❌ ${brand}: ${e}`);
    }
  }
  
  console.log(`  ✅ carfolio.com: ${results.length} vehicles`);
  return results;
}

function parseCarfolioSpecs(html: string, brand: string, model: string, url: string): VehicleDimensions | null {
  const dims: VehicleDimensions = {
    brand,
    model,
    source: 'carfolio.com',
    sourceUrl: url
  };
  
  // Carfolio uses tables with specific patterns
  const patterns: Record<string, RegExp> = {
    length: /Overall length[^<]*<[^>]+>(\d+)\s*mm/i,
    width: /Overall width[^<]*<[^>]+>(\d+)\s*mm/i,
    height: /Overall height[^<]*<[^>]+>(\d+)\s*mm/i,
    wheelbase: /Wheelbase[^<]*<[^>]+>(\d+)\s*mm/i,
    frontHeadroom: /Front head room[^<]*<[^>]+>(\d+)\s*mm/i,
    rearHeadroom: /Rear head room[^<]*<[^>]+>(\d+)\s*mm/i,
    frontLegroom: /Front leg room[^<]*<[^>]+>(\d+)\s*mm/i,
    rearLegroom: /Rear leg room[^<]*<[^>]+>(\d+)\s*mm/i,
    frontShoulderRoom: /Front shoulder room[^<]*<[^>]+>(\d+)\s*mm/i,
    rearShoulderRoom: /Rear shoulder room[^<]*<[^>]+>(\d+)\s*mm/i,
    cargoVolume: /(?:Luggage|Cargo|Boot) capacity[^<]*<[^>]+>(\d+)\s*(?:litres|l)/i,
  };
  
  let hasData = false;
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) {
      (dims as any)[key] = parseInt(match[1]);
      hasData = true;
    }
  }
  
  return hasData ? dims : null;
}

// ============================================
// SOURCE C: ADAC PDFs (via search index)
// ============================================
async function scrapeAdacPdfs(): Promise<VehicleDimensions[]> {
  console.log('\n📊 [C] Scraping ADAC autotest index...');
  const results: VehicleDimensions[] = [];
  
  // ADAC stores PDFs at predictable URLs based on test IDs
  // We'll fetch the autotest search page to find vehicle IDs
  
  try {
    // First get list of tested vehicles from ADAC API/page
    const searchUrl = 'https://www.adac.de/rund-ums-fahrzeug/autokatalog/autotest/suche?newCarsOnly=false';
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    
    if (!response.ok) {
      console.log(`  ⚠️ ADAC search: HTTP ${response.status}`);
      return results;
    }
    
    const html = await response.text();
    
    // Look for __APOLLO_STATE__ with test data
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (!apolloMatch) {
      console.log('  ⚠️ No Apollo state found');
      return results;
    }
    
    const apolloData = JSON.parse(apolloMatch[1]);
    
    // Extract vehicle test URLs
    const testUrls: string[] = [];
    for (const key of Object.keys(apolloData)) {
      if (key.includes('Teaser:') && apolloData[key]?.link?.url) {
        const url = apolloData[key].link.url;
        if (url.includes('/marken-modelle/')) {
          testUrls.push(url.startsWith('http') ? url : `https://www.adac.de${url}`);
        }
      }
    }
    
    console.log(`  Found ${testUrls.length} ADAC test URLs`);
    
    // Filter for MVP brands
    const mvpUrls = testUrls.filter(url => 
      MVP_BRANDS.some(b => url.toLowerCase().includes(b.toLowerCase()))
    );
    
    console.log(`  MVP brands: ${mvpUrls.length} URLs`);
    
    // Parse each test page for dimensions
    for (const testUrl of mvpUrls.slice(0, 20)) {
      await new Promise(r => setTimeout(r, 800));
      
      try {
        const testResp = await fetch(testUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        
        if (!testResp.ok) continue;
        
        const testHtml = await testResp.text();
        const dims = parseAdacTestPage(testHtml, testUrl);
        if (dims) {
          results.push(dims);
        }
      } catch (e) {
        // Skip
      }
    }
    
  } catch (e) {
    console.log(`  ❌ ADAC: ${e}`);
  }
  
  console.log(`  ✅ ADAC: ${results.length} vehicles`);
  return results;
}

function parseAdacTestPage(html: string, url: string): VehicleDimensions | null {
  // Extract brand/model from URL or title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1] : '';
  
  // Parse brand from URL path
  const urlParts = url.split('/');
  const brandIndex = urlParts.findIndex(p => p === 'marken-modelle');
  const brand = brandIndex >= 0 ? urlParts[brandIndex + 1] : 'Unknown';
  const model = brandIndex >= 0 ? urlParts[brandIndex + 2] : 'Unknown';
  
  const dims: VehicleDimensions = {
    brand: brand.charAt(0).toUpperCase() + brand.slice(1),
    model: model.replace(/-/g, ' '),
    source: 'adac.de',
    sourceUrl: url
  };
  
  // ADAC expresses space as "Beinfreiheit reicht für X m große Personen"
  // We'll extract these as body height limits (convertible to approx cm)
  
  // Front legroom (Beinfreiheit vorn)
  const frontLegroomMatch = html.match(/Beinfreiheit[^.]*?(\d[,.]?\d{0,2})\s*(?:m|Meter)[^.]*?(?:vorn|groß)/i);
  if (frontLegroomMatch) {
    // Convert "1.95 m person" to approximate legroom
    const personHeight = parseFloat(frontLegroomMatch[1].replace(',', '.'));
    dims.frontLegroom = Math.round(personHeight * 100); // Store as body height indicator
  }
  
  // Rear legroom
  const rearLegroomMatch = html.match(/(?:hinten|Fond)[^.]*?Beinfreiheit[^.]*?(\d[,.]?\d{0,2})\s*(?:m|Meter)/i) ||
                          html.match(/Beinfreiheit[^.]*?(\d[,.]?\d{0,2})\s*(?:m|Meter)[^.]*?(?:hinten|Fond)/i);
  if (rearLegroomMatch) {
    const personHeight = parseFloat(rearLegroomMatch[1].replace(',', '.'));
    dims.rearLegroom = Math.round(personHeight * 100);
  }
  
  // Front headroom (Kopffreiheit vorn)
  const frontHeadroomMatch = html.match(/Kopffreiheit[^.]*?(\d[,.]?\d{0,2})\s*(?:m|Meter)[^.]*?vorn/i);
  if (frontHeadroomMatch) {
    const personHeight = parseFloat(frontHeadroomMatch[1].replace(',', '.'));
    dims.frontHeadroom = Math.round(personHeight * 100);
  }
  
  // Rear headroom  
  const rearHeadroomMatch = html.match(/(?:hinten|Fond)[^.]*?Kopffreiheit[^.]*?(\d[,.]?\d{0,2})\s*(?:m|Meter)/i);
  if (rearHeadroomMatch) {
    const personHeight = parseFloat(rearHeadroomMatch[1].replace(',', '.'));
    dims.rearHeadroom = Math.round(personHeight * 100);
  }
  
  // Cargo volume (Kofferraum ADAC Messung)
  const cargoMatch = html.match(/ADAC\s*Messung[^.]*?(\d{2,4})\s*(?:Liter|l)/i) ||
                     html.match(/(\d{2,4})\s*(?:Liter|l)[^.]*?ADAC/i);
  if (cargoMatch) {
    dims.cargoVolume = parseInt(cargoMatch[1]);
  }
  
  // Check if we got any useful data
  const hasData = dims.frontLegroom || dims.rearLegroom || dims.frontHeadroom || 
                  dims.rearHeadroom || dims.cargoVolume;
  
  return hasData ? dims : null;
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  console.log('🚀 MEGA SCRAPER - Interior Dimensions');
  console.log('=====================================');
  console.log(`MVP Brands: ${MVP_BRANDS.join(', ')}`);
  console.log('');
  
  const startTime = Date.now();
  
  // Run all scrapers in parallel
  const [autoDataResults, carfolioResults, adacResults] = await Promise.all([
    scrapeAutoDataNet().catch(e => { console.error('auto-data.net failed:', e); return []; }),
    scrapeCarfolio().catch(e => { console.error('carfolio.com failed:', e); return []; }),
    scrapeAdacPdfs().catch(e => { console.error('ADAC failed:', e); return []; })
  ]);
  
  // Combine all results
  const allResults = [
    ...autoDataResults,
    ...carfolioResults,
    ...adacResults
  ];
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n=====================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('=====================================');
  console.log(`auto-data.net: ${autoDataResults.length} vehicles`);
  console.log(`carfolio.com:  ${carfolioResults.length} vehicles`);
  console.log(`ADAC:          ${adacResults.length} vehicles`);
  console.log(`TOTAL:         ${allResults.length} vehicles`);
  console.log(`Time:          ${elapsed}s`);
  
  // Save results
  const outputPath = path.join(__dirname, '../data/sources/dimensions-mega-scrape.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    sources: {
      'auto-data.net': autoDataResults.length,
      'carfolio.com': carfolioResults.length,
      'adac.de': adacResults.length
    },
    total: allResults.length,
    vehicles: allResults
  }, null, 2));
  
  console.log(`\n✅ Saved to ${outputPath}`);
  
  // Also save per-source files
  fs.writeFileSync(
    path.join(__dirname, '../data/sources/auto-data-net.json'),
    JSON.stringify(autoDataResults, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, '../data/sources/carfolio.json'),
    JSON.stringify(carfolioResults, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, '../data/sources/adac-dimensions.json'),
    JSON.stringify(adacResults, null, 2)
  );
  
  // Print sample data
  if (allResults.length > 0) {
    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(allResults.slice(0, 3), null, 2));
  }
}

main().catch(console.error);
