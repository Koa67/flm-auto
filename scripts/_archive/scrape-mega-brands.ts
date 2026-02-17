/**
 * FLM AUTO - MEGA Scraper (All remaining major brands)
 * Runtime estimate: ~2h
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface VehicleSpec {
  brand: string;
  model: string;
  variant: string;
  generation: string | null;
  year_start: number | null;
  year_end: number | null;
  engine_type: string | null;
  displacement_cc: number | null;
  cylinders: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  trunk_volume_l: number | null;
  curb_weight_kg: number | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel_consumption_l100km: number | null;
  co2_gkm: number | null;
  source_url: string;
  scraped_at: string;
}

// ALL remaining major brands we don't have yet
const BRANDS = [
  // Premium/Luxury
  { name: 'Volvo', slug: 'Volvo' },
  { name: 'Bentley', slug: 'Bentley' },
  { name: 'Rolls-Royce', slug: 'Rolls-Royce' },
  { name: 'Bugatti', slug: 'Bugatti' },
  { name: 'McLaren', slug: 'McLaren' },
  { name: 'Lotus', slug: 'Lotus' },
  { name: 'Alpina', slug: 'Alpina' },
  { name: 'Alpine', slug: 'Alpine' },
  
  // German mainstream
  { name: 'Seat', slug: 'Seat' },
  { name: 'Skoda', slug: 'Skoda' },
  { name: 'Smart', slug: 'Smart' },
  { name: 'Cupra', slug: 'Cupra' },
  
  // Japanese additional
  { name: 'Subaru', slug: 'Subaru' },
  { name: 'Suzuki', slug: 'Suzuki' },
  { name: 'Mitsubishi', slug: 'Mitsubishi' },
  { name: 'Daihatsu', slug: 'Daihatsu' },
  { name: 'Infiniti', slug: 'Infiniti' },
  { name: 'Acura', slug: 'Acura' },
  
  // American additional
  { name: 'Dodge', slug: 'Dodge' },
  { name: 'Jeep', slug: 'Jeep' },
  { name: 'Chrysler', slug: 'Chrysler' },
  { name: 'Buick', slug: 'Buick' },
  { name: 'Cadillac', slug: 'Cadillac' },
  { name: 'Lincoln', slug: 'Lincoln' },
  { name: 'GMC', slug: 'GMC' },
  
  // European others
  { name: 'Dacia', slug: 'Dacia' },
  { name: 'Lancia', slug: 'Lancia' },
  { name: 'Abarth', slug: 'Abarth' },
  { name: 'DS', slug: 'DS' },
  { name: 'Saab', slug: 'Saab' },
  { name: 'Rover', slug: 'Rover' },
  { name: 'MG', slug: 'MG' },
  { name: 'Vauxhall', slug: 'Vauxhall' },
  
  // Korean additional
  { name: 'Genesis', slug: 'Genesis' },
  { name: 'SsangYong', slug: 'Ssangyong' },
  
  // Chinese/EV newcomers
  { name: 'BYD', slug: 'BYD' },
  { name: 'Polestar', slug: 'Polestar' },
  { name: 'VinFast', slug: 'VinFast' },
  { name: 'XPeng', slug: 'XPeng' },
  { name: 'ZEEKR', slug: 'ZEEKR' },
  { name: 'Aiways', slug: 'Aiways' },
  
  // Niche/Sports
  { name: 'TVR', slug: 'Tvr' },
  { name: 'Caterham', slug: 'Caterham' },
  { name: 'Morgan', slug: 'Morgan' },
  { name: 'Donkervoort', slug: 'Donkervoort' },
  { name: 'Zenvo', slug: 'Zenvo' },
  { name: 'Koenigsegg', slug: 'Koenigsegg' },
  { name: 'Pagani', slug: 'Pagani' },
  { name: 'Spyker', slug: 'Spyker' },
  { name: 'De Tomaso', slug: 'De-Tomaso' },
  
  // Classic/Historic interesting
  { name: 'Austin', slug: 'Austin' },
  { name: 'Triumph', slug: 'Triumph' },
  { name: 'Pontiac', slug: 'Pontiac' },
  { name: 'Oldsmobile', slug: 'Oldsmobile' },
  { name: 'Plymouth', slug: 'Plymouth' },
  { name: 'DeLorean', slug: 'Delorean' },
];

async function extractSpecsFromVariantPage(page: Page, brand: string, url: string): Promise<VehicleSpec | null> {
  try {
    const spec = await page.evaluate((brandName: string, pageUrl: string) => {
      const getText = (selector: string): string | null => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || null;
      };

      const parseNum = (str: string | null | undefined): number | null => {
        if (!str) return null;
        const match = str.match(/[\d.,]+/);
        if (!match) return null;
        const num = parseFloat(match[0].replace(',', '.'));
        return isNaN(num) ? null : num;
      };

      // Get title/variant name
      const title = document.querySelector('h1')?.textContent?.trim() || '';
      
      // Extract specs from tables
      const specData: Record<string, string> = {};
      document.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const key = cells[0]?.textContent?.trim().toLowerCase() || '';
          const value = cells[1]?.textContent?.trim() || '';
          if (key && value) {
            specData[key] = value;
          }
        }
      });

      // Also try definition lists
      document.querySelectorAll('dt, dd').forEach((el, i, arr) => {
        if (el.tagName === 'DT' && arr[i + 1]?.tagName === 'DD') {
          const key = el.textContent?.trim().toLowerCase() || '';
          const value = arr[i + 1]?.textContent?.trim() || '';
          if (key && value) specData[key] = value;
        }
      });

      const findValue = (...keys: string[]): string | null => {
        for (const k of keys) {
          for (const [specKey, specVal] of Object.entries(specData)) {
            if (specKey.includes(k)) return specVal;
          }
        }
        return null;
      };

      return {
        brand: brandName,
        model: brandName,
        variant: title || `${brandName} Unknown`,
        generation: null,
        year_start: parseNum(findValue('year', 'production')),
        year_end: null,
        engine_type: findValue('engine type', 'fuel type', 'fuel'),
        displacement_cc: parseNum(findValue('displacement', 'engine size', 'capacity')),
        cylinders: parseNum(findValue('cylinder', 'cylinders')),
        power_hp: parseNum(findValue('power', 'hp', 'horsepower', 'ps')),
        power_kw: parseNum(findValue('kw')),
        torque_nm: parseNum(findValue('torque', 'nm')),
        acceleration_0_100: parseNum(findValue('0-100', '0 to 100', 'acceleration')),
        top_speed_kmh: parseNum(findValue('top speed', 'max speed', 'vmax')),
        length_mm: parseNum(findValue('length')),
        width_mm: parseNum(findValue('width')),
        height_mm: parseNum(findValue('height')),
        wheelbase_mm: parseNum(findValue('wheelbase')),
        trunk_volume_l: parseNum(findValue('trunk', 'boot', 'cargo', 'luggage')),
        curb_weight_kg: parseNum(findValue('weight', 'curb weight', 'kerb')),
        drivetrain: findValue('drivetrain', 'drive', 'wheel drive'),
        transmission: findValue('transmission', 'gearbox'),
        fuel_consumption_l100km: parseNum(findValue('consumption', 'fuel economy', 'l/100')),
        co2_gkm: parseNum(findValue('co2', 'emission')),
        source_url: pageUrl,
        scraped_at: new Date().toISOString(),
      };
    }, brand, url);

    return spec as VehicleSpec;
  } catch {
    return null;
  }
}

async function scrapeBrand(browser: Browser, brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  const allSpecs: VehicleSpec[] = [];
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Block images and CSS for speed
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    const brandUrl = `https://www.ultimatespecs.com/car-specs/${brand.slug}-models`;
    
    await page.goto(brandUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1000);

    // Get all model links
    const modelLinks = await page.evaluate((brandSlug: string) => {
      const links: string[] = [];
      document.querySelectorAll('a[href*="/car-specs/"]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href && href.match(new RegExp(`/car-specs/${brandSlug}/M\\d+/`, 'i'))) {
          if (!links.includes(href)) links.push(href);
        }
      });
      return links;
    }, brand.slug);

    process.stdout.write(` (${modelLinks.length} models)`);

    // Visit each model page to get variants
    for (const modelUrl of modelLinks) {
      try {
        await page.goto(modelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(300);

        // Get variant links from model page
        const variantLinks = await page.evaluate(() => {
          const links: string[] = [];
          document.querySelectorAll('a[href*="/car-specs/"]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            // Variant pages have longer URLs with specific model codes
            if (href && href.match(/\/car-specs\/[^\/]+\/\d+\//)) {
              if (!links.includes(href)) links.push(href);
            }
          });
          return links.slice(0, 200); // Limit per model
        });

        // Extract basic specs from model page table
        const pageSpecs = await page.evaluate((brandName: string, pageUrl: string) => {
          const specs: any[] = [];
          
          const parseNum = (str: string | null | undefined): number | null => {
            if (!str) return null;
            const match = str.match(/[\d.,]+/);
            if (!match) return null;
            const num = parseFloat(match[0].replace(',', '.'));
            return isNaN(num) ? null : num;
          };

          // Get generation from URL
          const urlMatch = pageUrl.match(/\/([^\/]+)$/);
          const genFromUrl = urlMatch ? decodeURIComponent(urlMatch[1]).replace(/[()]/g, ' ').trim() : null;

          const tables = document.querySelectorAll('table');
          
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 2) return;
              
              const variantLink = row.querySelector('a');
              const variantName = variantLink?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
              
              if (!variantName || variantName.length < 3) return;
              if (variantName.toLowerCase().includes('model') && variantName.toLowerCase().includes('name')) return;

              const spec: any = {
                brand: brandName,
                model: brandName,
                variant: variantName.startsWith(brandName) ? variantName : `${brandName} ${variantName}`,
                generation: genFromUrl,
                year_start: null,
                year_end: null,
                engine_type: null,
                displacement_cc: null,
                cylinders: null,
                power_hp: null,
                power_kw: null,
                torque_nm: null,
                acceleration_0_100: null,
                top_speed_kmh: null,
                length_mm: null,
                width_mm: null,
                height_mm: null,
                wheelbase_mm: null,
                trunk_volume_l: null,
                curb_weight_kg: null,
                drivetrain: null,
                transmission: null,
                fuel_consumption_l100km: null,
                co2_gkm: null,
                source_url: variantLink?.href || pageUrl,
                scraped_at: new Date().toISOString(),
              };

              // Try to extract data from cells
              cells.forEach((cell) => {
                const text = cell.textContent?.trim() || '';
                
                // Year
                const yearMatch = text.match(/\b(19|20)\d{2}\b/);
                if (yearMatch && !spec.year_start) {
                  spec.year_start = parseInt(yearMatch[0]);
                }
                
                // Power
                if (text.match(/\d+\s*hp/i)) spec.power_hp = parseNum(text);
                if (text.match(/\d+\s*kw/i)) spec.power_kw = parseNum(text);
                if (text.match(/\d+\s*ps/i) && !spec.power_hp) spec.power_hp = parseNum(text);
                
                // Torque
                if (text.match(/\d+\s*nm/i)) spec.torque_nm = parseNum(text);
                
                // Displacement
                if (text.match(/\d+\s*cc/i)) spec.displacement_cc = parseNum(text);
                if (text.match(/\d\.\d\s*(l|liter)/i)) {
                  const liters = parseNum(text);
                  if (liters && liters < 20) spec.displacement_cc = Math.round(liters * 1000);
                }
                
                // Performance
                if (text.match(/\d+\.\d\s*s(ec)?/i) && text.match(/0.?100|acceleration/i)) {
                  spec.acceleration_0_100 = parseNum(text);
                }
                if (text.match(/\d+\s*km\/h/i)) spec.top_speed_kmh = parseNum(text);
              });

              // Only add if we have at least some useful data
              if (spec.power_hp || spec.displacement_cc || spec.torque_nm || spec.year_start) {
                specs.push(spec);
              }
            });
          });

          return specs;
        }, brand.name, modelUrl);

        allSpecs.push(...pageSpecs);
        
      } catch (err) {
        // Continue on error
      }
    }

  } catch (err) {
    console.log(` ❌ Error: ${(err as Error).message?.substring(0, 50)}`);
  } finally {
    await page.close();
  }

  return allSpecs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - MEGA Scraper (All Remaining Brands)         ║');
  console.log('║     Estimated runtime: ~2 hours                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const summary: { brand: string; count: number }[] = [];
  const startTime = Date.now();

  try {
    for (let i = 0; i < BRANDS.length; i++) {
      const brand = BRANDS[i];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
      
      process.stdout.write(`[${i + 1}/${BRANDS.length}] ${brand.name.padEnd(15)} (${elapsedStr})`);
      
      // Check if already scraped
      const outputFile = path.join(outputDir, `${brand.slug.toLowerCase()}.json`);
      if (fs.existsSync(outputFile)) {
        const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
        if (existing.length > 50) {
          console.log(` → SKIP (${existing.length} already exists) ⏭️`);
          summary.push({ brand: brand.name, count: existing.length });
          continue;
        }
      }
      
      const specs = await scrapeBrand(browser, brand);
      
      if (specs.length > 0) {
        fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
        console.log(` → ${specs.length} vehicles ✅`);
      } else {
        console.log(` → 0 vehicles ⚠️`);
      }
      
      summary.push({ brand: brand.name, count: specs.length });
      
      // Delay between brands to avoid rate limiting
      await delay(2000);
    }

  } finally {
    await browser.close();
  }

  // Summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  
  let total = 0;
  for (const s of summary) {
    console.log(`  ${s.brand.padEnd(15)} ${s.count.toString().padStart(5)} vehicles`);
    total += s.count;
  }
  console.log('─'.repeat(60));
  console.log(`  ${'TOTAL'.padEnd(15)} ${total.toString().padStart(5)} vehicles`);
  console.log(`  ${'TIME'.padEnd(15)} ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);

  console.log('\n✅ Done!');
}

main().catch(console.error);
