/**
 * 09-nhtsa-recalls.ts — Import NHTSA Vehicle Recalls
 *
 * Source: api.nhtsa.gov/recalls (free, no auth)
 * Target: vehicle_recalls table
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/09-nhtsa-recalls.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/09-nhtsa-recalls.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/09-nhtsa-recalls.ts --brand=bmw
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BRAND_FILTER = process.argv.find(a => a.startsWith('--brand='))?.split('=')[1]?.toLowerCase();
const DELAY_MS = 200;
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

// Our 32 brands: NHTSA make name → our DB brand name
const BRAND_MAP: Record<string, string> = {
  'BMW': 'BMW', 'MERCEDES-BENZ': 'Mercedes-Benz', 'MERCEDES BENZ': 'Mercedes-Benz',
  'AUDI': 'Audi', 'VOLKSWAGEN': 'Volkswagen', 'TOYOTA': 'Toyota',
  'HONDA': 'Honda', 'NISSAN': 'Nissan', 'HYUNDAI': 'Hyundai', 'KIA': 'Kia',
  'RENAULT': 'Renault', 'PEUGEOT': 'Peugeot', 'VOLVO': 'Volvo',
  'SKODA': 'Skoda', 'PORSCHE': 'Porsche', 'FORD': 'Ford', 'MAZDA': 'Mazda',
  'FIAT': 'Fiat', 'ALFA ROMEO': 'Alfa Romeo', 'FERRARI': 'Ferrari',
  'LAMBORGHINI': 'Lamborghini', 'JAGUAR': 'Jaguar', 'LEXUS': 'Lexus',
  'TESLA': 'Tesla', 'LAND ROVER': 'Land Rover', 'MASERATI': 'Maserati',
  'ASTON MARTIN': 'Aston Martin', 'BENTLEY': 'Bentley',
  'ROLLS-ROYCE': 'Rolls-Royce', 'ROLLS ROYCE': 'Rolls-Royce',
  'MINI': 'Mini', 'SEAT': 'Seat', 'CITROEN': 'Citroen', 'OPEL': 'Opel',
};

// Component categorization
function categorizeComponent(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('air bag') || lower.includes('airbag')) return 'airbag';
  if (lower.includes('brake')) return 'brakes';
  if (lower.includes('fuel') || lower.includes('gasoline')) return 'fuel_system';
  if (lower.includes('electrical') || lower.includes('battery') || lower.includes('wiring')) return 'electrical';
  if (lower.includes('engine') || lower.includes('powertrain')) return 'engine';
  if (lower.includes('steering')) return 'steering';
  if (lower.includes('transmission')) return 'transmission';
  if (lower.includes('suspension') || lower.includes('spring')) return 'suspension';
  if (lower.includes('tire') || lower.includes('wheel') || lower.includes('rim')) return 'tires_wheels';
  if (lower.includes('seat') || lower.includes('belt') || lower.includes('restraint')) return 'seats_belts';
  if (lower.includes('door') || lower.includes('lock') || lower.includes('latch')) return 'doors_locks';
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('headlight')) return 'lights';
  if (lower.includes('software') || lower.includes('electronic')) return 'software';
  return 'other';
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'FLM-Auto/1.0' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  09-NHTSA-RECALLS — Vehicle Recalls Import');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (BRAND_FILTER) console.log(`  Brand: ${BRAND_FILTER}`);
  console.log('='.repeat(60));

  // Load DB generations for matching
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Build gen lookup
  const genLookup = new Map<string, { gen: any; startYear: number; endYear: number }[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ gen, startYear, endYear });
  }

  // Load existing recalls
  const existingRecalls = await paginateAll('vehicle_recalls', 'recall_number, source');
  const existingSet = new Set(existingRecalls.filter(r => r.source === 'nhtsa').map(r => r.recall_number));
  console.log(`  Existing NHTSA recalls: ${existingSet.size}`);

  // Get our brands in NHTSA format
  const nhtsaMakes = Object.keys(BRAND_MAP);

  const stats = {
    apiCalls: 0,
    totalRecalls: 0,
    newRecalls: 0,
    duplicates: 0,
    matched: 0,
    unmatched: 0,
    inserted: 0,
    httpErrors: 0,
  };

  const toInsert: any[] = [];

  // Parse NHTSA date format (DD/MM/YYYY) → YYYY-MM-DD
  function parseNHTSADate(raw: string): string {
    if (!raw) return new Date().toISOString().substring(0, 10);
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (yyyy && mm && dd) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return raw.substring(0, 10);
  }

  // Iterate: our brands × years 2015-2026
  // NHTSA API requires make+model+year for recalls
  for (const [nhtsaMake, ourBrand] of Object.entries(BRAND_MAP)) {
    if (BRAND_FILTER && ourBrand.toLowerCase() !== BRAND_FILTER) continue;

    for (let year = 2015; year <= 2026; year++) {
      try {
        // Step 1: Get models with recalls for this make+year
        const modelsUrl = `https://api.nhtsa.gov/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(nhtsaMake)}&issueType=r`;
        const modelsData = await fetchJSON(modelsUrl);
        const models = (modelsData.results || []) as any[];
        stats.apiCalls++;
        await sleep(50);

        // Deduplicate model names
        const uniqueModels = [...new Set(models.map((m: any) => m.model))];

        for (const modelName of uniqueModels) {
          if (!modelName) continue;

          try {
            // Step 2: Get recalls for this make+model+year
            const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(nhtsaMake)}&model=${encodeURIComponent(modelName)}&modelYear=${year}`;
            const data = await fetchJSON(url);
            stats.apiCalls++;
            const results = data.results || [];
            stats.totalRecalls += results.length;

            for (const r of results) {
              const campaignNumber = r.NHTSACampaignNumber;
              if (!campaignNumber) continue;
              if (existingSet.has(campaignNumber)) { stats.duplicates++; continue; }
              existingSet.add(campaignNumber);

              stats.newRecalls++;

              // Try to match generation
              const rModel = (r.Model || modelName || '').toLowerCase().trim();
              let genId: string | null = null;
              const brandLower = ourBrand.toLowerCase();

              for (const [k, entries] of Array.from(genLookup.entries())) {
                const [bk, mk] = k.split('|');
                if (bk !== brandLower) continue;
                const mkNorm = normalize(mk);
                const modelNorm = normalize(rModel);
                if (mkNorm === modelNorm || mkNorm.includes(modelNorm) || modelNorm.includes(mkNorm)) {
                  const yearMatch = entries.find(e => year >= e.startYear && year <= e.endYear);
                  if (yearMatch) { genId = yearMatch.gen.id; stats.matched++; break; }
                }
              }
              if (!genId) stats.unmatched++;

              toInsert.push({
                brand: ourBrand,
                model: r.Model || modelName,
                generation_id: genId,
                recall_number: campaignNumber,
                recall_date: parseNHTSADate(r.ReportReceivedDate),
                source: 'nhtsa',
                component: categorizeComponent(r.Component || ''),
                issue_summary: (r.Summary || '').substring(0, 500),
                issue_description: r.Consequence || null,
                remedy: r.Remedy || null,
                remedy_available: true,
                affected_year_start: year,
                affected_year_end: year,
                source_url: `https://www.nhtsa.gov/recalls?nhtsaId=${campaignNumber}`,
              });
            }

            if (results.length > 0) process.stdout.write(`.${results.length}`);
            await sleep(DELAY_MS);
          } catch {
            stats.httpErrors++;
            process.stdout.write('x');
            await sleep(DELAY_MS * 2);
          }
        }

        if (uniqueModels.length === 0) process.stdout.write('-');
      } catch (e: any) {
        stats.httpErrors++;
        process.stdout.write('X');
        await sleep(DELAY_MS * 2);
      }
    }
    process.stdout.write(`[${ourBrand}]`);
  }
  console.log('');

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} recalls...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_recalls').upsert(batch, {
        onConflict: 'recall_number,source'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
        if (i % 500 === 0 && i > 0) process.stdout.write(`  ${inserted}...`);
      }
    }
    stats.inserted = inserted;
    console.log(`\n  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  NHTSA RECALLS RESULTS');
  console.log('='.repeat(60));
  console.log(`  API calls:          ${stats.apiCalls}`);
  console.log(`  Total recalls:      ${stats.totalRecalls}`);
  console.log(`  New (not in DB):    ${stats.newRecalls}`);
  console.log(`  Duplicates:         ${stats.duplicates}`);
  console.log(`  Gen matched:        ${stats.matched}`);
  console.log(`  Gen unmatched:      ${stats.unmatched}`);
  console.log(`  Inserted:           ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  HTTP errors:        ${stats.httpErrors}`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'nhtsa-recalls-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
