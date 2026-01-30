/**
 * Debug: Dump IMCDb HTML structure
 */

import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('Fetching IMCDb Ferrari page...');
  await page.goto('https://www.imcdb.org/vehicles.php?make=Ferrari', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  // Get page HTML
  const html = await page.content();
  
  // Save to file
  require('fs').writeFileSync('/tmp/imcdb-debug.html', html);
  console.log('Saved to /tmp/imcdb-debug.html');
  
  // Print sample
  console.log('\n--- First 3000 chars ---\n');
  console.log(html.substring(0, 3000));
  
  // Find vehicle entries
  const vehicles = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.href;
      const text = a.textContent?.trim() || '';
      if (href.includes('vehicle') || href.includes('movie')) {
        results.push(`${text} -> ${href}`);
      }
    });
    return results.slice(0, 30);
  });
  
  console.log('\n--- Vehicle/Movie links found ---\n');
  vehicles.forEach(v => console.log(v));
  
  await browser.close();
}

main().catch(console.error);
