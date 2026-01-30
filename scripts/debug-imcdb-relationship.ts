/**
 * Debug: Get vehicle-movie relationship from IMCDb
 */

import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  const url = 'https://www.imcdb.org/vehicles.php?make=Ferrari&model=';
  console.log(`Fetching: ${url}\n`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Get parent containers that have both vehicle and movie info
  const entries = await page.evaluate(() => {
    const results: any[] = [];
    
    // Try to find thumbnail containers
    const thumbs = document.querySelectorAll('a[href*="vehicle_"]');
    
    thumbs.forEach((vehicleLink, idx) => {
      if (idx >= 10) return; // Just first 10
      
      const href = (vehicleLink as HTMLAnchorElement).getAttribute('href') || '';
      const parent = vehicleLink.parentElement;
      const grandparent = parent?.parentElement;
      const greatGrandparent = grandparent?.parentElement;
      
      // Look for movie link in nearby elements
      let movieHref = 'NOT FOUND';
      let movieText = '';
      
      // Check parent hierarchy
      [parent, grandparent, greatGrandparent].forEach(el => {
        if (!el) return;
        const ml = el.querySelector('a[href*="movie"]') as HTMLAnchorElement | null;
        if (ml && movieHref === 'NOT FOUND') {
          movieHref = ml.getAttribute('href') || '';
          movieText = ml.textContent?.trim() || '';
        }
      });
      
      // Get surrounding HTML
      const containerHTML = greatGrandparent?.innerHTML?.substring(0, 500) || 
                           grandparent?.innerHTML?.substring(0, 500) || 
                           parent?.innerHTML?.substring(0, 500) || '';
      
      results.push({
        vehicleHref: href,
        movieHref,
        movieText,
        parentTag: parent?.tagName,
        grandparentTag: grandparent?.tagName,
        greatGrandparentTag: greatGrandparent?.tagName,
        sampleHTML: containerHTML.substring(0, 300),
      });
    });
    
    return results;
  });
  
  console.log('=== VEHICLE-MOVIE RELATIONSHIPS ===\n');
  entries.forEach((e, i) => {
    console.log(`[${i + 1}] Vehicle: ${e.vehicleHref}`);
    console.log(`    Movie: ${e.movieText || 'NONE'} (${e.movieHref})`);
    console.log(`    Structure: ${e.greatGrandparentTag} > ${e.grandparentTag} > ${e.parentTag}`);
    console.log(`    HTML sample: ${e.sampleHTML.substring(0, 150)}...`);
    console.log('');
  });
  
  await browser.close();
}

main().catch(console.error);
