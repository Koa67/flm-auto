/**
 * Check what brand classes exist in HTML
 */

import * as fs from 'fs';

const html = fs.readFileSync('../data/raw/ev_database/debug_list.html', 'utf-8');

// Find all span class patterns that look like brands
const brandSpans = html.match(/<span class="[a-z_-]+">[A-Z][a-z]+/g) || [];
const unique = [...new Set(brandSpans)];

console.log('Brand span patterns found:');
unique.filter(s => !s.includes('model') && !s.includes('hidden')).forEach(s => console.log('  ', s));

// Specifically look for Mercedes and Skoda
console.log('\n\nMercedes patterns:');
const mercMatches = html.match(/<span class="[^"]*">[^<]*Mercedes[^<]*/gi) || [];
mercMatches.slice(0, 5).forEach(m => console.log('  ', m));

console.log('\nSkoda patterns:');
const skodaMatches = html.match(/<span class="[^"]*">[^<]*Skoda[^<]*/gi) || [];
skodaMatches.slice(0, 5).forEach(m => console.log('  ', m));

// Also check for cupra, etc.
console.log('\n\nAll brand-like classes:');
const allBrandClasses = html.match(/class="([\w-]+)">\s*[A-Z][a-z]+(?:-[A-Z][a-z]+)?\s*<\/span>/g) || [];
const uniqueClasses = [...new Set(allBrandClasses)];
uniqueClasses.slice(0, 30).forEach(c => console.log('  ', c));
