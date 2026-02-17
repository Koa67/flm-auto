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
  console.log('🔧 FLM AUTO — Fix Orphan Photos\n');

  // Load all data
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const generations = await paginate('generations', 'id, name, model_id');
  const images = await paginate('vehicle_images', 'id, generation_id, alt_text, url, source, image_type');

  console.log(`  Brands: ${brands.length}`);
  console.log(`  Models: ${models.length}`);
  console.log(`  Generations: ${generations.length}`);
  console.log(`  Images: ${images.length}`);

  // Build lookup maps
  const validGenIds = new Set(generations.map(g => g.id));
  const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }
  const gensByModel = new Map<string, any[]>();
  for (const g of generations) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Find orphan images
  const orphans = images.filter(img => !validGenIds.has(img.generation_id));
  console.log(`\n  Orphan images: ${orphans.length}`);

  // Try to match orphans by alt_text (format: "Brand Model")
  let matched = 0;
  let unmatched = 0;
  const updates: { id: string; generation_id: string }[] = [];

  for (const img of orphans) {
    const altText = img.alt_text || '';
    const parts = altText.split(' ');
    if (parts.length < 2) {
      unmatched++;
      continue;
    }

    const brandName = parts[0].toLowerCase();
    const modelName = parts.slice(1).join(' ').toLowerCase();

    const brandId = brandMap.get(brandName);
    if (!brandId) {
      unmatched++;
      continue;
    }

    const brandModels = modelsByBrand.get(brandId) || [];
    const model = brandModels.find(m => m.name.toLowerCase() === modelName);
    if (!model) {
      unmatched++;
      continue;
    }

    const modelGens = gensByModel.get(model.id) || [];
    if (modelGens.length === 0) {
      unmatched++;
      continue;
    }

    // Assign to first generation of this model
    updates.push({ id: img.id, generation_id: modelGens[0].id });
    matched++;
  }

  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);

  if (updates.length === 0) {
    console.log('\n  No updates to make.');
    return;
  }

  // Batch update
  console.log(`\n  Updating ${updates.length} images...`);
  
  let updated = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const u of batch) {
      const { error } = await supabase
        .from('vehicle_images')
        .update({ generation_id: u.generation_id })
        .eq('id', u.id);
      if (!error) updated++;
    }
    process.stdout.write(`  ${updated}/${updates.length}\r`);
  }

  console.log(`\n\n✅ Updated ${updated} orphan images`);
}

main().catch(console.error);
