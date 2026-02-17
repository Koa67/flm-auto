/**
 * FLM AUTO - CarSized Scraper
 * Scrape dimensions from carsized.com for visual comparison
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface CarDimensions {
  brand: string;
  model: string;
  year: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  cargo_volume_l: number | null;
  curb_weight_kg: number | null;
  source_url: string;
  scraped_at: string;
}

// Popular models for visual comparison
const MODELS_TO_SCRAPE = [
  // German
  { brand: 'BMW', models: ['3 Series', '5 Series', 'X3', 'X5', 'M3', 'M5'] },
  { brand: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'AMG GT'] },
  { brand: 'Audi', models: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7', 'RS6'] },
  { brand: 'Volkswagen', models: ['Golf', 'Passat', 'Tiguan', 'Polo', 'ID.4'] },
  { brand: 'Porsche', models: ['911', 'Cayenne', 'Macan', 'Taycan', 'Panamera'] },
  // Japanese
  { brand: 'Toyota', models: ['Corolla', 'Camry', 'RAV4', 'Supra', 'Land Cruiser'] },
  { brand: 'Honda', models: ['Civic', 'Accord', 'CR-V', 'NSX'] },
  { brand: 'Nissan', models: ['GT-R', '370Z', 'Qashqai', 'X-Trail'] },
  { brand: 'Mazda', models: ['MX-5', 'Mazda3', 'CX-5'] },
  // American
  { brand: 'Ford', models: ['Mustang', 'F-150', 'Focus', 'Bronco'] },
  { brand: 'Chevrolet', models: ['Corvette', 'Camaro', 'Silverado'] },
  { brand: 'Tesla', models: ['Model 3', 'Model S', 'Model X', 'Model Y'] },
  // Italian
  { brand: 'Ferrari', models: ['488', 'F8', 'SF90', '812'] },
  { brand: 'Lamborghini', models: ['Huracan', 'Aventador', 'Urus'] },
  // British
  { brand: 'Jaguar', models: ['F-Type', 'XE', 'XF', 'F-Pace'] },
  { brand: 'Land Rover', models: ['Range Rover', 'Defender', 'Discovery'] },
  { brand: 'Aston Martin', models: ['DB11', 'Vantage', 'DBS'] },
  // French
  { brand: 'Peugeot', models: ['208', '308', '3008', '508'] },
  { brand: 'Renault', models: ['Clio', 'Megane', 'Captur'] },
];

async function searchCarSized(page: Page, brand: string, model: string): Promise<CarDimensions | null> {
  try {
    const searchQuery = `${brand} ${model}`;
    const searchUrl = `https://www.carsized.com/en/cars/?q=${encodeURIComponent(searchQuery)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(1000);
    
    // Get first result link
    const firstResultUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/en/cars/"]');
      return link ? (link as HTMLAnchorElement).href : null;
    });
    
    if (!firstResultUrl) return null;
    
    // Go to car page
    await page.goto(firstResultUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(800);
    
    // Extract dimensions
    const dimensions = await page.evaluate((brandName: string, modelName: string) => {
      const parseNum = (str: string | null): number | null => {
        if (!str) return null;
        const match = str.match(/[\d.,]+/);
        if (!match) return null;
        const num = parseFloat(match[0].replace(',', '.'));
        return isNaN(num) ? null : num;
      };
      
      const getText = (selector: string): string | null => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || null;
      };
      
      // Try to find specs in tables or spec lists
      const specData: Record<string, string> = {};
      
      document.querySelectorAll('table tr, .spec-row, .dimension-row').forEach(row => {
        const cells = row.querySelectorAll('td, th, span, div');
        if (cells.length >= 2) {
          const key = cells[0]?.textContent?.trim().toLowerCase() || '';
          const value = cells[1]?.textContent?.trim() || '';
          if (key && value) specData[key] = value;
        }
      });
      
      // Also look for specific dimension elements
      document.querySelectorAll('[class*="length"], [class*="width"], [class*="height"], [data-spec]').forEach(el => {
        const className = el.className || '';
        const text = el.textContent?.trim() || '';
        if (className.includes('length') && text) specData['length'] = text;
        if (className.includes('width') && text) specData['width'] = text;
        if (className.includes('height') && text) specData['height'] = text;
      });
      
      const findValue = (...keys: string[]): string | null => {
        for (const k of keys) {
          for (const [specKey, specVal] of Object.entries(specData)) {
            if (specKey.includes(k)) return specVal;
          }
        }
        return null;
      };
      
      // Try to get year from title
      const title = document.querySelector('h1')?.textContent || '';
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      
      return {
        brand: brandName,
        model: modelName,
        year: yearMatch ? parseInt(yearMatch[0]) : null,
        length_mm: parseNum(findValue('length', 'longueur', 'länge')),
        width_mm: parseNum(findValue('width', 'largeur', 'breite')),
        height_mm: parseNum(findValue('height', 'hauteur', 'höhe')),
        wheelbase_mm: parseNum(findValue('wheelbase', 'empattement')),
        cargo_volume_l: parseNum(findValue('cargo', 'trunk', 'boot', 'luggage', 'coffre')),
        curb_weight_kg: parseNum(findValue('weight', 'poids', 'gewicht')),
        source_url: window.location.href,
      };
    }, brand, model);
    
    if (dimensions.length_mm || dimensions.width_mm || dimensions.height_mm) {
      return {
        ...dimensions,
        scraped_at: new Date().toISOString(),
      } as CarDimensions;
    }
    
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - CarSized Scraper (Dimensions)               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputFile = path.join(__dirname, '../data/carsized-dimensions.json');
  const allDimensions: CarDimensions[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allDimensions.push(...existing);
    console.log(`Loaded ${existing.length} existing dimensions\n`);
  }

  const processed = new Set(allDimensions.map(d => `${d.brand}-${d.model}`));

  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let totalModels = 0;
    for (const brandData of MODELS_TO_SCRAPE) {
      totalModels += brandData.models.length;
    }

    let current = 0;
    
    for (const brandData of MODELS_TO_SCRAPE) {
      for (const model of brandData.models) {
        current++;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
        
        const key = `${brandData.brand}-${model}`;
        process.stdout.write(`[${current}/${totalModels}] ${key.padEnd(30)} (${elapsedStr})`);
        
        if (processed.has(key)) {
          console.log(` → SKIP ⏭️`);
          continue;
        }

        const dimensions = await searchCarSized(page, brandData.brand, model);
        
        if (dimensions) {
          allDimensions.push(dimensions);
          console.log(` → L:${dimensions.length_mm || '?'} W:${dimensions.width_mm || '?'} H:${dimensions.height_mm || '?'} ✅`);
        } else {
          console.log(` → Not found ⚠️`);
        }
        
        // Save progress
        if (current % 10 === 0) {
          fs.writeFileSync(outputFile, JSON.stringify(allDimensions, null, 2));
        }
        
        await delay(1500);
      }
    }

    await page.close();
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allDimensions, null, 2));

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`Total dimensions: ${allDimensions.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
