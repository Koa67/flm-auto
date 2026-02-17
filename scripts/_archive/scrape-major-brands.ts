/**
 * FLM AUTO - Scrape Missing Major Brands (BMW, Mercedes, Lamborghini)
 * These 3 brands were not properly scraped initially
 * 
 * Usage: npx ts-node scripts/scrape-major-brands.ts
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
  body_type: string | null;
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
  fuel_type: string | null;
  fuel_consumption_l100km: number | null;
  co2_gkm: number | null;
  source_url: string;
  scraped_at: string;
}

// The 3 major brands missing from UltimateSpecs
const BRANDS = [
  { name: 'BMW', slug: 'BMW' },
  { name: 'Mercedes-Benz', slug: 'Mercedes-Benz' },
  { name: 'Lamborghini', slug: 'Lamborghini' },
];

async function scrapeBrand(browser: Browser, brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  const allSpecs: VehicleSpec[] = [];
  let page: Page | null = null;
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Scraping ${brand.name}...`);
  console.log('═'.repeat(60));
  
  try {
    page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Block images for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Try multiple URL patterns
    const brandUrls = [
      `https://www.ultimatespecs.com/car-specs/${brand.slug}-models`,
      `https://www.ultimatespecs.com/car-specs/${brand.slug}`,
      `https://www.ultimatespecs.com/car-specs/${brand.slug.toLowerCase()}-models`,
    ];
    
    let modelLinks: string[] = [];
    
    for (const brandUrl of brandUrls) {
      console.log(`  Trying: ${brandUrl}`);
      
      try {
        const response = await page.goto(brandUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        if (response && response.status() === 200) {
          await delay(1500);
          
          // Get all model links
          modelLinks = await page.evaluate((brandSlug: string) => {
            const links: string[] = [];
            const slugVariants = [brandSlug, brandSlug.toLowerCase(), brandSlug.replace('-', '')];
            
            document.querySelectorAll('a[href*="/car-specs/"]').forEach((a) => {
              const href = (a as HTMLAnchorElement).href;
              // Match pattern like /car-specs/BMW/M123/Model-Name
              if (href) {
                for (const sv of slugVariants) {
                  if (href.match(new RegExp(`/car-specs/${sv}/M\\d+/`, 'i'))) {
                    if (!links.includes(href)) links.push(href);
                    break;
                  }
                }
              }
            });
            return links;
          }, brand.slug);
          
          if (modelLinks.length > 0) {
            console.log(`  ✓ Found ${modelLinks.length} model pages`);
            break;
          }
        }
      } catch (err) {
        console.log(`  ✗ Failed: ${(err as Error).message}`);
      }
    }

    if (modelLinks.length === 0) {
      console.log(`  ⚠️  No model links found for ${brand.name}`);
      return allSpecs;
    }

    // Visit each model page
    let processed = 0;
    let errors = 0;
    
    for (const modelUrl of modelLinks) {
      processed++;
      
      if (processed % 10 === 0) {
        process.stdout.write(`\r  [${processed}/${modelLinks.length}] ${allSpecs.length} vehicles found...`);
      }
      
      try {
        await page.goto(modelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(500);

        const pageSpecs = await page.evaluate((brandName: string, pageUrl: string) => {
          const specs: any[] = [];
          
          const parseNum = (str: string | null | undefined): number | null => {
            if (!str) return null;
            const match = str.match(/[\d.,]+/);
            if (!match) return null;
            const num = parseFloat(match[0].replace(',', '.'));
            return isNaN(num) ? null : num;
          };

          // Extract generation from URL
          const urlMatch = pageUrl.match(/\/([^\/]+)$/);
          const genFromUrl = urlMatch ? decodeURIComponent(urlMatch[1]).replace(/[()]/g, ' ').trim() : null;
          
          // Extract model name from page title or h1
          const h1 = document.querySelector('h1')?.textContent?.trim() || '';
          const modelName = h1.replace(brandName, '').trim().split(' ')[0] || 'Unknown';

          // Find all tables with variant specs
          const tables = document.querySelectorAll('table');
          
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 2) return;
              
              const variantLink = row.querySelector('a[href*="/car-specs/"]') as HTMLAnchorElement | null;
              let variantName = variantLink?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
              
              // Skip empty or header rows
              if (!variantName || variantName.length < 3) return;
              if (variantName.toLowerCase().includes('model') && variantName.toLowerCase().includes('name')) return;
              if (variantName.toLowerCase() === 'version' || variantName.toLowerCase() === 'variant') return;

              // Clean variant name
              variantName = variantName.trim();
              if (!variantName.toLowerCase().startsWith(brandName.toLowerCase())) {
                variantName = `${brandName} ${variantName}`;
              }

              const spec: any = {
                brand: brandName,
                model: modelName,
                variant: variantName,
                generation: genFromUrl,
                year_start: null,
                year_end: null,
                body_type: null,
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
                fuel_type: null,
                fuel_consumption_l100km: null,
                co2_gkm: null,
                source_url: variantLink?.href || pageUrl,
                scraped_at: new Date().toISOString(),
              };

              // Extract data from cells
              cells.forEach((cell) => {
                const text = cell.textContent?.trim() || '';
                
                // Year
                const yearMatch = text.match(/\b(19|20)\d{2}\b/);
                if (yearMatch && !spec.year_start) {
                  spec.year_start = parseInt(yearMatch[0]);
                }
                
                // Power
                const hpMatch = text.match(/(\d+)\s*(hp|bhp|ch)/i);
                if (hpMatch) spec.power_hp = parseInt(hpMatch[1]);
                
                const psMatch = text.match(/(\d+)\s*ps/i);
                if (psMatch && !spec.power_hp) spec.power_hp = parseInt(psMatch[1]);
                
                const kwMatch = text.match(/(\d+)\s*kw/i);
                if (kwMatch) spec.power_kw = parseInt(kwMatch[1]);
                
                // Torque
                const nmMatch = text.match(/(\d+)\s*nm/i);
                if (nmMatch) spec.torque_nm = parseInt(nmMatch[1]);
                
                // Displacement
                const ccMatch = text.match(/(\d{3,5})\s*cc/i);
                if (ccMatch) spec.displacement_cc = parseInt(ccMatch[1]);
                
                const literMatch = text.match(/(\d\.\d)\s*(l|liter|litre)/i);
                if (literMatch && !spec.displacement_cc) {
                  spec.displacement_cc = Math.round(parseFloat(literMatch[1]) * 1000);
                }
                
                // Acceleration
                const accelMatch = text.match(/(\d+\.?\d*)\s*s(ec)?/i);
                if (accelMatch && (text.includes('0-100') || text.includes('0-60'))) {
                  spec.acceleration_0_100 = parseFloat(accelMatch[1]);
                }
                
                // Top speed
                const speedMatch = text.match(/(\d{2,3})\s*km\/h/i);
                if (speedMatch && parseInt(speedMatch[1]) > 100) {
                  spec.top_speed_kmh = parseInt(speedMatch[1]);
                }
                
                // Weight
                const weightMatch = text.match(/(\d{3,4})\s*kg/i);
                if (weightMatch && parseInt(weightMatch[1]) > 500) {
                  spec.curb_weight_kg = parseInt(weightMatch[1]);
                }
                
                // Drivetrain
                if (text.match(/\bAWD\b|4WD|xDrive|quattro|4MATIC/i)) {
                  spec.drivetrain = 'AWD';
                } else if (text.match(/\bRWD\b|rear.wheel/i)) {
                  spec.drivetrain = 'RWD';
                } else if (text.match(/\bFWD\b|front.wheel/i)) {
                  spec.drivetrain = 'FWD';
                }
                
                // Fuel type
                if (text.match(/diesel/i)) spec.fuel_type = 'Diesel';
                else if (text.match(/electric|BEV/i)) spec.fuel_type = 'Electric';
                else if (text.match(/hybrid|PHEV/i)) spec.fuel_type = 'Hybrid';
                else if (text.match(/petrol|gasoline/i)) spec.fuel_type = 'Petrol';
                
                // Transmission
                if (text.match(/automatic|auto|DCT|PDK|Tiptronic/i)) {
                  spec.transmission = 'Automatic';
                } else if (text.match(/manual|MT\b/i)) {
                  spec.transmission = 'Manual';
                }
              });

              // Only keep if we got meaningful data
              if (spec.power_hp || spec.displacement_cc || spec.torque_nm) {
                specs.push(spec);
              }
            });
          });

          return specs;
        }, brand.name, modelUrl);

        allSpecs.push(...pageSpecs);
        
      } catch (err) {
        errors++;
      }
      
      // Rate limiting
      if (processed % 50 === 0) {
        await delay(2000);
      }
    }

    console.log(`\n  ✅ Scraped ${allSpecs.length} vehicles (${errors} errors)`);

  } catch (err) {
    console.error(`  ❌ Brand-level error: ${(err as Error).message}`);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
  }

  return allSpecs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FLM AUTO - Scrape Missing Major Brands                   ║');
  console.log('║   BMW, Mercedes-Benz, Lamborghini                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  const summary: { brand: string; count: number }[] = [];
  const startTime = Date.now();

  for (const brand of BRANDS) {
    // Fresh browser for each brand
    let browser: Browser | null = null;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      
      const specs = await scrapeBrand(browser, brand);
      
      const outputFile = path.join(outputDir, `${brand.slug.toLowerCase().replace('-', '_')}.json`);
      
      if (specs.length > 0) {
        fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
        console.log(`  💾 Saved to ${outputFile}`);
      }
      
      summary.push({ brand: brand.name, count: specs.length });
      
    } catch (err) {
      console.error(`  ❌ Error for ${brand.name}: ${(err as Error).message}`);
      summary.push({ brand: brand.name, count: 0 });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {}
      }
    }
    
    // Delay between brands
    await delay(3000);
  }

  // Summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  
  let total = 0;
  for (const s of summary) {
    const status = s.count > 0 ? '✅' : '❌';
    console.log(`  ${status} ${s.brand.padEnd(20)} ${s.count.toString().padStart(5)} vehicles`);
    total += s.count;
  }
  console.log('─'.repeat(60));
  console.log(`     ${'TOTAL'.padEnd(17)} ${total.toString().padStart(5)} vehicles`);
  console.log(`     ${'TIME'.padEnd(17)} ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);

  console.log('\n✅ Done!');
}

main().catch(console.error);
