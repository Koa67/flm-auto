/**
 * FLM AUTO - Scrape UltimateSpecs v2 (corrected structure)
 * Specs are on model pages, not separate variant pages
 * 
 * Usage: npx ts-node scripts/scrape-ultimatespecs-v2.ts
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

const BRANDS = [
  { name: 'Audi', slug: 'Audi' },
  { name: 'Porsche', slug: 'Porsche' },
  { name: 'Volkswagen', slug: 'Volkswagen' },
];

async function extractSpecsFromPage(page: Page, brand: string, url: string): Promise<VehicleSpec[]> {
  return await page.evaluate((brandName: string, pageUrl: string) => {
    const specs: any[] = [];
    
    const parseNum = (str: string | null | undefined): number | null => {
      if (!str) return null;
      const match = str.match(/[\d.,]+/);
      if (!match) return null;
      const num = parseFloat(match[0].replace(',', '.'));
      return isNaN(num) ? null : num;
    };

    // Get page title for model/generation info
    const pageTitle = document.querySelector('h1')?.textContent?.trim() || '';
    
    // Extract generation from URL or title (e.g., "A2-(8Z)" or "M611")
    const urlMatch = pageUrl.match(/\/([^\/]+)$/);
    const genFromUrl = urlMatch ? urlMatch[1].replace(/[()]/g, ' ').trim() : null;

    // Find all variant tables/rows on the page
    // UltimateSpecs usually has tables with variant specs
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        
        // Try to extract variant name from first cell or link
        const variantLink = row.querySelector('a');
        const variantName = variantLink?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
        
        if (!variantName || variantName.length < 3) return;
        
        // Skip header rows
        if (variantName.toLowerCase().includes('model') && variantName.toLowerCase().includes('name')) return;

        // Extract specs from cells - common patterns
        const getText = (index: number): string | null => {
          return cells[index]?.textContent?.trim() || null;
        };

        // Try to identify column meanings by header row
        const headerRow = table.querySelector('tr:first-child, thead tr');
        const headers: string[] = [];
        headerRow?.querySelectorAll('th, td').forEach(h => {
          headers.push(h.textContent?.trim().toLowerCase() || '');
        });

        // Build spec object
        const spec: any = {
          brand: brandName,
          model: pageTitle.split(' ')[0] || brandName,
          variant: `${brandName} ${variantName}`,
          generation: genFromUrl,
          year_start: parseNum(variantName.match(/\b(19|20)\d{2}\b/)?.[0]),
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
          source_url: pageUrl,
          scraped_at: new Date().toISOString(),
        };

        // Map cells to specs based on headers or position
        cells.forEach((cell, i) => {
          const text = cell.textContent?.trim() || '';
          const header = headers[i] || '';
          
          if (header.includes('power') || header.includes('hp') || header.includes('ps')) {
            spec.power_hp = parseNum(text);
          } else if (header.includes('torque') || header.includes('nm')) {
            spec.torque_nm = parseNum(text);
          } else if (header.includes('0-100') || header.includes('acceleration')) {
            spec.acceleration_0_100 = parseNum(text);
          } else if (header.includes('top speed') || header.includes('vmax')) {
            spec.top_speed_kmh = parseNum(text);
          } else if (header.includes('displacement') || header.includes('cc') || header.includes('engine')) {
            spec.displacement_cc = parseNum(text);
          } else if (header.includes('weight') || header.includes('kg')) {
            spec.curb_weight_kg = parseNum(text);
          }
          
          // Also try to extract from text patterns
          if (text.match(/\d+\s*hp/i)) spec.power_hp = parseNum(text);
          if (text.match(/\d+\s*kw/i)) spec.power_kw = parseNum(text);
          if (text.match(/\d+\s*nm/i)) spec.torque_nm = parseNum(text);
          if (text.match(/\d+\s*km\/h/i)) spec.top_speed_kmh = parseNum(text);
          if (text.match(/\d+\s*cc/i)) spec.displacement_cc = parseNum(text);
        });

        // Only keep if we got meaningful data
        if (spec.power_hp || spec.displacement_cc || spec.torque_nm) {
          specs.push(spec);
        }
      });
    });

    // Also try to get specs from definition lists or other structures
    const specDivs = document.querySelectorAll('.spec, .specification, [class*="spec"]');
    specDivs.forEach(div => {
      // Similar extraction logic...
    });

    return specs;
  }, brand, url);
}

async function scrapeBrand(browser: Browser, brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Scraping ${brand.name}...`);
  console.log('═'.repeat(60));

  const allSpecs: VehicleSpec[] = [];
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  try {
    // Go to brand page
    const brandUrl = `https://www.ultimatespecs.com/car-specs/${brand.slug}`;
    console.log(`   Loading: ${brandUrl}`);
    
    await page.goto(brandUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Get all model page links (format: /car-specs/Brand/M###/Model-Name)
    const modelLinks = await page.evaluate((brandSlug: string) => {
      const links: string[] = [];
      document.querySelectorAll('a').forEach((a) => {
        const href = a.href;
        // Match pattern like /car-specs/Audi/M611/A2-(8Z)
        if (href && href.match(new RegExp(`/car-specs/${brandSlug}/M\\d+/`, 'i'))) {
          if (!links.includes(href)) {
            links.push(href);
          }
        }
      });
      return links;
    }, brand.slug);

    console.log(`   Found ${modelLinks.length} model pages`);

    // Scrape each model page
    let processed = 0;
    
    for (const modelUrl of modelLinks.slice(0, 150)) { // Limit for testing
      processed++;
      process.stdout.write(`\r   [${processed}/${Math.min(modelLinks.length, 150)}] Scraping...`);

      try {
        await page.goto(modelUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(500);

        // Extract all specs from this page
        const pageSpecs = await extractSpecsFromPage(page, brand.name, modelUrl);
        allSpecs.push(...pageSpecs);

      } catch (err) {
        // Continue on error
      }
    }

    console.log(`\n   ✅ Found ${allSpecs.length} vehicles for ${brand.name}`);

  } catch (err) {
    console.error(`   ❌ Error: ${err}`);
  } finally {
    await page.close();
  }

  return allSpecs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - UltimateSpecs Scraper v2                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const brand of BRANDS) {
      const specs = await scrapeBrand(browser, brand);
      
      const outputFile = path.join(outputDir, `${brand.slug.toLowerCase()}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
      console.log(`   💾 Saved to ${outputFile}`);
      
      await delay(3000);
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    
    let total = 0;
    for (const brand of BRANDS) {
      const file = path.join(outputDir, `${brand.slug.toLowerCase()}.json`);
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        console.log(`   ${brand.name}: ${data.length} vehicles`);
        total += data.length;
      }
    }
    console.log(`   TOTAL: ${total} vehicles`);

  } finally {
    await browser.close();
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
