#!/usr/bin/env node
/**
 * Automobile-Catalog Scraper
 * Comprehensive specs since 1945
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'scraped');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const BASE_URL = 'https://www.automobile-catalog.com';
const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

// Brand URL slugs on automobile-catalog
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
 * Extract specs from HTML tables
 */
function extractSpecs(html) {
  const specs = {};
  
  // Match table rows with spec data
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  let match;
  
  while ((match = rowRegex.exec(html)) !== null) {
    const [, label, value] = match;
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const val = value.trim();
    
    if (key && val && val !== '-' && val !== 'n/a') {
      // Parse numeric values
      const numMatch = val.match(/([\d.,]+)\s*(hp|kw|nm|mm|kg|l|km\/h|s)?/i);
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
  
  return specs;
}

/**
 * Get models for a brand
 */
async function getModelsForBrand(brand) {
  const slug = BRAND_SLUGS[brand] || brand.toLowerCase();
  const url = `${BASE_URL}/make/${slug}/`;
  
  console.log(`  Fetching models from ${url}`);
  const html = await fetchHTML(url);
  
  const models = [];
  const linkRegex = /<a href="(\/car\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const [, href, name] = match;
    if (name && name.trim().length > 1) {
      models.push({
        name: name.trim(),
        url: `${BASE_URL}${href}`,
      });
    }
  }
  
  // Dedupe
  return [...new Map(models.map(m => [m.url, m])).values()];
}

/**
 * Get vehicle specs
 */
async function getVehicleSpecs(vehicleUrl) {
  const html = await fetchHTML(vehicleUrl);
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch?.[1]?.trim() || '';
  
  // Extract year from title
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0] || null;
  
  // Extract specs
  const specs = extractSpecs(html);
  
  // Extract images
  const images = [];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*alt="[^"]*car[^"]*"/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 3) {
    const src = imgMatch[1];
    if (src && !src.includes('logo') && !src.includes('icon')) {
      images.push(src.startsWith('http') ? src : `${BASE_URL}${src}`);
    }
  }
  
  return {
    title,
    year,
    specs,
    images,
    url: vehicleUrl,
  };
}

/**
 * Scrape MVP brands
 */
async function scrapeMVPBrands() {
  console.log('\n🚗 Automobile-Catalog Scraper - MVP Brands\n');
  
  const results = {
    source: 'automobile-catalog',
    type: 'specs',
    scraped_at: new Date().toISOString(),
    brands: {},
    total_vehicles: 0,
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n📊 ${brand}`);
    results.brands[brand] = [];
    
    try {
      await sleep(3000);
      const models = await getModelsForBrand(brand);
      console.log(`  Found ${models.length} models`);
      
      // Scrape top 20 models
      let count = 0;
      for (const model of models.slice(0, 20)) {
        try {
          await sleep(2000);
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
          
          process.stdout.write(`  ${count}/${Math.min(models.length, 20)} models\r`);
          
        } catch (err) {
          // Silent fail
        }
      }
      console.log(`  ✓ ${count} models scraped`);
      
      // Save incrementally
      const brandPath = join(DATA_DIR, `automobile-catalog-${brand.toLowerCase().replace(/[^a-z]/g, '')}.json`);
      writeFileSync(brandPath, JSON.stringify({ brand, vehicles: results.brands[brand] }, null, 2));
      
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  // Save all
  const outPath = join(DATA_DIR, 'automobile-catalog-mvp.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  console.log(`   Total vehicles: ${results.total_vehicles}`);
  
  return results;
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--brand')) {
  const idx = args.indexOf('--brand');
  const brand = args[idx + 1];
  console.log(`Single brand scrape: ${brand}`);
  // TODO: implement single brand
} else {
  scrapeMVPBrands();
}

export { getModelsForBrand, getVehicleSpecs, scrapeMVPBrands };
