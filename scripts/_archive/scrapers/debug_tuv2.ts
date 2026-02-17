/**
 * Debug TÜV v2 - trouve la vraie structure du tableau
 */

import * as fs from 'fs';

async function debug() {
  const html = fs.readFileSync('../data/raw/tuv/debug_page.html', 'utf-8');
  
  // Chercher la structure autour de "BMW"
  const bmwIdx = html.indexOf('BMW');
  if (bmwIdx > 0) {
    // Remonter pour trouver le <tr> parent
    const beforeBmw = html.substring(Math.max(0, bmwIdx - 1000), bmwIdx + 500);
    console.log('=== CONTEXT AROUND BMW ===\n');
    console.log(beforeBmw);
  }
  
  // Chercher les <td> avec des pourcentages
  const tdRegex = /<td[^>]*>([^<]*\d+[.,]\d*\s*%?[^<]*)<\/td>/g;
  let match;
  let count = 0;
  console.log('\n=== TD WITH NUMBERS ===');
  while ((match = tdRegex.exec(html)) !== null && count < 20) {
    if (match[1].match(/\d/)) {
      console.log(match[1].trim());
      count++;
    }
  }
  
  // Chercher les lignes de tableau complètes
  console.log('\n=== LOOKING FOR TABLE ROWS ===');
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;
  let found = 0;
  while ((trMatch = trRegex.exec(html)) !== null && found < 5) {
    const row = trMatch[1];
    if (row.includes('BMW') || row.includes('Mercedes') || row.includes('Audi')) {
      console.log('\n--- ROW ---');
      console.log(row.substring(0, 800));
      found++;
    }
  }
  
  // Chercher les patterns de tablepress ou wp-table
  console.log('\n=== TABLE CLASSES ===');
  const tableClasses = html.match(/class="[^"]*table[^"]*"/g) || [];
  tableClasses.slice(0, 10).forEach(c => console.log(c));
}

debug().catch(console.error);
