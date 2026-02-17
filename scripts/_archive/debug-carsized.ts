/**
 * Debug: Analyze CarSized page structure
 */

import puppeteer from 'puppeteer';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  // Search for BMW 3 Series
  const searchUrl = 'https://www.carsized.com/en/cars/?q=BMW+3+Series';
  console.log(`Fetching: ${searchUrl}\n`);
  
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);
  
  // Get search results
  const searchResults = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.href;
      const text = a.textContent?.trim().substring(0, 60) || '';
      if (href.includes('/en/cars/') && text) {
        results.push(`${text} -> ${href}`);
      }
    });
    return results.slice(0, 10);
  });
  
  console.log('=== SEARCH RESULTS ===');
  searchResults.forEach(r => console.log(r));
  
  // Click first result if exists
  const firstCarUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/en/cars/"][href*="bmw"]') as HTMLAnchorElement;
    return link?.href || null;
  });
  
  if (firstCarUrl) {
    console.log(`\nGoing to: ${firstCarUrl}\n`);
    await page.goto(firstCarUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Analyze the car page
    const analysis = await page.evaluate(() => {
      const data: any = {
        title: document.querySelector('h1')?.textContent?.trim(),
        allText: document.body.innerText.substring(0, 3000),
        specs: [] as string[],
        dimensions: [] as any[],
      };
      
      // Look for specs in various formats
      document.querySelectorAll('table tr, .spec, [class*="dimension"], [class*="spec"], dl dt, dl dd').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 100) {
          data.specs.push(text);
        }
      });
      
      // Look for dimension values (numbers with mm, cm, L, kg, etc.)
      const text = document.body.innerText;
      const dimMatches = text.match(/\d[\d,\.]*\s*(mm|cm|m|L|kg|lb|inch|ft|hp|kW|Nm)/gi);
      if (dimMatches) {
        data.dimensions = dimMatches.slice(0, 30);
      }
      
      return data;
    });
    
    console.log('=== CAR PAGE ANALYSIS ===');
    console.log(`Title: ${analysis.title}`);
    console.log(`\nDimension values found: ${analysis.dimensions.length}`);
    analysis.dimensions.forEach((d: string) => console.log(`  ${d}`));
    console.log(`\nSpecs elements: ${analysis.specs.length}`);
    analysis.specs.slice(0, 20).forEach((s: string) => console.log(`  ${s}`));
    console.log(`\nPage text sample:\n${analysis.allText.substring(0, 1000)}`);
  }
  
  await browser.close();
}

main().catch(console.error);
