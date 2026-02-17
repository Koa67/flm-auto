/**
 * FLM AUTO -- NHTSA Recalls Scraper
 * Source: NHTSA Recalls API (public, no auth)
 * https://api.nhtsa.gov/recalls/recallsByVehicle
 *
 * Scrapes recall data for all brands/models in our DB and upserts into vehicle_recalls table.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-nhtsa-recalls.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/nhtsa_recalls_checkpoint.json');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── paginateAll helper (1000 per page) ──────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error(`  Error fetching ${table} page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ─── Checkpoint ──────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalRecalls: number;
  totalMatched: number;
  totalApiCalls: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    completedBrands: [],
    totalRecalls: 0,
    totalMatched: 0,
    totalApiCalls: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── NHTSA brand name mapping ────────────────────────────────

const NHTSA_BRAND_MAP: Record<string, string> = {
  'ALFA ROMEO': 'Alfa Romeo',
  'AUDI': 'Audi',
  'BMW': 'BMW',
  'CITROEN': 'Citroen',
  'CUPRA': 'Cupra',
  'FIAT': 'Fiat',
  'FORD': 'Ford',
  'HONDA': 'Honda',
  'HYUNDAI': 'Hyundai',
  'JEEP': 'Jeep',
  'KIA': 'Kia',
  'MAZDA': 'Mazda',
  'MERCEDES-BENZ': 'Mercedes-Benz',
  'MINI': 'Mini',
  'NISSAN': 'Nissan',
  'OPEL': 'Opel',
  'PEUGEOT': 'Peugeot',
  'PORSCHE': 'Porsche',
  'RENAULT': 'Renault',
  'SEAT': 'Seat',
  'SKODA': 'Skoda',
  'TESLA': 'Tesla',
  'TOYOTA': 'Toyota',
  'VOLKSWAGEN': 'Volkswagen',
  'VOLVO': 'Volvo',
};

// Reverse map: our brand name -> NHTSA uppercase name
const OUR_TO_NHTSA: Record<string, string> = {};
for (const [nhtsa, ours] of Object.entries(NHTSA_BRAND_MAP)) {
  OUR_TO_NHTSA[ours] = nhtsa;
}

// ─── Component categorisation ────────────────────────────────

function categorizeComponent(component: string): string {
  const c = component.toLowerCase();
  if (c.includes('airbag')) return 'airbag';
  if (c.includes('brake')) return 'brakes';
  if (c.includes('fuel') || c.includes('tank')) return 'fuel_system';
  if (c.includes('steer')) return 'steering';
  if (c.includes('electric') || c.includes('wiring') || c.includes('battery')) return 'electrical';
  if (c.includes('engine') || c.includes('motor')) return 'engine';
  if (c.includes('transmission') || c.includes('gearbox')) return 'transmission';
  if (c.includes('suspension')) return 'suspension';
  if (c.includes('tire') || c.includes('wheel')) return 'tires_wheels';
  if (c.includes('seat') || c.includes('belt')) return 'seats_belts';
  if (c.includes('door') || c.includes('lock')) return 'doors_locks';
  if (c.includes('light') || c.includes('lamp')) return 'lights';
  if (c.includes('software') || c.includes('display')) return 'software';
  return 'other';
}

// ─── Risk level assessment ───────────────────────────────────

function assessRiskLevel(consequence: string): string {
  const c = consequence.toLowerCase();
  if (c.includes('fire') || c.includes('crash') || c.includes('death') || c.includes('serious injury')) return 'critical';
  if (c.includes('injury') || c.includes('accident') || c.includes('loss of control')) return 'high';
  if (c.includes('stall') || c.includes('malfunction') || c.includes('fail')) return 'medium';
  return 'low';
}

// ─── Fetch JSON from NHTSA API ───────────────────────────────

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Parse NHTSA date (DD/MM/YYYY or YYYY-MM-DD) → YYYY-MM-DD ──

function parseNhtsaDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Already ISO format (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
  // DD/MM/YYYY format
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // MM/DD/YYYY format (US style)
  const m2 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const month = m2[1].padStart(2, '0');
    const day = m2[2].padStart(2, '0');
    return `${m2[3]}-${month}-${day}`;
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();

  console.log('='.repeat(60));
  console.log('  FLM AUTO -- NHTSA Recalls Scraper');
  console.log('='.repeat(60));
  console.log();

  // 1. Load all brands, models, generations from DB
  console.log('Loading database...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const generations = await paginateAll('generations', 'id, name, model_id, production_start, production_end');

  console.log(`  Brands: ${brands.length}`);
  console.log(`  Models: ${models.length}`);
  console.log(`  Generations: ${generations.length}`);
  console.log();

  // 2. Build lookup maps
  const brandById = new Map<string, string>();
  const brandIdByName = new Map<string, string>();
  for (const b of brands) {
    brandById.set(b.id, b.name);
    brandIdByName.set(b.name, b.id);
  }

  const modelsByBrandId = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrandId.has(m.brand_id)) modelsByBrandId.set(m.brand_id, []);
    modelsByBrandId.get(m.brand_id)!.push(m);
  }

  const gensByModelId = new Map<string, any[]>();
  for (const g of generations) {
    if (!gensByModelId.has(g.model_id)) gensByModelId.set(g.model_id, []);
    gensByModelId.get(g.model_id)!.push(g);
  }

  // 3. Load checkpoint
  const checkpoint = loadCheckpoint();
  console.log(`Checkpoint: ${checkpoint.completedBrands.length} brands already done, ${checkpoint.totalRecalls} recalls so far`);
  console.log();

  // Determine which brands to process
  const nhtsaBrands = Object.keys(NHTSA_BRAND_MAP);
  const brandsToProcess = nhtsaBrands.filter(nb => !checkpoint.completedBrands.includes(nb));
  const totalBrands = nhtsaBrands.length;

  console.log(`Processing ${brandsToProcess.length} / ${totalBrands} brands`);
  console.log();

  // 4. Process each brand
  for (let bi = 0; bi < brandsToProcess.length; bi++) {
    const nhtsaBrand = brandsToProcess[bi];
    const ourBrand = NHTSA_BRAND_MAP[nhtsaBrand];
    const brandIndex = nhtsaBrands.indexOf(nhtsaBrand) + 1;

    const brandId = brandIdByName.get(ourBrand);
    if (!brandId) {
      console.log(`[${brandIndex}/${totalBrands}] ${ourBrand} -- not found in DB, skipping`);
      checkpoint.completedBrands.push(nhtsaBrand);
      saveCheckpoint(checkpoint);
      continue;
    }

    const brandModels = modelsByBrandId.get(brandId) || [];
    let brandRecalls = 0;
    let brandMatched = 0;

    console.log(`[${brandIndex}/${totalBrands}] ${ourBrand} -- ${brandModels.length} models`);

    for (const model of brandModels) {
      const modelGens = gensByModelId.get(model.id) || [];

      for (let year = 2010; year <= 2025; year++) {
        const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(nhtsaBrand)}&model=${encodeURIComponent(model.name)}&modelYear=${year}`;

        const data = await fetchJson(url);
        checkpoint.totalApiCalls++;

        if (!data || !data.results || data.results.length === 0) {
          await sleep(100);
          continue;
        }

        const rows: any[] = [];

        for (const recall of data.results) {
          const campaignNumber = recall.NHTSACampaignNumber;
          if (!campaignNumber) continue;

          const component = categorizeComponent(recall.Component || '');
          const riskLevel = assessRiskLevel(recall.Consequence || '');
          const recallYear = parseInt(recall.ModelYear) || year;

          // Match generation_id (production_start/production_end are ISO date strings like "2018-01-01")
          let generationId: string | null = null;
          for (const gen of modelGens) {
            const ys = gen.production_start ? parseInt(gen.production_start.substring(0, 4)) : null;
            const ye = gen.production_end ? parseInt(gen.production_end.substring(0, 4)) : null;
            if (ys && ys <= recallYear && (ye === null || ye >= recallYear)) {
              generationId = gen.id;
              break;
            }
          }

          if (generationId) brandMatched++;

          rows.push({
            brand: ourBrand,
            model: model.name,
            generation_id: generationId,
            recall_number: campaignNumber,
            recall_date: parseNhtsaDate(recall.ReportReceivedDate) || `${year}-01-01`,
            source: 'nhtsa',
            component,
            issue_summary: (recall.Summary || '').substring(0, 500),
            issue_description: recall.Consequence || null,
            risk_level: riskLevel,
            affected_year_start: recallYear,
            affected_year_end: recallYear,
            estimated_affected_units: null,
            remedy: recall.Remedy || null,
            remedy_available: true,
            source_url: `https://www.nhtsa.gov/recalls?nhtsaId=${campaignNumber}`,
          });
        }

        // Upsert in batches of 100
        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error } = await supabase
              .from('vehicle_recalls')
              .upsert(batch, { onConflict: 'recall_number,source' });
            if (error) {
              console.error(`    Error upserting recalls for ${ourBrand} ${model.name} ${year}:`, error.message);
              checkpoint.errors++;
            }
          }
          brandRecalls += rows.length;
          checkpoint.totalRecalls += rows.length;
        }

        await sleep(100);
      }
    }

    checkpoint.totalMatched += brandMatched;
    checkpoint.completedBrands.push(nhtsaBrand);
    saveCheckpoint(checkpoint);

    console.log(`  [${brandIndex}/${totalBrands}] ${ourBrand} -- ${brandModels.length} models, ${brandRecalls} recalls found, ${brandMatched} matched`);
    console.log();
  }

  // 5. Final summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('='.repeat(60));
  console.log('  NHTSA Recalls Scraper -- Summary');
  console.log('='.repeat(60));
  console.log(`  Total recalls processed: ${checkpoint.totalRecalls}`);
  console.log(`  Matched to generations:  ${checkpoint.totalMatched}`);
  console.log(`  API calls:               ${checkpoint.totalApiCalls}`);
  console.log(`  Errors:                  ${checkpoint.errors}`);
  console.log(`  Duration:                ${elapsed}s`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
