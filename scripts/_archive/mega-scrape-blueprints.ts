/**
 * FLM AUTO — Mega Blueprint Scraper
 * Wikimedia Commons categories + text searches for car blueprints
 * Target: 141 → 1,000 blueprints
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/mega-scrape-blueprints.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_blueprints.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Categories ──────────────────────────────────────────

const BLUEPRINT_CATEGORIES = [
  // Direct blueprint categories
  'Blueprints_of_cars',
  'Blueprints_of_automobiles',
  'Vehicle_blueprints',
  'Automobile_blueprints',
  'Car_blueprints',
  'Technical_drawings_of_automobiles',
  'Technical_drawings_of_cars',
  'Orthographic_projections_of_automobiles',
  'Orthographic_projections_of_cars',

  // Side/top/front views
  'Side_views_of_cars',
  'Side_views_of_automobiles',
  'Front_views_of_automobiles',
  'Rear_views_of_automobiles',
  'Top_views_of_automobiles',

  // Technical drawings by brand
  'Technical_drawings_of_BMW_automobiles',
  'Technical_drawings_of_Mercedes-Benz_automobiles',
  'Technical_drawings_of_Porsche_automobiles',
  'Technical_drawings_of_Audi_automobiles',
  'Technical_drawings_of_Volkswagen_automobiles',
  'Technical_drawings_of_Ferrari_automobiles',
  'Technical_drawings_of_Toyota_automobiles',
  'Technical_drawings_of_Ford_automobiles',

  // Outline drawings
  'Outline_drawings_of_cars',
  'Outline_drawings_of_automobiles',
  'Silhouettes_of_automobiles',
  'Silhouettes_of_cars',

  // Line drawings
  'Line_drawings_of_automobiles',
  'Line_drawings_of_cars',
  'Line_art_of_automobiles',

  // SVG technical drawings (often blueprints)
  'SVG_automobiles',
  'SVG_cars',

  // Dimensions / schematics
  'Automobile_dimensions',
  'Car_dimensions',
  'Vehicle_dimensions',

  // Scale drawings
  'Scale_drawings_of_automobiles',
  'Scale_models_of_automobiles',
];

// ─── Search queries ──────────────────────────────────────

const BLUEPRINT_SEARCHES = [
  // Generic blueprint terms
  'car blueprint', 'automobile blueprint', 'vehicle blueprint',
  'car orthographic drawing', 'car orthographic projection',
  'car technical drawing', 'automobile technical drawing',
  'car side view drawing', 'car front view drawing',
  'car plan view', 'car top view drawing',
  'car outline drawing', 'car line drawing',
  'car silhouette drawing', 'car dimensions drawing',
  'car scale drawing', 'automobile scale drawing',
  'car schematic drawing', 'vehicle schematic',

  // By brand
  'BMW blueprint', 'BMW technical drawing', 'BMW orthographic',
  'Mercedes-Benz blueprint', 'Mercedes blueprint', 'Mercedes technical drawing',
  'Porsche blueprint', 'Porsche technical drawing',
  'Audi blueprint', 'Audi technical drawing',
  'Ferrari blueprint', 'Ferrari technical drawing',
  'Lamborghini blueprint', 'Lamborghini technical drawing',
  'Volkswagen blueprint', 'VW blueprint',
  'Toyota blueprint', 'Toyota technical drawing',
  'Honda blueprint', 'Ford blueprint',
  'Nissan blueprint', 'Mazda blueprint',
  'Volvo blueprint', 'Jaguar blueprint',
  'Renault blueprint', 'Peugeot blueprint',
  'Fiat blueprint', 'Alfa Romeo blueprint',
  'Hyundai blueprint', 'Kia blueprint',
  'Chevrolet blueprint', 'Tesla blueprint',

  // Specific models
  'BMW 3 Series blueprint', 'BMW M3 blueprint', 'BMW 5 Series blueprint',
  'Mercedes S-Class blueprint', 'Mercedes E-Class blueprint',
  'Porsche 911 blueprint', 'Porsche Cayenne blueprint',
  'Audi A4 blueprint', 'Audi A6 blueprint',
  'VW Golf blueprint', 'VW Beetle blueprint',
  'Ferrari 458 blueprint', 'Ferrari F40 blueprint',
  'Lamborghini Countach blueprint', 'Lamborghini Huracan blueprint',
  'Toyota Supra blueprint', 'Honda NSX blueprint',
  'Nissan GT-R blueprint', 'Mazda MX-5 blueprint',
  'Ford Mustang blueprint', 'Ford GT blueprint',
  'Corvette blueprint', 'Dodge Viper blueprint',

  // Additional search variants
  'car wireframe', 'automobile wireframe',
  'car three view drawing', 'car multiview drawing',
  'car engineering drawing', 'car drafting',
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
    .from('brands')
    .select('id')
    .ilike('name', `%${brandName}%`)
    .limit(1)
    .single();

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
        if (ii.width < 300 || ii.height < 200) continue;
        if (!ii.mime?.startsWith('image/')) continue;

        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['gif', 'tiff', 'tif', 'pdf'].includes(ext)) continue;
        // Allow SVG for blueprints — they're often the best quality

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
      if (ii.width < 300 || ii.height < 200) continue;
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
    image_type: 'blueprint',
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
  console.log('  FLM AUTO — Mega Blueprint Scraper');
  console.log('  Target: 141 → 1,000 blueprints');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  const processedSearches = new Set(checkpoint.processedSearches);
  let { totalSaved, errors } = checkpoint;

  const seenUrls = new Set<string>();

  // Load existing blueprint URLs
  console.log('Loading existing blueprints...');
  let page = 0;
  while (true) {
    const { data } = await supabase.from('vehicle_images')
      .select('url')
      .eq('image_type', 'blueprint')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => seenUrls.add(r.url));
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Existing blueprints: ${seenUrls.size}\n`);

  if (totalSaved > 0) console.log(`Resuming: ${totalSaved} saved so far\n`);

  const startTime = Date.now();

  // ═══ PHASE 1: Categories + subcategories ═══
  console.log('═══ PHASE 1: Wikimedia Categories ═══\n');

  const allCategories = [...BLUEPRINT_CATEGORIES];
  console.log('Discovering subcategories...');
  let subCount = 0;
  for (const cat of BLUEPRINT_CATEGORIES) {
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

  for (let i = 0; i < BLUEPRINT_SEARCHES.length; i++) {
    const query = BLUEPRINT_SEARCHES[i];
    if (processedSearches.has(query)) continue;

    process.stdout.write(`  [${i + 1}/${BLUEPRINT_SEARCHES.length}] "${query}"...`);
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
  console.log('  BLUEPRINT SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total saved:    ${totalSaved}`);
  console.log(`  Categories:     ${processedCats.size}`);
  console.log(`  Searches:       ${processedSearches.size}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
