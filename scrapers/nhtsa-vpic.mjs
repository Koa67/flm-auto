#!/usr/bin/env node
/**
 * NHTSA vPIC Scraper
 * Official US Government vehicle database
 * FREE API - No authentication required
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'scraped');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Get all makes (manufacturers)
 */
async function getAllMakes() {
  console.log('Fetching all makes...');
  const url = `${BASE_URL}/GetAllMakes?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

/**
 * Get models for a specific make
 */
async function getModelsForMake(makeName) {
  const url = `${BASE_URL}/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

/**
 * Get vehicle types for a make
 */
async function getVehicleTypesForMake(makeName) {
  const url = `${BASE_URL}/GetVehicleTypesForMake/${encodeURIComponent(makeName)}?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

/**
 * Decode VIN
 */
async function decodeVIN(vin) {
  const url = `${BASE_URL}/DecodeVin/${vin}?format=json`;
  const data = await fetchJSON(url);
  
  const result = {};
  for (const item of data.Results || []) {
    if (item.Value && item.Value.trim()) {
      result[item.Variable] = item.Value;
    }
  }
  return result;
}

/**
 * Get WMIs for a manufacturer
 */
async function getWMIsForManufacturer(manufacturer) {
  const url = `${BASE_URL}/GetWMIsForManufacturer/${encodeURIComponent(manufacturer)}?format=json`;
  const data = await fetchJSON(url);
  return data.Results || [];
}

/**
 * Scrape MVP brands only
 */
async function scrapeMVPBrands() {
  console.log('\n🚗 NHTSA vPIC Scraper - MVP Brands\n');
  
  const results = {
    source: 'nhtsa-vpic',
    scraped_at: new Date().toISOString(),
    brands: {},
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n📊 ${brand}`);
    
    try {
      // Get models
      await sleep(500);
      const models = await getModelsForMake(brand);
      console.log(`  Found ${models.length} models`);
      
      // Get vehicle types
      await sleep(500);
      const types = await getVehicleTypesForMake(brand);
      
      // Get WMIs
      await sleep(500);
      const wmis = await getWMIsForManufacturer(brand);
      
      results.brands[brand] = {
        models: models.map(m => ({
          make_id: m.Make_ID,
          make_name: m.Make_Name,
          model_id: m.Model_ID,
          model_name: m.Model_Name,
        })),
        vehicle_types: types,
        wmis: wmis.slice(0, 10), // Limit WMIs
        model_count: models.length,
      };
      
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  // Save
  const outPath = join(DATA_DIR, 'nhtsa-vpic-mvp.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  
  return results;
}

/**
 * Full scrape - all makes
 */
async function scrapeAllMakes() {
  console.log('\n🚗 NHTSA vPIC Scraper - FULL\n');
  
  const allMakes = await getAllMakes();
  console.log(`Found ${allMakes.length} makes total`);
  
  // Filter to top 50 by relevance
  const relevantMakes = allMakes
    .filter(m => m.Make_Name && m.Make_Name.length > 1)
    .slice(0, 50);
  
  const results = {
    source: 'nhtsa-vpic',
    scraped_at: new Date().toISOString(),
    total_makes: allMakes.length,
    brands: {},
  };
  
  for (const make of relevantMakes) {
    console.log(`  ${make.Make_Name}...`);
    
    try {
      await sleep(300);
      const models = await getModelsForMake(make.Make_Name);
      
      results.brands[make.Make_Name] = {
        make_id: make.Make_ID,
        models: models.map(m => ({
          model_id: m.Model_ID,
          model_name: m.Model_Name,
        })),
        model_count: models.length,
      };
    } catch (err) {
      console.error(`    Error: ${err.message}`);
    }
  }
  
  const outPath = join(DATA_DIR, 'nhtsa-all-makes.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  
  return results;
}

/**
 * Decode multiple VINs
 */
async function decodeVINBatch(vins) {
  console.log(`\nDecoding ${vins.length} VINs...\n`);
  
  const results = [];
  
  for (const vin of vins) {
    console.log(`  ${vin}...`);
    try {
      await sleep(500);
      const decoded = await decodeVIN(vin);
      results.push({ vin, ...decoded });
    } catch (err) {
      results.push({ vin, error: err.message });
    }
  }
  
  const outPath = join(DATA_DIR, 'nhtsa-vin-decoded.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to ${outPath}`);
  
  return results;
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--full')) {
  scrapeAllMakes();
} else if (args.includes('--vin')) {
  const vinIdx = args.indexOf('--vin');
  const vins = args[vinIdx + 1]?.split(',') || [];
  if (vins.length) {
    decodeVINBatch(vins);
  } else {
    console.log('Usage: --vin VIN1,VIN2,VIN3');
  }
} else {
  scrapeMVPBrands();
}

export { getAllMakes, getModelsForMake, decodeVIN, scrapeMVPBrands, scrapeAllMakes };
