import { createClient } from '@supabase/supabase-js';
import { normalizeModelName } from './model-aliases';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function debugMatching() {
  // Get all our models
  const { data: models } = await supabase
    .from('models')
    .select('name, brand:brands(name)')
    .order('name');
  
  console.log('🔍 DEBUG MATCHING\n');
  
  // Build lookup like scraper does
  const genLookup = new Map<string, string>();
  for (const m of models || []) {
    const b = m.brand as any;
    if (!b) continue;
    const key = `${b.name.toLowerCase().replace(/-/g, ' ')}|${m.name.toLowerCase()}`;
    genLookup.set(key, m.name);
  }
  
  // Test cases from UltimateSpecs URLs
  const testCases = [
    ['BMW', '3-Series'],
    ['BMW', '5-Series'],  
    ['BMW', 'X3'],
    ['BMW', 'M3'],
    ['Mercedes-Benz', 'C-Class'],
    ['Mercedes-Benz', 'E-Class'],
    ['Mercedes-Benz', 'GLE'],
    ['Audi', 'A4'],
    ['Audi', 'Q5'],
    ['Volkswagen', 'Golf'],
    ['Volkswagen', 'Tiguan'],
    ['Porsche', '911'],
    ['Toyota', 'Corolla'],
    ['Volvo', 'XC60'],
  ];
  
  console.log('Scraper input → Normalized → DB lookup:\n');
  
  for (const [brand, model] of testCases) {
    const modelName = model.replace(/-/g, ' ');
    const normalized = normalizeModelName(brand, modelName).toLowerCase();
    const brandNorm = brand.toLowerCase().replace(/-/g, ' ');
    const directKey = `${brandNorm}|${normalized}`;
    
    const found = genLookup.has(directKey);
    
    // What keys exist for this brand?
    const brandKeys = [...genLookup.keys()].filter(k => k.startsWith(brandNorm));
    
    console.log(`${brand} | "${modelName}" → "${normalized}"`);
    console.log(`  Key: "${directKey}" → ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (!found) {
      // Show what we have for this brand
      const similar = brandKeys.filter(k => {
        const dbModel = k.split('|')[1];
        return dbModel.includes(normalized.split(' ')[0]) || normalized.includes(dbModel);
      });
      console.log(`  Similar: ${similar.slice(0, 3).join(', ') || 'none'}`);
    }
    console.log('');
  }
  
  // Show all BMW models in DB
  console.log('\n📦 BMW models in DB:');
  const bmwKeys = [...genLookup.keys()].filter(k => k.startsWith('bmw'));
  console.log(bmwKeys.map(k => k.split('|')[1]).sort().join(', '));
  
  console.log('\n📦 Mercedes models in DB:');
  const mbKeys = [...genLookup.keys()].filter(k => k.startsWith('mercedes'));
  console.log(mbKeys.map(k => k.split('|')[1]).sort().join(', '));
}

debugMatching();
