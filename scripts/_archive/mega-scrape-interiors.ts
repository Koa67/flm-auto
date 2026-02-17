/**
 * FLM AUTO — Mega Interior Photos Scraper
 * Wikimedia Commons categories + text searches for car interior images
 * Target: 635 → 5,000 interior photos
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/mega-scrape-interiors.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_interiors.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Categories to crawl ─────────────────────────────────

const INTERIOR_CATEGORIES = [
  // General interior categories
  'Automobile_interiors',
  'Car_interiors',
  'Interiors_of_automobiles',
  'Vehicle_interiors',

  // Dashboards
  'Automobile_dashboards',
  'Dashboards',
  'Car_dashboards',
  'Instrument_clusters',
  'Instrument_panels_of_automobiles',

  // Seats
  'Car_seats',
  'Automobile_seats',
  'Vehicle_seats',
  'Bucket_seats',
  'Sport_seats',

  // Steering
  'Steering_wheels',
  'Steering_wheels_of_automobiles',
  'Automobile_steering_wheels',

  // Infotainment
  'Car_audio',
  'In-car_entertainment',
  'Automobile_navigation_systems',

  // Brand-specific interiors
  'Interior_of_BMW_vehicles',
  'Interior_of_Mercedes-Benz_vehicles',
  'Interior_of_Audi_vehicles',
  'Interior_of_Porsche_vehicles',
  'Interior_of_Volkswagen_vehicles',
  'Interior_of_Toyota_vehicles',
  'Interior_of_Honda_vehicles',
  'Interior_of_Ford_vehicles',
  'Interior_of_Volvo_vehicles',
  'Interior_of_Tesla_vehicles',
  'Interior_of_Ferrari_vehicles',
  'Interior_of_Lamborghini_vehicles',

  // BMW interiors by series
  'BMW_3_Series_interiors',
  'BMW_5_Series_interiors',
  'BMW_7_Series_interiors',
  'BMW_X3_interiors',
  'BMW_X5_interiors',

  // Mercedes interiors
  'Mercedes-Benz_S-Class_interiors',
  'Mercedes-Benz_E-Class_interiors',
  'Mercedes-Benz_C-Class_interiors',

  // Gear shifts & controls
  'Gear_shifters',
  'Gear_sticks',
  'Automobile_gear_shifts',
  'Automatic_transmission_shifters',

  // Cockpit
  'Automobile_cockpits',
  'Car_cockpits',
  'Cockpits_of_automobiles',

  // Trunks / boots
  'Automobile_trunks',
  'Car_boots',
  'Car_trunks',
  'Automobile_luggage_compartments',

  // Comfort
  'Automobile_air_conditioning',
  'Car_heaters',
];

// ─── Search queries ──────────────────────────────────────

const INTERIOR_SEARCHES = [
  // General
  'car interior', 'automobile interior', 'vehicle interior',
  'car dashboard', 'automobile dashboard',
  'car cockpit', 'automobile cockpit',
  'car cabin', 'automobile cabin',

  // Components
  'car steering wheel', 'automobile steering wheel',
  'car instrument cluster', 'car instrument panel',
  'car center console', 'car centre console',
  'car infotainment system', 'car navigation screen',
  'car seats leather', 'car interior leather',
  'car gear shift', 'car gear lever',
  'car trunk interior', 'car boot space',

  // Brand interiors
  'BMW interior', 'BMW dashboard', 'BMW cockpit',
  'Mercedes-Benz interior', 'Mercedes interior', 'Mercedes dashboard',
  'Audi interior', 'Audi dashboard', 'Audi cockpit',
  'Porsche interior', 'Porsche dashboard', 'Porsche cockpit',
  'Volkswagen interior', 'VW interior', 'VW dashboard',
  'Toyota interior', 'Toyota dashboard',
  'Honda interior', 'Honda dashboard',
  'Ford interior', 'Ford dashboard',
  'Ferrari interior', 'Ferrari cockpit',
  'Lamborghini interior', 'Lamborghini cockpit',
  'Volvo interior', 'Volvo dashboard',
  'Tesla interior', 'Tesla dashboard',
  'Hyundai interior', 'Kia interior',
  'Renault interior', 'Peugeot interior',
  'Mazda interior', 'Nissan interior',
  'Jaguar interior', 'Alfa Romeo interior',
  'Fiat interior', 'Skoda interior',
  'SEAT interior', 'Citroen interior',

  // Specific model interiors
  'BMW M3 interior', 'BMW M5 interior', 'BMW X5 interior',
  'Mercedes S-Class interior', 'Mercedes E-Class interior', 'Mercedes C-Class interior',
  'Audi A4 interior', 'Audi A6 interior', 'Audi Q7 interior',
  'Porsche 911 interior', 'Porsche Cayenne interior',
  'Tesla Model 3 interior', 'Tesla Model S interior',
  'VW Golf interior', 'VW Passat interior',
  'Toyota Camry interior', 'Toyota Corolla interior',
  'Honda Civic interior', 'Honda Accord interior',

  // Luxury & sport interiors
  'luxury car interior', 'sports car interior',
  'supercar interior', 'race car interior',
  'classic car interior', 'vintage car interior',
  'car interior night', 'car ambient lighting',
];

// ─── Checkpoint ──────────────────────────────────────────

interface CheckpointData {
  processedCategories: string[];
  processedSearches: string[];
  totalSaved: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedCategories: [], processedSearches: [],
    totalSaved: 0, errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Brand extraction & matching ─────────────────────────

const KNOWN_BRANDS = [
  'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Porsche', 'Ferrari', 'Lamborghini',
  'Volkswagen', 'VW', 'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Mazda',
  'Renault', 'Peugeot', 'Citroen', 'Citroën', 'Fiat', 'Alfa Romeo', 'Volvo',
  'Jaguar', 'Hyundai', 'Kia', 'Skoda', 'Škoda', 'SEAT', 'Tesla',
];

function extractBrand(title: string): string | null {
  const lower = title.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      if (brand === 'Mercedes') return 'Mercedes-Benz';
      if (brand === 'VW') return 'Volkswagen';
      if (brand === 'Citroën') return 'Citroen';
      if (brand === 'Škoda') return 'Skoda';
      return brand;
    }
  }
  return null;
}

// Cache brand→generation mapping
const brandGenCache = new Map<string, string | null>();

async function getGenForBrand(brandName: string): Promise<string | null> {
  if (brandGenCache.has(brandName)) return brandGenCache.get(brandName)!;

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', `%${brandName}%`)
    .limit(1)
    .single();

  if (!brand) {
    brandGenCache.set(brandName, null);
    return null;
  }

  const { data: models } = await supabase
    .from('models')
    .select('id')
    .eq('brand_id', brand.id)
    .limit(1);

  if (!models || models.length === 0) {
    brandGenCache.set(brandName, null);
    return null;
  }

  const { data: gen } = await supabase
    .from('generations')
    .select('id')
    .eq('model_id', models[0].id)
    .limit(1)
    .single();

  const genId = gen?.id || null;
  brandGenCache.set(brandName, genId);
  return genId;
}

// ─── Wikimedia API helpers ───────────────────────────────

async function fetchCategoryImages(category: string, maxImages = 500): Promise<any[]> {
  const images: any[] = [];
  let gcmcontinue: string | undefined;

  while (images.length < maxImages) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${category}`,
      gcmtype: 'file',
      gcmlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });
    if (gcmcontinue) params.set('gcmcontinue', gcmcontinue);

    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!res.ok) break;
      const data = await res.json();

      for (const page of Object.values(data.query?.pages || {}) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 400 || ii.height < 250) continue;
        if (!ii.mime?.startsWith('image/')) continue;

        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['gif', 'tiff', 'tif', 'pdf', 'svg'].includes(ext)) continue;

        images.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', '') || '',
          description: ii.extmetadata?.ImageDescription?.value || '',
        });
      }

      gcmcontinue = data.continue?.gcmcontinue;
      if (!gcmcontinue) break;
    } catch {
      break;
    }
    await delay(200);
  }

  return images;
}

async function getSubcategories(category: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'subcat',
      cmlimit: '50',
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.categorymembers || []).map((c: any) => c.title?.replace('Category:', '')).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchWikimediaImages(query: string, limit = 50): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();

    const results: any[] = [];
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      if (ii.width < 400 || ii.height < 250) continue;
      if (!ii.mime?.startsWith('image/')) continue;

      results.push({
        url: ii.url,
        thumbUrl: ii.thumburl || ii.url,
        width: ii.width,
        height: ii.height,
        title: page.title?.replace('File:', '') || '',
        description: ii.extmetadata?.ImageDescription?.value || '',
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Insert ──────────────────────────────────────────────

async function insertImage(img: any, seenUrls: Set<string>): Promise<boolean> {
  if (seenUrls.has(img.url)) return false;

  const brand = extractBrand(img.title);
  const genId = brand ? await getGenForBrand(brand) : null;

  const { error } = await supabase.from('vehicle_images').insert({
    generation_id: genId,
    url: img.url,
    thumbnail_url: img.thumbUrl,
    source: 'Wikimedia Commons',
    source_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(img.title)}`,
    image_type: 'interior',
    width: img.width,
    height: img.height,
    alt_text: img.title.replace(/\.[^.]+$/, '').slice(0, 255),
  });

  if (!error) {
    seenUrls.add(img.url);
    return true;
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega Interior Photos Scraper');
  console.log('  Target: 635 → 5,000 interior photos');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  const processedSearches = new Set(checkpoint.processedSearches);
  let { totalSaved, errors } = checkpoint;

  const seenUrls = new Set<string>();

  // Load existing interior image URLs
  console.log('Loading existing interior images...');
  let page = 0;
  while (true) {
    const { data } = await supabase.from('vehicle_images')
      .select('url')
      .eq('image_type', 'interior')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => seenUrls.add(r.url));
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Existing interior images: ${seenUrls.size}\n`);

  if (totalSaved > 0) {
    console.log(`Resuming: ${totalSaved} saved so far\n`);
  }

  const startTime = Date.now();

  // ═══ PHASE 1: Category crawl with subcategories ═══
  console.log('═══ PHASE 1: Wikimedia Categories (+ subcategories) ═══\n');

  const allCategories = [...INTERIOR_CATEGORIES];

  // Discover subcategories
  console.log('Discovering subcategories...');
  let subCount = 0;
  for (const cat of INTERIOR_CATEGORIES) {
    const subs = await getSubcategories(cat);
    for (const sub of subs) {
      if (!allCategories.includes(sub)) {
        // Filter: only include interior/dashboard/seat/steering related subcats
        const subLower = sub.toLowerCase();
        if (subLower.includes('interior') || subLower.includes('dashboard') ||
            subLower.includes('cockpit') || subLower.includes('seat') ||
            subLower.includes('steering') || subLower.includes('cabin') ||
            subLower.includes('instrument') || subLower.includes('console') ||
            subLower.includes('trunk') || subLower.includes('boot') ||
            subLower.includes('gear') || subLower.includes('infotainment') ||
            // Brand-specific subcategories
            KNOWN_BRANDS.some(b => subLower.includes(b.toLowerCase()))) {
          allCategories.push(sub);
          subCount++;
        }
      }
    }
    await delay(200);
  }
  console.log(`Found ${subCount} subcategories (total: ${allCategories.length} categories)\n`);

  for (let i = 0; i < allCategories.length; i++) {
    const cat = allCategories[i];
    if (processedCats.has(cat)) continue;

    process.stdout.write(`  [${i + 1}/${allCategories.length}] ${cat.slice(0, 50).padEnd(50)}...`);

    const images = await fetchCategoryImages(cat, 300);
    let batchSaved = 0;

    for (const img of images) {
      const saved = await insertImage(img, seenUrls);
      if (saved) {
        totalSaved++;
        batchSaved++;
      }
    }

    processedCats.add(cat);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({
        processedCategories: [...processedCats],
        processedSearches: [...processedSearches],
        totalSaved, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(300);
  }

  // ═══ PHASE 2: Text searches ═══
  console.log('\n═══ PHASE 2: Wikimedia Text Searches ═══\n');

  for (let i = 0; i < INTERIOR_SEARCHES.length; i++) {
    const query = INTERIOR_SEARCHES[i];
    if (processedSearches.has(query)) continue;

    process.stdout.write(`  [${i + 1}/${INTERIOR_SEARCHES.length}] "${query}"...`);

    const images = await searchWikimediaImages(query, 50);
    let batchSaved = 0;

    for (const img of images) {
      const saved = await insertImage(img, seenUrls);
      if (saved) {
        totalSaved++;
        batchSaved++;
      }
    }

    processedSearches.add(query);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({
        processedCategories: [...processedCats],
        processedSearches: [...processedSearches],
        totalSaved, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(500);
  }

  // Final save
  saveCheckpoint({
    processedCategories: [...processedCats],
    processedSearches: [...processedSearches],
    totalSaved, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  INTERIOR PHOTOS SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total saved:    ${totalSaved}`);
  console.log(`  Categories:     ${processedCats.size}`);
  console.log(`  Searches:       ${processedSearches.size}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
