/**
 * FLM AUTO — Mega Wikimedia v2
 * Phase 1: Crawl broad categories (blueprints, cutaways, interiors, posters)
 * Phase 2: Match images to generations via filename parsing
 *
 * Targets:
 *   Blueprints     13,390 → 25,000+
 *   Cutaways          222 → 2,000+
 *   Interiors       9,885 → 20,000+
 *   Illustrations   6,483 → 15,000+
 *   Technical         916 → 5,000+
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_wikimedia_v2.json');
const DELAY_MS = 200;
const MAX_DEPTH = 3;
const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Categories to crawl ───────────────────────────────────

const CATEGORIES: { name: string; imageType: string }[] = [
  // Interiors (209 brand subcategories will be crawled recursively)
  { name: 'Automobile_interiors_by_brand', imageType: 'interior' },
  { name: 'Automobile_interiors', imageType: 'interior' },
  { name: 'Automobile_dashboards', imageType: 'interior' },

  // Concept cars (rich design imagery)
  { name: 'Concept_automobiles_by_brand', imageType: 'exterior' },

  // Advertisements (posters, brochures)
  { name: 'BMW_advertisements', imageType: 'illustration' },
  { name: 'Mercedes-Benz_advertisements', imageType: 'illustration' },
  { name: 'Audi_advertisements', imageType: 'illustration' },
  { name: 'Volkswagen_advertisements', imageType: 'illustration' },
  { name: 'Toyota_advertisements', imageType: 'illustration' },

  // Per-brand automobile categories (deep recursive crawl)
  { name: 'BMW_automobiles', imageType: 'exterior' },
  { name: 'BMW_automobile_interiors', imageType: 'interior' },
  { name: 'Mercedes-Benz_automobiles', imageType: 'exterior' },
  { name: 'Mercedes-Benz_automobile_interiors', imageType: 'interior' },
  { name: 'Audi_automobiles', imageType: 'exterior' },
  { name: 'Audi_automobile_interiors', imageType: 'interior' },
  { name: 'Volkswagen_automobiles', imageType: 'exterior' },
  { name: 'Porsche_automobiles', imageType: 'exterior' },
  { name: 'Porsche_automobile_interiors', imageType: 'interior' },
  { name: 'Toyota_automobiles', imageType: 'exterior' },
  { name: 'Honda_automobiles', imageType: 'exterior' },
  { name: 'Ford_automobiles', imageType: 'exterior' },
  { name: 'Tesla_automobiles', imageType: 'exterior' },
  { name: 'Lamborghini_automobiles', imageType: 'exterior' },
  { name: 'Ferrari_automobiles', imageType: 'exterior' },
  { name: 'Volvo_automobiles', imageType: 'exterior' },
  { name: 'Renault_automobiles', imageType: 'exterior' },
  { name: 'Peugeot_automobiles', imageType: 'exterior' },
  { name: 'Citroën_automobiles', imageType: 'exterior' },
  { name: 'Nissan_automobiles', imageType: 'exterior' },
  { name: 'Mazda_automobiles', imageType: 'exterior' },
  { name: 'Hyundai_automobiles', imageType: 'exterior' },
  { name: 'Kia_automobiles', imageType: 'exterior' },
  { name: 'Fiat_automobiles', imageType: 'exterior' },
  { name: 'Alfa_Romeo_automobiles', imageType: 'exterior' },
  { name: 'Jaguar_automobiles', imageType: 'exterior' },
  { name: 'Land_Rover_automobiles', imageType: 'exterior' },
  { name: 'Lexus_automobiles', imageType: 'exterior' },
  { name: 'Subaru_automobiles', imageType: 'exterior' },
  { name: 'Opel_automobiles', imageType: 'exterior' },
  { name: 'Škoda_Auto_automobiles', imageType: 'exterior' },
  { name: 'SEAT_automobiles', imageType: 'exterior' },
];

// ─── Checkpoint ────────────────────────────────────────────

interface Checkpoint {
  processedCategories: string[];
  totalScanned: number;
  totalSaved: number;
  totalSkipped: number;
  totalMatched: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedCategories: [],
    totalScanned: 0,
    totalSaved: 0,
    totalSkipped: 0,
    totalMatched: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Wikimedia API ─────────────────────────────────────────

interface WikiImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  title: string; // filename without "File:" prefix
}

async function getCategoryFiles(category: string, maxImages = 500): Promise<WikiImage[]> {
  const images: WikiImage[] = [];
  let gcmcontinue: string | undefined;

  while (images.length < maxImages) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${category}`,
      gcmtype: 'file',
      gcmlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });
    if (gcmcontinue) params.set('gcmcontinue', gcmcontinue);

    try {
      const res = await fetch(`${WIKIMEDIA_API}?${params}`);
      if (!res.ok) break;
      const data = await res.json();

      if (!data.query?.pages) break;

      for (const page of Object.values(data.query.pages) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 500 || ii.height < 300) continue;
        if (!ii.mime?.startsWith('image/')) continue;
        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['svg', 'pdf', 'tiff', 'tif', 'gif'].includes(ext)) continue;

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

      await delay(DELAY_MS);
    } catch {
      break;
    }
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
    const res = await fetch(`${WIKIMEDIA_API}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.categorymembers || []).map((c: any) => c.title?.replace('Category:', ''));
  } catch {
    return [];
  }
}

// Recursive category crawl — collects all files up to maxDepth
async function crawlCategory(
  category: string,
  depth: number,
  visited: Set<string>,
  maxImagesPerCat = 200
): Promise<WikiImage[]> {
  if (depth > MAX_DEPTH || visited.has(category)) return [];
  visited.add(category);

  const images = await getCategoryFiles(category, maxImagesPerCat);
  await delay(DELAY_MS);

  // Recurse into subcategories
  if (depth < MAX_DEPTH) {
    const subs = await getSubcategories(category);
    await delay(DELAY_MS);

    for (const sub of subs) {
      if (visited.has(sub)) continue;
      const subImages = await crawlCategory(sub, depth + 1, visited, Math.min(100, maxImagesPerCat));
      images.push(...subImages);
    }
  }

  return images;
}

// ─── Generation Matching ───────────────────────────────────

interface GenInfo {
  id: string;
  brandName: string;
  modelName: string;
  genName: string;
  chassisCode: string | null;
}

// Build normalized search patterns for each generation
function buildGenPatterns(gen: GenInfo): string[] {
  const patterns: string[] = [];
  const b = gen.brandName.toLowerCase();
  const m = gen.modelName.toLowerCase();

  patterns.push(`${b} ${m}`);
  patterns.push(`${b}_${m}`);

  if (gen.chassisCode) {
    const c = gen.chassisCode.toLowerCase();
    patterns.push(`${b} ${c}`);
    patterns.push(`${b}_${c}`);
    patterns.push(c); // chassis codes are often unique enough
  }

  return patterns;
}

function matchImageToGeneration(
  filename: string,
  genIndex: Map<string, GenInfo[]>
): GenInfo | null {
  const lower = filename.toLowerCase().replace(/[_\-\.]/g, ' ');

  // Try each pattern (longest match first is achieved by order)
  for (const [pattern, gens] of genIndex) {
    if (lower.includes(pattern)) {
      // If multiple gens match the same brand+model, pick the one
      // whose chassis code also appears, or first one
      if (gens.length === 1) return gens[0];

      // Try to disambiguate by chassis code
      for (const gen of gens) {
        if (gen.chassisCode && lower.includes(gen.chassisCode.toLowerCase())) {
          return gen;
        }
      }
      return gens[0]; // default to first
    }
  }

  return null;
}

// ─── DB helpers ────────────────────────────────────────────

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

async function getExistingUrls(): Promise<Set<string>> {
  const all = await paginateAll('vehicle_images', 'url');
  return new Set(all.map(r => r.url));
}

// ─── Image type classification override ────────────────────

function classifyImageType(filename: string, defaultType: string): string {
  const lower = filename.toLowerCase();

  if (/blueprint|schematic|technical.drawing/i.test(lower)) return 'blueprint';
  if (/cutaway|cross.section|transparenz/i.test(lower)) return 'cutaway';
  if (/interior|cockpit|dashboard|instrument.panel|steering/i.test(lower)) return 'interior';
  if (/engine|motor|power.?train|transmission/i.test(lower)) return 'technical';
  if (/poster|advertisement|advert|brochure|catalog/i.test(lower)) return 'illustration';
  if (/sketch|drawing|render|concept/i.test(lower)) return 'blueprint';
  if (/rear|front|side|profile|exterior/i.test(lower)) return 'exterior';

  return defaultType;
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega Wikimedia v2 (Category Crawler)');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedCats = new Set(checkpoint.processedCategories);
  let { totalScanned, totalSaved, totalSkipped, totalMatched, errors } = checkpoint;

  if (processedCats.size > 0) {
    console.log(`Resuming: ${processedCats.size} categories done, ${totalSaved} images saved\n`);
  }

  // Load DB data
  console.log('Loading database...');
  const gens = await paginateAll('generations', 'id, name, chassis_code, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  console.log(`  ${gens.length} generations, ${models.length} models, ${brands.length} brands`);

  // Build generation search index
  const genInfos: GenInfo[] = gens.map((g: any) => {
    const model = modelMap.get(g.model_id);
    const brand = model ? brandMap.get(model.brand_id) : null;
    return {
      id: g.id,
      brandName: brand?.name || '',
      modelName: model?.name || '',
      genName: g.name || '',
      chassisCode: g.chassis_code || null,
    };
  }).filter((g: GenInfo) => g.brandName && g.modelName);

  // Build index: pattern → GenInfo[]
  // Sort patterns by length descending so we try longer (more specific) first
  const genIndex = new Map<string, GenInfo[]>();
  for (const gen of genInfos) {
    for (const pat of buildGenPatterns(gen)) {
      const existing = genIndex.get(pat) || [];
      existing.push(gen);
      genIndex.set(pat, existing);
    }
  }

  // Sort index by pattern length descending
  const sortedIndex = new Map(
    [...genIndex.entries()].sort((a, b) => b[0].length - a[0].length)
  );

  console.log(`  Index: ${sortedIndex.size} search patterns\n`);

  // Load existing URLs to avoid duplicates
  console.log('Loading existing image URLs...');
  const existingUrls = await getExistingUrls();
  console.log(`  ${existingUrls.size} existing URLs\n`);

  // Filter categories not yet processed
  const catsToProcess = CATEGORIES.filter(c => !processedCats.has(c.name));
  console.log(`Categories to process: ${catsToProcess.length}/${CATEGORIES.length}\n`);

  const startTime = Date.now();

  for (let ci = 0; ci < catsToProcess.length; ci++) {
    const cat = catsToProcess[ci];
    console.log(`\n[${ ci + 1}/${catsToProcess.length}] Crawling: ${cat.name} (type: ${cat.imageType})`);

    const visited = new Set<string>();
    const images = await crawlCategory(cat.name, 0, visited, 500);
    totalScanned += images.length;

    console.log(`  Found ${images.length} images across ${visited.size} categories`);

    // Batch insert
    let catSaved = 0;
    let catMatched = 0;
    const insertBatch: any[] = [];

    for (const img of images) {
      // Skip duplicates
      if (existingUrls.has(img.url)) {
        totalSkipped++;
        continue;
      }

      // Match to generation
      const gen = matchImageToGeneration(img.title, sortedIndex);
      if (!gen) continue;

      catMatched++;
      totalMatched++;

      const imageType = classifyImageType(img.title, cat.imageType);

      insertBatch.push({
        generation_id: gen.id,
        image_type: imageType,
        url: img.url,
        thumbnail_url: img.thumbUrl,
        width: img.width,
        height: img.height,
        alt_text: `${gen.brandName} ${gen.modelName} ${gen.genName}`,
        source: 'Wikimedia Commons',
        is_primary: false,
        display_order: 99,
      });

      existingUrls.add(img.url); // prevent intra-batch dupes

      // Insert in chunks of 100
      if (insertBatch.length >= 100) {
        const { error } = await supabase.from('vehicle_images').insert(insertBatch);
        if (error) {
          errors++;
          console.error(`  Insert error: ${error.message}`);
        } else {
          catSaved += insertBatch.length;
          totalSaved += insertBatch.length;
        }
        insertBatch.length = 0;
      }
    }

    // Flush remaining
    if (insertBatch.length > 0) {
      const { error } = await supabase.from('vehicle_images').insert(insertBatch);
      if (error) {
        errors++;
        console.error(`  Insert error: ${error.message}`);
      } else {
        catSaved += insertBatch.length;
        totalSaved += insertBatch.length;
      }
    }

    console.log(`  Matched: ${catMatched} | Saved: ${catSaved} | Skipped dupes: ${totalSkipped}`);

    processedCats.add(cat.name);
    saveCheckpoint({
      processedCategories: [...processedCats],
      totalScanned,
      totalSaved,
      totalSkipped,
      totalMatched,
      errors,
      startedAt: checkpoint.startedAt,
    });
  }

  // Final report
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MEGA WIKIMEDIA v2 — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Categories crawled: ${processedCats.size}`);
  console.log(`  Images scanned:     ${totalScanned}`);
  console.log(`  Matched to gens:    ${totalMatched}`);
  console.log(`  Images saved:       ${totalSaved}`);
  console.log(`  Duplicates skipped: ${totalSkipped}`);
  console.log(`  Errors:             ${errors}`);
  console.log(`  Duration:           ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
