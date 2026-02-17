import { createClient } from '@supabase/supabase-js';
import { normalizeModelName } from './model-aliases';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function debugScraperMatching() {
  console.log('🔍 SIMULATING SCRAPER MATCHING\n');
  
  // Build lookup EXACTLY like scraper does
  let ourGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    ourGens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  
  const genLookup = new Map<string, string>();
  for (const g of ourGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const brand = m.brand.name.toLowerCase().replace(/-/g, ' ');
    const model = m.name.toLowerCase().replace(/-/g, ' ');
    genLookup.set(`${brand}|${model}`, g.id);
  }
  
  console.log(`Lookup size: ${genLookup.size}\n`);
  
  // Simulate what Auto-Data extracts
  const autoDataModels = [
    ['bmw', 'bmw 3 series g20'],      // URL extracted
    ['bmw', 'bmw 5 series sedan'],
    ['bmw', '3 series'],
    ['bmw', 'x3'],
    ['mercedes benz', 'c class'],
    ['mercedes benz', 'mercedes benz c class w206'],
    ['audi', 'a4'],
    ['audi', 'audi a4 b9'],
    ['volkswagen', 'golf'],
    ['volkswagen', 'vw golf 8'],
  ];
  
  console.log('Auto-Data URL extraction simulation:\n');
  
  for (const [brand, rawModel] of autoDataModels) {
    // How scraper normalizes
    const brandNorm = brand.toLowerCase().replace(/-/g, ' ');
    const normalized = normalizeModelName(
      brand === 'mercedes benz' ? 'Mercedes-Benz' : brand.charAt(0).toUpperCase() + brand.slice(1),
      rawModel
    ).toLowerCase();
    
    const directKey = `${brandNorm}|${normalized}`;
    const found = genLookup.has(directKey);
    
    console.log(`Raw: "${rawModel}"`);
    console.log(`  Normalized: "${normalized}"`);
    console.log(`  Key: "${directKey}" → ${found ? '✅' : '❌'}`);
    
    if (!found) {
      // Try fuzzy
      let fuzzyFound = false;
      for (const [key, id] of genLookup) {
        if (key.startsWith(brandNorm)) {
          const modelPart = key.split('|')[1];
          if (normalized.includes(modelPart) || modelPart.includes(normalized)) {
            console.log(`  Fuzzy: "${key}" → ✅`);
            fuzzyFound = true;
            break;
          }
        }
      }
      if (!fuzzyFound) console.log(`  Fuzzy: ❌`);
    }
    console.log('');
  }
  
  // Show what keys exist for BMW
  console.log('BMW keys in lookup:');
  const bmwKeys = [...genLookup.keys()].filter(k => k.startsWith('bmw')).slice(0, 20);
  console.log(bmwKeys.join('\n'));
}

debugScraperMatching();
