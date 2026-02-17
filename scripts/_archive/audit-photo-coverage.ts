/**
 * FLM AUTO — Photo Coverage Audit
 * 
 * Shows which generations have photos and which don't
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('📷 FLM AUTO — Photo Coverage Audit\n');

  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, name, model_id');
  
  // Get photos from vehicle_images table
  const { data: vehicleImages, error } = await supabase
    .from('vehicle_images')
    .select('generation_id, image_type')
    .limit(50000);

  const gensWithPhotos = new Set<string>();
  const photosByType: Record<string, Set<string>> = {};

  if (!error && vehicleImages) {
    for (const img of vehicleImages) {
      if (img.generation_id) {
        gensWithPhotos.add(img.generation_id);
        const cat = img.image_type || 'exterior';
        if (!photosByType[cat]) photosByType[cat] = new Set();
        photosByType[cat].add(img.generation_id);
      }
    }
  } else if (error) {
    console.log('  Error loading vehicle_images:', error.message);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GLOBAL PHOTO COVERAGE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total generations: ${gens.length}`);
  console.log(`  With any photo:    ${gensWithPhotos.size} (${Math.round(gensWithPhotos.size / gens.length * 100)}%)`);
  console.log(`  Without photo:     ${gens.length - gensWithPhotos.size} (${Math.round((gens.length - gensWithPhotos.size) / gens.length * 100)}%)`);

  console.log('\n  By type:');
  for (const [type, genSet] of Object.entries(photosByType).sort((a, b) => b[1].size - a[1].size)) {
    console.log(`    ${type.padEnd(20)} ${genSet.size} gens`);
  }

  // Per-brand breakdown
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PER-BRAND PHOTO COVERAGE');
  console.log('═══════════════════════════════════════════════════════════════');

  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const modelBrand = new Map(models.map((m: any) => [m.id, m.brand_id]));
  const genModel = new Map(gens.map((g: any) => [g.id, g.model_id]));

  const brandStats: { name: string; total: number; withPhoto: number }[] = [];

  for (const brand of brands) {
    const brandGens = gens.filter((g: any) => {
      const modelId = g.model_id;
      return modelBrand.get(modelId) === brand.id;
    });
    const withPhoto = brandGens.filter((g: any) => gensWithPhotos.has(g.id)).length;
    brandStats.push({ name: brand.name, total: brandGens.length, withPhoto });
  }

  brandStats.sort((a, b) => (a.withPhoto / a.total) - (b.withPhoto / b.total));

  for (const b of brandStats) {
    const pct = b.total > 0 ? Math.round(b.withPhoto / b.total * 100) : 0;
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    console.log(`  ${b.name.padEnd(18)} ${String(b.withPhoto).padStart(4)}/${String(b.total).padStart(4)}  ${bar} ${pct}%`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
