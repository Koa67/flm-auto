import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function main() {
  // Get sample images with their generations
  const { data: sample } = await supabase
    .from('vehicle_images')
    .select(`
      id,
      generation_id,
      alt_text,
      source,
      generations (
        id,
        name,
        models (
          name,
          brands (name)
        )
      )
    `)
    .limit(20);

  console.log('Sample images with generation links:\n');
  for (const img of sample || []) {
    const gen = img.generations as any;
    if (gen) {
      console.log(`✅ ${img.alt_text} → ${gen.models?.brands?.name} ${gen.models?.name} ${gen.name}`);
    } else {
      console.log(`❌ ${img.alt_text} → NO LINK (gen_id: ${img.generation_id})`);
    }
  }

  // Count by brand via join
  const { data: byBrand } = await supabase
    .from('vehicle_images')
    .select(`
      generations!inner (
        models!inner (
          brands!inner (name)
        )
      )
    `)
    .limit(5000);

  const brandCounts: Record<string, number> = {};
  for (const row of byBrand || []) {
    const brand = (row.generations as any)?.models?.brands?.name || 'unknown';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  }

  console.log('\n\nImages by brand (via join):');
  for (const [brand, count] of Object.entries(brandCounts).sort((a,b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${brand}: ${count}`);
  }
}

main().catch(console.error);
