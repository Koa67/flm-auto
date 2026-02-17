import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function main() {
  // Count unique generation_ids with photos
  const { data: images } = await supabase
    .from('vehicle_images')
    .select('generation_id')
    .limit(50000);

  const uniqueGens = new Set((images || []).map(i => i.generation_id));
  console.log(`Unique generation_ids with images: ${uniqueGens.size}`);

  // Verify these exist in generations
  const { data: validGens } = await supabase
    .from('generations')
    .select('id')
    .limit(50000);

  const validIds = new Set((validGens || []).map(g => g.id));
  const validPhotos = [...uniqueGens].filter(id => validIds.has(id));
  console.log(`Valid generation_ids (in generations table): ${validPhotos.length}`);

  // Get total generations
  const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  console.log(`Total generations: ${count}`);
  console.log(`Photo coverage: ${(validPhotos.length / (count || 1) * 100).toFixed(1)}%`);

  // Count by brand
  console.log('\n--- Images by brand (via SQL) ---');
  const { data: brandCounts } = await supabase.rpc('count_images_by_brand');
  if (brandCounts) {
    for (const row of brandCounts) {
      console.log(`  ${row.brand_name}: ${row.image_count}`);
    }
  } else {
    // Manual count
    const { data: gensWithBrand } = await supabase
      .from('generations')
      .select('id, models!inner(brands!inner(name))')
      .in('id', validPhotos.slice(0, 1000));

    const byBrand: Record<string, number> = {};
    for (const g of gensWithBrand || []) {
      const brand = (g.models as any)?.brands?.name || 'unknown';
      byBrand[brand] = (byBrand[brand] || 0) + 1;
    }
    for (const [brand, count] of Object.entries(byBrand).sort((a,b) => b[1] - a[1])) {
      console.log(`  ${brand}: ${count} gens with photos`);
    }
  }
}

main().catch(console.error);
