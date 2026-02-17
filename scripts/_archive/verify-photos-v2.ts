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
  console.log('📊 FLM AUTO — Photo Coverage (Verified)\n');

  // Load ALL data with pagination
  const generations = await paginate('generations', 'id, model_id');
  const images = await paginate('vehicle_images', 'generation_id');

  console.log(`Total generations: ${generations.length}`);
  console.log(`Total images: ${images.length}`);

  const validGenIds = new Set(generations.map(g => g.id));
  const imgGenIds = [...new Set(images.map(i => i.generation_id))];

  const validImgGens = imgGenIds.filter(id => validGenIds.has(id));
  const orphanImgGens = imgGenIds.filter(id => !validGenIds.has(id));

  console.log(`\nUnique generation_ids in images: ${imgGenIds.length}`);
  console.log(`Valid (linked to generation): ${validImgGens.length}`);
  console.log(`Orphans (no generation): ${orphanImgGens.length}`);
  console.log(`\n✅ REAL Photo coverage: ${validImgGens.length}/${generations.length} = ${(validImgGens.length/generations.length*100).toFixed(1)}%`);

  if (orphanImgGens.length > 0) {
    // Count orphan images
    const orphanImages = images.filter(i => orphanImgGens.includes(i.generation_id));
    console.log(`\n⚠️  Orphan images to clean: ${orphanImages.length}`);
  }
}

main().catch(console.error);
