/**
 * 08-nhtsa-5star.ts — Import NHTSA 5-Star Safety Ratings
 *
 * Source: api.nhtsa.gov (free, no auth)
 * Years: 2011-2026
 * Target: safety_ratings table (only if generation has NO existing rating)
 *
 * IMPORTANT: EuroNCAP > NHTSA. Never overwrite existing ratings.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/08-nhtsa-5star.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/08-nhtsa-5star.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/08-nhtsa-5star.ts --brand=bmw
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
const DELAY_MS = 200; // Phase 2: detailed ratings
const LIST_DELAY_MS = 50; // Phase 1: lightweight list queries
const BATCH_SIZE = 50;
const START_YEAR = 2011;
const END_YEAR = 2026;
const CHECKPOINT_PATH = path.resolve(__dirname, '../../data/nhtsa-5star-checkpoint.json');
const DATA_DIR = path.resolve(__dirname, '../../data');

// ═══════════ HTTP ═══════════
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FLM-Auto/1.0 (automotive-encyclopedia)',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════ DB ═══════════
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

// ═══════════ Brand mapping: NHTSA → our DB ═══════════
const NHTSA_BRAND_MAP: Record<string, string> = {
  'BMW': 'bmw', 'MERCEDES-BENZ': 'mercedes-benz', 'MERCEDES BENZ': 'mercedes-benz',
  'AUDI': 'audi', 'VOLKSWAGEN': 'volkswagen', 'TOYOTA': 'toyota',
  'HONDA': 'honda', 'NISSAN': 'nissan', 'HYUNDAI': 'hyundai', 'KIA': 'kia',
  'RENAULT': 'renault', 'PEUGEOT': 'peugeot', 'VOLVO': 'volvo',
  'SKODA': 'skoda', 'PORSCHE': 'porsche', 'FORD': 'ford', 'MAZDA': 'mazda',
  'FIAT': 'fiat', 'ALFA ROMEO': 'alfa romeo', 'FERRARI': 'ferrari',
  'LAMBORGHINI': 'lamborghini', 'JAGUAR': 'jaguar', 'LEXUS': 'lexus',
  'TESLA': 'tesla', 'LAND ROVER': 'land rover', 'MASERATI': 'maserati',
  'ASTON MARTIN': 'aston martin', 'BENTLEY': 'bentley',
  'ROLLS-ROYCE': 'rolls-royce', 'ROLLS ROYCE': 'rolls-royce',
  'MINI': 'mini', 'SEAT': 'seat', 'CITROEN': 'citroen', 'CITROËN': 'citroen',
  'OPEL': 'opel',
};

// NHTSA model → our DB model (common US-market differences)
const NHTSA_MODEL_MAP: Record<string, Record<string, string>> = {
  'bmw': {
    '2 series': '2 series', '3 series': '3 series', '4 series': '4 series',
    '5 series': '5 series', '7 series': '7 series', '8 series': '8 series',
    'x1': 'x1', 'x2': 'x2', 'x3': 'x3', 'x4': 'x4', 'x5': 'x5', 'x6': 'x6', 'x7': 'x7',
    'z4': 'z4', 'i3': 'i3', 'i4': 'i4', 'i5': 'i5', 'i7': 'i7',
    'ix': 'ix', 'ix1': 'ix1',
  },
  'mercedes-benz': {
    'c-class': 'c-class', 'e-class': 'e-class', 's-class': 's-class', 'a-class': 'a-class',
    'cla-class': 'cla', 'cls-class': 'cls', 'gla-class': 'gla', 'glb-class': 'glb',
    'glc-class': 'glc', 'gle-class': 'gle', 'gls-class': 'gls',
    'cla': 'cla', 'gla': 'gla', 'glb': 'glb', 'glc': 'glc', 'gle': 'gle', 'gls': 'gls',
    'eqb': 'eqb', 'eqe': 'eqe', 'eqs': 'eqs',
    'g-class': 'g-class',
  },
  'audi': {
    'a3': 'a3', 'a4': 'a4', 'a5': 'a5', 'a6': 'a6', 'a7': 'a7', 'a8': 'a8',
    'q3': 'q3', 'q5': 'q5', 'q7': 'q7', 'q8': 'q8',
    'e-tron': 'e-tron', 'e-tron gt': 'e-tron gt', 'q4 e-tron': 'q4 e-tron',
    'q8 e-tron': 'q8 e-tron', 'q6 e-tron': 'q6 e-tron',
    'tt': 'tt', 'r8': 'r8',
  },
  'volkswagen': {
    'golf': 'golf', 'gti': 'golf', 'golf gti': 'golf', 'golf r': 'golf',
    'jetta': 'jetta', 'passat': 'passat', 'arteon': 'arteon',
    'tiguan': 'tiguan', 'atlas': 'atlas', 'taos': 'taos',
    'id.4': 'id.4', 'id.buzz': 'id. buzz',
  },
  'toyota': {
    'corolla': 'corolla', 'camry': 'camry', 'rav4': 'rav4', 'highlander': 'highlander',
    'prius': 'prius', 'tacoma': 'tacoma', '4runner': '4runner', 'tundra': 'tundra',
    'supra': 'supra', 'gr86': 'gr86', 'bz4x': 'bz4x', 'venza': 'venza',
    'sienna': 'sienna', 'land cruiser': 'land cruiser', 'sequoia': 'sequoia',
    'c-hr': 'c-hr', 'yaris': 'yaris', 'avalon': 'avalon', 'crown': 'crown',
  },
  'honda': {
    'civic': 'civic', 'accord': 'accord', 'cr-v': 'cr-v', 'hr-v': 'hr-v',
    'pilot': 'pilot', 'odyssey': 'odyssey', 'ridgeline': 'ridgeline',
    'passport': 'passport', 'fit': 'jazz', 'insight': 'insight',
    'prologue': 'prologue',
  },
  'hyundai': {
    'elantra': 'elantra', 'sonata': 'sonata', 'tucson': 'tucson',
    'santa fe': 'santa fe', 'kona': 'kona', 'palisade': 'palisade',
    'ioniq 5': 'ioniq 5', 'ioniq 6': 'ioniq 6', 'venue': 'venue',
    'accent': 'accent',
  },
  'kia': {
    'forte': 'forte', 'k5': 'k5', 'sportage': 'sportage', 'sorento': 'sorento',
    'seltos': 'seltos', 'telluride': 'telluride', 'soul': 'soul',
    'ev6': 'ev6', 'ev9': 'ev9', 'niro': 'niro', 'carnival': 'carnival',
    'stinger': 'stinger',
  },
  'nissan': {
    'altima': 'altima', 'sentra': 'sentra', 'maxima': 'maxima', 'versa': 'versa',
    'rogue': 'rogue', 'pathfinder': 'pathfinder', 'murano': 'murano',
    'kicks': 'kicks', 'frontier': 'frontier', 'armada': 'armada',
    'leaf': 'leaf', 'ariya': 'ariya', 'z': 'z',
    'juke': 'juke', 'qashqai': 'qashqai', 'x-trail': 'x-trail',
  },
  'volvo': {
    'xc40': 'xc40', 'xc60': 'xc60', 'xc90': 'xc90',
    's60': 's60', 's90': 's90', 'v60': 'v60', 'v90': 'v90',
    'c40': 'c40', 'ex30': 'ex30', 'ex90': 'ex90',
  },
  'tesla': {
    'model 3': 'model 3', 'model y': 'model y',
    'model s': 'model s', 'model x': 'model x',
  },
  'porsche': {
    'cayenne': 'cayenne', 'macan': 'macan', 'taycan': 'taycan',
    'panamera': 'panamera', '911': '911',
  },
  'ford': {
    'mustang': 'mustang', 'mustang mach-e': 'mustang mach-e', 'explorer': 'explorer',
    'escape': 'escape', 'bronco': 'bronco', 'f-150': 'f-150', 'ranger': 'ranger',
    'edge': 'edge', 'expedition': 'expedition', 'maverick': 'maverick',
    'focus': 'focus', 'fiesta': 'fiesta', 'puma': 'puma', 'kuga': 'kuga',
  },
  'mazda': {
    'mazda3': 'mazda3', '3': 'mazda3', 'mazda6': 'mazda6', '6': 'mazda6',
    'cx-5': 'cx-5', 'cx-30': 'cx-30', 'cx-50': 'cx-50', 'cx-90': 'cx-90',
    'mx-5': 'mx-5', 'mx-5 miata': 'mx-5',
  },
  'lexus': {
    'is': 'is', 'es': 'es', 'ls': 'ls', 'gs': 'gs',
    'rx': 'rx', 'nx': 'nx', 'ux': 'ux', 'gx': 'gx', 'lx': 'lx',
    'rz': 'rz', 'lc': 'lc', 'rc': 'rc',
  },
  'jaguar': {
    'f-pace': 'f-pace', 'e-pace': 'e-pace', 'i-pace': 'i-pace',
    'xe': 'xe', 'xf': 'xf', 'xj': 'xj', 'f-type': 'f-type',
  },
  'land rover': {
    'range rover': 'range rover', 'range rover sport': 'range rover sport',
    'range rover evoque': 'range rover evoque', 'range rover velar': 'range rover velar',
    'discovery': 'discovery', 'discovery sport': 'discovery sport',
    'defender': 'defender',
  },
  'fiat': {
    '500': '500', '500x': '500x', '500l': '500l', '500e': '500e',
    'tipo': 'tipo', 'panda': 'panda',
  },
  'mini': {
    'cooper': 'cooper', 'countryman': 'countryman', 'clubman': 'clubman',
    'hardtop': 'cooper', 'hardtop 2 door': 'cooper', 'hardtop 4 door': 'cooper',
    'convertible': 'cooper',
  },
};

// ═══════════ Checkpoint ═══════════
interface Checkpoint {
  processedVehicleIds: string[];
  ratings: Array<{
    vehicleId: string;
    make: string;
    model: string;
    year: number;
    stars: number;
    frontCrash: string;
    sideCrash: string;
    rollover: string;
    fcw: string;
    ldw: string;
    esc: string;
  }>;
}

function loadCheckpoint(): Checkpoint {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')); }
  catch { return { processedVehicleIds: [], ratings: [] }; }
}

function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  08-NHTSA-5STAR — NHTSA Safety Ratings Import');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (BRAND_FILTER) console.log(`  Brand: ${BRAND_FILTER}`);
  console.log(`  Years: ${START_YEAR}-${END_YEAR}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Build lookup: brand|model → [{gen, startYear, endYear}]
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

  // Load existing safety_ratings
  const existing = await paginateAll('safety_ratings', 'generation_id');
  const existingGenIds = new Set(existing.map(r => r.generation_id));
  console.log(`  Existing safety_ratings: ${existing.length}`);

  // Load checkpoint
  const cp = loadCheckpoint();
  const processedSet = new Set(cp.processedVehicleIds);
  console.log(`  Checkpoint: ${processedSet.size} vehicles already processed`);

  // ═══ PHASE 1: Drill down NHTSA API: year → make → model → vehicleId ═══
  console.log('\n━━━ PHASE 1: Fetching NHTSA vehicle lists (3-level drill) ━━━');

  interface NHTSAVehicle {
    VehicleId: number;
    Make: string;
    Model: string;
    ModelYear: number;
  }

  const allVehicles: NHTSAVehicle[] = [];
  const seenVids = new Set<number>();

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    try {
      // Level 1: Get makes for this year
      const makesUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}`;
      const makesData = await fetchJSON(makesUrl);
      const makes = (makesData.Results || []) as any[];
      await sleep(LIST_DELAY_MS);

      // Filter to our brands
      const ourMakes = makes.filter((m: any) => {
        const upper = (m.Make || '').toUpperCase().trim();
        return NHTSA_BRAND_MAP[upper] !== undefined;
      });

      let yearVehicles = 0;

      for (const makeEntry of ourMakes) {
        const makeName = makeEntry.Make;
        const brand = NHTSA_BRAND_MAP[makeName.toUpperCase().trim()];
        if (BRAND_FILTER && brand !== BRAND_FILTER) continue;

        try {
          // Level 2: Get models for this make+year
          const modelsUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}`;
          const modelsData = await fetchJSON(modelsUrl);
          const models = (modelsData.Results || []) as any[];
          await sleep(LIST_DELAY_MS);

          for (const modelEntry of models) {
            const modelName = modelEntry.Model;
            if (!modelName) continue;

            try {
              // Level 3: Get VehicleIds for this make+model+year
              const vehiclesUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}/model/${encodeURIComponent(modelName)}`;
              const vehiclesData = await fetchJSON(vehiclesUrl);
              const vehicles = (vehiclesData.Results || []) as any[];
              await sleep(LIST_DELAY_MS);

              for (const v of vehicles) {
                const vid = v.VehicleId;
                if (!vid || seenVids.has(vid)) continue;
                seenVids.add(vid);
                allVehicles.push({
                  VehicleId: vid,
                  Make: makeName,
                  Model: modelName,
                  ModelYear: year,
                });
                yearVehicles++;
              }
            } catch { /* skip model */ }
          }
        } catch { /* skip make */ }
      }

      console.log(`  ${year}: ${makes.length} makes, ${ourMakes.length} ours → ${yearVehicles} vehicles`);
    } catch (e: any) {
      console.log(`  ${year}: ERROR ${e.message}`);
    }
  }

  console.log(`\n  Total vehicles to process: ${allVehicles.length}`);

  // ═══ PHASE 2: Fetch detailed ratings for each vehicle ═══
  console.log('\n━━━ PHASE 2: Fetching detailed ratings ━━━');

  const stats = {
    vehiclesTotal: allVehicles.length,
    vehiclesFetched: 0,
    vehiclesSkipped: 0,
    vehiclesNoRating: 0,
    matched: 0,
    alreadyExists: 0,
    toInsert: 0,
    inserted: 0,
    unmatched: 0,
    httpErrors: 0,
    unmatchedExamples: [] as string[],
  };

  const toUpsert: any[] = [];
  const insertedGenIds = new Set<string>(); // Track within this run

  for (let i = 0; i < allVehicles.length; i++) {
    const vehicle = allVehicles[i];
    const vid = String(vehicle.VehicleId);

    if (processedSet.has(vid)) {
      stats.vehiclesSkipped++;
      // Check if we have a cached rating
      const cached = cp.ratings.find(r => r.vehicleId === vid);
      if (cached && cached.stars > 0) {
        processRating(cached, genLookup, existingGenIds, insertedGenIds, toUpsert, stats);
      }
      continue;
    }

    try {
      const url = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vid}`;
      const data = await fetchJSON(url);
      const result = data.Results?.[0];
      stats.vehiclesFetched++;

      if (!result || result.OverallRating === 'Not Rated' || !result.OverallRating) {
        stats.vehiclesNoRating++;
        processedSet.add(vid);
        cp.processedVehicleIds.push(vid);
        if (stats.vehiclesFetched % 100 === 0) saveCheckpoint(cp);
        process.stdout.write('-');
        await sleep(DELAY_MS);
        continue;
      }

      const rating = {
        vehicleId: vid,
        make: vehicle.Make,
        model: vehicle.Model,
        year: vehicle.ModelYear,
        stars: parseInt(result.OverallRating) || 0,
        frontCrash: result.OverallFrontCrashRating || 'Not Rated',
        sideCrash: result.OverallSideCrashRating || 'Not Rated',
        rollover: result.RolloverRating || 'Not Rated',
        fcw: result.NHTSAForwardCollisionWarning || '',
        ldw: result.NHTSALaneDepartureWarning || '',
        esc: result.NHTSAElectronicStabilityControl || '',
      };

      cp.ratings.push(rating);
      processedSet.add(vid);
      cp.processedVehicleIds.push(vid);

      processRating(rating, genLookup, existingGenIds, insertedGenIds, toUpsert, stats);

      if (stats.vehiclesFetched % 100 === 0) {
        saveCheckpoint(cp);
        process.stdout.write(`[${stats.vehiclesFetched}]`);
      } else {
        process.stdout.write(rating.stars > 0 ? '.' : '-');
      }

      await sleep(DELAY_MS);
    } catch (e: any) {
      stats.httpErrors++;
      process.stdout.write('x');
      await sleep(DELAY_MS * 2);
    }
  }

  saveCheckpoint(cp);
  console.log('');

  // ═══ INSERT ═══
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Inserting ${toUpsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // ═══ Results ═══
  console.log('\n' + '='.repeat(60));
  console.log('  NHTSA 5-STAR RESULTS');
  console.log('='.repeat(60));
  console.log(`  Vehicles total:     ${stats.vehiclesTotal}`);
  console.log(`  Vehicles fetched:   ${stats.vehiclesFetched}`);
  console.log(`  Vehicles skipped:   ${stats.vehiclesSkipped} (checkpoint)`);
  console.log(`  No rating:          ${stats.vehiclesNoRating}`);
  console.log(`  HTTP errors:        ${stats.httpErrors}`);
  console.log(`  Matched to gen:     ${stats.matched}`);
  console.log(`  Already has rating: ${stats.alreadyExists}`);
  console.log(`  New to insert:      ${stats.toInsert}`);
  console.log(`  Inserted:           ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Unmatched:          ${stats.unmatched}`);

  const newTotal = existingGenIds.size + insertedGenIds.size;
  console.log(`\n  Safety coverage: ${existing.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);

  if (stats.unmatchedExamples.length > 0) {
    console.log('\n  Unmatched examples (brand in DB, model not found):');
    for (const ex of stats.unmatchedExamples.slice(0, 20)) {
      console.log(`    ${ex}`);
    }
  }

  console.log('='.repeat(60));

  // Save report
  const reportPath = path.join(DATA_DIR, 'nhtsa-5star-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    unmatchedExamples: stats.unmatchedExamples,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

function processRating(
  rating: { make: string; model: string; year: number; stars: number; frontCrash: string; sideCrash: string; rollover: string; fcw: string; ldw: string; esc: string },
  genLookup: Map<string, { gen: any; startYear: number; endYear: number }[]>,
  existingGenIds: Set<string>,
  insertedGenIds: Set<string>,
  toUpsert: any[],
  stats: any
) {
  if (!rating.stars || rating.stars < 1 || rating.stars > 5) return;

  const brand = NHTSA_BRAND_MAP[(rating.make || '').toUpperCase().trim()];
  if (!brand) return;

  // Resolve model name
  const modelLower = (rating.model || '').toLowerCase().trim();
  const brandAliases = NHTSA_MODEL_MAP[brand] || {};
  const resolvedModel = brandAliases[modelLower] || modelLower;

  // Find generation
  let matchedGen: any = null;
  const key = `${brand}|${resolvedModel}`;
  let entries = genLookup.get(key);

  // Fuzzy fallback
  if (!entries) {
    const modelNorm = normalize(resolvedModel);
    for (const [k, v] of genLookup) {
      const [bk, mk] = k.split('|');
      if (bk !== brand) continue;
      const mkNorm = normalize(mk);
      if (mkNorm === modelNorm || mkNorm.includes(modelNorm) || modelNorm.includes(mkNorm)) {
        entries = v;
        break;
      }
    }
  }

  if (!entries) {
    stats.unmatched++;
    if (stats.unmatchedExamples.length < 50) {
      const ex = `${brand} ${rating.model} (${rating.year})`;
      if (!stats.unmatchedExamples.includes(ex)) stats.unmatchedExamples.push(ex);
    }
    return;
  }

  // Match by year range
  const yearMatch = entries.find(e => rating.year >= e.startYear && rating.year <= e.endYear);
  matchedGen = yearMatch?.gen || entries[entries.length - 1]?.gen;

  if (!matchedGen) return;

  stats.matched++;

  // Don't overwrite existing ratings (EuroNCAP > NHTSA)
  if (existingGenIds.has(matchedGen.id) || insertedGenIds.has(matchedGen.id)) {
    stats.alreadyExists++;
    return;
  }

  // Compute approximate percentages from NHTSA 1-5 scale
  const frontPct = ratingToPct(rating.frontCrash);
  const sidePct = ratingToPct(rating.sideCrash);
  const adultPct = frontPct !== null && sidePct !== null
    ? Math.round((frontPct + sidePct) / 2)
    : frontPct || sidePct;

  // Safety assist from ADAS features
  let assistScore = 0;
  let assistCount = 0;
  if (rating.fcw && rating.fcw !== 'Not Rated') { assistScore += rating.fcw === 'Standard' ? 100 : 50; assistCount++; }
  if (rating.ldw && rating.ldw !== 'Not Rated') { assistScore += rating.ldw === 'Standard' ? 100 : 50; assistCount++; }
  if (rating.esc && rating.esc !== 'Not Rated') { assistScore += rating.esc === 'Standard' ? 100 : 50; assistCount++; }
  const assistPct = assistCount > 0 ? Math.round(assistScore / assistCount) : null;

  toUpsert.push({
    generation_id: matchedGen.id,
    euroncap_id: null,
    source_url: `https://www.nhtsa.gov/vehicle/${rating.year}/${encodeURIComponent(rating.make)}/${encodeURIComponent(rating.model)}`,
    stars: rating.stars,
    adult_occupant_pct: adultPct,
    child_occupant_pct: null, // NHTSA doesn't test children separately
    pedestrian_pct: null, // NHTSA doesn't test pedestrians
    safety_assist_pct: assistPct,
    test_year: rating.year,
  });

  insertedGenIds.add(matchedGen.id);
  stats.toInsert++;
}

function ratingToPct(rating: string): number | null {
  const n = parseInt(rating);
  if (isNaN(n) || n < 1 || n > 5) return null;
  return n * 20; // 1→20, 2→40, 3→60, 4→80, 5→100
}

main().catch(console.error);
