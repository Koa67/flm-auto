/**
 * Automobile-Catalog Scraper - Puppeteer version
 * Comprehensive specs since 1945
 */

import puppeteer, { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.automobile-catalog.com';
const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

const BRAND_SLUGS: Record<string, string> = {
  'BMW': 'abarth-to-b/bmw',
  'Mercedes-Benz': 'm-to-o/mercedes-benz',
  'Audi': 'abarth-to-b/audi',
  'Porsche': 'p-to-r/porsche',
  'Volkswagen': 'v-to-z/volkswagen',
  'Skoda': 's-to-u/skoda',
};

const DATA_DIR = path.join(__dirname, '..', 'data', 'scraped');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface VehicleSpecs {
  [key: string]: string | number;
}

interface Vehicle {
  name: string;
  url: string;
  brand: string;
  year?: string;
  specs: VehicleSpecs;
  images: string[];
}

async function scrapeBrandModels(page: Page, brand: string): Promise<{ name: string; url: string }[]> {
  const slug = BRAND_SLUGS[brand];
  if (!slug) {
    console.log(`  No slug for ${brand}`);
    return [];
  }
  
  const url = `${BASE_URL}/make/${slug}/`;
  console.log(`  Navigating to ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  
  const models = await page.evaluate((baseUrl: string) => {
    const results: { name: string; url: string }[] = [];
    const links = document.querySelectorAll('a[href*="/car/"], a[href*="/make/"]');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      const name = link.textContent?.trim();
      
      if (href && name && name.length > 1 && href.includes('/car/')) {
        results.push({
          name,
          url: href.startsWith('http') ? href : `${baseUrl}${href}`,
        });
      }
    });
    
    const seen = new Set<string>();
    return results.filter(m => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    });
  }, BASE_URL);
  
  return models;
}

async function scrapeVehicleSpecs(page: Page, vehicleUrl: string): Promise<{ specs: VehicleSpecs; images: string[]; year?: string }> {
  await page.goto(vehicleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  
  const data = await page.evaluate(() => {
    const specs: Record<string, string | number> = {};
    const images: string[] = [];
    
    document.querySelectorAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0].textContent?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const value = cells[1].textContent?.trim();
        
        if (label && value && value !== '-' && value !== 'n/a') {
          const numMatch = value.match(/([\d.,]+)\s*(hp|kw|nm|mm|kg|l|km\/h|s)?/i);
          if (numMatch) {
            specs[label] = parseFloat(numMatch[1].replace(',', '.'));
          } else {
            specs[label] = value;
          }
        }
      }
    });
    
    document.querySelectorAll('dl').forEach(dl => {
      dl.querySelectorAll('dt').forEach(dt => {
        const label = dt.textContent?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const dd = dt.nextElementSibling;
        const value = dd?.textContent?.trim();
        
        if (label && value && value !== '-') {
          const numMatch = value.match(/([\d.,]+)/);
          if (numMatch) {
            specs[label] = parseFloat(numMatch[1].replace(',', '.'));
          } else {
            specs[label] = value;
          }
        }
      });
    });
    
    document.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('flag') && images.length < 5) {
        images.push(src);
      }
    });
    
    const title = document.querySelector('h1')?.textContent || '';
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    
    return {
      specs,
      images,
      year: yearMatch?.[0],
    };
  });
  
  return data;
}

async function main() {
  console.log('\n🚗 Automobile-Catalog Scraper (Puppeteer) - MVP Brands\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = {
    source: 'automobile-catalog',
    type: 'specs',
    scraped_at: new Date().toISOString(),
    brands: {} as Record<string, Vehicle[]>,
    total_vehicles: 0,
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n📊 ${brand}`);
    results.brands[brand] = [];
    
    try {
      const models = await scrapeBrandModels(page, brand);
      console.log(`  Found ${models.length} models`);
      
      let count = 0;
      for (const model of models.slice(0, 15)) {
        try {
          await sleep(3000);
          const { specs, images, year } = await scrapeVehicleSpecs(page, model.url);
          
          if (Object.keys(specs).length > 0) {
            results.brands[brand].push({
              ...model,
              brand,
              year,
              specs,
              images,
            });
            results.total_vehicles++;
            count++;
          }
          
          process.stdout.write(`  ${count}/15 models (${Object.keys(specs).length} specs)\r`);
        } catch (err) {
          console.error(`    Error on ${model.name}: ${(err as Error).message}`);
        }
      }
      console.log(`\n  ✓ ${count} models scraped`);
      
      const brandPath = path.join(DATA_DIR, `automobile-catalog-${brand.toLowerCase().replace(/[^a-z]/g, '')}.json`);
      fs.writeFileSync(brandPath, JSON.stringify({ brand, vehicles: results.brands[brand] }, null, 2));
      
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
    }
  }
  
  await browser.close();
  
  const outPath = path.join(DATA_DIR, 'automobile-catalog-puppeteer.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Saved to ${outPath}`);
  console.log(`   Total vehicles: ${results.total_vehicles}`);
}

main().catch(console.error);
