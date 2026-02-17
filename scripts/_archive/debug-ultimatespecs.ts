/**
 * FLM AUTO - Debug UltimateSpecs structure
 * Run with: npx ts-node scripts/debug-ultimatespecs.ts
 */

import puppeteer from 'puppeteer';

async function debug() {
  console.log('Launching browser (visible)...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Go to Audi page
  console.log('Loading Audi page...');
  await page.goto('https://www.ultimatespecs.com/car-specs/Audi', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });

  // Wait a bit for user to see
  await new Promise(r => setTimeout(r, 3000));

  // Get all links and their hrefs
  const links = await page.evaluate(() => {
    const allLinks: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href && a.href.includes('ultimatespecs')) {
        allLinks.push({
          text: a.textContent?.trim().substring(0, 50) || '',
          href: a.href,
        });
      }
    });
    return allLinks;
  });

  console.log(`\nFound ${links.length} links total`);
  console.log('\nSample links:');
  
  // Show different patterns
  const patterns = new Set<string>();
  links.forEach(l => {
    const match = l.href.match(/ultimatespecs\.com\/([^\/]+\/[^\/]+)/);
    if (match) patterns.add(match[1]);
  });

  console.log('\nURL patterns found:');
  Array.from(patterns).slice(0, 20).forEach(p => console.log(`  - ${p}`));

  // Click on first model to see structure
  console.log('\n\nClicking on first model link...');
  
  const modelLink = links.find(l => l.href.includes('/car-specs/Audi/') && l.href !== 'https://www.ultimatespecs.com/car-specs/Audi');
  
  if (modelLink) {
    console.log(`Going to: ${modelLink.href}`);
    await page.goto(modelLink.href, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Get links on this page
    const modelPageLinks = await page.evaluate(() => {
      const allLinks: { text: string; href: string }[] = [];
      document.querySelectorAll('a').forEach(a => {
        if (a.href) {
          allLinks.push({
            text: a.textContent?.trim().substring(0, 80) || '',
            href: a.href,
          });
        }
      });
      return allLinks;
    });

    console.log(`\nLinks on model page: ${modelPageLinks.length}`);
    console.log('\nSample variant/spec links:');
    modelPageLinks
      .filter(l => l.href.includes('spec') || l.href.includes('Audi'))
      .slice(0, 15)
      .forEach(l => console.log(`  [${l.text}] → ${l.href}`));
  }

  console.log('\n\nBrowser will stay open for 30 seconds for inspection...');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
  console.log('Done');
}

debug().catch(console.error);
