/**
 * Debug: Save raw HTML from IMCDB
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/imcdb');

async function main() {
  const url = 'https://www.imcdb.org/vehicles_make-BMW.html';
  
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  
  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${response.headers.get('content-type')}`);
  
  const html = await response.text();
  console.log(`HTML length: ${html.length} chars`);
  
  // Save raw HTML
  const htmlFile = path.join(DATA_DIR, 'debug_bmw_raw.html');
  fs.writeFileSync(htmlFile, html);
  console.log(`Saved to: ${htmlFile}`);
  
  // Show first 2000 chars
  console.log('\n--- First 2000 chars ---');
  console.log(html.substring(0, 2000));
  
  // Check for E46
  if (html.includes('E46')) {
    console.log('\n✓ Found E46 in HTML');
    const idx = html.indexOf('E46');
    console.log('Context:', html.substring(idx - 100, idx + 100));
  } else {
    console.log('\n✗ E46 NOT found in HTML');
  }
  
  // Check for chassis section
  if (html.includes('Chassis')) {
    console.log('✓ Found "Chassis" in HTML');
  }
  if (html.includes('modelMatch')) {
    console.log('✓ Found "modelMatch" in HTML');
  }
}

main().catch(console.error);
