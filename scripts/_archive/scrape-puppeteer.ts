/**
 * FLM AUTO - Scrape UltimateSpecs with Puppeteer (headless browser)
 * Bypasses anti-bot protection
 * 
 * Usage: npx ts-node scripts/scrape-puppeteer.ts
 */

import puppeteer, { Browser } from 'puppeteer';
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

async function scrapeBrand(browser: Browser, brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Scraping ${brand.name}...`);
  console.log('═'.repeat(60));

  const specs: VehicleSpec[] = [];
  const page = await browser.newPage();
  
  // Set realistic viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Go to brand page
    const brandUrl = `https://www.ultimatespecs.com/car-specs/${brand.slug}`;
    console.log(`   Loading: ${brandUrl}`);
    
    await page.goto(brandUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Get all model links
    const modelLinks = await page.evaluate(() => {
      const links: string[] = [];
      document.querySelectorAll('a[href*="/car-specs/"]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href && !links.includes(href) && href.includes('/car-specs/')) {
          links.push(href);
        }
      });
      return links;
    });

    console.log(`   Found ${modelLinks.length} model links`);

    // Process each model page to get variant links
    const variantLinks: string[] = [];
    
    for (const modelLink of modelLinks.slice(0, 50)) { // Limit models
      try {
        await page.goto(modelLink, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(1000);

        const pageVariants = await page.evaluate(() => {
          const links: string[] = [];
          // Look for spec page links
          document.querySelectorAll('a[href*="-specs-"]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            if (href && !links.includes(href)) {
              links.push(href);
            }
          });
          // Also try other patterns
          document.querySelectorAll('a[href*="/specs/"]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            if (href && !links.includes(href) && href.includes('specs')) {
              links.push(href);
            }
          });
          return links;
        });

        variantLinks.push(...pageVariants);
        process.stdout.write(`\r   Collecting variant links: ${variantLinks.length}`);
      } catch (err) {
        // Skip errors
      }
    }

    console.log(`\n   Total variant links: ${variantLinks.length}`);

    // Dedupe
    const uniqueVariants = [...new Set(variantLinks)];
    console.log(`   Unique variants: ${uniqueVariants.length}`);

    // Scrape each variant
    let processed = 0;
    
    for (const variantUrl of uniqueVariants.slice(0, 300)) { // Limit variants
      processed++;
      process.stdout.write(`\r   [${processed}/${Math.min(uniqueVariants.length, 300)}] Scraping specs...`);

      try {
        await page.goto(variantUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(800);

        const spec = await page.evaluate((brandName: string, url: string) => {
          const getText = (selector: string): string | null => {
            const el = document.querySelector(selector);
            return el ? el.textContent?.trim() || null : null;
          };

          const getSpecValue = (label: string): string | null => {
            // Try table rows
            const rows = document.querySelectorAll('tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td, th');
              for (let i = 0; i < cells.length - 1; i++) {
                if (cells[i].textContent?.toLowerCase().includes(label.toLowerCase())) {
                  return cells[i + 1].textContent?.trim() || null;
                }
              }
            }
            // Try definition lists
            const dts = document.querySelectorAll('dt');
            for (const dt of dts) {
              if (dt.textContent?.toLowerCase().includes(label.toLowerCase())) {
                const dd = dt.nextElementSibling;
                if (dd && dd.tagName === 'DD') {
                  return dd.textContent?.trim() || null;
                }
              }
            }
            return null;
          };

          const parseNum = (str: string | null): number | null => {
            if (!str) return null;
            const match = str.match(/[\d.,]+/);
            if (!match) return null;
            const num = parseFloat(match[0].replace(',', '.'));
            return isNaN(num) ? null : num;
          };

          // Get title
          const title = document.querySelector('h1')?.textContent?.trim() || 'Unknown';
          
          // Extract model from title
          const modelMatch = title.match(new RegExp(`${brandName}\\s+([A-Za-z0-9]+)`, 'i'));
          const model = modelMatch ? modelMatch[1] : title.split(' ')[1] || 'Unknown';

          // Extract generation code
          let generation: string | null = null;
          const genPatterns = [
            /\b([A-Z]\d{1,2})\b/, // Audi B8, C7
            /\b(Typ\s*\d+[A-Z]?)\b/i,
            /\b(9\d{2}|9\d{2}\.\d)\b/, // Porsche 911, 964
            /\b(Mk\s*[IVX\d]+)\b/i,
          ];
          for (const p of genPatterns) {
            const m = title.match(p);
            if (m) { generation = m[1]; break; }
          }

          // Extract year
          const yearMatch = title.match(/\b(19|20)\d{2}\b/);

          return {
            brand: brandName,
            model,
            variant: title,
            generation,
            year_start: yearMatch ? parseInt(yearMatch[0]) : null,
            year_end: null,
            engine_type: getSpecValue('fuel') || getSpecValue('engine type'),
            displacement_cc: parseNum(getSpecValue('displacement') || getSpecValue('engine size') || getSpecValue('capacity')),
            cylinders: parseNum(getSpecValue('cylinder')),
            power_hp: parseNum(getSpecValue('power') || getSpecValue('horsepower') || getSpecValue('hp')),
            power_kw: parseNum(getSpecValue('kw')),
            torque_nm: parseNum(getSpecValue('torque')),
            acceleration_0_100: parseNum(getSpecValue('0-100') || getSpecValue('0 to 100') || getSpecValue('acceleration')),
            top_speed_kmh: parseNum(getSpecValue('top speed') || getSpecValue('max speed')),
            length_mm: parseNum(getSpecValue('length')),
            width_mm: parseNum(getSpecValue('width')),
            height_mm: parseNum(getSpecValue('height')),
            wheelbase_mm: parseNum(getSpecValue('wheelbase')),
            trunk_volume_l: parseNum(getSpecValue('trunk') || getSpecValue('boot') || getSpecValue('cargo') || getSpecValue('luggage')),
            curb_weight_kg: parseNum(getSpecValue('weight') || getSpecValue('curb weight') || getSpecValue('kerb')),
            drivetrain: getSpecValue('drive') || getSpecValue('drivetrain') || getSpecValue('driven wheels'),
            transmission: getSpecValue('transmission') || getSpecValue('gearbox'),
            fuel_consumption_l100km: parseNum(getSpecValue('consumption') || getSpecValue('combined')),
            co2_gkm: parseNum(getSpecValue('co2') || getSpecValue('emission')),
            source_url: url,
            scraped_at: new Date().toISOString(),
          };
        }, brand.name, variantUrl);

        // Only keep if we have meaningful data
        if (spec && (spec.power_hp || spec.displacement_cc || spec.length_mm)) {
          specs.push(spec as VehicleSpec);
        }

      } catch (err) {
        // Skip errors, continue
      }
    }

    console.log(`\n   ✅ Found ${specs.length} vehicles for ${brand.name}`);

  } catch (err) {
    console.error(`   ❌ Error: ${err}`);
  } finally {
    await page.close();
  }

  return specs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - UltimateSpecs Puppeteer Scraper             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true, // Set to false to see the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const brand of BRANDS) {
      const specs = await scrapeBrand(browser, brand);
      
      // Save
      const outputFile = path.join(outputDir, `${brand.slug.toLowerCase()}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
      console.log(`   💾 Saved to ${outputFile}`);
      
      await delay(3000); // Pause between brands
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
