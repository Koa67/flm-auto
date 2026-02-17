/**
 * FLM AUTO -- Wikimedia Interior Photos Scraper
 * Searches Wikimedia Commons for interior/cockpit/trunk/dashboard photos
 * and inserts them into vehicle_images with proper subcategory tagging.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-wikimedia-interiors.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/wikimedia_interiors_checkpoint.json');
const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const DELAY_MS = 200;
const BATCH_INSERT_SIZE = 50;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Checkpoint ─────────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalFound: number;
  totalInserted: number;
  totalDupes: number;
  totalErrors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    completedBrands: [],
    totalFound: 0,
    totalInserted: 0,
    totalDupes: 0,
    totalErrors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(cp: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── paginateAll helper ─────────────────────────────────────────

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

// ─── Wikimedia API helpers ──────────────────────────────────────

async function wikimediaSearch(query: string, limit: number): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srnamespace: '6',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
      headers: { 'User-Agent': 'FLM-Auto-Bot/2.0 (contact@flm-auto.fr)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.query?.search || [];
  } catch {
    return [];
  }
}

interface ImageInfo {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  descriptionUrl: string;
}

async function getImageInfo(title: string): Promise<ImageInfo | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '1200',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`${WIKIMEDIA_API}?${params}`, {
      headers: { 'User-Agent': 'FLM-Auto-Bot/2.0 (contact@flm-auto.fr)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;

      // Filter: only jpg/jpeg/png, width > 600
      const urlLower = ii.url?.toLowerCase() || '';
      const isValidFormat = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') || urlLower.endsWith('.png');
      if (!isValidFormat) return null;
      if (ii.width < 600) return null;

      return {
        url: ii.url,
        thumbUrl: ii.thumburl || ii.url,
        width: ii.width,
        height: ii.height,
        descriptionUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ─── Subcategory classification ─────────────────────────────────

function classifySubcategory(filename: string): string {
  const lower = filename.toLowerCase();

  if (/rear.?seat|back.?seat|r[uü]cksitz|banquette|rear.?bench/.test(lower)) {
    return 'rear_seats';
  }
  if (/front.?seat|vordersitz|driver.?seat/.test(lower)) {
    return 'front_seats';
  }
  if (/trunk|boot|kofferraum|coffre|luggage|cargo.?area|laderaum/.test(lower)) {
    return 'trunk';
  }
  if (/steering|lenkrad|volant/.test(lower)) {
    return 'controls';
  }
  // Default for interior/cockpit/dashboard/innen/habitacle/interieur
  return 'dashboard';
}

// ─── Year extraction from filename ──────────────────────────────

function extractYear(filename: string): number | null {
  const match = filename.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  return match ? parseInt(match[1]) : null;
}

// ─── Generation matching ────────────────────────────────────────

function matchGenerations(
  modelGens: Array<{ id: string; production_start: number | null; production_end: number | null }>,
  year: number | null
): string[] {
  if (modelGens.length === 0) return [];

  if (year !== null) {
    // Find generations whose production range includes the year
    const matching = modelGens.filter(g => {
      const start = g.production_start || 1900;
      const end = g.production_end || 2099;
      return year >= start && year <= end;
    });
    if (matching.length > 0) return matching.map(g => g.id);
  }

  // No year found or no match: assign to the most recent generation
  const sorted = [...modelGens].sort((a, b) => (b.production_start || 0) - (a.production_start || 0));
  return [sorted[0].id];
}

// ─── Search queries per model ───────────────────────────────────

interface SearchQuery {
  suffix: string;
  limit: number;
}

const SEARCH_QUERIES: SearchQuery[] = [
  { suffix: 'interior', limit: 50 },
  { suffix: 'cockpit', limit: 30 },
  { suffix: 'dashboard', limit: 30 },
  { suffix: 'trunk', limit: 20 },
  { suffix: 'Innenraum', limit: 30 },
  { suffix: 'Kofferraum', limit: 20 },
];

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('================================================================');
  console.log('  FLM AUTO -- Wikimedia Interior Photos Scraper');
  console.log('================================================================');
  console.log('');

  const cp = loadCheckpoint();
  const completedSet = new Set(cp.completedBrands);

  // 1. Load all brands, models, generations
  console.log('Loading database...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll('generations', 'id, name, model_id, production_start, production_end');

  console.log(`  ${brands.length} brands, ${models.length} models, ${gens.length} generations`);

  // 2. Build lookups
  const modelsByBrand = new Map<string, typeof models>();
  for (const model of models) {
    const list = modelsByBrand.get(model.brand_id) || [];
    list.push(model);
    modelsByBrand.set(model.brand_id, list);
  }

  const gensByModel = new Map<string, typeof gens>();
  for (const gen of gens) {
    const list = gensByModel.get(gen.model_id) || [];
    list.push(gen);
    gensByModel.set(gen.model_id, list);
  }

  const startTime = Date.now();
  let sessionFound = 0;
  let sessionInserted = 0;
  let sessionDupes = 0;
  let sessionErrors = 0;

  // 3. Iterate brands
  const brandsToProcess = brands.filter(b => !completedSet.has(b.id));
  console.log(`\n  Brands remaining: ${brandsToProcess.length}/${brands.length}\n`);

  for (let bi = 0; bi < brandsToProcess.length; bi++) {
    const brand = brandsToProcess[bi];
    const brandModels = modelsByBrand.get(brand.id) || [];
    const brandNum = brands.length - brandsToProcess.length + bi + 1;

    let brandFound = 0;
    let brandInserted = 0;
    let modelsSearched = 0;

    for (const model of brandModels) {
      const modelGens = gensByModel.get(model.id) || [];
      if (modelGens.length === 0) continue;

      modelsSearched++;
      const seenTitles = new Set<string>();
      const insertBatch: any[] = [];

      // Run all search queries for this brand+model
      for (const sq of SEARCH_QUERIES) {
        const query = `${brand.name} ${model.name} ${sq.suffix}`;
        const results = await wikimediaSearch(query, sq.limit);
        await delay(DELAY_MS);

        for (const result of results) {
          const title = result.title as string;
          if (!title) continue;

          // Deduplicate within this model's searches
          if (seenTitles.has(title)) continue;
          seenTitles.add(title);

          // Get image info (URL, dimensions)
          const info = await getImageInfo(title);
          await delay(DELAY_MS);

          if (!info) continue;

          brandFound++;
          const filename = title.replace('File:', '');
          const subcategory = classifySubcategory(filename);
          const year = extractYear(filename);
          const matchedGenIds = matchGenerations(modelGens, year);

          for (const genId of matchedGenIds) {
            insertBatch.push({
              generation_id: genId,
              image_type: 'interior',
              image_subcategory: subcategory,
              url: info.url,
              thumbnail_url: info.thumbUrl,
              width: info.width,
              height: info.height,
              alt_text: filename.replace(/\.[^.]+$/, '').slice(0, 255),
              source: 'Wikimedia Commons',
              source_url: info.descriptionUrl,
              is_primary: false,
              display_order: 99,
            });
          }
        }
      }

      // Deduplicate against DB: check existing URLs for this model's generations
      if (insertBatch.length > 0) {
        const genIds = [...new Set(insertBatch.map(r => r.generation_id))];
        const existingUrlsSet = new Set<string>();

        // Fetch existing URLs for these generations in chunks
        for (let ci = 0; ci < genIds.length; ci += 20) {
          const chunk = genIds.slice(ci, ci + 20);
          const { data: existing } = await supabase
            .from('vehicle_images')
            .select('url')
            .in('generation_id', chunk)
            .eq('image_type', 'interior');
          if (existing) {
            for (const row of existing) existingUrlsSet.add(row.url);
          }
        }

        const newRows = insertBatch.filter(r => !existingUrlsSet.has(r.url));
        const dupes = insertBatch.length - newRows.length;
        brandInserted += newRows.length;
        sessionDupes += dupes;
        cp.totalDupes += dupes;

        // Insert in batches
        for (let i = 0; i < newRows.length; i += BATCH_INSERT_SIZE) {
          const batch = newRows.slice(i, i + BATCH_INSERT_SIZE);
          const { error } = await supabase.from('vehicle_images').insert(batch);
          if (error) {
            // Try one-by-one on batch failure
            for (const row of batch) {
              const { error: e } = await supabase.from('vehicle_images').insert(row);
              if (!e) {
                // already counted above
              } else if (e.code === '23505') {
                sessionDupes++;
                cp.totalDupes++;
                brandInserted--;
              } else {
                sessionErrors++;
                cp.totalErrors++;
                brandInserted--;
              }
            }
          }
        }
      }
    }

    sessionFound += brandFound;
    sessionInserted += brandInserted;
    cp.totalFound += brandFound;
    cp.totalInserted += brandInserted;
    cp.completedBrands.push(brand.id);
    saveCheckpoint(cp);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `  [${brandNum}/${brands.length}] ${brand.name} -- ` +
      `searched ${modelsSearched} models, found ${brandFound} images, ` +
      `inserted ${brandInserted} (${elapsed}s)`
    );
  }

  // ─── Final summary ─────────────────────────────────────────

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('================================================================');
  console.log('  SCRAPING COMPLETE');
  console.log('================================================================');
  console.log(`  Duration:        ${totalElapsed} min`);
  console.log(`  This session:    ${sessionFound} found, ${sessionInserted} inserted, ${sessionDupes} dupes, ${sessionErrors} errors`);
  console.log(`  All time:        ${cp.totalFound} found, ${cp.totalInserted} inserted, ${cp.totalDupes} dupes, ${cp.totalErrors} errors`);
  console.log(`  Brands done:     ${cp.completedBrands.length}/${brands.length}`);
  console.log('================================================================');
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
