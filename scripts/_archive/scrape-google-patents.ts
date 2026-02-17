/**
 * FLM AUTO — Google Patents Design Drawings Scraper v2
 * Uses Google Patents XHR API to find automotive design patents
 * Extracts patent drawings and matches to DB generations
 *
 * Strategy: Search per brand via XHR API (31 queries with pagination)
 * to avoid rate limiting. Construct image URLs from thumbnail paths.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-google-patents.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_patents_v2.json');
const DELAY_MS = 15000; // 15s between Google requests to avoid rate limiting
const BATCH_SIZE = 50;
const IMG_BASE = 'https://patentimages.storage.googleapis.com';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Brand assignee names for Google Patents ────────────────
// Maps our brand names to legal entity names used in patent filings

const BRAND_ASSIGNEES: Record<string, string[]> = {
  'Alfa Romeo': ['Alfa Romeo'],
  'Audi': ['Audi AG', 'AUDI AG'],
  'BMW': ['Bayerische Motoren Werke', 'BMW AG'],
  'Citroën': ['PSA Automobiles', 'Stellantis'],
  'Dacia': ['Automobile Dacia'],
  'Ferrari': ['Ferrari S.p.A.'],
  'Fiat': ['Fiat Chrysler', 'Fiat S.p.A.'],
  'Ford': ['Ford Motor', 'Ford Global Technologies'],
  'Honda': ['Honda Motor', 'Honda Motor Co'],
  'Hyundai': ['Hyundai Motor', 'Hyundai Motor Company'],
  'Jaguar': ['Jaguar Land Rover'],
  'Kia': ['Kia Motors', 'Kia Corporation'],
  'Lamborghini': ['Automobili Lamborghini'],
  'Land Rover': ['Jaguar Land Rover'],
  'Lexus': ['Toyota Motor'],
  'Mazda': ['Mazda Motor'],
  'Mercedes-Benz': ['Daimler AG', 'Mercedes-Benz Group'],
  'Mitsubishi': ['Mitsubishi Motors'],
  'Nissan': ['Nissan Motor'],
  'Opel': ['Adam Opel', 'Opel Automobile'],
  'Peugeot': ['PSA Automobiles', 'Stellantis'],
  'Porsche': ['Dr. Ing. h.c. F. Porsche', 'Porsche AG'],
  'Renault': ['Renault S.A.S.'],
  'Seat': ['SEAT S.A.'],
  'Skoda': ['Skoda Auto'],
  'Subaru': ['Subaru Corporation', 'Fuji Heavy Industries'],
  'Suzuki': ['Suzuki Motor'],
  'Tesla': ['Tesla Inc', 'Tesla Motors'],
  'Toyota': ['Toyota Motor'],
  'Volkswagen': ['Volkswagen AG', 'Volkswagen Aktiengesellschaft'],
  'Volvo': ['Volvo Car', 'Volvo Car Corporation'],
};

// ─── Checkpoint ──────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalPatents: number;
  totalImages: number;
  totalSaved: number;
  totalDupes: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { completedBrands: [], totalPatents: 0, totalImages: 0, totalSaved: 0, totalDupes: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── HTTP via curl ──────────────────────────────────────────

function curlJson(url: string): any | null {
  try {
    const result = execSync(
      `curl -s -L --connect-timeout 15 --max-time 30 '${url}' ` +
      `-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' ` +
      `-H 'Accept: application/json, text/html' ` +
      `-H 'Referer: https://patents.google.com/'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    if (!result || result.includes('Sorry...') || result.includes('automated queries')) return null;
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// ─── XHR Search via Google Patents API ──────────────────────

interface PatentResult {
  id: string;
  title: string;
  thumbnail: string;
  publicationNumber: string;
  assignee: string;
  filingDate: string;
}

function searchPatentsXhr(assignee: string, page: number = 0): PatentResult[] {
  const params = `q=automobile&type=DESIGN&assignee=${encodeURIComponent(assignee)}&country=US&num=100&page=${page}`;
  const url = `https://patents.google.com/xhr/query?url=${encodeURIComponent(params)}&exp=`;

  const data = curlJson(url);
  if (!data?.results?.cluster) return [];

  const results: PatentResult[] = [];
  for (const cluster of data.results.cluster) {
    for (const r of cluster.result || []) {
      const p = r.patent;
      if (!p) continue;
      results.push({
        id: r.id || '',
        title: (p.title || '').replace(/<[^>]+>/g, ''),
        thumbnail: p.thumbnail || '',
        publicationNumber: p.publication_number || '',
        assignee: (p.assignee || '').replace(/<[^>]+>/g, ''),
        filingDate: p.filing_date || '',
      });
    }
  }

  return results;
}

// ─── Construct drawing URLs from patent ID ──────────────────

function constructDrawingUrls(patent: PatentResult, maxDrawings: number = 8): string[] {
  const urls: string[] = [];

  // If we have a thumbnail path, use it as template
  if (patent.thumbnail) {
    // Thumbnail format: ab/cd/ef/hash/USD0123456-20200101-D00001.png
    // Replace D00001 with D00002, D00003 etc.
    const base = patent.thumbnail.replace(/-D\d+\./, '-D00001.');
    const prefix = base.replace(/-D00001\..*$/, '');
    const ext = base.match(/\.(png|jpg|jpeg)$/i)?.[1] || 'png';

    for (let i = 0; i < maxDrawings; i++) {
      const num = String(i).padStart(5, '0');
      urls.push(`${IMG_BASE}/${prefix}-D${num}.${ext}`);
    }
  }

  return urls;
}

// ─── Try to extract model name from patent title ─────────────

function extractModelFromTitle(title: string, brandName: string): string | null {
  const lower = title.toLowerCase();

  // Skip non-vehicle patents
  if (/wheel|rim|emblem|badge|key|fob|charger|connector|display|grille insert/i.test(lower)) return null;

  // Look for model name patterns
  // "Motor vehicle" / "Automobile" / "Vehicle" are generic
  if (/^(motor )?vehicle$/i.test(title.trim()) || /^automobile$/i.test(title.trim())) return null;

  // Try to find model-specific words
  const cleaned = title
    .replace(/motor vehicle/gi, '')
    .replace(/automobile/gi, '')
    .replace(/vehicle/gi, '')
    .replace(/\(.*\)/g, '')
    .trim();

  if (cleaned.length > 1 && cleaned.length < 30) return cleaned;
  return null;
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
    .replace(/classe /i, '')
    .replace(/class /i, '')
    .trim();
}

function matchGeneration(brandName: string, modelHint: string | null, year: number | null, gens: GenInfo[]): GenInfo | null {
  const brandGens = gens.filter(g => g.brandName === brandName);
  if (brandGens.length === 0) return null;

  // If we have a model hint from the patent title, try to match
  if (modelHint) {
    const normHint = normalizeModel(modelHint);
    for (const gen of brandGens) {
      const normGen = normalizeModel(gen.modelName);
      if (normHint.includes(normGen) || normGen.includes(normHint)) {
        if (year) {
          const start = gen.prodStart || 1900;
          const end = gen.prodEnd || 2030;
          if (year >= start - 2 && year <= end + 2) return gen;
        } else {
          return gen;
        }
      }
    }
  }

  // Fallback: assign to the newest generation of this brand
  if (year) {
    const sorted = brandGens
      .filter(g => {
        const start = g.prodStart || 1900;
        const end = g.prodEnd || 2030;
        return year >= start - 2 && year <= end + 2;
      })
      .sort((a, b) => (b.prodStart || 0) - (a.prodStart || 0));
    if (sorted.length > 0) return sorted[0];
  }

  // Last resort: newest gen
  const newest = brandGens.sort((a, b) => (b.prodStart || 0) - (a.prodStart || 0));
  return newest[0] || null;
}

// ─── Check if image URL actually exists (HEAD request) ───────

function imageExists(url: string): boolean {
  try {
    const result = execSync(
      `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 8 -I '${url}'`,
      { encoding: 'utf-8' }
    );
    return result.trim() === '200';
  } catch {
    return false;
  }
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
  console.log('  FLM AUTO — Google Patents Design Scraper v2');
  console.log('═══════════════════════════════════════════════════════\n');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(BRAND_ASSIGNEES).length} brands done, ${cp.totalSaved} saved\n`);
  }

  // Load DB
  console.log('  Loading database...');
  const gens = await paginateAll('generations', 'id, name, model_id, production_start, production_end');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  const genInfos: GenInfo[] = gens
    .map((g: any) => {
      const model = modelMap.get(g.model_id);
      const brand = model ? brandMap.get(model.brand_id) : null;
      return { id: g.id, brandName: brand?.name || '', modelName: model?.name || '', prodStart: g.production_start, prodEnd: g.production_end };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  console.log(`  ${genInfos.length} generations loaded`);

  // Load existing URLs
  console.log('  Loading existing image URLs...');
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

  const brandEntries = Object.entries(BRAND_ASSIGNEES).filter(([name]) => !completedBrands.has(name));
  console.log(`  Brands remaining: ${brandEntries.length}\n`);

  for (let bi = 0; bi < brandEntries.length; bi++) {
    const [brandName, assigneeNames] = brandEntries[bi];
    console.log(`  [${bi + 1}/${brandEntries.length}] ${brandName}`);

    let brandPatents = 0;
    let brandImages = 0;

    // Search with each assignee name, collect unique patents
    const allPatents = new Map<string, PatentResult>();

    for (const assignee of assigneeNames) {
      // Fetch up to 3 pages (300 patents max per assignee)
      for (let page = 0; page < 3; page++) {
        const results = searchPatentsXhr(assignee, page);
        if (results.length === 0) break;

        for (const r of results) {
          if (!allPatents.has(r.publicationNumber)) {
            allPatents.set(r.publicationNumber, r);
          }
        }

        console.log(`    ${assignee} page ${page}: ${results.length} results (total unique: ${allPatents.size})`);
        await delay(DELAY_MS);

        // If we got fewer than 100 results, no more pages
        if (results.length < 100) break;
      }
    }

    console.log(`    ${allPatents.size} unique patents found`);
    brandPatents = allPatents.size;
    cp.totalPatents += brandPatents;

    // Process each patent
    for (const patent of allPatents.values()) {
      // Skip non-vehicle patents based on title
      const title = patent.title.toLowerCase();
      if (/wheel|rim|emblem|badge|key|fob|charger|connector|headlamp|tail.?lamp|mirror/i.test(title)) continue;

      // Get year from filing date
      const year = patent.filingDate ? parseInt(patent.filingDate.slice(0, 4)) : null;

      // Try to extract model from title
      const modelHint = extractModelFromTitle(patent.title, brandName);

      // Match to generation
      const gen = matchGeneration(brandName, modelHint, year, genInfos);
      if (!gen) continue;

      // Construct drawing URLs
      const drawingUrls = constructDrawingUrls(patent);
      if (drawingUrls.length === 0) continue;

      // Verify first drawing exists, then save all that exist
      let validCount = 0;
      for (const imgUrl of drawingUrls) {
        if (existingUrls.has(imgUrl)) { cp.totalDupes++; continue; }

        // For first URL, always check. For subsequent, check if previous worked
        if (validCount === 0 || validCount < 6) {
          if (!imageExists(imgUrl)) break;
        }

        insertBatch.push({
          generation_id: gen.id,
          image_type: 'technical',
          url: imgUrl,
          thumbnail_url: imgUrl,
          width: 800,
          height: 600,
          alt_text: `${brandName} ${gen.modelName} patent drawing (${patent.publicationNumber})`,
          source: 'Google Patents',
          is_primary: false,
          display_order: 99,
        });

        existingUrls.add(imgUrl);
        validCount++;
        cp.totalImages++;
        brandImages++;

        if (insertBatch.length >= BATCH_SIZE) await flushBatch();
      }
    }

    await flushBatch();

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Saved: ${brandImages} images from ${brandPatents} patents | Total: ${cp.totalSaved} | ${Math.floor(elapsed / 60)}m elapsed`);

    completedBrands.add(brandName);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  await flushBatch();

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOOGLE PATENTS v2 — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Patents found:   ${cp.totalPatents}`);
  console.log(`  Images saved:    ${cp.totalSaved}`);
  console.log(`  Duplicates:      ${cp.totalDupes}`);
  console.log(`  Errors:          ${cp.errors}`);
  console.log(`  Duration:        ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
