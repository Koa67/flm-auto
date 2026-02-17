#!/usr/bin/env node
/**
 * IMCDb Scraper - Movie/TV vehicle appearances
 * Source: https://www.imcdb.org
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'scraped');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const BASE_URL = 'https://www.imcdb.org';
const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

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
 * Get vehicles for a brand from IMCDb
 */
async function getBrandVehicles(brand) {
  const url = `${BASE_URL}/vehicles_make.php?make=${encodeURIComponent(brand)}`;
  console.log(`  Fetching ${brand}...`);
  
  const html = await fetchHTML(url);
  const vehicles = [];
  
  // Parse vehicle links - simplified regex extraction
  const linkRegex = /<a href="(\/vehicle_\d+[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const [, href, name] = match;
    if (name && name.trim().length > 2) {
      vehicles.push({
        name: name.trim(),
        url: `${BASE_URL}${href}`,
      });
    }
  }
  
  // Dedupe
  const seen = new Set();
  return vehicles.filter(v => {
    if (seen.has(v.url)) return false;
    seen.add(v.url);
    return true;
  });
}

/**
 * Get vehicle details including movie appearances
 */
async function getVehicleDetails(vehicleUrl) {
  const html = await fetchHTML(vehicleUrl);
  const appearances = [];
  
  // Extract movie links
  const movieRegex = /<a href="(\/movie_\d+[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = movieRegex.exec(html)) !== null) {
    const [, href, title] = match;
    if (title && title.trim().length > 1) {
      appearances.push({
        movie: title.trim(),
        url: `${BASE_URL}${href}`,
      });
    }
  }
  
  // Extract year from title if present
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch?.[1]?.trim() || '';
  
  return {
    title,
    appearances: [...new Map(appearances.map(a => [a.url, a])).values()],
    appearances_count: appearances.length,
  };
}

/**
 * Scrape MVP brands
 */
async function scrapeMVPBrands() {
  console.log('\n🎬 IMCDb Scraper - MVP Brands (Pop Culture)\n');
  
  const results = {
    source: 'imcdb',
    type: 'pop_culture',
    scraped_at: new Date().toISOString(),
    brands: {},
    total_vehicles: 0,
    total_appearances: 0,
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n🎥 ${brand}`);
    results.brands[brand] = [];
    
    try {
      await sleep(2000);
      const vehicles = await getBrandVehicles(brand);
      console.log(`  Found ${vehicles.length} vehicles`);
      
      // Get details for top 15 vehicles
      let count = 0;
      for (const vehicle of vehicles.slice(0, 15)) {
        try {
          await sleep(1500);
          const details = await getVehicleDetails(vehicle.url);
          
          results.brands[brand].push({
            ...vehicle,
            ...details,
            brand,
          });
          
          results.total_vehicles++;
          results.total_appearances += details.appearances_count;
          count++;
          
          process.stdout.write(`  ${count}/${Math.min(vehicles.length, 15)} vehicles\r`);
          
        } catch (err) {
          // Silent fail
        }
      }
      console.log(`  ✓ ${count} vehicles scraped`);
      
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  // Save
  const outPath = join(DATA_DIR, 'imcdb-mvp.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  console.log(`   Vehicles: ${results.total_vehicles}`);
  console.log(`   Appearances: ${results.total_appearances}`);
  
  return results;
}

// CLI
scrapeMVPBrands();

export { getBrandVehicles, getVehicleDetails, scrapeMVPBrands };
