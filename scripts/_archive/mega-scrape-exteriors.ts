/**
 * FLM AUTO — Mega Exterior Photos Multiplier
 * For each generation, finds additional exterior photos from Wikimedia
 * Goal: Push from ~18k → 35k total images by adding more photos per generation
 *
 * Strategy:
 * 1. For each brand, crawl Wikimedia brand categories for ALL photos
 * 2. Match to correct generation via title parsing
 * 3. Add up to 5 photos per generation (currently most have 1-2)
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/mega-scrape-exteriors.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_exteriors_multi.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Brand → Wikimedia category mapping ──────────────────

const BRAND_CATEGORIES: Record<string, string[]> = {
  'BMW': [
    'BMW_vehicles', 'BMW_automobiles', 'BMW_cars',
    'BMW_1_Series', 'BMW_2_Series', 'BMW_3_Series', 'BMW_4_Series',
    'BMW_5_Series', 'BMW_6_Series', 'BMW_7_Series', 'BMW_8_Series',
    'BMW_X1', 'BMW_X2', 'BMW_X3', 'BMW_X4', 'BMW_X5', 'BMW_X6', 'BMW_X7',
    'BMW_Z3', 'BMW_Z4', 'BMW_i3', 'BMW_i4', 'BMW_i7', 'BMW_iX',
    'BMW_M3', 'BMW_M4', 'BMW_M5',
  ],
  'Mercedes-Benz': [
    'Mercedes-Benz_vehicles', 'Mercedes-Benz_automobiles',
    'Mercedes-Benz_A-Class', 'Mercedes-Benz_B-Class', 'Mercedes-Benz_C-Class',
    'Mercedes-Benz_E-Class', 'Mercedes-Benz_S-Class', 'Mercedes-Benz_G-Class',
    'Mercedes-Benz_GLA-Class', 'Mercedes-Benz_GLB-Class', 'Mercedes-Benz_GLC',
    'Mercedes-Benz_GLE-Class', 'Mercedes-Benz_GLS-Class',
    'Mercedes-Benz_CLA-Class', 'Mercedes-Benz_CLS-Class',
    'Mercedes-AMG_vehicles',
  ],
  'Audi': [
    'Audi_vehicles', 'Audi_automobiles',
    'Audi_A1', 'Audi_A3', 'Audi_A4', 'Audi_A5', 'Audi_A6', 'Audi_A7', 'Audi_A8',
    'Audi_Q2', 'Audi_Q3', 'Audi_Q5', 'Audi_Q7', 'Audi_Q8',
    'Audi_TT', 'Audi_R8', 'Audi_e-tron',
    'Audi_RS_models', 'Audi_S_models',
  ],
  'Porsche': [
    'Porsche_vehicles', 'Porsche_automobiles',
    'Porsche_911', 'Porsche_Cayenne', 'Porsche_Macan',
    'Porsche_Panamera', 'Porsche_Boxster', 'Porsche_Cayman',
    'Porsche_Taycan', 'Porsche_718',
  ],
  'Volkswagen': [
    'Volkswagen_vehicles', 'Volkswagen_automobiles',
    'Volkswagen_Golf', 'Volkswagen_Polo', 'Volkswagen_Passat',
    'Volkswagen_Tiguan', 'Volkswagen_Touareg', 'Volkswagen_T-Roc',
    'Volkswagen_Arteon', 'Volkswagen_ID.3', 'Volkswagen_ID.4',
    'Volkswagen_Beetle', 'Volkswagen_Up!',
  ],
  'Toyota': [
    'Toyota_vehicles', 'Toyota_automobiles',
    'Toyota_Corolla', 'Toyota_Camry', 'Toyota_RAV4',
    'Toyota_Yaris', 'Toyota_Prius', 'Toyota_Supra',
    'Toyota_Land_Cruiser', 'Toyota_Hilux', 'Toyota_C-HR',
    'Toyota_GR86',
  ],
  'Honda': [
    'Honda_automobiles', 'Honda_vehicles',
    'Honda_Civic', 'Honda_Accord', 'Honda_CR-V',
    'Honda_Jazz', 'Honda_HR-V', 'Honda_NSX',
  ],
  'Ford': [
    'Ford_vehicles', 'Ford_automobiles',
    'Ford_Focus', 'Ford_Fiesta', 'Ford_Mustang',
    'Ford_Ranger', 'Ford_Explorer', 'Ford_F-Series',
    'Ford_Bronco', 'Ford_GT',
  ],
  'Ferrari': [
    'Ferrari_vehicles', 'Ferrari_automobiles',
    'Ferrari_458', 'Ferrari_488', 'Ferrari_F8',
    'Ferrari_812', 'Ferrari_Roma', 'Ferrari_SF90',
    'Ferrari_F40', 'Ferrari_F50', 'Ferrari_Enzo',
    'Ferrari_LaFerrari', 'Ferrari_250', 'Ferrari_Testarossa',
  ],
  'Lamborghini': [
    'Lamborghini_vehicles', 'Lamborghini_automobiles',
    'Lamborghini_Huracán', 'Lamborghini_Aventador',
    'Lamborghini_Urus', 'Lamborghini_Gallardo',
    'Lamborghini_Murciélago', 'Lamborghini_Diablo',
    'Lamborghini_Countach',
  ],
  'Volvo': [
    'Volvo_vehicles', 'Volvo_automobiles',
    'Volvo_XC40', 'Volvo_XC60', 'Volvo_XC90',
    'Volvo_S60', 'Volvo_S90', 'Volvo_V60', 'Volvo_V90',
  ],
  'Renault': [
    'Renault_vehicles', 'Renault_automobiles',
    'Renault_Clio', 'Renault_Megane', 'Renault_Captur',
    'Renault_Kadjar', 'Renault_Scenic', 'Renault_Twingo',
  ],
  'Peugeot': [
    'Peugeot_vehicles', 'Peugeot_automobiles',
    'Peugeot_208', 'Peugeot_308', 'Peugeot_3008',
    'Peugeot_508', 'Peugeot_2008', 'Peugeot_5008',
  ],
  'Hyundai': [
    'Hyundai_vehicles', 'Hyundai_automobiles',
    'Hyundai_Tucson', 'Hyundai_i30', 'Hyundai_Kona',
    'Hyundai_Ioniq', 'Hyundai_Santa_Fe',
  ],
  'Kia': [
    'Kia_vehicles', 'Kia_automobiles',
    'Kia_Sportage', 'Kia_Ceed', 'Kia_Sorento',
    'Kia_Niro', 'Kia_EV6', 'Kia_Stinger',
  ],
  'Mazda': [
    'Mazda_vehicles', 'Mazda_automobiles',
    'Mazda3', 'Mazda6', 'Mazda_CX-5', 'Mazda_CX-3',
    'Mazda_MX-5',
  ],
  'Nissan': [
    'Nissan_vehicles', 'Nissan_automobiles',
    'Nissan_Qashqai', 'Nissan_Juke', 'Nissan_X-Trail',
    'Nissan_Leaf', 'Nissan_GT-R', 'Nissan_370Z',
  ],
  'Fiat': [
    'Fiat_vehicles', 'Fiat_automobiles',
    'Fiat_500', 'Fiat_Panda', 'Fiat_Tipo', 'Fiat_Punto',
  ],
  'Skoda': [
    'Škoda_vehicles', 'Škoda_automobiles', 'Škoda_Auto_vehicles',
    'Škoda_Octavia', 'Škoda_Superb', 'Škoda_Fabia',
    'Škoda_Kodiaq', 'Škoda_Karoq', 'Škoda_Kamiq',
  ],
  'SEAT': [
    'SEAT_vehicles', 'SEAT_automobiles',
    'SEAT_Leon', 'SEAT_Ibiza', 'SEAT_Ateca', 'SEAT_Arona',
  ],
  'Citroen': [
    'Citroën_vehicles', 'Citroën_automobiles',
    'Citroën_C3', 'Citroën_C4', 'Citroën_C5',
    'Citroën_Berlingo',
  ],
  'Alfa Romeo': [
    'Alfa_Romeo_vehicles', 'Alfa_Romeo_automobiles',
    'Alfa_Romeo_Giulia', 'Alfa_Romeo_Stelvio',
    'Alfa_Romeo_Giulietta',
  ],
  'Jaguar': [
    'Jaguar_vehicles', 'Jaguar_automobiles',
    'Jaguar_XE', 'Jaguar_XF', 'Jaguar_F-Type',
    'Jaguar_F-Pace', 'Jaguar_E-Pace', 'Jaguar_I-Pace',
    'Jaguar_E-Type',
  ],
  'Tesla': [
    'Tesla_vehicles', 'Tesla_automobiles',
    'Tesla_Model_3', 'Tesla_Model_S', 'Tesla_Model_X',
    'Tesla_Model_Y', 'Tesla_Cybertruck',
  ],
  'Chevrolet': [
    'Chevrolet_vehicles', 'Chevrolet_automobiles',
    'Chevrolet_Corvette', 'Chevrolet_Camaro',
    'Chevrolet_Silverado', 'Chevrolet_Suburban',
  ],
};

// ─── Checkpoint ──────────────────────────────────────────

interface CheckpointData {
  processedCategories: string[];
  totalSaved: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedCategories: [], totalSaved: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Wikimedia API ───────────────────────────────────────

async function fetchCategoryImages(category: string, maxImages = 500): Promise<any[]> {
  const images: any[] = [];
  let gcmcontinue: string | undefined;

  while (images.length < maxImages) {
    const params = new URLSearchParams({
      action: 'query', generator: 'categorymembers',
      gcmtitle: `Category:${category}`, gcmtype: 'file',
      gcmlimit: '50', prop: 'imageinfo',
      iiprop: 'url|size|mime', iiurlwidth: '800',
      format: 'json', origin: '*',
    });
    if (gcmcontinue) params.set('gcmcontinue', gcmcontinue);

    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!res.ok) break;
      const data = await res.json();

      for (const page of Object.values(data.query?.pages || {}) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 500 || ii.height < 300) continue;
        if (!ii.mime?.startsWith('image/')) continue;

        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['gif', 'tiff', 'tif', 'pdf', 'svg'].includes(ext)) continue;

        images.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', '') || '',
        });
      }

      gcmcontinue = data.continue?.gcmcontinue;
      if (!gcmcontinue) break;
    } catch { break; }
    await delay(200);
  }

  return images;
}

async function getSubcategories(category: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: 'query', list: 'categorymembers',
      cmtitle: `Category:${category}`, cmtype: 'subcat',
      cmlimit: '50', format: 'json', origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.categorymembers || []).map((c: any) => c.title?.replace('Category:', '')).filter(Boolean);
  } catch { return []; }
}

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
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

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega Exterior Photos Multiplier');
  console.log('  Target: 18k → 35k total images');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  let { totalSaved, errors } = checkpoint;

  // Load DB data
  console.log('Loading DB data...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll('generations', 'id, name, slug, model_id');

  const brandMap = new Map(brands.map(b => [b.name, b]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    const brand = brands.find(b => b.id === m.brand_id);
    if (!brand) continue;
    if (!modelsByBrand.has(brand.name)) modelsByBrand.set(brand.name, []);
    modelsByBrand.get(brand.name)!.push(m);
  }

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Count existing photos per gen
  console.log('Counting existing photos...');
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id, url');
  const photosPerGen = new Map<string, number>();
  const seenUrls = new Set<string>();
  for (const p of existingPhotos) {
    seenUrls.add(p.url);
    if (p.generation_id) {
      photosPerGen.set(p.generation_id, (photosPerGen.get(p.generation_id) || 0) + 1);
    }
  }
  console.log(`Existing: ${existingPhotos.length} images, ${seenUrls.size} unique URLs\n`);

  if (totalSaved > 0) console.log(`Resuming: ${totalSaved} saved so far\n`);

  const startTime = Date.now();

  // Build all categories to crawl (brand categories + subcategories)
  const allCategories: { cat: string; brand: string }[] = [];

  for (const [brandName, cats] of Object.entries(BRAND_CATEGORIES)) {
    for (const cat of cats) {
      allCategories.push({ cat, brand: brandName });
    }
  }

  console.log(`Total categories to crawl: ${allCategories.length}\n`);

  // Discover subcategories for model-specific categories
  console.log('Discovering subcategories...');
  const extraCats: { cat: string; brand: string }[] = [];
  for (const { cat, brand } of allCategories.slice(0, 50)) {
    if (processedCats.has(cat)) continue;
    const subs = await getSubcategories(cat);
    for (const sub of subs) {
      if (!allCategories.some(c => c.cat === sub) && !extraCats.some(c => c.cat === sub)) {
        // Only include automobile/car related subcategories
        const subLower = sub.toLowerCase();
        if (subLower.includes('interior') || subLower.includes('engine') ||
            subLower.includes('diagram') || subLower.includes('logo')) continue;
        extraCats.push({ cat: sub, brand });
      }
    }
    await delay(200);
  }
  allCategories.push(...extraCats);
  console.log(`Found ${extraCats.length} subcategories (total: ${allCategories.length})\n`);

  // Process categories
  for (let i = 0; i < allCategories.length; i++) {
    const { cat, brand } = allCategories[i];
    if (processedCats.has(cat)) continue;

    process.stdout.write(`  [${i + 1}/${allCategories.length}] ${cat.slice(0, 55).padEnd(55)}...`);

    const images = await fetchCategoryImages(cat, 200);
    let batchSaved = 0;

    // Find matching brand models/gens
    const brandObj = brandMap.get(brand);
    const brandModels = modelsByBrand.get(brand) || [];

    for (const img of images) {
      if (seenUrls.has(img.url)) continue;

      // Try to match to a specific generation
      let matchedGenId: string | null = null;
      const titleLower = img.title.toLowerCase();

      for (const model of brandModels) {
        const modelName = model.name.toLowerCase();
        if (titleLower.includes(modelName) || titleLower.includes(modelName.replace(/ /g, '_'))) {
          const modelGens = gensByModel.get(model.id) || [];
          // Try to match generation by year or chassis code in title
          for (const gen of modelGens) {
            const genName = gen.name?.toLowerCase() || '';
            const genSlug = gen.slug?.toLowerCase() || '';
            if (titleLower.includes(genName) || titleLower.includes(genSlug)) {
              matchedGenId = gen.id;
              break;
            }
          }
          // If no specific gen match, use most recent
          if (!matchedGenId && modelGens.length > 0) {
            matchedGenId = modelGens[modelGens.length - 1].id;
          }
          break;
        }
      }

      // If no model match, assign to first gen of brand
      if (!matchedGenId && brandObj) {
        const firstModel = brandModels[0];
        if (firstModel) {
          const firstGens = gensByModel.get(firstModel.id) || [];
          if (firstGens.length > 0) matchedGenId = firstGens[0].id;
        }
      }

      // Skip if this gen already has 5+ photos
      if (matchedGenId && (photosPerGen.get(matchedGenId) || 0) >= 8) continue;

      const { error } = await supabase.from('vehicle_images').insert({
        generation_id: matchedGenId,
        url: img.url,
        thumbnail_url: img.thumbUrl,
        source: 'Wikimedia Commons',
        image_type: 'exterior',
        width: img.width,
        height: img.height,
        alt_text: img.title.replace(/\.[^.]+$/, '').slice(0, 255),
        is_primary: false,
        display_order: (photosPerGen.get(matchedGenId || '') || 0) + 1,
      });

      if (!error) {
        totalSaved++;
        batchSaved++;
        seenUrls.add(img.url);
        if (matchedGenId) photosPerGen.set(matchedGenId, (photosPerGen.get(matchedGenId) || 0) + 1);
      } else {
        errors++;
      }
    }

    processedCats.add(cat);
    console.log(` ${images.length} found, +${batchSaved} (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({ processedCategories: [...processedCats], totalSaved, errors, startedAt: checkpoint.startedAt });
      const currentTotal = existingPhotos.length + totalSaved;
      console.log(`\n  >>> Current total images: ~${currentTotal} (target: 35,000)\n`);
    }

    await delay(300);
  }

  saveCheckpoint({ processedCategories: [...processedCats], totalSaved, errors, startedAt: checkpoint.startedAt });

  const elapsed = (Date.now() - startTime) / 1000;
  const estimatedTotal = existingPhotos.length + totalSaved;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  EXTERIOR MULTIPLIER COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  New images:     +${totalSaved}`);
  console.log(`  Est. total:     ~${estimatedTotal}`);
  console.log(`  Categories:     ${processedCats.size}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
