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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('🔧 FLM AUTO — Rematch Orphan Photos\n');

  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const generations = await paginate('generations', 'id, name, model_id');
  const images = await paginate('vehicle_images', 'id, generation_id, alt_text, source');

  const validGenIds = new Set(generations.map(g => g.id));

  // Build lookup: "brandname modelname" -> [generation_ids]
  const brandById = new Map(brands.map(b => [b.id, b.name]));
  const modelById = new Map(models.map(m => [m.id, { name: m.name, brandId: m.brand_id }]));

  const lookupByBrandModel = new Map<string, string[]>();
  for (const g of generations) {
    const model = modelById.get(g.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brandId);
    if (!brand) continue;
    
    const key = normalize(brand + model.name);
    if (!lookupByBrandModel.has(key)) lookupByBrandModel.set(key, []);
    lookupByBrandModel.get(key)!.push(g.id);
  }

  // Find orphans
  const orphans = images.filter(img => !validGenIds.has(img.generation_id));
  console.log(`Total images: ${images.length}`);
  console.log(`Orphan images: ${orphans.length}`);

  // Try to rematch
  const updates: { id: string; newGenId: string }[] = [];
  let noAltText = 0;
  let noMatch = 0;

  for (const img of orphans) {
    if (!img.alt_text) {
      noAltText++;
      continue;
    }

    const key = normalize(img.alt_text);
    const genIds = lookupByBrandModel.get(key);
    
    if (!genIds || genIds.length === 0) {
      noMatch++;
      continue;
    }

    updates.push({ id: img.id, newGenId: genIds[0] });
  }

  console.log(`\nMatched: ${updates.length}`);
  console.log(`No alt_text: ${noAltText}`);
  console.log(`No match found: ${noMatch}`);

  if (updates.length === 0) {
    console.log('\nNo updates to make.');
    return;
  }

  console.log(`\nUpdating ${updates.length} images...`);
  let success = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('vehicle_images')
      .update({ generation_id: u.newGenId })
      .eq('id', u.id);
    if (!error) success++;
  }

  console.log(`✅ Updated: ${success}/${updates.length}`);
}

main().catch(console.error);
