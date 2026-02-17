/**
 * Debug Skoda structure
 */

import * as fs from 'fs';

const html = fs.readFileSync('../data/raw/ev_database/debug_list.html', 'utf-8');

// Find Skoda entries
const skodaIdx = html.indexOf('Skoda Enyaq');
if (skodaIdx > 0) {
  console.log('=== SKODA ENYAQ CONTEXT ===\n');
  console.log(html.substring(skodaIdx - 500, skodaIdx + 1000));
}

// Check for škoda with accent
const skodaAccent = html.indexOf('Škoda');
console.log('\n\nŠkoda with accent found:', skodaAccent > 0);

// Check all Skoda mentions
const skodaMatches = html.match(/[ŠS]koda[^<]{0,50}/gi) || [];
console.log('\nSkoda matches:', skodaMatches.length);
skodaMatches.slice(0, 10).forEach(m => console.log('  ', m));
