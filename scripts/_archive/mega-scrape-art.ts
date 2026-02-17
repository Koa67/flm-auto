/**
 * FLM AUTO — Mega Art & Illustration Scraper
 * Wikimedia Commons categories + text searches for car art/illustrations
 * Target: 29 → 500 art/illustrations
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/mega-scrape-art.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_art.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Categories ──────────────────────────────────────────

const ART_CATEGORIES = [
  // Car art & illustration
  'Automobile_art',
  'Car_art',
  'Automotive_art',
  'Paintings_of_automobiles',
  'Paintings_of_cars',
  'Art_of_automobiles',

  // Illustrations
  'Automobile_illustrations',
  'Car_illustrations',
  'Vehicle_illustrations',
  'Illustrations_of_automobiles',

  // Posters & advertising art
  'Automobile_posters',
  'Car_posters',
  'Automotive_advertising',
  'Automobile_advertising',
  'Car_advertisements',
  'Vintage_car_advertisements',
  'Vintage_automobile_advertisements',

  // Concept art
  'Concept_car_art',
  'Concept_car_renderings',
  'Concept_car_illustrations',
  'Automobile_concept_art',

  // Stamps & coins
  'Automobiles_on_stamps',
  'Cars_on_stamps',
  'Automobiles_on_coins',

  // Comics & cartoons
  'Cars_in_art',
  'Automobiles_in_art',
  'Cars_in_cartoons',

  // Historical
  'Historical_automobile_images',
  'Vintage_car_images',
  'Classic_car_images',
  'Historical_automobiles',

  // Logos & emblems
  'Automobile_logos',
  'Car_logos',
  'Automobile_emblems',
  'Car_emblems',
  'BMW_logos',
  'Mercedes-Benz_logos',
  'Porsche_logos',
  'Ferrari_logos',
  'Lamborghini_logos',
  'Audi_logos',
  'Volkswagen_logos',
  'Toyota_logos',

  // Motor sport art
  'Motorsport_art',
  'Racing_car_art',
  'Formula_One_art',
  'Rally_car_art',
  'Le_Mans_posters',
];

// ─── Search queries ──────────────────────────────────────

const ART_SEARCHES = [
  // General art
  'car art', 'automobile art', 'automotive art',
  'car illustration', 'automobile illustration',
  'car painting', 'automobile painting',
  'car poster', 'automobile poster', 'automotive poster',
  'car drawing art', 'automobile drawing art',
  'car watercolor', 'car oil painting',
  'car digital art', 'car concept art',

  // Vintage & classic
  'vintage car advertisement', 'vintage automobile advertisement',
  'vintage car poster', 'classic car poster',
  'retro car art', 'retro automobile',
  'vintage car illustration', 'classic car illustration',
  'art deco car', 'art deco automobile',

  // Brand art
  'BMW art', 'BMW poster', 'BMW advertisement vintage',
  'Mercedes-Benz art', 'Mercedes poster', 'Mercedes advertisement vintage',
  'Porsche art', 'Porsche poster', 'Porsche illustration',
  'Ferrari art', 'Ferrari poster', 'Ferrari illustration',
  'Lamborghini art', 'Lamborghini poster',
  'Audi art', 'Volkswagen art', 'VW poster',
  'Toyota art', 'Honda art', 'Ford art',
  'Jaguar art', 'Alfa Romeo art',
  'Renault poster', 'Peugeot poster', 'Citroen poster',
  'Fiat poster vintage', 'Volvo poster vintage',

  // Motorsport
  'racing car art', 'motorsport poster',
  'Formula 1 poster', 'Le Mans poster',
  'rally car art', 'rally poster',
  'NASCAR art', 'IndyCar poster',

  // Specific famous cars in art
  'Porsche 911 art', 'Ferrari F40 art',
  'Lamborghini Countach art', 'BMW M3 art',
  'Ford Mustang art', 'Corvette art',
  'DeLorean art', 'Aston Martin art',
  'Mini Cooper art', 'VW Beetle art',
  'Land Rover art', 'Jeep art',

  // Stamps and collectibles
  'car stamp', 'automobile stamp',
  'car emblem', 'car badge',
  'car logo vintage', 'automobile logo',
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

// ─── Brand extraction ────────────────────────────────────

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

const brandGenCache = new Map<string, string | null>();

async function getGenForBrand(brandName: string): Promise<string | null> {
  if (brandGenCache.has(brandName)) return brandGenCache.get(brandName)!;

  const { data: brand } = await supabase
    .from('brands').select('id').ilike('name', `%${brandName}%`).limit(1).single();

  if (!brand) { brandGenCache.set(brandName, null); return null; }

  const { data: models } = await supabase
    .from('models').select('id').eq('brand_id', brand.id).limit(1);

  if (!models || models.length === 0) { brandGenCache.set(brandName, null); return null; }

  const { data: gen } = await supabase
    .from('generations').select('id').eq('model_id', models[0].id).limit(1).single();

  const genId = gen?.id || null;
  brandGenCache.set(brandName, genId);
  return genId;
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
      iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800',
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
        if (ii.width < 200 || ii.height < 150) continue; // Lower threshold for art
        if (!ii.mime?.startsWith('image/')) continue;

        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['tiff', 'tif', 'pdf'].includes(ext)) continue;

        images.push({
          url: ii.url, thumbUrl: ii.thumburl || ii.url,
          width: ii.width, height: ii.height,
          title: page.title?.replace('File:', '') || '',
          description: ii.extmetadata?.ImageDescription?.value || '',
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

async function searchWikimediaImages(query: string, limit = 50): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query', generator: 'search',
    gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6',
    gsrlimit: String(limit), prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800',
    format: 'json', origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();

    const results: any[] = [];
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      if (ii.width < 200 || ii.height < 150) continue;
      if (!ii.mime?.startsWith('image/')) continue;

      results.push({
        url: ii.url, thumbUrl: ii.thumburl || ii.url,
        width: ii.width, height: ii.height,
        title: page.title?.replace('File:', '') || '',
        description: ii.extmetadata?.ImageDescription?.value || '',
      });
    }
    return results;
  } catch { return []; }
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
    image_type: 'illustration',
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
  console.log('  FLM AUTO — Mega Art & Illustration Scraper');
  console.log('  Target: 29 → 500 art/illustrations');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  const processedSearches = new Set(checkpoint.processedSearches);
  let { totalSaved, errors } = checkpoint;

  const seenUrls = new Set<string>();

  // Load existing art URLs
  console.log('Loading existing art images...');
  let page = 0;
  while (true) {
    const { data } = await supabase.from('vehicle_images')
      .select('url')
      .eq('image_type', 'illustration')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => seenUrls.add(r.url));
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Existing art images: ${seenUrls.size}\n`);

  if (totalSaved > 0) console.log(`Resuming: ${totalSaved} saved so far\n`);

  const startTime = Date.now();

  // ═══ PHASE 1: Categories + subcategories ═══
  console.log('═══ PHASE 1: Wikimedia Categories ═══\n');

  const allCategories = [...ART_CATEGORIES];
  console.log('Discovering subcategories...');
  let subCount = 0;
  for (const cat of ART_CATEGORIES) {
    const subs = await getSubcategories(cat);
    for (const sub of subs) {
      if (!allCategories.includes(sub)) {
        allCategories.push(sub);
        subCount++;
      }
    }
    await delay(200);
  }
  console.log(`Found ${subCount} subcategories (total: ${allCategories.length})\n`);

  for (let i = 0; i < allCategories.length; i++) {
    const cat = allCategories[i];
    if (processedCats.has(cat)) continue;

    process.stdout.write(`  [${i + 1}/${allCategories.length}] ${cat.slice(0, 50).padEnd(50)}...`);
    const images = await fetchCategoryImages(cat, 300);
    let batchSaved = 0;

    for (const img of images) {
      if (await insertImage(img, seenUrls)) { totalSaved++; batchSaved++; }
    }

    processedCats.add(cat);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({ processedCategories: [...processedCats], processedSearches: [...processedSearches], totalSaved, errors, startedAt: checkpoint.startedAt });
    }
    await delay(300);
  }

  // ═══ PHASE 2: Text searches ═══
  console.log('\n═══ PHASE 2: Wikimedia Text Searches ═══\n');

  for (let i = 0; i < ART_SEARCHES.length; i++) {
    const query = ART_SEARCHES[i];
    if (processedSearches.has(query)) continue;

    process.stdout.write(`  [${i + 1}/${ART_SEARCHES.length}] "${query}"...`);
    const images = await searchWikimediaImages(query, 50);
    let batchSaved = 0;

    for (const img of images) {
      if (await insertImage(img, seenUrls)) { totalSaved++; batchSaved++; }
    }

    processedSearches.add(query);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({ processedCategories: [...processedCats], processedSearches: [...processedSearches], totalSaved, errors, startedAt: checkpoint.startedAt });
    }
    await delay(500);
  }

  saveCheckpoint({ processedCategories: [...processedCats], processedSearches: [...processedSearches], totalSaved, errors, startedAt: checkpoint.startedAt });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ART SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total saved:    ${totalSaved}`);
  console.log(`  Categories:     ${processedCats.size}`);
  console.log(`  Searches:       ${processedSearches.size}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
