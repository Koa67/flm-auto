/**
 * FLM AUTO - ADAC Autokatalog Scraper
 * Scrapes interior dimensions and test data from ADAC.de
 * 
 * ADAC provides: interior dimensions, trunk volume, tested consumption
 */
import puppeteer, { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ADACVehicle {
  brand: string;
  model: string;
  variant?: string;
  year?: number;
  // Interior dimensions
  front_headroom_mm?: number;
  rear_headroom_mm?: number;
  front_legroom_mm?: number;
  rear_legroom_mm?: number;
  front_shoulder_room_mm?: number;
  rear_shoulder_room_mm?: number;
  // Trunk
  trunk_volume_l?: number;
  trunk_volume_max_l?: number;
  trunk_length_mm?: number;
  trunk_width_mm?: number;
  trunk_height_mm?: number;
  loading_sill_height_mm?: number;
  // Tested values
  tested_consumption_l100km?: number;
  tested_range_km?: number;
  // ADAC rating
  adac_rating?: string;
  adac_test_url?: string;
  // Meta
  source_url: string;
  scraped_at: string;
}

const MVP_BRANDS: Record<string, string> = {
  'BMW': 'bmw',
  'Mercedes-Benz': 'mercedes-benz',
  'Audi': 'audi',
  'Porsche': 'porsche',
  'Volkswagen': 'volkswagen',
  'Skoda': 'skoda',
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'adac-dimensions.json');

async function getBrandModels(page: Page, brandSlug: string): Promise<{name: string, url: string}[]> {
  const url = `https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/${brandSlug}/`;
  console.log(`   Loading: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Accept cookies if present
    try {
      const cookieBtn = await page.$('[data-testid="uc-accept-all-button"], .cookie-accept, #accept-cookies');
      if (cookieBtn) {
        await cookieBtn.click();
        await delay(1000);
      }
    } catch {}
    
    const models = await page.evaluate(() => {
      const results: {name: string, url: string}[] = [];
      
      // Look for model links
      const links = document.querySelectorAll('a[href*="/autokatalog/marken-modelle/"]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        
        // Filter to model pages (deeper than brand page)
        if (href && text && text.length > 1 && href.split('/').length > 6) {
          const fullUrl = href.startsWith('http') ? href : `https://www.adac.de${href}`;
          if (!results.find(r => r.url === fullUrl)) {
            results.push({ name: text, url: fullUrl });
          }
        }
      });
      
      return results;
    });
    
    return models;
  } catch (err) {
    console.error(`   Error loading brand page: ${(err as Error).message}`);
    return [];
  }
}

async function scrapeVehiclePage(page: Page, url: string, brand: string): Promise<ADACVehicle | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    const data = await page.evaluate((brandName: string) => {
      const result: Record<string, any> = { brand: brandName };
      
      // Get title/model name
      const title = document.querySelector('h1')?.textContent?.trim();
      if (title) {
        result.model = title.replace(brandName, '').trim();
      }
      
      // Helper to extract number from German format (1.234,56 -> 1234.56)
      const parseGermanNumber = (text: string | null): number | undefined => {
        if (!text) return undefined;
        // Remove thousand separators and convert comma to dot
        const clean = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? undefined : num;
      };
      
      // Look for spec tables
      document.querySelectorAll('table tr, dl, .spec-row, [class*="specification"]').forEach(row => {
        let label = '';
        let value = '';
        
        // Try different structures
        const th = row.querySelector('th, dt, .label');
        const td = row.querySelector('td, dd, .value');
        
        if (th && td) {
          label = th.textContent?.toLowerCase().trim() || '';
          value = td.textContent?.trim() || '';
        }
        
        // Interior dimensions (German labels)
        if (label.includes('kopfraum') && label.includes('vorn')) {
          result.front_headroom_mm = parseGermanNumber(value);
        } else if (label.includes('kopfraum') && label.includes('hint')) {
          result.rear_headroom_mm = parseGermanNumber(value);
        } else if (label.includes('beinraum') && label.includes('vorn')) {
          result.front_legroom_mm = parseGermanNumber(value);
        } else if (label.includes('beinraum') && label.includes('hint')) {
          result.rear_legroom_mm = parseGermanNumber(value);
        } else if (label.includes('schulterraum') && label.includes('vorn')) {
          result.front_shoulder_room_mm = parseGermanNumber(value);
        } else if (label.includes('schulterraum') && label.includes('hint')) {
          result.rear_shoulder_room_mm = parseGermanNumber(value);
        }
        // Trunk
        else if (label.includes('kofferraum') && label.includes('volumen')) {
          result.trunk_volume_l = parseGermanNumber(value);
        } else if (label.includes('kofferraum') && label.includes('max')) {
          result.trunk_volume_max_l = parseGermanNumber(value);
        } else if (label.includes('ladekante') || label.includes('ladehöhe')) {
          result.loading_sill_height_mm = parseGermanNumber(value);
        }
        // Consumption
        else if (label.includes('verbrauch') && label.includes('test')) {
          result.tested_consumption_l100km = parseGermanNumber(value);
        } else if (label.includes('reichweite')) {
          result.tested_range_km = parseGermanNumber(value);
        }
        // Rating
        else if (label.includes('adac urteil') || label.includes('note')) {
          result.adac_rating = value;
        }
      });
      
      // Also check for structured data
      document.querySelectorAll('[class*="innenraum"], [class*="interior"], [class*="abmessung"]').forEach(section => {
        const text = section.textContent || '';
        
        // Look for patterns like "Kopfraum vorn: 1.020 mm"
        const patterns = [
          { regex: /kopfraum\s+vorn[:\s]+(\d+[\d.,]*)\s*mm/i, key: 'front_headroom_mm' },
          { regex: /kopfraum\s+hint[:\s]+(\d+[\d.,]*)\s*mm/i, key: 'rear_headroom_mm' },
          { regex: /beinraum\s+vorn[:\s]+(\d+[\d.,]*)\s*mm/i, key: 'front_legroom_mm' },
          { regex: /beinraum\s+hint[:\s]+(\d+[\d.,]*)\s*mm/i, key: 'rear_legroom_mm' },
          { regex: /kofferraum[:\s]+(\d+[\d.,]*)\s*l/i, key: 'trunk_volume_l' },
        ];
        
        patterns.forEach(({ regex, key }) => {
          const match = text.match(regex);
          if (match && !result[key]) {
            const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(val)) result[key] = val;
          }
        });
      });
      
      return result;
    }, brand);
    
    // Only return if we got meaningful data
    const hasInteriorData = data.front_headroom_mm || data.rear_headroom_mm || 
                           data.front_legroom_mm || data.rear_legroom_mm ||
                           data.trunk_volume_l;
    
    if (!hasInteriorData && !data.model) {
      return null;
    }
    
    return {
      ...data,
      source_url: url,
      scraped_at: new Date().toISOString(),
    } as ADACVehicle;
    
  } catch (err) {
    console.error(`   Error scraping ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - ADAC Interior Dimensions Scraper           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=de-DE'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-DE,de;q=0.9' });
  
  const allVehicles: ADACVehicle[] = [];
  
  for (const [brand, slug] of Object.entries(MVP_BRANDS)) {
    console.log(`\n🚗 ${brand}`);
    
    const models = await getBrandModels(page, slug);
    console.log(`   Found ${models.length} models`);
    
    let count = 0;
    for (const model of models.slice(0, 20)) { // Limit per brand for testing
      const vehicle = await scrapeVehiclePage(page, model.url, brand);
      
      if (vehicle) {
        allVehicles.push(vehicle);
        count++;
        const dims = [
          vehicle.front_headroom_mm && 'headroom',
          vehicle.front_legroom_mm && 'legroom',
          vehicle.trunk_volume_l && 'trunk'
        ].filter(Boolean).join(', ');
        console.log(`   ✓ ${vehicle.model || model.name} (${dims || 'basic'})`);
      }
      
      await delay(2000 + Math.random() * 2000);
    }
    
    console.log(`   Total: ${count} vehicles with data`);
    
    // Save progress
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allVehicles, null, 2));
  }
  
  await browser.close();
  
  // Final stats
  const withHeadroom = allVehicles.filter(v => v.front_headroom_mm || v.rear_headroom_mm).length;
  const withLegroom = allVehicles.filter(v => v.front_legroom_mm || v.rear_legroom_mm).length;
  const withTrunk = allVehicles.filter(v => v.trunk_volume_l).length;
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Total vehicles: ${allVehicles.length}`);
  console.log(`With headroom: ${withHeadroom}`);
  console.log(`With legroom: ${withLegroom}`);
  console.log(`With trunk: ${withTrunk}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('✅ Done!');
}

main().catch(console.error);
