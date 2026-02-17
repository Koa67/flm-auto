/**
 * FLM AUTO - Debug EV-Database structure
 */

import * as fs from 'fs';

async function debug() {
  const url = 'https://ev-database.org/cheatsheet/useable-battery-capacity';
  console.log('🔍 Fetching:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  fs.mkdirSync('../data/raw/ev_database', { recursive: true });
  fs.writeFileSync('../data/raw/ev_database/debug.html', html);
  
  console.log('Length:', html.length);
  console.log('Contains BMW:', (html.match(/BMW/gi) || []).length);
  console.log('Contains Audi:', (html.match(/Audi/gi) || []).length);
  console.log('Contains href:', (html.match(/href="/g) || []).length);
  
  // Find car links
  const linkRegex = /href="(\/[^"]*)"[^>]*>([^<]*(?:BMW|Audi|Mercedes|Volkswagen|VW|Porsche|Skoda)[^<]*)</gi;
  const matches: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    matches.push(`${match[1]} => ${match[2]}`);
  }
  console.log(`\nFound ${matches.length} brand links:`);
  matches.slice(0, 30).forEach(m => console.log('  ', m));
  
  // Try alternative page
  console.log('\n\n🔍 Trying car list page...');
  const listUrl = 'https://ev-database.org/';
  const listResponse = await fetch(listUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const listHtml = await listResponse.text();
  fs.writeFileSync('../data/raw/ev_database/debug_list.html', listHtml);
  
  console.log('List page length:', listHtml.length);
  
  // Look for data-* attributes or JSON
  const dataMatch = listHtml.match(/data-vehicles="([^"]+)"/);
  if (dataMatch) {
    console.log('Found data-vehicles!');
  }
  
  // Look for script with JSON data
  const scriptMatch = listHtml.match(/<script[^>]*>[\s\S]*?(vehicles|cars)[\s\S]*?<\/script>/i);
  if (scriptMatch) {
    console.log('Found script with vehicle data');
  }
}

debug().catch(console.error);
