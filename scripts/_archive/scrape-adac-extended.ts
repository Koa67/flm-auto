/**
 * FLM AUTO — ADAC Extended Dimensions Scraper
 * Extends the ADAC scraper to fetch additional dimension data:
 *   - Trunk loading height, loading width, internal dimensions
 *   - Rear bench width
 *   - Door opening angles, step-in heights
 *
 * Crawls ADAC Autokatalog site structure:
 *   Brand page -> Model slugs -> Generation page (Apollo state) -> Car detail page
 * Extracts extended dimension fields from "name":"...","value":"..." pairs in Apollo state.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-adac-extended.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_adac_extended.json');
const ADAC_BASE = 'https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle';
const DELAY_MS = 1000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- ADAC brand slugs (same as v2 scraper) ----------------------------------

const BRAND_SLUGS: Record<string, string> = {
  'Alfa Romeo': 'alfa-romeo', 'Audi': 'audi', 'BMW': 'bmw',
  'Citroen': 'citroen', 'Dacia': 'dacia', 'Ferrari': 'ferrari',
  'Fiat': 'fiat', 'Ford': 'ford', 'Honda': 'honda',
  'Hyundai': 'hyundai', 'Jaguar': 'jaguar', 'Kia': 'kia',
  'Lamborghini': 'lamborghini', 'Land Rover': 'land-rover',
  'Lexus': 'lexus', 'Mazda': 'mazda', 'Mercedes-Benz': 'mercedes-benz',
  'Mitsubishi': 'mitsubishi', 'Nissan': 'nissan', 'Opel': 'opel',
  'Peugeot': 'peugeot', 'Porsche': 'porsche', 'Renault': 'renault',
  'Seat': 'seat', 'Skoda': 'skoda', 'Subaru': 'subaru',
  'Suzuki': 'suzuki', 'Tesla': 'tesla', 'Toyota': 'toyota',
  'Volkswagen': 'volkswagen', 'Volvo': 'volvo',
};

// --- Checkpoint --------------------------------------------------------------

interface Checkpoint {
  completedBrands: string[];
  totalUpdated: number;
  totalSkipped: number;
  totalCarPages: number;
  totalNoExtData: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    completedBrands: [],
    totalUpdated: 0,
    totalSkipped: 0,
    totalCarPages: 0,
    totalNoExtData: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// --- HTTP fetch (same pattern as v2 scraper) ---------------------------------

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// --- Step 1: Discover model slugs from brand page ----------------------------

async function discoverModelSlugs(brandSlug: string): Promise<string[]> {
  const html = await fetchHtml(`${ADAC_BASE}/${brandSlug}/`);
  if (!html) return [];

  const slugs = new Set<string>();
  const regex = new RegExp(
    `/marken-modelle/${brandSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([a-z0-9][a-z0-9-]*)/`,
    'g'
  );
  let m;
  while ((m = regex.exec(html)) !== null) {
    const slug = m[1];
    if (!slug.startsWith('#') && slug !== brandSlug) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

// --- Step 2: Discover generations from model page ----------------------------

interface AdacGeneration {
  genSlug: string;
  genName: string;
  manufacturedFrom: number | null;
  manufacturedUntil: number | null;
}

async function discoverGenerations(brandSlug: string, modelSlug: string): Promise<AdacGeneration[]> {
  const html = await fetchHtml(`${ADAC_BASE}/${brandSlug}/${modelSlug}/`);
  if (!html) return [];

  const gens: AdacGeneration[] = [];

  // Extract Apollo state for generation data
  const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;\s*window\./);
  if (apolloMatch) {
    try {
      const raw = apolloMatch[1].replace(/[\x00-\x1f]/g, ' ');
      const data = JSON.parse(raw);

      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('ApilGenerationCollectionItem:') && typeof val === 'object' && val !== null) {
          const v = val as any;
          gens.push({
            genSlug: v.slug || '',
            genName: v.name || '',
            manufacturedFrom: v.manufacturedFrom || null,
            manufacturedUntil: v.manufacturedUntil || null,
          });
        }
      }
    } catch {
      // Parse error, fall through to link-based discovery
    }
  }

  // Fallback: discover generation slugs from links
  if (gens.length === 0) {
    const regex = new RegExp(`/${brandSlug}/${modelSlug}/([a-z0-9][a-z0-9-]*)/`, 'g');
    let m;
    const seen = new Set<string>();
    while ((m = regex.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        gens.push({ genSlug: m[1], genName: m[1], manufacturedFrom: null, manufacturedUntil: null });
      }
    }
  }

  return gens;
}

// --- Step 3: Get first car ID from generation page ---------------------------

async function getFirstCarId(brandSlug: string, modelSlug: string, genSlug: string): Promise<string | null> {
  const html = await fetchHtml(`${ADAC_BASE}/${brandSlug}/${modelSlug}/${genSlug}/`);
  if (!html) return null;

  // Look for car detail link
  const linkMatch = html.match(new RegExp(`/${brandSlug}/${modelSlug}/${genSlug}/(\\d+)/`));
  if (linkMatch) return linkMatch[1];

  // Try Apollo state
  const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;\s*window\./);
  if (apolloMatch) {
    try {
      const raw = apolloMatch[1].replace(/[\x00-\x1f]/g, ' ');
      const data = JSON.parse(raw);
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('ApilCarCollectionItem:')) {
          const id = (val as any).id;
          if (id) return id;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

// --- Step 4: Extract extended dimension data from car detail page ------------

interface ExtendedDimensions {
  trunk_loading_height_mm?: number;
  trunk_loading_width_mm?: number;
  trunk_length_mm?: number;
  trunk_width_mm?: number;
  trunk_width_wheelhouses_mm?: number;
  trunk_height_mm?: number;
  rear_bench_width_total_mm?: number;
  door_opening_angle_front?: number;
  door_opening_angle_rear?: number;
  step_in_height_front_mm?: number;
  step_in_height_rear_mm?: number;
}

function extractExtendedDimensions(html: string): ExtendedDimensions | null {
  // Extract name/value pairs: "name":"...","value":"..."
  const pairs = html.matchAll(/"name":"([^"]+)","value":"([^"]*)"/g);
  const techMap = new Map<string, string>();

  for (const [, name, value] of pairs) {
    if (value && value.trim()) {
      techMap.set(name, value.trim());
    }
  }

  const parseNum = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1]) : undefined;
  };

  const data: ExtendedDimensions = {};

  // Trunk loading edge / opening
  data.trunk_loading_height_mm = parseNum(
    techMap.get('Ladekantenhöhe') ||
    techMap.get('Ladekantenhöhe ')  // Some entries have trailing space
  );

  data.trunk_loading_width_mm = parseNum(
    techMap.get('Ladeöffnungsbreite') ||
    techMap.get('Ladeöffnung Breite') ||
    techMap.get('Ladeöffnungsbreite ')
  );

  // Internal trunk dimensions
  data.trunk_length_mm = parseNum(
    techMap.get('Kofferraumlänge') ||
    techMap.get('Kofferraumlänge ')
  );

  data.trunk_width_mm = parseNum(
    techMap.get('Kofferraumbreite') ||
    techMap.get('Kofferraumbreite ')
  );

  data.trunk_width_wheelhouses_mm = parseNum(
    techMap.get('Breite zwischen Radkästen') ||
    techMap.get('Breite zwischen den Radkästen') ||
    techMap.get('Breite zwischen Radkästen ')
  );

  data.trunk_height_mm = parseNum(
    techMap.get('Kofferraumhöhe') ||
    techMap.get('Kofferraumhöhe ')
  );

  // Rear bench
  data.rear_bench_width_total_mm = parseNum(
    techMap.get('Sitzbreite hinten') ||
    techMap.get('Sitzbreite hinten ') ||
    techMap.get('Sitzflächenbreite hinten')
  );

  // Door opening angles
  data.door_opening_angle_front = parseNum(
    techMap.get('Türöffnungswinkel vorn') ||
    techMap.get('Türöffnungswinkel vorne') ||
    techMap.get('Türöffnungswinkel vorn ')
  );

  data.door_opening_angle_rear = parseNum(
    techMap.get('Türöffnungswinkel hinten') ||
    techMap.get('Türöffnungswinkel hinten ')
  );

  // Step-in heights
  data.step_in_height_front_mm = parseNum(
    techMap.get('Einstiegshöhe vorn') ||
    techMap.get('Einstiegshöhe vorne') ||
    techMap.get('Einstiegshöhe vorn ')
  );

  data.step_in_height_rear_mm = parseNum(
    techMap.get('Einstiegshöhe hinten') ||
    techMap.get('Einstiegshöhe hinten ')
  );

  // Only return if we got at least one useful value
  const nonNullCount = Object.values(data).filter(v => v !== undefined).length;
  if (nonNullCount === 0) return null;

  return data;
}

// --- Generation matching (same logic as v2 scraper) --------------------------

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
    .replace(/er reihe$/i, '')
    .replace(/er$/i, '')
    .replace(/ reihe$/i, '')
    .replace(/classe /i, '')
    .replace(/class /i, '')
    .replace(/serie /i, 'series ')
    .replace(/série /i, 'series ')
    .trim();
}

function matchGeneration(
  brandName: string,
  adacModelSlug: string,
  adacGenName: string,
  yearFrom: number | null,
  gens: GenInfo[]
): GenInfo | null {
  const brandGens = gens.filter(g => g.brandName === brandName);
  const normAdac = normalizeModel(adacModelSlug.replace(/-/g, ' '));

  // Pass 1: match model + year overlap
  for (const gen of brandGens) {
    const normGen = normalizeModel(gen.modelName);
    if (normAdac === normGen || normAdac.includes(normGen) || normGen.includes(normAdac)) {
      if (yearFrom) {
        const start = gen.prodStart || 1900;
        const end = gen.prodEnd || 2030;
        if (yearFrom >= start - 1 && yearFrom <= end + 1) return gen;
      }
    }
  }

  // Pass 2: model match only (no year filter)
  for (const gen of brandGens) {
    const normGen = normalizeModel(gen.modelName);
    if (normAdac === normGen || normAdac.includes(normGen) || normGen.includes(normAdac)) {
      return gen;
    }
  }

  return null;
}

// --- DB helpers --------------------------------------------------------------

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

// --- Main --------------------------------------------------------------------

async function main() {
  console.log('===============================================================');
  console.log('  FLM AUTO — ADAC Extended Dimensions Scraper');
  console.log('  Trunk loading height, internal dimensions, bench, step-in');
  console.log('===============================================================\n');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(BRAND_SLUGS).length} brands done, ${cp.totalUpdated} rows updated\n`);
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
      return {
        id: g.id,
        brandName: brand?.name || '',
        modelName: model?.name || '',
        prodStart: g.production_start,
        prodEnd: g.production_end,
      };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  console.log(`  ${genInfos.length} generations loaded`);

  // Load existing interior_dimensions to know what already exists
  const existingDims = await paginateAll('interior_dimensions', 'generation_id, trunk_loading_height_mm');
  const existingMap = new Map(existingDims.map((d: any) => [d.generation_id, d]));
  console.log(`  ${existingMap.size} existing interior_dimensions rows\n`);

  const startTime = Date.now();
  const brandEntries = Object.entries(BRAND_SLUGS).filter(([name]) => !completedBrands.has(name));
  console.log(`  Brands remaining: ${brandEntries.length}\n`);

  for (let bi = 0; bi < brandEntries.length; bi++) {
    const [brandName, brandSlug] = brandEntries[bi];
    console.log(`  [${bi + 1}/${brandEntries.length}] ${brandName}`);

    // Step 1: Discover model slugs
    const modelSlugs = await discoverModelSlugs(brandSlug);
    console.log(`    ${modelSlugs.length} models on ADAC`);
    await delay(DELAY_MS);

    let brandUpdated = 0;

    for (let mi = 0; mi < modelSlugs.length; mi++) {
      const modelSlug = modelSlugs[mi];

      // Step 2: Discover generations
      const adacGens = await discoverGenerations(brandSlug, modelSlug);
      await delay(DELAY_MS);

      for (const adacGen of adacGens) {
        // Step 3: Get first car ID
        const carId = await getFirstCarId(brandSlug, modelSlug, adacGen.genSlug);
        await delay(DELAY_MS);
        if (!carId) { cp.totalSkipped++; continue; }

        // Step 4: Fetch car detail page and extract extended dimensions
        const detailUrl = `${ADAC_BASE}/${brandSlug}/${modelSlug}/${adacGen.genSlug}/${carId}/`;
        const html = await fetchHtml(detailUrl);
        await delay(DELAY_MS);
        if (!html) { cp.totalSkipped++; continue; }

        cp.totalCarPages++;

        const extDims = extractExtendedDimensions(html);
        if (!extDims) {
          cp.totalNoExtData++;
          continue;
        }

        // Match to our DB generation
        const gen = matchGeneration(brandName, modelSlug, adacGen.genName, adacGen.manufacturedFrom, genInfos);
        if (!gen) { cp.totalSkipped++; continue; }

        // Build upsert row: only include non-undefined fields
        const row: Record<string, any> = {
          generation_id: gen.id,
          source: 'adac_extended',
        };

        if (extDims.trunk_loading_height_mm) row.trunk_loading_height_mm = extDims.trunk_loading_height_mm;
        if (extDims.trunk_loading_width_mm) row.trunk_loading_width_mm = extDims.trunk_loading_width_mm;
        if (extDims.trunk_length_mm) row.trunk_length_mm = extDims.trunk_length_mm;
        if (extDims.trunk_width_mm) row.trunk_width_mm = extDims.trunk_width_mm;
        if (extDims.trunk_width_wheelhouses_mm) row.trunk_width_wheelhouses_mm = extDims.trunk_width_wheelhouses_mm;
        if (extDims.trunk_height_mm) row.trunk_height_mm = extDims.trunk_height_mm;
        if (extDims.rear_bench_width_total_mm) row.rear_bench_width_total_mm = extDims.rear_bench_width_total_mm;
        if (extDims.door_opening_angle_front) row.door_opening_angle_front = extDims.door_opening_angle_front;
        if (extDims.door_opening_angle_rear) row.door_opening_angle_rear = extDims.door_opening_angle_rear;
        if (extDims.step_in_height_front_mm) row.step_in_height_front_mm = extDims.step_in_height_front_mm;
        if (extDims.step_in_height_rear_mm) row.step_in_height_rear_mm = extDims.step_in_height_rear_mm;

        // Only upsert if we have at least one actual dimension value (beyond generation_id + source)
        const dimKeys = Object.keys(row).filter(k => k !== 'generation_id' && k !== 'source');
        if (dimKeys.length === 0) {
          cp.totalNoExtData++;
          continue;
        }

        const { error } = await supabase
          .from('interior_dimensions')
          .upsert(row, { onConflict: 'generation_id' });

        if (!error) {
          cp.totalUpdated++;
          brandUpdated++;
        } else {
          cp.errors++;
          if (brandUpdated < 3) {
            console.log(`      UPSERT ERROR: ${error.message}`);
          }
        }
      }

      if ((mi + 1) % 10 === 0) {
        console.log(`    ${mi + 1}/${modelSlugs.length} models | Updated: ${brandUpdated}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Done | Updated: ${brandUpdated} | Total: ${cp.totalUpdated} | ${Math.floor(elapsed / 60)}m elapsed`);

    completedBrands.add(brandName);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n===============================================================');
  console.log('  ADAC EXTENDED DIMENSIONS SCRAPER — COMPLETE');
  console.log('===============================================================');
  console.log(`  Car pages fetched:     ${cp.totalCarPages}`);
  console.log(`  Rows updated/created:  ${cp.totalUpdated}`);
  console.log(`  No extended data:      ${cp.totalNoExtData}`);
  console.log(`  Skipped (no match):    ${cp.totalSkipped}`);
  console.log(`  Errors:                ${cp.errors}`);
  console.log(`  Duration:              ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('===============================================================\n');
}

main().catch(console.error);
