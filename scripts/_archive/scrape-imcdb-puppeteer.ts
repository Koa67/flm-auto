/**
 * IMCDb Scraper - Puppeteer version
 * Movie/TV vehicle appearances
 */

import puppeteer, { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.imcdb.org';
const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volkswagen', 'Skoda'];

const DATA_DIR = path.join(__dirname, '..', 'data', 'scraped');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface VehicleAppearance {
  movie: string;
  year?: string;
  url?: string;
}

interface Vehicle {
  name: string;
  url: string;
  brand: string;
  appearances: VehicleAppearance[];
  appearances_count: number;
}

async function scrapeBrandVehicles(page: Page, brand: string): Promise<Vehicle[]> {
  const url = `${BASE_URL}/vehicles.php?make=${encodeURIComponent(brand)}`;
  console.log(`  Navigating to ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  
  const vehicles = await page.evaluate(() => {
    const results: { name: string; url: string }[] = [];
    const links = document.querySelectorAll('a[href*="/vehicle_"]');
    
    links.forEach(link => {
      const name = link.textContent?.trim();
      const href = link.getAttribute('href');
      if (name && href && name.length > 2) {
        results.push({
          name,
          url: href.startsWith('http') ? href : `https://www.imcdb.org${href}`,
        });
      }
    });
    
    const seen = new Set<string>();
    return results.filter(v => {
      if (seen.has(v.url)) return false;
      seen.add(v.url);
      return true;
    });
  });
  
  return vehicles.map((v: { name: string; url: string }) => ({
    ...v,
    brand,
    appearances: [],
    appearances_count: 0,
  }));
}

async function scrapeVehicleAppearances(page: Page, vehicleUrl: string): Promise<VehicleAppearance[]> {
  await page.goto(vehicleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  
  const appearances = await page.evaluate(() => {
    const results: { movie: string; year?: string; url?: string }[] = [];
    const movieLinks = document.querySelectorAll('a[href*="/movie/"], a[href*="movie.php"]');
    
    movieLinks.forEach(link => {
      const title = link.textContent?.trim();
      const href = link.getAttribute('href');
      
      if (title && title.length > 1) {
        const parent = link.parentElement;
        const yearMatch = parent?.textContent?.match(/\((\d{4})\)/);
        
        results.push({
          movie: title,
          year: yearMatch?.[1],
          url: href || undefined,
        });
      }
    });
    
    const seen = new Set<string>();
    return results.filter(a => {
      if (seen.has(a.movie)) return false;
      seen.add(a.movie);
      return true;
    });
  });
  
  return appearances;
}

async function main() {
  console.log('\n🎬 IMCDb Scraper (Puppeteer) - MVP Brands\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = {
    source: 'imcdb',
    type: 'pop_culture',
    scraped_at: new Date().toISOString(),
    brands: {} as Record<string, Vehicle[]>,
    total_vehicles: 0,
    total_appearances: 0,
  };
  
  for (const brand of MVP_BRANDS) {
    console.log(`\n🎥 ${brand}`);
    results.brands[brand] = [];
    
    try {
      const vehicles = await scrapeBrandVehicles(page, brand);
      console.log(`  Found ${vehicles.length} vehicles`);
      
      let count = 0;
      for (const vehicle of vehicles.slice(0, 20)) {
        try {
          await sleep(2000);
          const appearances = await scrapeVehicleAppearances(page, vehicle.url);
          
          vehicle.appearances = appearances;
          vehicle.appearances_count = appearances.length;
          
          results.brands[brand].push(vehicle);
          results.total_vehicles++;
          results.total_appearances += appearances.length;
          count++;
          
          process.stdout.write(`  ${count}/20 vehicles (${appearances.length} appearances)\r`);
        } catch (err) {
          console.error(`    Error on ${vehicle.name}: ${(err as Error).message}`);
        }
      }
      console.log(`\n  ✓ ${count} vehicles scraped`);
      
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
    }
  }
  
  await browser.close();
  
  const outPath = path.join(DATA_DIR, 'imcdb-puppeteer.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Saved to ${outPath}`);
  console.log(`   Vehicles: ${results.total_vehicles}`);
  console.log(`   Appearances: ${results.total_appearances}`);
}

main().catch(console.error);
