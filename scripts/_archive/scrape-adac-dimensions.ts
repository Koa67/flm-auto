/**
 * FLM AUTO — ADAC Dimensions & Specs Scraper v2
 * Crawls ADAC Autokatalog site structure:
 *   Brand page → Model slugs → Generation page (Apollo state) → Car detail page
 * Extracts dimensions, cargo volume, consumption data
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-adac-dimensions.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_adac_v2.json');
const ADAC_BASE = 'https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle';
const DELAY_MS = 1000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── ADAC brand slugs ────────────────────────────────────────

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

// ─── Checkpoint ──────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalDimSaved: number;
  totalSpecsSaved: number;
  totalSkipped: number;
  totalCarPages: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { completedBrands: [], totalDimSaved: 0, totalSpecsSaved: 0, totalSkipped: 0, totalCarPages: 0, errors: 0, startedAt: new Date().toISOString() };
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
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// ─── Step 1: Discover model slugs from brand page ────────────

async function discoverModelSlugs(brandSlug: string): Promise<string[]> {
  const html = await fetchHtml(`${ADAC_BASE}/${brandSlug}/`);
  if (!html) return [];

  const slugs = new Set<string>();
  const regex = new RegExp(`/marken-modelle/${brandSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([a-z0-9][a-z0-9-]*)/`, 'g');
  let m;
  while ((m = regex.exec(html)) !== null) {
    const slug = m[1];
    // Skip anchors and non-model slugs
    if (!slug.startsWith('#') && slug !== brandSlug) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

// ─── Step 2: Discover generations + first car ID from model page ─

interface AdacGeneration {
  genSlug: string;
  genName: string;
  firstCarId: string;
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

      // Find generation items with their car IDs
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('ApilGenerationCollectionItem:') && typeof val === 'object' && val !== null) {
          const v = val as any;
          gens.push({
            genSlug: v.slug || '',
            genName: v.name || '',
            firstCarId: '', // Will get from generation page
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
        gens.push({ genSlug: m[1], genName: m[1], firstCarId: '', manufacturedFrom: null, manufacturedUntil: null });
      }
    }
  }

  return gens;
}

// ─── Step 3: Get first car ID from generation page ──────────

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

// ─── Step 4: Extract technical data from car detail page ────

interface TechData {
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  cargo_volume_liters?: number;
  cargo_volume_max_liters?: number;
  frunk_volume_liters?: number;
  weight_kg?: number;
  consumption_wltp?: number;
  co2_wltp?: number;
  modelName?: string;
  generationCode?: string;
}

function extractTechData(html: string): TechData | null {
  const data: TechData = {};

  // Extract name/value pairs: "name":"...","value":"..."
  const pairs = html.matchAll(/"name":"([^"]+)","value":"([^"]*)"/g);
  const techMap = new Map<string, string>();

  for (const [, name, value] of pairs) {
    if (value && value.trim()) {
      techMap.set(name, value.trim());
    }
  }

  // Dimensions
  const parseNum = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1]) : undefined;
  };

  const parseFloat2 = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const m = s.match(/(\d+[.,]\d+)/);
    return m ? parseFloat(m[1].replace(',', '.')) : undefined;
  };

  data.length_mm = parseNum(techMap.get('Länge ') || techMap.get('Länge'));
  data.width_mm = parseNum(techMap.get('Breite'));
  data.height_mm = parseNum(techMap.get('Höhe'));
  data.wheelbase_mm = parseNum(techMap.get('Radstand'));
  data.cargo_volume_liters = parseNum(techMap.get('Kofferraumvolumen normal'));
  data.cargo_volume_max_liters = parseNum(
    techMap.get('Kofferraumvolumen dachhoch mit umgeklappter Rücksitzbank') ||
    techMap.get('Kofferraumvolumen fensterhoch mit umgeklappter Rücksitzbank')
  );
  data.frunk_volume_liters = parseNum(techMap.get('Kofferraumvolumen vorne (Frunk)'));
  data.weight_kg = parseNum(techMap.get('Leergewicht (EU)'));
  data.consumption_wltp = parseFloat2(techMap.get('Verbrauch kombiniert (WLTP)'))
    || parseFloat2(techMap.get('Verbrauch Gesamt (NEFZ)'));  // Fallback to NEFZ
  data.co2_wltp = parseNum(techMap.get('CO2-Wert kombiniert (WLTP)'))
    || parseNum(techMap.get('CO2-Wert (NEFZ)'));
  data.modelName = techMap.get('Modell');
  data.generationCode = techMap.get('Herstellerinterne Baureihenbezeichnung');

  // Need at least one useful dimension or consumption value
  if (!data.cargo_volume_liters && !data.length_mm && !data.consumption_wltp) return null;

  return data;
}

// ─── Generation matching ────────────────────────────────────

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
    .replace(/er reihe$/i, '')  // "1er Reihe" → "1"
    .replace(/er$/i, '')        // "3er" → "3"
    .replace(/ reihe$/i, '')    // "5 Reihe" → "5"
    .replace(/classe /i, '')
    .replace(/class /i, '')
    .replace(/serie /i, 'series ')
    .replace(/série /i, 'series ')
    .trim();
}

function matchGeneration(brandName: string, adacModelSlug: string, adacGenName: string, yearFrom: number | null, gens: GenInfo[]): GenInfo | null {
  const brandGens = gens.filter(g => g.brandName === brandName);
  const normAdac = normalizeModel(adacModelSlug.replace(/-/g, ' '));

  // Pass 1: match model + generation code + year
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

  // Pass 2: model match only
  for (const gen of brandGens) {
    const normGen = normalizeModel(gen.modelName);
    if (normAdac === normGen || normAdac.includes(normGen) || normGen.includes(normAdac)) {
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
  console.log('  FLM AUTO — ADAC Dimensions Scraper v2');
  console.log('═══════════════════════════════════════════════════════\n');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(BRAND_SLUGS).length} brands done, ${cp.totalDimSaved} dims saved\n`);
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

  // Check existing dimensions (must paginate — table has >1000 rows)
  const existingDims = await paginateAll('interior_dimensions', 'generation_id');
  const hasDims = new Set(existingDims.map((d: any) => d.generation_id));
  console.log(`  ${hasDims.size} generations already have dimensions\n`);

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

    let brandDims = 0;
    let brandSpecs = 0;

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

        // Step 4: Fetch car detail and extract tech data
        const detailUrl = `${ADAC_BASE}/${brandSlug}/${modelSlug}/${adacGen.genSlug}/${carId}/`;
        const html = await fetchHtml(detailUrl);
        await delay(DELAY_MS);
        if (!html) { cp.totalSkipped++; continue; }

        const tech = extractTechData(html);
        if (!tech) { cp.totalSkipped++; continue; }

        cp.totalCarPages++;

        // Match to our DB generation
        const gen = matchGeneration(brandName, modelSlug, adacGen.genName, adacGen.manufacturedFrom, genInfos);
        if (!gen) { cp.totalSkipped++; continue; }

        // Store dimensions — table columns: trunk_volume_liters, trunk_volume_max_liters, frunk_volume_liters
        if ((tech.cargo_volume_liters || tech.cargo_volume_max_liters || tech.frunk_volume_liters) && !hasDims.has(gen.id)) {
          const dimRow: any = { generation_id: gen.id };
          if (tech.cargo_volume_liters) dimRow.trunk_volume_liters = tech.cargo_volume_liters;
          if (tech.cargo_volume_max_liters) dimRow.trunk_volume_max_liters = tech.cargo_volume_max_liters;
          if (tech.frunk_volume_liters) dimRow.frunk_volume_liters = tech.frunk_volume_liters;

          const { error } = await supabase.from('interior_dimensions').upsert(dimRow, { onConflict: 'generation_id' });
          if (!error) { cp.totalDimSaved++; brandDims++; hasDims.add(gen.id); }
          else { cp.errors++; if (brandDims === 0 && brandSpecs < 3) console.log(`      DIM ERROR: ${error.message}`); }
        }

        // Store consumption as third_party_spec
        if (tech.consumption_wltp) {
          const { error } = await supabase.from('third_party_specs').upsert({
            generation_id: gen.id,
            source: 'ADAC',
            source_url: detailUrl,
            spec_type: 'consumption_wltp_l100km',
            spec_value: tech.consumption_wltp,
            raw_data: {
              consumption_wltp_l100km: tech.consumption_wltp,
              co2_wltp_gkm: tech.co2_wltp || null,
              length_mm: tech.length_mm || null,
              width_mm: tech.width_mm || null,
              height_mm: tech.height_mm || null,
              wheelbase_mm: tech.wheelbase_mm || null,
              weight_kg: tech.weight_kg || null,
              cargo_volume_liters: tech.cargo_volume_liters || null,
              cargo_volume_max_liters: tech.cargo_volume_max_liters || null,
            },
          }, { onConflict: 'generation_id,source,spec_type' });

          if (!error) { cp.totalSpecsSaved++; brandSpecs++; }
          else if (error.code !== '23505') cp.errors++;
        }
      }

      if ((mi + 1) % 10 === 0) {
        console.log(`    ${mi + 1}/${modelSlugs.length} models | Dims: ${brandDims} Specs: ${brandSpecs}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Done | Dims: ${brandDims} Specs: ${brandSpecs} | Total dims: ${cp.totalDimSaved} | ${Math.floor(elapsed / 60)}m elapsed`);

    completedBrands.add(brandName);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ADAC SCRAPER v2 — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Car pages fetched: ${cp.totalCarPages}`);
  console.log(`  Dimensions saved:  ${cp.totalDimSaved}`);
  console.log(`  Specs saved:       ${cp.totalSpecsSaved}`);
  console.log(`  Skipped:           ${cp.totalSkipped}`);
  console.log(`  Errors:            ${cp.errors}`);
  console.log(`  Duration:          ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
