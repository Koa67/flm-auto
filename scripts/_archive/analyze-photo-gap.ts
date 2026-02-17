import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function analyzeGap() {
  // Load photos
  const photos = JSON.parse(fs.readFileSync('/Users/koa/Dev/flm-auto/data/photos-all-merged.json', 'utf-8'));
  
  // Get DB generations
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allGens = [...allGens, ...data];
    if (data.length < 1000) break;
    page++;
  }
  
  // Get generations WITH photos
  const { data: withPhotos } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('spec_type', 'photos');
  const hasPhotoSet = new Set(withPhotos?.map(p => p.generation_id) || []);
  
  // Brands in DB
  const dbBrands = new Map<string, number>();
  const dbBrandsNoPhoto = new Map<string, string[]>();
  
  for (const gen of allGens) {
    const brand = (gen.model as any)?.brand?.name || 'Unknown';
    const model = (gen.model as any)?.name || 'Unknown';
    dbBrands.set(brand, (dbBrands.get(brand) || 0) + 1);
    
    if (!hasPhotoSet.has(gen.id)) {
      if (!dbBrandsNoPhoto.has(brand)) dbBrandsNoPhoto.set(brand, []);
      dbBrandsNoPhoto.get(brand)!.push(`${model} ${gen.name}`);
    }
  }
  
  // Brands in photos
  const photoBrands = new Map<string, number>();
  for (const p of photos) {
    const brand = p.brand || 'Unknown';
    photoBrands.set(brand, (photoBrands.get(brand) || 0) + 1);
  }
  
  console.log('═'.repeat(60));
  console.log('📊 PHOTO GAP ANALYSIS');
  console.log('═'.repeat(60));
  
  console.log('\n🚗 DB BRANDS (generations without photos):');
  const sortedNoPhoto = [...dbBrandsNoPhoto.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [brand, models] of sortedNoPhoto) {
    console.log(`   ${brand}: ${models.length} generations missing photos`);
  }
  
  console.log('\n📷 PHOTO FILE BRANDS (unmatched):');
  const unmatchedBrands = [...photoBrands.entries()]
    .filter(([b]) => !dbBrands.has(b))
    .sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of unmatchedBrands.slice(0, 20)) {
    console.log(`   ${brand}: ${count} photos (NOT IN DB)`);
  }
  
  console.log('\n🎯 TOP PRIORITY - Generations needing photos:');
  // Get most important brands missing photos
  const priorityBrands = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Tesla', 'Toyota', 'Hyundai', 'Kia', 'Volvo', 'Skoda'];
  for (const brand of priorityBrands) {
    const missing = dbBrandsNoPhoto.get(brand) || [];
    if (missing.length > 0) {
      console.log(`\n   ${brand} (${missing.length} missing):`);
      missing.slice(0, 5).forEach(m => console.log(`      - ${m}`));
      if (missing.length > 5) console.log(`      ... and ${missing.length - 5} more`);
    }
  }
}

analyzeGap().catch(console.error);
