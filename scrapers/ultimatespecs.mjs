#!/usr/bin/env node
/**
 * UltimateSpecs Scraper
 * 50,000+ vehicle specifications
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'scraped');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const BASE_URL = 'https://www.ultimatespecs.com';
const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

const BRAND_SLUGS = {
  'BMW': 'bmw',
  'Mercedes-Benz': 'mercedes-benz',
  'Audi': 'audi',
  'Porsche': 'porsche',
  'Volkswagen': 'volkswagen',
  'Skoda': 'skoda',
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Extract specs from HTML
 */
function extractSpecs(html) {
  const specs = {};
  
  // Match spec rows in tables
  const patterns = [
    /<tr[^>]*>\s*<td[^>]*class="[^"]*spec[^"]*"[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi,
    /<div[^>]*class="[^"]*spec-item[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>([^<]+)<\/span>/gi,
    /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/gi,
  ];
  
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const [, label, value] = match;
      const key = label.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const val = value.trim();
      
      if (key && val && val !== '-' && val !== 'n/a' && key.length > 1) {
        // Parse numeric values
        const numMatch = val.match(/([\d.,]+)\s*(hp|ps|kw|nm|lb.ft|mm|cm|m|kg|lbs|l|gal|km\/h|mph|s|sec)?/i);
        if (numMatch) {
          specs[key] = parseFloat(numMatch[1].replace(',', '.'));
          if (numMatch[2]) {
            specs[`${key}_unit`] = numMatch[2].toLowerCase();
          }
        } else {
          specs[key] = val;
        }
      }
    }
  }
  
  return specs;
}

/**
 * Get models for a brand
 */
async function getModelsForBrand(brand) {
  const slug = BRAND_SLUGS[brand] || brand.toLowerCase().replace(/\s+/g, '-');
  const url = `${BASE_URL}/en/car-specs/${slug}`;
  
  console.log(`  Fetching from ${url}`);
  const html = await fetchHTML(url);
  
  const models = [];
  const linkRegex = /<a href="(\/en\/car-specs\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const [, href, name] = match;
    if (name && name.trim().length > 1 && !href.includes('#')) {
      models.push({
        name: name.trim(),
        url: `${BASE_URL}${href}`,
      });
    }
  }
  
  return [...new Map(models.map(m => [m.url, m])).values()];
}

/**
 * Get vehicle specs from detail page
 */
async function getVehicleSpecs(vehicleUrl) {
  const html = await fetchHTML(vehicleUrl);
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch?.[1]?.trim() || '';
  
  // Extract year
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0] || null;
  
  // Extract generation
  const genMatch = title.match(/\(([A-Z]\d+[A-Z]?)\)/i);
  const generation = genMatch?.[1] || null;
  
  // Extract specs
  const specs = extractSpecs(html);
  
  return {
    title,
    year,
    generation,
    specs,
    url: vehicleUrl,
  };
}

/**
 * Scrape MVP brands
 */
async function scrapeMVPBrands() {
  console.log('\n📊 UltimateSpecs Scraper - MVP Brands\n');
  
  const results = {
    source: 'ultimatespecs',
    type: 'specs',
    scraped_at: new Date().toISOString(),
    brands: {},
    total_vehicles: 0,
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n🔧 ${brand}`);
    results.brands[brand] = [];
    
    try {
      await sleep(3000);
      const models = await getModelsForBrand(brand);
      console.log(`  Found ${models.length} models`);
      
      let count = 0;
      for (const model of models.slice(0, 25)) {
        try {
          await sleep(2500);
          const data = await getVehicleSpecs(model.url);
          
          if (Object.keys(data.specs).length > 0) {
            results.brands[brand].push({
              ...model,
              ...data,
              brand,
            });
            results.total_vehicles++;
            count++;
          }
          
          process.stdout.write(`  ${count}/${Math.min(models.length, 25)} models\r`);
          
        } catch (err) {
          // Silent fail
        }
      }
      console.log(`  ✓ ${count} models scraped`);
      
      // Save incrementally
      const brandPath = join(DATA_DIR, `ultimatespecs-${brand.toLowerCase().replace(/[^a-z]/g, '')}.json`);
      writeFileSync(brandPath, JSON.stringify({ brand, vehicles: results.brands[brand] }, null, 2));
      
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  const outPath = join(DATA_DIR, 'ultimatespecs-mvp.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  console.log(`   Total vehicles: ${results.total_vehicles}`);
  
  return results;
}

// CLI
scrapeMVPBrands();

export { getModelsForBrand, getVehicleSpecs, scrapeMVPBrands };
