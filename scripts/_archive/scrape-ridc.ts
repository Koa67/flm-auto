/**
 * FLM AUTO - RiDC Interior Dimensions Scraper
 * Scrapes interior accessibility dimensions from ridc.org.uk
 * 
 * Key measurements: door opening, seat height, legroom, headroom, boot access
 */
import puppeteer, { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface InteriorDimensions {
  brand: string;
  model: string;
  variant?: string;
  year?: number;
  // Front access
  front_door_opening_mm?: number;
  front_seat_height_mm?: number;
  front_legroom_mm?: number;
  front_headroom_mm?: number;
  // Rear access
  rear_door_opening_mm?: number;
  rear_seat_height_mm?: number;
  rear_legroom_mm?: number;
  rear_headroom_mm?: number;
  // Boot
  boot_opening_height_mm?: number;
  boot_opening_width_mm?: number;
  boot_sill_height_mm?: number;
  boot_depth_mm?: number;
  // Wheelchair
  wheelchair_compatible?: boolean;
  // Meta
  source_url: string;
  scraped_at: string;
}

const MVP_BRANDS = ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Porsche', 'Volkswagen', 'VW', 'Skoda'];

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'ridc-dimensions.json');

async function searchBrand(page: Page, brand: string): Promise<string[]> {
  console.log(`\n🔍 Searching for ${brand}...`);
  
  // Go to car search
  await page.goto('https://www.ridc.org.uk/car-search', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);
  
  // Try to find and interact with search/filter
  const vehicleLinks: string[] = [];
  
  try {
    // Look for brand filter or search input
    const searchInput = await page.$('input[type="search"], input[name="search"], #search, .search-input');
    if (searchInput) {
      await searchInput.type(brand, { delay: 100 });
      await delay(1000);
      await page.keyboard.press('Enter');
      await delay(3000);
    }
    
    // Extract vehicle links
    const links = await page.evaluate((brandName: string) => {
      const results: string[] = [];
      const allLinks = document.querySelectorAll('a[href*="/car-search/"], a[href*="vehicle"], a[href*="car"]');
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.toLowerCase() || '';
        const brandLower = brandName.toLowerCase();
        
        if (href && (text.includes(brandLower) || href.includes(brandLower))) {
          const fullUrl = href.startsWith('http') ? href : `https://www.ridc.org.uk${href}`;
          if (!results.includes(fullUrl)) {
            results.push(fullUrl);
          }
        }
      });
      
      return results;
    }, brand);
    
    vehicleLinks.push(...links);
    console.log(`   Found ${links.length} vehicle links`);
    
  } catch (err) {
    console.error(`   Search error: ${(err as Error).message}`);
  }
  
  return vehicleLinks;
}

async function scrapeVehiclePage(page: Page, url: string): Promise<InteriorDimensions | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    const data = await page.evaluate(() => {
      const result: Record<string, any> = {};
      
      // Extract title/model info
      const title = document.querySelector('h1, .vehicle-title, .car-title')?.textContent?.trim();
      if (title) {
        result.title = title;
      }
      
      // Helper to extract numeric value from text
      const extractMM = (text: string | null): number | undefined => {
        if (!text) return undefined;
        const match = text.match(/(\d+)\s*(mm|cm|m)/i);
        if (match) {
          const val = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === 'cm') return val * 10;
          if (unit === 'm') return val * 1000;
          return val;
        }
        // Try just number
        const numMatch = text.match(/(\d+)/);
        return numMatch ? parseInt(numMatch[1]) : undefined;
      };
      
      // Look for dimension tables
      document.querySelectorAll('table tr, .spec-row, .dimension-row, dl').forEach(row => {
        const labelEl = row.querySelector('th, td:first-child, dt, .label');
        const valueEl = row.querySelector('td:last-child, td:nth-child(2), dd, .value');
        
        const label = labelEl?.textContent?.toLowerCase().trim() || '';
        const value = valueEl?.textContent?.trim() || '';
        
        // Map common labels
        if (label.includes('front door') && label.includes('open')) {
          result.front_door_opening_mm = extractMM(value);
        } else if (label.includes('rear door') && label.includes('open')) {
          result.rear_door_opening_mm = extractMM(value);
        } else if (label.includes('front seat') && label.includes('height')) {
          result.front_seat_height_mm = extractMM(value);
        } else if (label.includes('rear seat') && label.includes('height')) {
          result.rear_seat_height_mm = extractMM(value);
        } else if (label.includes('front') && label.includes('legroom')) {
          result.front_legroom_mm = extractMM(value);
        } else if (label.includes('rear') && label.includes('legroom')) {
          result.rear_legroom_mm = extractMM(value);
        } else if (label.includes('front') && label.includes('headroom')) {
          result.front_headroom_mm = extractMM(value);
        } else if (label.includes('rear') && label.includes('headroom')) {
          result.rear_headroom_mm = extractMM(value);
        } else if (label.includes('boot') && label.includes('opening') && label.includes('height')) {
          result.boot_opening_height_mm = extractMM(value);
        } else if (label.includes('boot') && label.includes('opening') && label.includes('width')) {
          result.boot_opening_width_mm = extractMM(value);
        } else if (label.includes('boot') && label.includes('sill')) {
          result.boot_sill_height_mm = extractMM(value);
        } else if (label.includes('boot') && label.includes('depth')) {
          result.boot_depth_mm = extractMM(value);
        } else if (label.includes('wheelchair')) {
          result.wheelchair_compatible = value.toLowerCase().includes('yes') || value.toLowerCase().includes('true');
        }
      });
      
      // Also check for specific data attributes or structured content
      document.querySelectorAll('[data-dimension], [data-measurement]').forEach(el => {
        const dim = el.getAttribute('data-dimension') || el.getAttribute('data-measurement');
        const val = el.textContent?.trim();
        if (dim && val) {
          result[dim] = extractMM(val);
        }
      });
      
      return result;
    });
    
    if (!data.title && Object.keys(data).length < 2) {
      return null;
    }
    
    // Parse brand/model from title or URL
    const urlParts = url.split('/');
    const brandModel = data.title || urlParts[urlParts.length - 1] || '';
    
    let brand = '';
    let model = '';
    
    for (const b of ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Porsche', 'Volkswagen', 'VW', 'Skoda']) {
      if (brandModel.toLowerCase().includes(b.toLowerCase())) {
        brand = b === 'Mercedes' ? 'Mercedes-Benz' : b === 'VW' ? 'Volkswagen' : b;
        model = brandModel.replace(new RegExp(b, 'i'), '').trim();
        break;
      }
    }
    
    return {
      brand,
      model,
      ...data,
      source_url: url,
      scraped_at: new Date().toISOString(),
    } as InteriorDimensions;
    
  } catch (err) {
    console.error(`   Error scraping ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - RiDC Interior Dimensions Scraper           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const allDimensions: InteriorDimensions[] = [];
  
  // First, explore the site structure
  console.log('\n📡 Exploring RiDC site structure...');
  await page.goto('https://www.ridc.org.uk/car-search', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);
  
  // Take screenshot for debugging
  await page.screenshot({ path: path.join(DATA_DIR, 'ridc-homepage.png') });
  console.log('   Screenshot saved to data/ridc-homepage.png');
  
  // Get page HTML structure
  const pageStructure = await page.evaluate(() => {
    return {
      title: document.title,
      forms: Array.from(document.querySelectorAll('form')).map(f => ({
        id: f.id,
        action: f.action,
        inputs: Array.from(f.querySelectorAll('input, select')).map(i => ({
          name: i.getAttribute('name'),
          type: i.getAttribute('type'),
          id: i.id,
        })),
      })),
      links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
        href: a.href,
        text: a.textContent?.trim().slice(0, 50),
      })),
      hasSearch: !!document.querySelector('input[type="search"], input[name="search"], .search'),
      hasFilters: !!document.querySelector('select[name*="make"], select[name*="brand"], .filter'),
    };
  });
  
  console.log('\n📋 Site structure:');
  console.log(`   Title: ${pageStructure.title}`);
  console.log(`   Has search: ${pageStructure.hasSearch}`);
  console.log(`   Has filters: ${pageStructure.hasFilters}`);
  console.log(`   Forms: ${pageStructure.forms.length}`);
  
  if (pageStructure.forms.length > 0) {
    console.log('\n   Form details:');
    pageStructure.forms.forEach((f, i) => {
      console.log(`   [${i}] id=${f.id}, inputs: ${f.inputs.map(i => i.name || i.id).join(', ')}`);
    });
  }
  
  // Try each brand
  for (const brand of ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda']) {
    const links = await searchBrand(page, brand);
    
    for (const link of links.slice(0, 10)) {
      console.log(`   Scraping: ${link.slice(0, 60)}...`);
      const dims = await scrapeVehiclePage(page, link);
      if (dims && Object.keys(dims).length > 3) {
        allDimensions.push(dims);
        console.log(`   ✓ Got ${Object.keys(dims).length} fields`);
      }
      await delay(2000);
    }
  }
  
  await browser.close();
  
  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allDimensions, null, 2));
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Total vehicles: ${allDimensions.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('✅ Done!');
}

main().catch(console.error);
