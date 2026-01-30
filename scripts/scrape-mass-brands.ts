/**
 * FLM AUTO - Mass scrape UltimateSpecs (22 new brands)
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
  displacement_cc: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  source_url: string;
  scraped_at: string;
}

const BRANDS = [
  // German
  { name: 'Opel', slug: 'Opel' },
  { name: 'Mini', slug: 'Mini' },
  // French
  { name: 'Peugeot', slug: 'Peugeot' },
  { name: 'Renault', slug: 'Renault' },
  { name: 'Citroen', slug: 'Citroen' },
  // Italian
  { name: 'Ferrari', slug: 'Ferrari' },
  { name: 'Alfa Romeo', slug: 'Alfa-Romeo' },
  { name: 'Fiat', slug: 'Fiat' },
  { name: 'Maserati', slug: 'Maserati' },
  // Japanese
  { name: 'Toyota', slug: 'Toyota' },
  { name: 'Honda', slug: 'Honda' },
  { name: 'Nissan', slug: 'Nissan' },
  { name: 'Mazda', slug: 'Mazda' },
  { name: 'Lexus', slug: 'Lexus' },
  // American
  { name: 'Ford', slug: 'Ford' },
  { name: 'Chevrolet', slug: 'Chevrolet' },
  { name: 'Tesla', slug: 'Tesla' },
  // British
  { name: 'Jaguar', slug: 'Jaguar' },
  { name: 'Land Rover', slug: 'Land-Rover' },
  { name: 'Aston Martin', slug: 'Aston-Martin' },
  // Korean
  { name: 'Hyundai', slug: 'Hyundai' },
  { name: 'Kia', slug: 'Kia' },
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

    const urlMatch = pageUrl.match(/\/([^\/]+)$/);
    const genFromUrl = urlMatch ? urlMatch[1].replace(/[()]/g, ' ').trim() : null;

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
          variant: `${brandName} ${variantName}`,
          generation: genFromUrl,
          displacement_cc: null,
          power_hp: null,
          power_kw: null,
          torque_nm: null,
          source_url: pageUrl,
          scraped_at: new Date().toISOString(),
        };

        cells.forEach((cell) => {
          const text = cell.textContent?.trim() || '';
          if (text.match(/\d+\s*hp/i)) spec.power_hp = parseNum(text);
          if (text.match(/\d+\s*kw/i)) spec.power_kw = parseNum(text);
          if (text.match(/\d+\s*nm/i)) spec.torque_nm = parseNum(text);
          if (text.match(/\d+\s*cc/i)) spec.displacement_cc = parseNum(text);
          if (text.match(/\d{3,4}/) && !spec.displacement_cc && parseNum(text)! > 500 && parseNum(text)! < 9000) {
            spec.displacement_cc = parseNum(text);
          }
        });

        if (spec.power_hp || spec.displacement_cc || spec.torque_nm) {
          specs.push(spec);
        }
      });
    });

    return specs;
  }, brand, url);
}

async function scrapeBrand(browser: Browser, brand: { name: string; slug: string }): Promise<VehicleSpec[]> {
  const allSpecs: VehicleSpec[] = [];
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  try {
    const brandUrl = `https://www.ultimatespecs.com/car-specs/${brand.slug}`;
    
    await page.goto(brandUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1500);

    // Get model page links
    const modelLinks = await page.evaluate((brandSlug: string) => {
      const links: string[] = [];
      document.querySelectorAll('a').forEach((a) => {
        const href = a.href;
        if (href && href.match(new RegExp(`/car-specs/${brandSlug}/M\\d+/`, 'i'))) {
          if (!links.includes(href)) links.push(href);
        }
      });
      return links;
    }, brand.slug);

    process.stdout.write(` (${modelLinks.length} models)`);

    // Scrape each model page (limit to 100 for speed)
    for (const modelUrl of modelLinks.slice(0, 100)) {
      try {
        await page.goto(modelUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(400);
        const pageSpecs = await extractSpecsFromPage(page, brand.name, modelUrl);
        allSpecs.push(...pageSpecs);
      } catch (err) {}
    }

  } catch (err) {
    console.log(` ❌ Error`);
  } finally {
    await page.close();
  }

  return allSpecs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Mass Scraper (22 Brands)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const summary: { brand: string; count: number }[] = [];

  try {
    for (let i = 0; i < BRANDS.length; i++) {
      const brand = BRANDS[i];
      process.stdout.write(`[${i + 1}/${BRANDS.length}] ${brand.name.padEnd(15)}`);
      
      const specs = await scrapeBrand(browser, brand);
      
      const outputFile = path.join(outputDir, `${brand.slug.toLowerCase()}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(specs, null, 2));
      
      console.log(` → ${specs.length} vehicles ✅`);
      summary.push({ brand: brand.name, count: specs.length });
      
      await delay(2000);
    }

  } finally {
    await browser.close();
  }

  // Summary
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

  console.log('\n✅ Done!');
}

main().catch(console.error);
