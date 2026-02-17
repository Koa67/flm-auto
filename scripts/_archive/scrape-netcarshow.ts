/**
 * FLM AUTO — NetCarShow Mega Scraper
 * Discovers ALL models per brand, extracts HD gallery images
 * Matches to generations, deduplicates, checkpoint-enabled
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-netcarshow.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_netcarshow.json');
const BASE = 'https://www.netcarshow.com';
const DELAY_MS = 500;
const BATCH_SIZE = 50;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Brand slugs ─────────────────────────────────────────────

// NetCarShow uses lowercase brand slugs: /bmw/2023-x7/
const BRANDS: Record<string, string> = {
  'alfa_romeo': 'Alfa Romeo', 'audi': 'Audi', 'bmw': 'BMW',
  'citroen': 'Citroën', 'dacia': 'Dacia', 'ferrari': 'Ferrari',
  'fiat': 'Fiat', 'ford': 'Ford', 'honda': 'Honda',
  'hyundai': 'Hyundai', 'jaguar': 'Jaguar', 'kia': 'Kia',
  'lamborghini': 'Lamborghini', 'land_rover': 'Land Rover',
  'lexus': 'Lexus', 'mazda': 'Mazda', 'mercedes-benz': 'Mercedes-Benz',
  'mitsubishi': 'Mitsubishi', 'nissan': 'Nissan', 'opel': 'Opel',
  'peugeot': 'Peugeot', 'porsche': 'Porsche', 'renault': 'Renault',
  'seat': 'Seat', 'skoda': 'Skoda', 'subaru': 'Subaru',
  'suzuki': 'Suzuki', 'tesla': 'Tesla', 'toyota': 'Toyota',
  'volkswagen': 'Volkswagen', 'volvo': 'Volvo',
};

// ─── Checkpoint ──────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
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
  return { completedBrands: [], totalScanned: 0, totalSaved: 0, totalDupes: 0, totalUnmatched: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── HTTP ────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// ─── Discover all model pages for a brand ────────────────────

interface ModelPage {
  slug: string;
  name: string;
  year: number;
}

async function discoverBrandModels(brandSlug: string): Promise<ModelPage[]> {
  const html = await fetchHtml(`${BASE}/${brandSlug}/`);
  if (!html) return [];

  const models: ModelPage[] = [];
  const seen = new Set<string>();

  // NetCarShow URL pattern: /{brand}/{year}-{model}/ e.g. /bmw/2023-x7/
  const regex = new RegExp(`href="/${brandSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d{4})-([^/"]+)/"`, 'g');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const year = parseInt(match[1]);
    const modelSlug = match[2];
    const fullSlug = `${year}-${modelSlug}`;
    if (seen.has(fullSlug)) continue;
    seen.add(fullSlug);

    const rawName = modelSlug.replace(/_/g, ' ').replace(/-/g, ' ');
    models.push({ slug: fullSlug, name: rawName, year });
  }

  return models;
}

// ─── Extract gallery images from a model page ────────────────

async function extractGalleryImages(slug: string): Promise<string[]> {
  const html = await fetchHtml(`${BASE}/${slug}/`);
  if (!html) return [];

  const urls = new Set<string>();

  // Pattern 1: High-res images (1600x1200, 1280x960)
  const hdRegex = /(?:src|data-src)=["']([^"']+(?:1600x1200|1280x960|1024x768)[^"']*\.(?:jpg|jpeg|png))["']/gi;
  let match;
  while ((match = hdRegex.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `${BASE}${match[1]}`;
    if (!url.includes('icon') && !url.includes('logo') && !url.includes('flag')) {
      urls.add(url);
    }
  }

  // Pattern 2: Standard images with netcarshow domain
  const stdRegex = /(?:src|data-src)=["']((?:https?:)?\/\/[^"']*netcarshow\.com\/[^"']+\.(?:jpg|jpeg|png))["']/gi;
  while ((match = stdRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('//')) url = 'https:' + url;
    if (!url.includes('icon') && !url.includes('logo') && !url.includes('flag') && !url.includes('thumb')) {
      urls.add(url);
    }
  }

  return [...urls];
}

// ─── Classify image type from URL/filename ──────────────────

function classifyImage(url: string): string {
  const lower = url.toLowerCase();
  if (/interior|dashboard|cockpit|cabin|steering|instrument/i.test(lower)) return 'interior';
  if (/engine|motor|powertrain/i.test(lower)) return 'technical';
  return 'exterior';
}

// ─── Generation matching (pre-loaded) ───────────────────────

interface GenInfo {
  id: string;
  brandName: string;
  modelName: string;
  prodStart: number | null;
  prodEnd: number | null;
}

function normalizeModel(name: string): string {
  return name.toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/classe /i, '')
    .replace(/class /i, '')
    .replace(/serie /i, 'series ')
    .replace(/série /i, 'series ')
    .trim();
}

function matchGeneration(brandName: string, modelName: string, year: number, gens: GenInfo[]): GenInfo | null {
  const normModel = normalizeModel(modelName);
  const brandGens = gens.filter(g => g.brandName === brandName);

  // Pass 1: exact match within year range
  for (const gen of brandGens) {
    const normGenModel = normalizeModel(gen.modelName);
    if (normModel === normGenModel || normModel.includes(normGenModel) || normGenModel.includes(normModel)) {
      const start = gen.prodStart || 1900;
      const end = gen.prodEnd || 2030;
      if (year >= start && year <= end + 1) return gen;
    }
  }

  // Pass 2: partial match (any year)
  for (const gen of brandGens) {
    const normGenModel = normalizeModel(gen.modelName);
    if (normModel.includes(normGenModel) || normGenModel.includes(normModel)) {
      return gen;
    }
  }

  return null;
}

// ─── DB helpers ─────────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — NetCarShow Mega Scraper');
  console.log('═══════════════════════════════════════════════════════\n');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(BRANDS).length} brands done, ${cp.totalSaved} saved\n`);
  }

  // Load DB
  console.log('  Loading database...');
  const gens = await paginateAll('generations', 'id, name, model_id, production_start, production_end');
  const dbModels = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(dbModels.map((m: any) => [m.id, m]));

  const genInfos: GenInfo[] = gens
    .map((g: any) => {
      const model = modelMap.get(g.model_id);
      const brand = model ? brandMap.get(model.brand_id) : null;
      return { id: g.id, brandName: brand?.name || '', modelName: model?.name || '', prodStart: g.production_start, prodEnd: g.production_end };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  console.log(`  ${genInfos.length} generations loaded`);

  // Load existing URLs
  console.log('  Loading existing URLs...');
  const existingImages = await paginateAll('vehicle_images', 'url');
  const existingUrls = new Set(existingImages.map((r: any) => r.url));
  console.log(`  ${existingUrls.size} existing URLs\n`);

  const startTime = Date.now();
  let insertBatch: any[] = [];

  async function flushBatch() {
    if (insertBatch.length === 0) return;
    const { error } = await supabase.from('vehicle_images').insert(insertBatch);
    if (error) {
      for (const row of insertBatch) {
        const { error: e } = await supabase.from('vehicle_images').insert(row);
        if (!e) cp.totalSaved++;
        else if (e.code === '23505') cp.totalDupes++;
        else cp.errors++;
      }
    } else {
      cp.totalSaved += insertBatch.length;
    }
    insertBatch = [];
  }

  const brandEntries = Object.entries(BRANDS).filter(([slug]) => !completedBrands.has(slug));
  console.log(`  Brands remaining: ${brandEntries.length}\n`);

  for (let bi = 0; bi < brandEntries.length; bi++) {
    const [brandSlug, brandName] = brandEntries[bi];
    console.log(`  [${bi + 1}/${brandEntries.length}] ${brandName}`);

    const models = await discoverBrandModels(brandSlug);
    console.log(`    Found ${models.length} model pages`);
    await delay(DELAY_MS);

    for (let mi = 0; mi < models.length; mi++) {
      const model = models[mi];
      const images = await extractGalleryImages(model.slug);
      cp.totalScanned += images.length;

      const gen = matchGeneration(brandName, model.name, model.year, genInfos);
      if (!gen) {
        cp.totalUnmatched += images.length;
        await delay(DELAY_MS);
        continue;
      }

      for (const url of images) {
        if (existingUrls.has(url)) { cp.totalDupes++; continue; }

        insertBatch.push({
          generation_id: gen.id,
          image_type: classifyImage(url),
          url,
          thumbnail_url: url,
          width: 1600,
          height: 1200,
          alt_text: `${brandName} ${model.name} ${model.year}`,
          source: 'NetCarShow',
          is_primary: false,
          display_order: 99,
        });

        existingUrls.add(url);
        if (insertBatch.length >= BATCH_SIZE) await flushBatch();
      }

      await delay(DELAY_MS);

      if ((mi + 1) % 25 === 0) {
        console.log(
          `    ${mi + 1}/${models.length} | Saved: ${cp.totalSaved} Dupes: ${cp.totalDupes} ` +
          `Unmatched: ${cp.totalUnmatched}`
        );
      }
    }

    await flushBatch();

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Done | Total saved: ${cp.totalSaved} | ${Math.floor(elapsed / 60)}m elapsed`);

    completedBrands.add(brandSlug);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  await flushBatch();

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  NETCARSHOW SCRAPER — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Images scanned:  ${cp.totalScanned}`);
  console.log(`  Images saved:    ${cp.totalSaved}`);
  console.log(`  Duplicates:      ${cp.totalDupes}`);
  console.log(`  Unmatched:       ${cp.totalUnmatched}`);
  console.log(`  Errors:          ${cp.errors}`);
  console.log(`  Duration:        ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
