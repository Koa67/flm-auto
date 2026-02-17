/**
 * Debug: Save raw HTML from IMCDB vehicle list page
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/imcdb');

async function main() {
  const url = 'https://www.imcdb.org/vehicles.php?make=BMW&model=E46&modelMatch=2&modelInclChassis=on';
  
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  
  console.log(`Status: ${response.status}`);
  
  const html = await response.text();
  console.log(`HTML length: ${html.length} chars`);
  
  // Save raw HTML
  const htmlFile = path.join(DATA_DIR, 'debug_e46_list.html');
  fs.writeFileSync(htmlFile, html);
  console.log(`Saved to: ${htmlFile}`);
  
  // Look for vehicle patterns
  console.log('\n--- Searching for patterns ---');
  
  // Check for vehicle links
  const vehicleLinks = html.match(/\/vehicle_\d+/g) || [];
  console.log(`Vehicle links found: ${vehicleLinks.length}`);
  if (vehicleLinks.length > 0) {
    console.log('Sample:', vehicleLinks.slice(0, 5));
  }
  
  // Check for movie links
  const movieLinks = html.match(/\/movie_\d+/g) || [];
  console.log(`Movie links found: ${movieLinks.length}`);
  if (movieLinks.length > 0) {
    console.log('Sample:', movieLinks.slice(0, 5));
  }
  
  // Find a specific vehicle entry
  const vehicleMatch = html.match(/<a[^>]+href="(\/vehicle_\d+[^"]*)"[^>]*>([^<]+)<\/a>/i);
  if (vehicleMatch) {
    console.log('\nFirst vehicle match:');
    console.log('  URL:', vehicleMatch[1]);
    console.log('  Text:', vehicleMatch[2]);
    
    // Get context around it
    const idx = html.indexOf(vehicleMatch[0]);
    console.log('\nContext (500 chars):');
    console.log(html.substring(idx - 50, idx + 450));
  }
  
  // Show a chunk of HTML where vehicles should be
  const mainContent = html.indexOf('class="main"');
  if (mainContent > 0) {
    console.log('\n--- Main content area (first 2000 chars) ---');
    console.log(html.substring(mainContent, mainContent + 2000));
  }
}

main().catch(console.error);
