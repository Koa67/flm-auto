/**
 * FLM AUTO — Technical Assets Scraper
 * Blueprints, cutaways, diagrams, sketches, patent drawings
 *
 * Sources: Wikimedia Commons categories + text search
 * Target: 1500+ technical assets
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-technical-assets.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_technical.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Categories to crawl ─────────────────────────────────

const TECHNICAL_CATEGORIES = [
  // Cutaways & sections
  'Cutaway_drawings_of_automobiles',
  'Automobile_cutaway_drawings',
  'Sectional_views_of_automobiles',
  'Cutaway_drawings_of_engines',
  'Cutaway_drawings_of_cars',

  // Design & styling
  'Automobile_design',
  'Automobile_styling',
  'Car_design',
  'Concept_car_design',
  'Automobile_design_sketches',
  'Car_design_sketches',

  // Diagrams
  'Automobile_diagrams',
  'Automobile_engine_diagrams',
  'Internal_combustion_engine_diagrams',
  'Transmission_diagrams',
  'Automobile_suspension_diagrams',
  'Engine_diagrams',

  // Patents
  'Patent_drawings_of_automobiles',
  'Automobile_patents',

  // SVG technical
  'SVG_automobiles',
  'SVG_automobile_diagrams',
  'SVG_engines',

  // Brand-specific design
  'BMW_design',
  'Mercedes-Benz_design',
  'Porsche_design',
  'Ferrari_design',
  'Lamborghini_design',
  'Audi_design',
  'Volkswagen_design',
  'Ford_design',
  'Toyota_design',
  'Concept_cars_by_BMW',
  'Concept_cars_by_Mercedes-Benz',
  'Concept_cars_by_Audi',
  'Concept_cars_by_Porsche',

  // Technical views
  'Automobile_chassis',
  'Automobile_engines',
  'Automobile_transmissions',
  'Automobile_suspensions',
  'Disc_brakes',
  'Drum_brakes',
  'Turbochargers',
  'Superchargers',
  'Automobile_differentials',
  'Automobile_steering',

  // Renders and concepts
  'Concept_cars',
  'Automobile_prototypes',
];

// ─── Search queries ──────────────────────────────────────

const TECHNICAL_SEARCHES = [
  // Blueprints
  'car blueprint', 'automobile blueprint', 'vehicle blueprint',
  'car orthographic', 'car technical drawing', 'automobile technical drawing',
  'car side view drawing', 'car plan drawing',

  // By brand
  'BMW blueprint', 'Mercedes blueprint', 'Mercedes-Benz blueprint',
  'Porsche blueprint', 'Ferrari blueprint', 'Lamborghini blueprint',
  'Audi blueprint', 'Volkswagen blueprint', 'Toyota blueprint',
  'Ford blueprint', 'Honda blueprint', 'Nissan blueprint',
  'Mazda blueprint', 'Volvo blueprint', 'Jaguar blueprint',
  'Renault blueprint', 'Peugeot blueprint', 'Fiat blueprint',

  // Cutaways
  'car cutaway', 'automobile cutaway', 'engine cutaway',
  'car cross section', 'automobile cross section',
  'car exploded view', 'engine exploded view',

  // Design
  'car design sketch', 'automobile sketch', 'concept car sketch',
  'car rendering', 'car design drawing', 'automobile rendering',

  // Technical
  'car diagram', 'engine diagram', 'transmission diagram',
  'suspension diagram', 'turbocharger diagram',
  'car schematic', 'automobile schematic',

  // Patents
  'automobile patent drawing', 'car patent design',
  'vehicle design patent',
];

// ─── Checkpoint ──────────────────────────────────────────

interface CheckpointData {
  processedCategories: string[];
  processedSearches: string[];
  totalSaved: number;
  byType: Record<string, number>;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedCategories: [], processedSearches: [],
    totalSaved: 0, byType: {}, errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Image type classification ───────────────────────────

function classifyImageType(title: string, desc: string = ''): string {
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('blueprint') || text.includes('orthographic') || text.includes('plan view') || text.includes('side view drawing')) return 'blueprint';
  if (text.includes('cutaway') || text.includes('cross section') || text.includes('sectional') || text.includes('exploded')) return 'cutaway';
  if (text.includes('diagram') || text.includes('schematic') || text.includes('schema')) return 'diagram';
  if (text.includes('sketch') || text.includes('design drawing') || text.includes('design sketch')) return 'sketch';
  if (text.includes('patent')) return 'patent';
  if (text.includes('render') || text.includes('cgi') || text.includes('3d model')) return 'render';
  if (title.toLowerCase().endsWith('.svg')) return 'diagram';
  if (text.includes('concept') || text.includes('prototype')) return 'illustration';
  if (text.includes('engine') || text.includes('motor') || text.includes('transmission') || text.includes('suspension')) return 'technical';
  return 'technical';
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

  // Get a generation from this brand
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

// ─── Wikimedia Category Fetcher ──────────────────────────

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

        const desc = ii.extmetadata?.ImageDescription?.value || '';

        images.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', '') || '',
          description: desc,
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

// ─── Wikimedia Search (also subcategories) ───────────────

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
      if (ii.width < 300 || ii.height < 200) continue;
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

async function insertImage(img: any, seenUrls: Set<string>): Promise<{ saved: boolean; type: string }> {
  if (seenUrls.has(img.url)) return { saved: false, type: '' };

  const imageType = classifyImageType(img.title, img.description);
  const brand = extractBrand(img.title);
  const genId = brand ? await getGenForBrand(brand) : null;

  const { error } = await supabase.from('vehicle_images').insert({
    generation_id: genId,
    url: img.url,
    thumbnail_url: img.thumbUrl,
    source: 'Wikimedia Commons',
    source_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(img.title)}`,
    image_type: imageType,
    width: img.width,
    height: img.height,
    alt_text: img.title.replace(/\.[^.]+$/, '').slice(0, 255),
  });

  if (!error) {
    seenUrls.add(img.url);
    return { saved: true, type: imageType };
  }
  return { saved: false, type: '' };
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Technical Assets Scraper');
  console.log('  Target: 1500+ blueprints, diagrams, cutaways, etc.');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  const processedSearches = new Set(checkpoint.processedSearches);
  let { totalSaved, byType, errors } = checkpoint;

  const seenUrls = new Set<string>();

  // Load existing technical image URLs
  console.log('Loading existing technical images...');
  const techTypes = ['blueprint', 'diagram', 'cutaway', 'sketch', 'patent', 'render', 'technical', 'illustration'];
  for (const t of techTypes) {
    let page = 0;
    while (true) {
      const { data } = await supabase.from('vehicle_images')
        .select('url')
        .eq('image_type', t)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      data.forEach(r => seenUrls.add(r.url));
      if (data.length < 1000) break;
      page++;
    }
  }
  console.log(`Existing technical images: ${seenUrls.size}\n`);

  if (totalSaved > 0) {
    console.log(`Resuming: ${totalSaved} saved so far\n`);
  }

  const startTime = Date.now();

  // ═══ PHASE 1: Category crawl with subcategories ═══
  console.log('═══ PHASE 1: Wikimedia Categories (+ subcategories) ═══\n');

  const allCategories = [...TECHNICAL_CATEGORIES];

  // Discover subcategories for the first batch
  console.log('Discovering subcategories...');
  let subCount = 0;
  for (const cat of TECHNICAL_CATEGORIES.slice(0, 15)) {
    const subs = await getSubcategories(cat);
    for (const sub of subs) {
      if (!allCategories.includes(sub)) {
        allCategories.push(sub);
        subCount++;
      }
    }
    await delay(200);
  }
  console.log(`Found ${subCount} subcategories (total: ${allCategories.length} categories)\n`);

  for (let i = 0; i < allCategories.length; i++) {
    const cat = allCategories[i];
    if (processedCats.has(cat)) continue;

    process.stdout.write(`  [${i + 1}/${allCategories.length}] ${cat.slice(0, 50).padEnd(50)}...`);

    const images = await fetchCategoryImages(cat, 200);
    let batchSaved = 0;

    for (const img of images) {
      const { saved, type } = await insertImage(img, seenUrls);
      if (saved) {
        totalSaved++;
        batchSaved++;
        byType[type] = (byType[type] || 0) + 1;
      }
    }

    processedCats.add(cat);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    // Checkpoint every 10 categories
    if ((i + 1) % 10 === 0) {
      saveCheckpoint({
        processedCategories: [...processedCats],
        processedSearches: [...processedSearches],
        totalSaved, byType, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(300);
  }

  // ═══ PHASE 2: Text searches ═══
  console.log('\n═══ PHASE 2: Wikimedia Text Searches ═══\n');

  for (let i = 0; i < TECHNICAL_SEARCHES.length; i++) {
    const query = TECHNICAL_SEARCHES[i];
    if (processedSearches.has(query)) continue;

    process.stdout.write(`  [${i + 1}/${TECHNICAL_SEARCHES.length}] "${query}"...`);

    const images = await searchWikimediaImages(query, 50);
    let batchSaved = 0;

    for (const img of images) {
      const { saved, type } = await insertImage(img, seenUrls);
      if (saved) {
        totalSaved++;
        batchSaved++;
        byType[type] = (byType[type] || 0) + 1;
      }
    }

    processedSearches.add(query);
    console.log(` ${images.length} found, +${batchSaved} saved (total: ${totalSaved})`);

    if ((i + 1) % 10 === 0) {
      saveCheckpoint({
        processedCategories: [...processedCats],
        processedSearches: [...processedSearches],
        totalSaved, byType, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(500);
  }

  // Final save
  saveCheckpoint({
    processedCategories: [...processedCats],
    processedSearches: [...processedSearches],
    totalSaved, byType, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TECHNICAL ASSETS SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total saved:    ${totalSaved}`);
  console.log('');
  console.log('  By type:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    console.log(`    ${type.padEnd(15)} ${count}`);
  }
  console.log('');
  console.log(`  Categories:     ${processedCats.size}`);
  console.log(`  Searches:       ${processedSearches.size}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
