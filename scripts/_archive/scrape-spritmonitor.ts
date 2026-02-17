/**
 * FLM AUTO — Spritmonitor Real Consumption Scraper v2
 * Uses correct URL pattern: /en/overview/{manufID}-{Brand}/{modelID}-{Model}.html
 * Extracts real-world fuel consumption data from community reports
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-spritmonitor.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_spritmonitor.json');
const BASE = 'https://www.spritmonitor.de';
const DELAY_MS = 800;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Spritmonitor manufacturer IDs (extracted from site dropdown) ────
// Format: brand name → manufacturer ID on spritmonitor
const MANUF_IDS: Record<string, number> = {
  'Alfa Romeo': 1, 'Audi': 3, 'BMW': 6, 'Citroën': 12, 'Dacia': 113,
  'Ferrari': 15, 'Fiat': 16, 'Ford': 17, 'Honda': 18, 'Hyundai': 19,
  'Jaguar': 21, 'Kia': 23, 'Lamborghini': 66, 'Land Rover': 25,
  'Lexus': 26, 'Mazda': 27, 'Mercedes-Benz': 28, 'Mitsubishi': 31,
  'Nissan': 33, 'Opel': 35, 'Peugeot': 36, 'Porsche': 39,
  'Renault': 41, 'Seat': 44, 'Skoda': 45, 'Subaru': 47,
  'Suzuki': 48, 'Tesla': 198, 'Toyota': 49, 'Volkswagen': 50, 'Volvo': 51,
};

// ─── Checkpoint ──────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalSaved: number;
  totalSkipped: number;
  totalModels: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { completedBrands: [], totalSaved: 0, totalSkipped: 0, totalModels: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── HTTP (using curl to avoid 503 blocking by Spritmonitor) ─

function fetchHtml(url: string): string | null {
  try {
    const result = execSync(
      `curl -s -L --connect-timeout 10 --max-time 15 "${url}" ` +
      `-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
      `-H "Accept: text/html,application/xhtml+xml" ` +
      `-H "Accept-Language: en-US,en;q=0.9"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    if (!result || result.includes('<title>Fehler')) return null;
    return result;
  } catch {
    return null;
  }
}

// ─── Fetch Spritmonitor model list via AJAX ──────────────────

interface SpritModel {
  id: number;
  name: string;
}

function fetchModelList(manufId: number): SpritModel[] {
  const url = `${BASE}/en/ajaxModel.action?manuf=${manufId}`;
  const html = fetchHtml(url);
  if (!html) return [];

  // Format: "36,1er;1323,2er;37,3er;..."
  const models: SpritModel[] = [];
  const parts = html.split(';').filter(p => p.trim());
  for (const part of parts) {
    const [idStr, name] = part.split(',', 2);
    if (idStr && name) {
      models.push({ id: parseInt(idStr), name: name.trim() });
    }
  }
  return models;
}

// ─── Extract consumption data from overview page ────────────

interface ConsumptionEntry {
  fuelType: string;
  avgConsumption: number;
  sampleSize: number;
}

function extractConsumption(html: string): ConsumptionEntry[] {
  const entries: ConsumptionEntry[] = [];

  // Extract fuel type names from class="name" cells
  const names: string[] = [];
  const nameRegex = /class="name"[^>]*>(.*?)<\/td>/gs;
  let m;
  while ((m = nameRegex.exec(html)) !== null) {
    names.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  // Extract consumption values from class="consumption" cells
  const consumptions: string[] = [];
  const consRegex = /class="consumption"[^>]*>(.*?)<\/td>/gs;
  while ((m = consRegex.exec(html)) !== null) {
    consumptions.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  // Extract sample counts from class="count" cells
  const counts: string[] = [];
  const countRegex = /class="count"[^>]*>(.*?)<\/td>/gs;
  while ((m = countRegex.exec(html)) !== null) {
    counts.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < names.length; i++) {
    const fuelType = names[i];
    const consText = consumptions[i] || '';
    const countText = counts[i] || '0';

    // Parse consumption: "6,54" or "9.27"
    const consMatch = consText.match(/(\d+[.,]\d+)/);
    if (!consMatch) continue;

    const avg = parseFloat(consMatch[1].replace(',', '.'));
    const count = parseInt(countText.replace(/[.,]/g, '')) || 0;

    if (avg > 0 && avg < 50 && count >= 3) {
      entries.push({ fuelType, avgConsumption: avg, sampleSize: count });
    }
  }

  return entries;
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
    .replace(/er$/, '')    // BMW: "3er" → "3"
    .replace(/classe /i, '')
    .replace(/class /i, '')
    .replace(/serie /i, 'series ')
    .replace(/série /i, 'series ')
    .trim();
}

function matchModels(spritModelName: string, brandName: string, gens: GenInfo[]): GenInfo[] {
  const normSprit = normalizeModel(spritModelName);
  const brandGens = gens.filter(g => g.brandName === brandName);
  const matched: GenInfo[] = [];

  for (const gen of brandGens) {
    const normGen = normalizeModel(gen.modelName);
    if (normSprit === normGen || normSprit.includes(normGen) || normGen.includes(normSprit)) {
      matched.push(gen);
    }
  }

  return matched;
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
  console.log('  FLM AUTO — Spritmonitor Real Consumption Scraper v2');
  console.log('═══════════════════════════════════════════════════════\n');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(MANUF_IDS).length} brands done, ${cp.totalSaved} saved\n`);
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

  const startTime = Date.now();
  const brandEntries = Object.entries(MANUF_IDS).filter(([name]) => !completedBrands.has(name));
  console.log(`  Brands remaining: ${brandEntries.length}\n`);

  for (let bi = 0; bi < brandEntries.length; bi++) {
    const [brandName, manufId] = brandEntries[bi];
    console.log(`  [${bi + 1}/${brandEntries.length}] ${brandName} (ID: ${manufId})`);

    // Get model list via AJAX
    const spritModels = fetchModelList(manufId);
    console.log(`    ${spritModels.length} models on Spritmonitor`);
    await delay(DELAY_MS);

    let brandSaved = 0;
    for (const spritModel of spritModels) {
      const overviewUrl = `${BASE}/en/overview/${manufId}-${encodeURIComponent(brandName)}/${spritModel.id}-${encodeURIComponent(spritModel.name)}.html`;
      const html = fetchHtml(overviewUrl);
      if (!html) {
        cp.totalSkipped++;
        await delay(DELAY_MS);
        continue;
      }

      const consumptionEntries = extractConsumption(html);
      if (consumptionEntries.length === 0) {
        cp.totalSkipped++;
        await delay(DELAY_MS);
        continue;
      }

      // Match to DB generations
      const matchedGens = matchModels(spritModel.name, brandName, genInfos);

      if (matchedGens.length === 0) {
        cp.totalSkipped++;
        await delay(DELAY_MS);
        continue;
      }

      // Use the largest fuel type entry (most data points)
      const bestEntry = consumptionEntries.reduce((a, b) => a.sampleSize > b.sampleSize ? a : b);

      for (const gen of matchedGens) {
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: gen.id,
          source: 'spritmonitor',
          source_url: overviewUrl,
          spec_type: 'real_consumption_l100km',
          spec_value: bestEntry.avgConsumption,
          raw_data: {
            fuel_type: bestEntry.fuelType,
            avg_consumption_l100km: bestEntry.avgConsumption,
            sample_size: bestEntry.sampleSize,
            all_fuel_types: consumptionEntries.map(e => ({
              fuel_type: e.fuelType,
              avg_l100km: e.avgConsumption,
              sample_size: e.sampleSize,
            })),
          },
        }, { onConflict: 'generation_id,source,spec_type' });

        if (!error) { cp.totalSaved++; brandSaved++; }
        else if (error.code !== '23505') cp.errors++;
      }

      cp.totalModels++;
      await delay(DELAY_MS);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Saved: ${brandSaved} | Total: ${cp.totalSaved} | ${Math.floor(elapsed / 60)}m elapsed`);

    completedBrands.add(brandName);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SPRITMONITOR v2 — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Models processed: ${cp.totalModels}`);
  console.log(`  Records saved:    ${cp.totalSaved}`);
  console.log(`  Skipped:          ${cp.totalSkipped}`);
  console.log(`  Errors:           ${cp.errors}`);
  console.log(`  Duration:         ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
