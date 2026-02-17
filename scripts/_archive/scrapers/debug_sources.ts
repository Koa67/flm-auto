/**
 * FLM AUTO - Debug alternative sources
 */

import * as fs from 'fs';

async function testSource(name: string, url: string) {
  console.log(`\n🔍 Testing ${name}: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    console.log(`  Status: ${response.status}`);
    const html = await response.text();
    console.log(`  Length: ${html.length}`);
    console.log(`  Contains BMW: ${(html.match(/BMW/gi) || []).length} times`);
    console.log(`  Contains table: ${html.includes('<table')}`);
    
    // Save for analysis
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(`../data/raw/debug_${safeName}.html`, html);
    
    return html.length > 10000;
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  fs.mkdirSync('../data/raw', { recursive: true });
  
  const sources = [
    ['Car Specs', 'https://www.carspecs.us/cars'],
    ['Ultimate Specs', 'https://www.ultimatespecs.com/car-specs/BMW-specs'],
    ['Car Folio', 'https://www.carfolio.com/specifications/models/?man=100'],
    ['Auto ABC', 'https://www.auto-abc.eu/BMW/specs'],
  ];
  
  for (const [name, url] of sources) {
    await testSource(name, url);
  }
}

main().catch(console.error);
