/**
 * FLM AUTO — Wikimedia Commons v2 (Category-based)
 * Uses Wikimedia categories instead of search for better results
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Wikimedia category names follow patterns like "Toyota Corolla" or "Toyota Corolla (E210)"
async function getCategoryImages(category: string, limit = 10): Promise<any[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmtype=file&gcmlimit=${limit}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800&format=json&origin=*`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    
    const images: any[] = [];
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii || ii.width < 600 || ii.height < 400) continue;
      
      const ext = ii.url?.split('.').pop()?.toLowerCase();
      if (['svg', 'pdf', 'tiff'].includes(ext)) continue;
      
      images.push({
        url: ii.url,
        thumbUrl: ii.thumburl || ii.url,
        width: ii.width,
        height: ii.height,
        title: page.title?.replace('File:', ''),
      });
    }
    return images;
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
  console.log('📷 FLM AUTO — Wikimedia v2 (Category-based)\n');

  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, name, model_id');
  
  const { data: existingPhotos } = await supabase
    .from('vehicle_images')
    .select('generation_id')
    .limit(50000);
  
  const hasPhoto = new Set((existingPhotos || []).map(p => p.generation_id));

  const priorityBrands = ['Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 
    'Ford', 'Volvo', 'Peugeot', 'Renault', 'Skoda', 'Tesla', 'Ferrari',
    'Jaguar', 'Land Rover', 'Lexus', 'Fiat', 'Alfa Romeo', 'Opel', 'Seat', 'Citroen'];

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

  for (const brandName of priorityBrands) {
    const brand = brands.find(b => b.name === brandName);
    if (!brand) continue;

    const brandModels = modelsByBrand.get(brand.id) || [];
    let brandSaved = 0;

    console.log(`\n🏷️  ${brandName} (${brandModels.length} models)`);

    for (const model of brandModels) {
      const modelGens = gensByModel.get(model.id) || [];
      const gensNeedingPhotos = modelGens.filter(g => !hasPhoto.has(g.id));
      
      if (gensNeedingPhotos.length === 0) continue;

      // Try different category patterns
      const categoryPatterns = [
        `${brandName} ${model.name}`,
        `${brandName}_${model.name}`.replace(/ /g, '_'),
        `${model.name} (automobile)`,
        `${brandName} ${model.name} automobiles`,
      ];

      let photos: any[] = [];
      for (const cat of categoryPatterns) {
        photos = await getCategoryImages(cat, 15);
        if (photos.length > 0) break;
        await delay(100);
      }

      if (photos.length === 0) continue;

      const rows = [];
      for (let i = 0; i < gensNeedingPhotos.length && i < photos.length; i++) {
        const gen = gensNeedingPhotos[i];
        const photo = photos[i];
        
        rows.push({
          generation_id: gen.id,
          image_type: 'exterior',
          url: photo.url,
          thumbnail_url: photo.thumbUrl,
          width: photo.width,
          height: photo.height,
          alt_text: `${brandName} ${model.name}`,
          source: 'Wikimedia Commons',
          is_primary: i === 0,
          display_order: i
        });
        
        hasPhoto.add(gen.id);
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('vehicle_images').insert(rows);
        if (!error) {
          totalSaved += rows.length;
          brandSaved += rows.length;
        }
      }

      await delay(150);
    }
    
    if (brandSaved > 0) console.log(`   ✅ ${brandSaved} photos saved`);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Complete: ${totalSaved} photos saved`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
