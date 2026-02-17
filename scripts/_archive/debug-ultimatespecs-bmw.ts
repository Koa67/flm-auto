/**
 * FLM AUTO - Debug UltimateSpecs Structure
 * Check what the page actually returns
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🔍 Debugging UltimateSpecs structure...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Test BMW models page
  const testUrl = 'https://www.ultimatespecs.com/car-specs/BMW-models';
  console.log(`Loading: ${testUrl}\n`);
  
  await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  // Save screenshot
  await page.screenshot({ path: 'data/debug-bmw-page.png', fullPage: true });
  console.log('📸 Screenshot saved to data/debug-bmw-page.png');

  // Save HTML
  const html = await page.content();
  fs.writeFileSync('data/debug-bmw-page.html', html);
  console.log('📄 HTML saved to data/debug-bmw-page.html');

  // Get all links
  const links = await page.evaluate(() => {
    const allLinks: { href: string; text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href.includes('/car-specs/')) {
        allLinks.push({ href: a.href, text: a.textContent?.trim() || '' });
      }
    });
    return allLinks;
  });

  console.log(`\n🔗 Found ${links.length} links containing /car-specs/:\n`);
  links.slice(0, 20).forEach(l => {
    console.log(`  ${l.text.substring(0, 40).padEnd(40)} → ${l.href}`);
  });

  // Now visit first model page
  const modelLinks = links.filter(l => l.href.match(/\/M\d+\//));
  console.log(`\n📁 Found ${modelLinks.length} model pages (M###)\n`);

  if (modelLinks.length > 0) {
    const firstModel = modelLinks[0];
    console.log(`Visiting first model: ${firstModel.href}\n`);
    
    await page.goto(firstModel.href, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Save screenshot
    await page.screenshot({ path: 'data/debug-bmw-model.png', fullPage: true });
    console.log('📸 Screenshot saved to data/debug-bmw-model.png');

    // Save HTML
    const modelHtml = await page.content();
    fs.writeFileSync('data/debug-bmw-model.html', modelHtml);
    console.log('📄 HTML saved to data/debug-bmw-model.html');

    // Analyze tables
    const tables = await page.evaluate(() => {
      const results: { rows: number; cells: number; sample: string[] }[] = [];
      document.querySelectorAll('table').forEach((table, i) => {
        const rows = table.querySelectorAll('tr');
        const firstRowCells = rows[0]?.querySelectorAll('td, th');
        const sample: string[] = [];
        firstRowCells?.forEach(c => sample.push(c.textContent?.trim() || ''));
        results.push({
          rows: rows.length,
          cells: firstRowCells?.length || 0,
          sample: sample.slice(0, 5),
        });
      });
      return results;
    });

    console.log(`\n📊 Found ${tables.length} tables:\n`);
    tables.forEach((t, i) => {
      console.log(`  Table ${i + 1}: ${t.rows} rows, ${t.cells} cells`);
      console.log(`    Sample: ${t.sample.join(' | ')}`);
    });

    // Look for variant links specifically
    const variantLinks = await page.evaluate(() => {
      const variants: { href: string; text: string }[] = [];
      document.querySelectorAll('a[href*="/car-specs/"]').forEach(a => {
        const href = (a as HTMLAnchorElement).href;
        const text = a.textContent?.trim() || '';
        // Look for specific variant pages (usually have .html or longer paths)
        if (href.includes('.html') || href.match(/\/\d+\//)) {
          variants.push({ href, text });
        }
      });
      return variants;
    });

    console.log(`\n🚗 Found ${variantLinks.length} potential variant links:\n`);
    variantLinks.slice(0, 15).forEach(v => {
      console.log(`  ${v.text.substring(0, 50).padEnd(50)} → ${v.href.substring(0, 60)}`);
    });
  }

  console.log('\n⏳ Browser will stay open for 30 seconds for manual inspection...');
  await delay(30000);

  await browser.close();
  console.log('\n✅ Debug complete. Check the saved files.');
}

main().catch(console.error);
