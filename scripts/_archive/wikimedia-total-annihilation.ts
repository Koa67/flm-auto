/**
 * FLM AUTO — Wikimedia Total Annihilation
 * Deep recursive crawl of all verified automobile categories
 * Discovers subcategories dynamically — no hardcoded names that might not exist
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/wikimedia-total-annihilation.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_total_annihilation.json');
const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const DELAY_MS = 100;
const MAX_DEPTH = 5;
const BATCH_INSERT_SIZE = 50;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Root categories to crawl (all verified to exist) ──────

const ROOT_CATEGORIES = [
  // Per-brand automobile categories (richest sources)
  'BMW automobiles',
  'Mercedes-Benz automobiles',
  'Audi automobiles',
  'Volkswagen automobiles',
  'Porsche automobiles',
  'Toyota automobiles',
  'Honda automobiles',
  'Ford automobiles',
  'Tesla automobiles',
  'Lamborghini automobiles',
  'Ferrari automobiles',
  'Volvo automobiles',
  'Renault automobiles',
  'Peugeot automobiles',
  'Citroën automobiles',
  'Nissan automobiles',
  'Mazda automobiles',
  'Hyundai automobiles',
  'Kia automobiles',
  'Fiat automobiles',
  'Alfa Romeo automobiles',
  'Jaguar automobiles',
  'Land Rover automobiles',
  'Lexus automobiles',
  'Subaru automobiles',
  'Opel automobiles',
  'SEAT automobiles',

  // Interiors (209 brand subcategories)
  'Automobile interiors by brand',

  // Concept automobiles
  'Concept automobiles by brand',

  // Parts & technical
  'Automobile parts',
  'Automobile engines',
  'Automobile wheels',
];

// ─── Checkpoint ────────────────────────────────────────────

interface Checkpoint {
  completedRoots: string[];
  visitedCategories: string[];
  totalScanned: number;
  totalSaved: number;
  totalDupes: number;
  totalUnmatched: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    completedRoots: [],
    visitedCategories: [],
    totalScanned: 0,
    totalSaved: 0,
    totalDupes: 0,
    totalUnmatched: 0,
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
  title: string;
}

async function fetchApi(params: Record<string, string>): Promise<any> {
  const urlParams = new URLSearchParams({
    ...params,
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKIMEDIA_API}?${urlParams}`, {
    headers: { 'User-Agent': 'FLM-Auto-Bot/2.0 (contact@flm-auto.fr)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Get files from a single category (with pagination)
async function getCategoryFiles(category: string): Promise<WikiImage[]> {
  const images: WikiImage[] = [];
  let gcmcontinue: string | undefined;

  do {
    try {
      const params: Record<string, string> = {
        action: 'query',
        generator: 'categorymembers',
        gcmtitle: `Category:${category}`,
        gcmtype: 'file',
        gcmlimit: '50',
        prop: 'imageinfo',
        iiprop: 'url|size|mime',
        iiurlwidth: '800',
      };
      if (gcmcontinue) params.gcmcontinue = gcmcontinue;

      const data = await fetchApi(params);
      if (!data.query?.pages) break;

      for (const page of Object.values(data.query.pages) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 400 || ii.height < 250) continue;
        if (!ii.mime?.startsWith('image/')) continue;
        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['svg', 'pdf', 'tiff', 'tif', 'gif', 'webp'].includes(ext)) continue;

        images.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', '') || '',
        });
      }

      gcmcontinue = data.continue?.gcmcontinue;
      await delay(DELAY_MS);
    } catch {
      break;
    }
  } while (gcmcontinue);

  return images;
}

// Get subcategories of a category
async function getSubcategories(category: string): Promise<string[]> {
  const subs: string[] = [];
  let cmcontinue: string | undefined;

  do {
    try {
      const params: Record<string, string> = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmtype: 'subcat',
        cmlimit: '500',
      };
      if (cmcontinue) params.cmcontinue = cmcontinue;

      const data = await fetchApi(params);
      for (const m of data.query?.categorymembers || []) {
        subs.push(m.title.replace('Category:', ''));
      }
      cmcontinue = data.continue?.cmcontinue;
      await delay(DELAY_MS);
    } catch {
      break;
    }
  } while (cmcontinue);

  return subs;
}

// ─── Recursive crawler ────────────────────────────────────

async function crawlRecursive(
  category: string,
  depth: number,
  visited: Set<string>,
  onImages: (images: WikiImage[], category: string) => Promise<void>
): Promise<number> {
  if (depth > MAX_DEPTH || visited.has(category)) return 0;
  visited.add(category);

  // Skip categories unlikely to contain car photos
  const lower = category.toLowerCase();
  if (
    lower.includes('by country') ||
    lower.includes('by location') ||
    lower.includes('by background') ||
    lower.includes('by year') ||
    lower.includes('by decade') ||
    lower.includes('in art') ||
    lower.includes('museums') ||
    lower.includes('model cars') ||
    lower.includes('miniature') ||
    lower.includes('toys') ||
    lower.includes('unidentified') ||
    lower.includes('replicas') ||
    lower.includes('motorsport') ||
    lower.includes('racing') ||
    lower.includes('rally') ||
    lower.includes('taxis') ||
    lower.includes('police') ||
    lower.includes('burned') ||
    lower.includes('wrecked') ||
    lower.includes('abandoned')
  ) {
    return 0;
  }

  let total = 0;

  // Get files from this category
  const files = await getCategoryFiles(category);
  if (files.length > 0) {
    await onImages(files, category);
    total += files.length;
  }

  // Recurse into subcategories
  if (depth < MAX_DEPTH) {
    const subs = await getSubcategories(category);
    for (const sub of subs) {
      if (!visited.has(sub)) {
        total += await crawlRecursive(sub, depth + 1, visited, onImages);
      }
    }
  }

  return total;
}

// ─── Generation matching ───────────────────────────────────

interface GenInfo {
  id: string;
  brandName: string;
  modelName: string;
  genName: string;
  chassisCode: string | null;
}

function buildMatchIndex(genInfos: GenInfo[]): Map<string, GenInfo[]> {
  const index = new Map<string, GenInfo[]>();

  for (const gen of genInfos) {
    const patterns = [
      `${gen.brandName.toLowerCase()} ${gen.modelName.toLowerCase()}`,
      `${gen.brandName.toLowerCase()}_${gen.modelName.toLowerCase()}`,
    ];
    if (gen.chassisCode) {
      patterns.push(`${gen.brandName.toLowerCase()} ${gen.chassisCode.toLowerCase()}`);
      patterns.push(`${gen.brandName.toLowerCase()}_${gen.chassisCode.toLowerCase()}`);
      patterns.push(gen.chassisCode.toLowerCase());
    }

    for (const pat of patterns) {
      const existing = index.get(pat) || [];
      existing.push(gen);
      index.set(pat, existing);
    }
  }

  // Sort by pattern length descending (longer = more specific)
  return new Map([...index.entries()].sort((a, b) => b[0].length - a[0].length));
}

function matchImage(filename: string, index: Map<string, GenInfo[]>): GenInfo | null {
  const lower = filename.toLowerCase().replace(/[_\-\.]/g, ' ');

  for (const [pattern, gens] of index) {
    if (lower.includes(pattern)) {
      if (gens.length === 1) return gens[0];
      // Disambiguate by chassis code
      for (const gen of gens) {
        if (gen.chassisCode && lower.includes(gen.chassisCode.toLowerCase())) {
          return gen;
        }
      }
      return gens[0];
    }
  }
  return null;
}

// Also try matching from the category name itself
function matchFromCategory(category: string, index: Map<string, GenInfo[]>): GenInfo | null {
  const lower = category.toLowerCase().replace(/[_\-]/g, ' ');
  for (const [pattern, gens] of index) {
    if (pattern.length >= 5 && lower.includes(pattern)) {
      return gens[0];
    }
  }
  return null;
}

// ─── Image type classification ─────────────────────────────

function classifyType(filename: string, category: string): string {
  const f = filename.toLowerCase();
  const c = category.toLowerCase();

  if (/blueprint|schematic/i.test(f + c)) return 'blueprint';
  if (/cutaway|cross.section|transparenz/i.test(f + c)) return 'cutaway';
  if (/patent/i.test(f + c)) return 'technical';
  if (/diagram|wiring/i.test(f + c)) return 'technical';
  if (/engine|motor|transmission|getriebe/i.test(f + c)) return 'technical';
  if (/brake|caliper|suspension/i.test(f + c)) return 'technical';
  if (/turbo|supercharger|intercooler/i.test(f + c)) return 'technical';
  if (/interior|cockpit|dashboard|armaturenbrett|innen/i.test(f + c)) return 'interior';
  if (/steering|lenkrad|volant/i.test(f + c)) return 'interior';
  if (/seat|sitz|siège/i.test(f + c)) return 'interior';
  if (/infotainment|navigation|touchscreen/i.test(f + c)) return 'interior';
  if (/instrument|tacho|speedometer/i.test(f + c)) return 'interior';
  if (/poster|advertisement|advert|brochure|catalog/i.test(f + c)) return 'illustration';
  if (/sketch|drawing|render|concept|clay/i.test(f + c)) return 'blueprint';
  if (/wheel|felge|tire|reifen/i.test(f + c)) return 'exterior';
  if (/headlight|taillight|scheinwerfer/i.test(f + c)) return 'exterior';

  return 'exterior';
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

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('  ████████╗ ██████╗ ████████╗ █████╗ ██╗');
  console.log('  ╚══██╔══╝██╔═══██╗╚══██╔══╝██╔══██╗██║');
  console.log('     ██║   ██║   ██║   ██║   ███████║██║');
  console.log('     ██║   ╚██████╔╝   ██║   ██║  ██║███████╗');
  console.log('     ╚═╝    ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝');
  console.log('       A N N I H I L A T I O N');
  console.log('');
  console.log(`  ${ROOT_CATEGORIES.length} root categories | depth ${MAX_DEPTH}`);
  console.log('');

  // Load checkpoint
  const cp = loadCheckpoint();
  const completedRoots = new Set(cp.completedRoots);

  if (completedRoots.size > 0) {
    console.log(`  Resuming: ${completedRoots.size}/${ROOT_CATEGORIES.length} roots done`);
    console.log(`  ${cp.totalSaved} saved, ${cp.totalDupes} dupes\n`);
  }

  // Load DB
  console.log('  Loading database...');
  const gens = await paginateAll('generations', 'id, name, chassis_code, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  const genInfos: GenInfo[] = gens
    .map((g: any) => {
      const model = modelMap.get(g.model_id);
      const brand = model ? brandMap.get(model.brand_id) : null;
      return {
        id: g.id,
        brandName: brand?.name || '',
        modelName: model?.name || '',
        genName: g.name || '',
        chassisCode: g.chassis_code || null,
      };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  const matchIndex = buildMatchIndex(genInfos);
  console.log(`  ${genInfos.length} generations, ${matchIndex.size} search patterns`);

  // Load existing URLs
  console.log('  Loading existing URLs...');
  const existingImages = await paginateAll('vehicle_images', 'url');
  const existingUrls = new Set(existingImages.map((r: any) => r.url));
  console.log(`  ${existingUrls.size} existing URLs\n`);

  // Process root categories
  const rootsToProcess = ROOT_CATEGORIES.filter(r => !completedRoots.has(r));
  console.log(`  Roots remaining: ${rootsToProcess.length}\n`);

  const startTime = Date.now();
  let insertBatch: any[] = [];

  async function flushBatch() {
    if (insertBatch.length === 0) return;
    const { error } = await supabase.from('vehicle_images').insert(insertBatch);
    if (error) {
      cp.errors++;
      // Try one by one on batch error
      for (const row of insertBatch) {
        const { error: singleErr } = await supabase.from('vehicle_images').insert(row);
        if (!singleErr) cp.totalSaved++;
        else if (singleErr.code === '23505') cp.totalDupes++;
        else cp.errors++;
      }
    } else {
      cp.totalSaved += insertBatch.length;
    }
    insertBatch = [];
  }

  async function handleImages(images: WikiImage[], category: string) {
    const catGen = matchFromCategory(category, matchIndex);

    for (const img of images) {
      cp.totalScanned++;

      if (existingUrls.has(img.url)) {
        cp.totalDupes++;
        continue;
      }

      // Try matching from filename first, then from category
      const gen = matchImage(img.title, matchIndex) || catGen;
      if (!gen) {
        cp.totalUnmatched++;
        continue;
      }

      const imageType = classifyType(img.title, category);

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

      existingUrls.add(img.url);

      if (insertBatch.length >= BATCH_INSERT_SIZE) {
        await flushBatch();
      }

      // Progress every 500 images
      if (cp.totalScanned % 500 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(
          `    [${new Date().toISOString().slice(11, 19)}] ` +
          `Scanned: ${cp.totalScanned} | Saved: ${cp.totalSaved} | ` +
          `Dupes: ${cp.totalDupes} | Unmatched: ${cp.totalUnmatched} | ` +
          `${Math.floor(elapsed / 60)}m elapsed`
        );
      }
    }
  }

  for (let ri = 0; ri < rootsToProcess.length; ri++) {
    const root = rootsToProcess[ri];
    const visited = new Set(cp.visitedCategories);

    console.log(`\n  [${ri + 1}/${rootsToProcess.length}] ${root}`);

    const totalImages = await crawlRecursive(root, 0, visited, handleImages);
    await flushBatch();

    console.log(
      `    Files found: ${totalImages} | Categories visited: ${visited.size} | ` +
      `Running total saved: ${cp.totalSaved}`
    );

    completedRoots.add(root);
    cp.completedRoots = [...completedRoots];
    cp.visitedCategories = [...visited];
    saveCheckpoint(cp);
  }

  // Final flush
  await flushBatch();

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n');
  console.log('  ═══════════════════════════════════════════════════');
  console.log('    TOTAL ANNIHILATION — COMPLETE');
  console.log('  ═══════════════════════════════════════════════════');
  console.log(`    Root categories:   ${cp.completedRoots.length}`);
  console.log(`    Categories visited: ${cp.visitedCategories.length}`);
  console.log(`    Images scanned:    ${cp.totalScanned}`);
  console.log(`    Images saved:      ${cp.totalSaved}`);
  console.log(`    Duplicates:        ${cp.totalDupes}`);
  console.log(`    Unmatched:         ${cp.totalUnmatched}`);
  console.log(`    Errors:            ${cp.errors}`);
  console.log(`    Duration:          ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('  ═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
