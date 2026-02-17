/**
 * Debug un seul list-item pour voir sa structure
 */

import * as fs from 'fs';

const html = fs.readFileSync('../data/raw/ev_database/debug_list.html', 'utf-8');

// Trouver un item BMW
const bmwIndex = html.indexOf('BMW iX3');
if (bmwIndex > 0) {
  // Remonter pour trouver le début du list-item
  const before = html.substring(Math.max(0, bmwIndex - 2000), bmwIndex);
  const listItemStart = before.lastIndexOf('list-item');
  
  // Extraire le bloc complet
  const start = bmwIndex - (before.length - listItemStart) - 10;
  const block = html.substring(start, bmwIndex + 2000);
  
  console.log('=== BMW iX3 BLOCK ===\n');
  console.log(block);
  console.log('\n=== END ===');
}

// Aussi regarder la structure générale
console.log('\n\n=== FIRST LIST-ITEM STRUCTURE ===\n');
const firstItem = html.indexOf('class="list-item"');
if (firstItem > 0) {
  console.log(html.substring(firstItem, firstItem + 3000));
}
