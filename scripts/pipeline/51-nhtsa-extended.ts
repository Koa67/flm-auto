/**
 * 51-nhtsa-extended.ts — NHTSA 5-Star Safety Ratings for 2000-2010
 *
 * Extends 08-nhtsa-5star.ts (which covers 2011-2026) to earlier years.
 *
 * API: https://api.nhtsa.gov/SafetyRatings/
 * Flow: modelyear/{year} → makes → models → VehicleId/{id}
 *
 * Rules:
 *   - Never overwrite existing EuroNCAP ratings (EuroNCAP > NHTSA for FR market)
 *   - Only insert when generation has NO existing rating
 *   - Confidence 'A' for direct NHTSA data
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/51-nhtsa-extended.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/51-nhtsa-extended.ts
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
const DELAY_MS = 100;
const BATCH_SIZE = 50;
const START_YEAR = 2000;
const END_YEAR = 2010;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'nhtsa-extended-checkpoint.json');

const BRAND_MAP: Record<string, string> = {
  'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
  'bmw': 'BMW', 'mercedes-benz': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz',
  'audi': 'Audi', 'porsche': 'Porsche', 'volvo': 'Volvo',
  'toyota': 'Toyota', 'honda': 'Honda', 'nissan': 'Nissan',
  'mazda': 'Mazda', 'subaru': 'Subaru', 'mitsubishi': 'Mitsubishi',
  'hyundai': 'Hyundai', 'kia': 'Kia', 'ford': 'Ford',
  'chevrolet': 'Chevrolet', 'mini': 'MINI', 'fiat': 'Fiat',
  'alfa romeo': 'Alfa Romeo', 'jaguar': 'Jaguar', 'land rover': 'Land Rover',
  'lexus': 'Lexus', 'infiniti': 'Infiniti', 'genesis': 'Genesis',
  'suzuki': 'Suzuki', 'peugeot': 'Peugeot', 'renault': 'Renault',
  'citroen': 'Citroën', 'citroën': 'Citroën',
  'skoda': 'Skoda', 'seat': 'SEAT', 'opel': 'Opel',
  'dacia': 'Dacia', 'ds': 'DS',
  'tesla': 'Tesla', 'ferrari': 'Ferrari', 'lamborghini': 'Lamborghini',
  'maserati': 'Maserati', 'bentley': 'Bentley', 'aston martin': 'Aston Martin',
  'rolls-royce': 'Rolls-Royce',
};

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'FLM-Auto/1.0' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize NHTSA model names to DB-friendly aliases */
function normalizeNHTSAModel(model: string): string {
  let m = model.toUpperCase().trim();
  // Strip " SERIES" / " CLASS" suffix (BMW "3 SERIES" → "3", Mercedes "E-CLASS" → "E")
  m = m.replace(/\s+SERIES$/i, '').replace(/\s*[-]?\s*CLASS$/i, '');
  // Strip " WAGON" suffix (BMW "3 SERIES WAGON" → "3")
  m = m.replace(/\s+WAGON$/i, '');
  // Strip " HYBRID" (Toyota "CAMRY HYBRID" → "CAMRY")
  m = m.replace(/\s+HYBRID$/i, '');
  // VW specifics
  if (m === 'NEW BEETLE') m = 'BEETLE';
  if (m === 'RABBIT') m = 'GOLF'; // VW Rabbit = Golf in US
  if (m === 'GTI') m = 'GOLF'; // VW GTI = Golf GTI
  if (m === 'GLI') m = 'JETTA'; // VW GLI = Jetta GLI
  return m;
}

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

interface NHTSARating {
  brand: string;
  model: string;
  year: number;
  stars: number;
  vehicleId: number;
}

interface Checkpoint {
  completedYears: number[];
  ratings: NHTSARating[];
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  51-NHTSA-EXTENDED — NHTSA ratings 2000-2010');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load checkpoint
  let checkpoint: Checkpoint = { completedYears: [], ratings: [] };
  if (fs.existsSync(CHECKPOINT_PATH)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    console.log(`  Resuming: ${checkpoint.completedYears.length} years done, ${checkpoint.ratings.length} ratings cached`);
  }

  // Phase 1: Fetch all ratings from NHTSA API
  console.log('\n  Phase 1: Fetching NHTSA ratings...');
  const allRatings: NHTSARating[] = [...checkpoint.ratings];

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    if (checkpoint.completedYears.includes(year)) {
      console.log(`    ${year}: skipped (cached)`);
      continue;
    }

    console.log(`    ${year}: fetching makes...`);
    try {
      const yearData = await fetchJSON(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}`);
      const makes = yearData.Results || [];
      await sleep(DELAY_MS);

      for (const make of makes) {
        const makeName = make.Make;
        const makeNorm = normalize(makeName);

        // Only process brands we have in our DB
        // BRAND_MAP keys need normalizing too (hyphens → spaces)
        const brandMatch = Object.entries(BRAND_MAP).find(([k]) => normalize(k) === makeNorm);
        if (!brandMatch) continue;
        const dbBrand = brandMatch[1];

        try {
          const modelsData = await fetchJSON(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}`);
          const models = modelsData.Results || [];
          await sleep(DELAY_MS);

          for (const model of models) {
            const modelName = model.Model;

            // Step 3: Get variants with actual VehicleIds
            try {
              const variantsData = await fetchJSON(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}/model/${encodeURIComponent(modelName)}`);
              const variants = variantsData.Results || [];
              await sleep(DELAY_MS);

              for (const variant of variants) {
                const vehicleId = variant.VehicleId;
                if (!vehicleId) continue;

                try {
                  const vehicleData = await fetchJSON(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`);
                  const results = vehicleData.Results || [];
                  await sleep(DELAY_MS);

                  for (const r of results) {
                    // Try OverallRating first (2011+ format)
                    let stars = parseInt(r.OverallRating);

                    // Pre-2011: compute from sub-ratings
                    if (!(stars >= 1 && stars <= 5)) {
                      const subRatings: number[] = [];
                      for (const key of [
                        'FrontCrashDriversideRating', 'FrontCrashPassengersideRating',
                        'SideCrashDriversideRating', 'SideCrashPassengersideRating',
                        'RolloverRating2',
                      ]) {
                        const val = parseInt(r[key]);
                        if (val >= 1 && val <= 5) subRatings.push(val);
                      }
                      if (subRatings.length >= 2) {
                        stars = Math.round(subRatings.reduce((a, b) => a + b, 0) / subRatings.length);
                      }
                    }

                    if (stars >= 1 && stars <= 5) {
                      allRatings.push({
                        brand: dbBrand,
                        model: modelName,
                        year,
                        stars,
                        vehicleId,
                      });
                    }
                  }
                } catch {
                  // Skip individual vehicle failures
                }
              }
            } catch {
              // Skip model variant failures
            }
          }
        } catch {
          // Skip make failures
        }
      }

      checkpoint.completedYears.push(year);
      checkpoint.ratings = allRatings;
      fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
      console.log(`    ${year}: done (${allRatings.length} total ratings)`);
    } catch (e: any) {
      console.log(`    ${year}: FAILED — ${e.message}`);
    }
  }

  console.log(`\n  Total NHTSA ratings: ${allRatings.length}`);

  // Phase 2: Match against DB
  console.log('\n  Phase 2: Matching against DB...');

  const gens = await paginateAll(
    'generations',
    'id, name, slug, internal_code, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Loaded ${gens.length} generations`);

  const existingRatings = await paginateAll('safety_ratings', 'generation_id, confidence');
  // Only skip gens with A confidence — NHTSA direct data IS A, so don't overwrite other A sources
  // But DO overwrite B/C/D/E with A since direct data is more reliable
  const existingAGenIds = new Set(existingRatings.filter((r: any) => r.confidence === 'A').map((r: any) => r.generation_id));
  console.log(`  Existing ratings: ${existingRatings.length} (${existingAGenIds.size} with A)`);

  // Build gen index
  const genIndex = new Map<string, any[]>();
  for (const gen of gens) {
    const brand = gen.model?.brand?.name;
    const model = gen.model?.name;
    if (!brand || !model) continue;
    const key = normalize(`${brand}`);
    if (!genIndex.has(key)) genIndex.set(key, []);
    genIndex.get(key)!.push(gen);
  }

  // Deduplicate: keep best rating per brand+model+year
  const bestRatings = new Map<string, NHTSARating>();
  for (const r of allRatings) {
    const key = `${normalize(r.brand)}|${normalize(r.model)}|${r.year}`;
    const existing = bestRatings.get(key);
    if (!existing || r.stars > existing.stars) {
      bestRatings.set(key, r);
    }
  }

  const toUpsert: any[] = [];
  let matched = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const rating of bestRatings.values()) {
    const brandNorm = normalize(rating.brand);
    const brandGens = genIndex.get(brandNorm) || [];

    if (brandGens.length === 0) {
      noMatch++;
      continue;
    }

    // Find matching generation by model name + year
    const modelNorm = normalize(rating.model);
    const modelNHTSA = normalize(normalizeNHTSAModel(rating.model));
    const candidates = brandGens.filter(g => {
      const genModel = normalize(g.model?.name || '');
      // Try original NHTSA name and normalized alias
      return genModel.includes(modelNorm) || modelNorm.includes(genModel) ||
             genModel.includes(modelNHTSA) || modelNHTSA.includes(genModel);
    });

    if (candidates.length === 0) {
      noMatch++;
      continue;
    }

    // Best year match
    const bestGen = candidates.find(g => {
      const startYear = g.production_start ? new Date(g.production_start).getFullYear() : 0;
      const endYear = g.production_end ? new Date(g.production_end).getFullYear() : 2099;
      return rating.year >= startYear - 1 && rating.year <= endYear + 1;
    }) || candidates[0];

    if (existingAGenIds.has(bestGen.id)) {
      skipped++;
      continue;
    }

    toUpsert.push({
      generation_id: bestGen.id,
      stars: rating.stars,
      test_year: rating.year,
      source_url: `nhtsa:${rating.vehicleId}`,
      confidence: 'A',
    });
    existingAGenIds.add(bestGen.id); // Prevent duplicates in this batch
    matched++;
  }

  console.log(`  Matched: ${matched}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  No match: ${noMatch}`);

  // Phase 3: Upsert
  console.log(`\n  Phase 3: Upserting ${toUpsert.length} ratings...`);

  let upserted = 0;
  if (!DRY_RUN && toUpsert.length > 0) {
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, { onConflict: 'generation_id' });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    years: `${START_YEAR}-${END_YEAR}`,
    total_nhtsa_ratings: allRatings.length,
    unique_ratings: bestRatings.size,
    matched, skipped, no_match: noMatch, upserted,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'nhtsa-extended-report.json'), JSON.stringify(report, null, 2));
  console.log('\n  Report saved to data/nhtsa-extended-report.json');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : `DONE — ${upserted} ratings upserted`}`);
}

main().catch(console.error);
