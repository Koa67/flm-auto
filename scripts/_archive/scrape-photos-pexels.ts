/**
 * FLM AUTO — Pexels Photo Scraper
 * Targets brands with 0% photo coverage
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: { original: string; large: string; medium: string };
}

async function searchPexels(query: string): Promise<PexelsPhoto[]> {
  if (!PEXELS_API_KEY) return [];
  
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.photos || [];
  } catch {
    return [];
  }
}

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
  if (!PEXELS_API_KEY) {
    console.log('❌ Set PEXELS_API_KEY environment variable');
    console.log('   Get free key at: https://www.pexels.com/api/');
    return;
  }

  console.log('📷 FLM AUTO — Pexels Photo Scraper\n');

  const brands = await paginate('brands', 'id, name, slug');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, name, model_id');
  
  // Get existing photos
  const { data: existingPhotos } = await supabase
    .from('vehicle_images')
    .select('generation_id')
    .limit(50000);
  
  const hasPhoto = new Set((existingPhotos || []).map(p => p.generation_id));
  
  // Priority brands (0% coverage)
  const priorityBrands = ['Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 
    'Ford', 'Volvo', 'Peugeot', 'Renault', 'Skoda', 'Tesla', 'Ferrari', 
    'Jaguar', 'Land Rover', 'Lexus', 'Fiat', 'Mini', 'Alfa Romeo', 
    'Maserati', 'Aston Martin', 'Bentley', 'Rolls-Royce', 'Opel', 'Seat', 'Citroen'];

  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  let totalSaved = 0;
  let requests = 0;
  const MAX_REQUESTS = 180; // Stay under 200/hour limit

  for (const brandName of priorityBrands) {
    const brand = brands.find(b => b.name === brandName);
    if (!brand) continue;

    const brandModels = modelsByBrand.get(brand.id) || [];
    console.log(`\n🏷️  ${brandName} (${brandModels.length} models)`);

    for (const model of brandModels) {
      if (requests >= MAX_REQUESTS) {
        console.log(`\n⏸️  Rate limit reached (${requests} requests). Run again in 1 hour.`);
        console.log(`   Total saved: ${totalSaved} photos`);
        return;
      }

      const modelGens = gensByModel.get(model.id) || [];
      const gensNeedingPhotos = modelGens.filter(g => !hasPhoto.has(g.id));
      
      if (gensNeedingPhotos.length === 0) continue;

      // Search Pexels
      const query = `${brandName} ${model.name} car`;
      const photos = await searchPexels(query);
      requests++;
      
      if (photos.length === 0) {
        await delay(200);
        continue;
      }

      // Assign photos to generations
      const rows = [];
      for (let i = 0; i < Math.min(gensNeedingPhotos.length, photos.length); i++) {
        const gen = gensNeedingPhotos[i];
        const photo = photos[i % photos.length];
        
        rows.push({
          generation_id: gen.id,
          image_type: 'exterior',
          url: photo.src.original,
          thumbnail_url: photo.src.medium,
          width: photo.width,
          height: photo.height,
          alt_text: `${brandName} ${model.name}`,
          source: 'Pexels',
          is_primary: i === 0,
          display_order: i
        });
        
        hasPhoto.add(gen.id);
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('vehicle_images').insert(rows);
        if (!error) {
          totalSaved += rows.length;
          process.stdout.write(`   ${model.name}: +${rows.length} photos\n`);
        }
      }

      await delay(200); // Rate limiting
    }
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Complete: ${totalSaved} photos saved`);
  console.log(`  📊 Requests used: ${requests}/${MAX_REQUESTS}`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
