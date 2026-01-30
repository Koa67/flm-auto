/**
 * FLM AUTO - Deep Specs Scraper
 * Visite chaque page variant pour extraire TOUTES les specs
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface DetailedSpec {
  brand: string;
  variant: string;
  source_url: string;
  // Dimensions
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  front_track_mm: number | null;
  rear_track_mm: number | null;
  ground_clearance_mm: number | null;
  // Weight
  curb_weight_kg: number | null;
  gross_weight_kg: number | null;
  // Cargo
  trunk_volume_l: number | null;
  trunk_volume_max_l: number | null;
  fuel_tank_l: number | null;
  // Performance
  acceleration_0_100: number | null;
  acceleration_0_60mph: number | null;
  top_speed_kmh: number | null;
  // Engine
  displacement_cc: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  compression_ratio: string | null;
  bore_mm: number | null;
  stroke_mm: number | null;
  // Fuel
  fuel_consumption_city: number | null;
  fuel_consumption_highway: number | null;
  fuel_consumption_combined: number | null;
  co2_gkm: number | null;
  // Transmission
  transmission: string | null;
  gears: number | null;
  drivetrain: string | null;
  scraped_at: string;
}

// Priority brands with most variants
const BRANDS_TO_ENRICH = [
  { name: 'Mercedes-Benz', slug: 'Mercedes-Benz' },
  { name: 'BMW', slug: 'BMW' },
  { name: 'Audi', slug: 'Audi' },
  { name: 'Volkswagen', slug: 'Volkswagen' },
  { name: 'Porsche', slug: 'Porsche' },
  { name: 'Toyota', slug: 'Toyota' },
  { name: 'Honda', slug: 'Honda' },
  { name: 'Ford', slug: 'Ford' },
  { name: 'Peugeot', slug: 'Peugeot' },
  { name: 'Renault', slug: 'Renault' },
];

async function extractDetailedSpecs(page: Page, url: string): Promise<Partial<DetailedSpec>> {
  try {
    const specs = await page.evaluate(() => {
      const data: Record<string, string> = {};
      
      // Extract from all tables
      document.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0]?.textContent?.trim().toLowerCase() || '';
          const value = cells[1]?.textContent?.trim() || '';
          if (key && value && value !== '-' && value !== 'N/A') {
            data[key] = value;
          }
        }
      });
      
      // Also try definition lists
      document.querySelectorAll('dl').forEach(dl => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        dts.forEach((dt, i) => {
          const key = dt.textContent?.trim().toLowerCase() || '';
          const value = dds[i]?.textContent?.trim() || '';
          if (key && value) data[key] = value;
        });
      });
      
      return data;
    });

    const parseNum = (str: string | undefined): number | null => {
      if (!str) return null;
      const match = str.match(/[\d.,]+/);
      if (!match) return null;
      const num = parseFloat(match[0].replace(',', '.'));
      return isNaN(num) ? null : num;
    };

    const findValue = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        for (const [specKey, specVal] of Object.entries(specs)) {
          if (specKey.includes(k)) return specVal;
        }
      }
      return undefined;
    };

    return {
      length_mm: parseNum(findValue('length', 'longueur', 'länge')),
      width_mm: parseNum(findValue('width', 'largeur', 'breite')),
      height_mm: parseNum(findValue('height', 'hauteur', 'höhe')),
      wheelbase_mm: parseNum(findValue('wheelbase', 'empattement', 'radstand')),
      front_track_mm: parseNum(findValue('front track', 'voie avant')),
      rear_track_mm: parseNum(findValue('rear track', 'voie arrière')),
      ground_clearance_mm: parseNum(findValue('ground clearance', 'garde au sol')),
      curb_weight_kg: parseNum(findValue('curb weight', 'kerb weight', 'poids à vide', 'unladen')),
      gross_weight_kg: parseNum(findValue('gross weight', 'max weight', 'poids total')),
      trunk_volume_l: parseNum(findValue('trunk', 'boot', 'cargo', 'luggage', 'coffre')),
      trunk_volume_max_l: parseNum(findValue('max cargo', 'max trunk', 'seats folded')),
      fuel_tank_l: parseNum(findValue('fuel tank', 'tank capacity', 'réservoir')),
      acceleration_0_100: parseNum(findValue('0-100', '0 to 100', '0 - 100')),
      acceleration_0_60mph: parseNum(findValue('0-60', '0 to 60')),
      top_speed_kmh: parseNum(findValue('top speed', 'max speed', 'vmax', 'vitesse max')),
      displacement_cc: parseNum(findValue('displacement', 'engine size', 'capacity', 'cylindrée')),
      power_hp: parseNum(findValue('power', 'horsepower', 'hp', 'ps', 'puissance')),
      power_kw: parseNum(findValue('kw')),
      torque_nm: parseNum(findValue('torque', 'nm', 'couple')),
      compression_ratio: findValue('compression'),
      bore_mm: parseNum(findValue('bore')),
      stroke_mm: parseNum(findValue('stroke')),
      fuel_consumption_city: parseNum(findValue('city', 'urban', 'ville')),
      fuel_consumption_highway: parseNum(findValue('highway', 'extra-urban', 'autoroute')),
      fuel_consumption_combined: parseNum(findValue('combined', 'average', 'mixte')),
      co2_gkm: parseNum(findValue('co2', 'co²', 'emission')),
      transmission: findValue('transmission', 'gearbox', 'boîte'),
      gears: parseNum(findValue('gears', 'speeds', 'rapports')),
      drivetrain: findValue('drivetrain', 'drive', 'traction', 'wheel drive'),
    };
  } catch {
    return {};
  }
}

async function scrapeBrandDetails(browser: Browser, brand: { name: string; slug: string }, limit: number = 100): Promise<DetailedSpec[]> {
  const allSpecs: DetailedSpec[] = [];
  let page: Page | null = null;
  
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Get brand page
    const brandUrl = `https://www.ultimatespecs.com/car-specs/${brand.slug}-models`;
    await page.goto(brandUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(500);

    // Collect all variant URLs
    const variantUrls = await page.evaluate(() => {
      const urls: string[] = [];
      document.querySelectorAll('a[href*="/car-specs/"]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        // Variant pages have numeric IDs
        if (href && href.match(/\/car-specs\/[^\/]+\/\d+\//)) {
          if (!urls.includes(href)) urls.push(href);
        }
      });
      return urls;
    });

    process.stdout.write(` (${variantUrls.length} variants)`);

    // Visit each variant page
    const urlsToProcess = variantUrls.slice(0, limit);
    let processed = 0;

    for (const variantUrl of urlsToProcess) {
      try {
        await page.goto(variantUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(300);

        const title = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
        const detailedSpecs = await extractDetailedSpecs(page, variantUrl);

        // Only save if we got meaningful data
        const hasData = detailedSpecs.length_mm || detailedSpecs.curb_weight_kg || 
                       detailedSpecs.acceleration_0_100 || detailedSpecs.trunk_volume_l;
        
        if (hasData) {
          allSpecs.push({
            brand: brand.name,
            variant: title || brand.name,
            source_url: variantUrl,
            ...detailedSpecs,
            scraped_at: new Date().toISOString(),
          } as DetailedSpec);
        }

        processed++;
        if (processed % 20 === 0) {
          process.stdout.write(`.`);
        }
      } catch {
        // Continue
      }
    }

  } catch (err) {
    // Brand-level error
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }

  return allSpecs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Deep Specs Scraper (Dimensions, Perf)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputFile = path.join(__dirname, '../data/detailed-specs.json');
  const allSpecs: DetailedSpec[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allSpecs.push(...existing);
    console.log(`Loaded ${existing.length} existing specs\n`);
  }

  const processedBrands = new Set(allSpecs.map(s => s.brand));

  for (let i = 0; i < BRANDS_TO_ENRICH.length; i++) {
    const brand = BRANDS_TO_ENRICH[i];
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
    
    process.stdout.write(`[${i + 1}/${BRANDS_TO_ENRICH.length}] ${brand.name.padEnd(15)} (${elapsedStr})`);
    
    if (processedBrands.has(brand.name)) {
      console.log(` → SKIP (already done) ⏭️`);
      continue;
    }

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const specs = await scrapeBrandDetails(browser, brand, 150);
      allSpecs.push(...specs);
      
      console.log(` → ${specs.length} detailed specs ✅`);
      
      // Save progress
      fs.writeFileSync(outputFile, JSON.stringify(allSpecs, null, 2));
      
    } catch (err) {
      console.log(` → ERROR ❌`);
    } finally {
      if (browser) {
        try { await browser.close(); } catch {}
      }
    }

    await delay(2000);
  }

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`Total specs: ${allSpecs.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
