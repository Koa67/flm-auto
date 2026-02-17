/**
 * Debug: Dump FULL IMCDb page structure
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  // Try the "all vehicles" URL for Ferrari
  const url = 'https://www.imcdb.org/vehicles.php?make=Ferrari&model=';
  console.log(`Fetching: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Save full HTML
  const html = await page.content();
  fs.writeFileSync('/tmp/imcdb-full.html', html);
  console.log(`Saved ${html.length} bytes to /tmp/imcdb-full.html`);
  
  // Analyze structure
  const analysis = await page.evaluate(() => {
    const results: any = {
      tables: 0,
      tableRows: 0,
      allLinks: [] as string[],
      vehicleLinks: [] as string[],
      movieLinks: [] as string[],
      divClasses: [] as string[],
      imgCount: 0,
    };
    
    results.tables = document.querySelectorAll('table').length;
    results.tableRows = document.querySelectorAll('tr').length;
    results.imgCount = document.querySelectorAll('img').length;
    
    // Get all links
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent?.trim().substring(0, 50) || '';
      if (href.includes('vehicle_')) {
        results.vehicleLinks.push(`${text} -> ${href}`);
      }
      if (href.includes('movie') && !href.includes('vehicles')) {
        results.movieLinks.push(`${text} -> ${href}`);
      }
    });
    
    // Get div classes
    document.querySelectorAll('div[class]').forEach(div => {
      const cls = div.className;
      if (cls && !results.divClasses.includes(cls)) {
        results.divClasses.push(cls);
      }
    });
    
    // Sample of body HTML structure
    const body = document.body.innerHTML;
    results.bodySample = body.substring(0, 5000);
    
    return results;
  });
  
  console.log('\n=== PAGE ANALYSIS ===');
  console.log(`Tables: ${analysis.tables}`);
  console.log(`Table rows: ${analysis.tableRows}`);
  console.log(`Images: ${analysis.imgCount}`);
  console.log(`\nVehicle links (${analysis.vehicleLinks.length}):`);
  analysis.vehicleLinks.slice(0, 20).forEach((l: string) => console.log(`  ${l}`));
  console.log(`\nMovie links (${analysis.movieLinks.length}):`);
  analysis.movieLinks.slice(0, 20).forEach((l: string) => console.log(`  ${l}`));
  console.log(`\nDiv classes: ${analysis.divClasses.slice(0, 20).join(', ')}`);
  
  await browser.close();
}

main().catch(console.error);
