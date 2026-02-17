/**
 * DEBUG: See exactly what the scraper extracts vs what's in the lookup
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeModelName } from './model-aliases';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

(async () => {
  // Get all generations
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

  // Build lookup like scrapers do (new multi-gen version)
  const genLookup = new Map<string, {id: string, name: string}[]>();
  for (const g of ourGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const brand = m.brand.name.toLowerCase().replace(/-/g, ' ');
    const model = m.name.toLowerCase().replace(/-/g, ' ');
    const key = `${brand}|${model}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ id: g.id, name: g.name.toLowerCase() });
  }

  console.log('Lookup keys:', genLookup.size);
  console.log('\n=== BMW keys ===');
  for (const [key, gens] of genLookup) {
    if (key.startsWith('bmw|')) {
      console.log(`  ${key} → ${gens.length} gens: ${gens.map(g => g.name).join(', ')}`);
    }
  }

  console.log('\n=== Mercedes keys ===');
  for (const [key, gens] of genLookup) {
    if (key.startsWith('mercedes')) {
      console.log(`  ${key} → ${gens.length} gens: ${gens.map(g => g.name).slice(0, 5).join(', ')}`);
    }
  }

  console.log('\n=== VW keys ===');
  for (const [key, gens] of genLookup) {
    if (key.startsWith('volkswagen|')) {
      console.log(`  ${key} → ${gens.length} gens: ${gens.map(g => g.name).slice(0, 5).join(', ')}`);
    }
  }

  console.log('\n=== TEST: What scraper sends vs what lookup has ===');
  const tests = [
    { brand: 'BMW', raw: 'bmw 3 series sedan g20' },
    { brand: 'BMW', raw: 'bmw x5' },
    { brand: 'BMW', raw: 'bmw ix' },
    { brand: 'Mercedes-Benz', raw: 'mercedes benz c class w206' },
    { brand: 'Mercedes-Benz', raw: 'mercedes benz glc' },
    { brand: 'Volkswagen', raw: 'volkswagen golf' },
    { brand: 'Volkswagen', raw: 'volkswagen tiguan' },
    { brand: 'Audi', raw: 'audi a4 b9' },
    { brand: 'Toyota', raw: 'toyota corolla' },
    { brand: 'Tesla', raw: 'tesla model 3' },
    { brand: 'Volvo', raw: 'volvo xc60' },
    { brand: 'Skoda', raw: 'skoda octavia' },
  ];

  for (const t of tests) {
    const normalized = normalizeModelName(t.brand, t.raw).toLowerCase();
    const brandNorm = t.brand.toLowerCase().replace(/-/g, ' ');
    const key = `${brandNorm}|${normalized}`;
    const found = genLookup.get(key);
    console.log(`\n  "${t.raw}" → normalized: "${normalized}" → key: "${key}"`);
    if (found) {
      console.log(`    ✅ FOUND ${found.length} gens: ${found.map(g => g.name).join(', ')}`);
    } else {
      console.log(`    ❌ NOT FOUND`);
      // Check what keys exist for this brand
      const brandKeys = [...genLookup.keys()].filter(k => k.startsWith(brandNorm + '|'));
      const close = brandKeys.filter(k => {
        const m = k.split('|')[1];
        return normalized.includes(m) || m.includes(normalized);
      });
      if (close.length > 0) console.log(`    🔍 Close matches: ${close.join(', ')}`);
    }
  }
})();
