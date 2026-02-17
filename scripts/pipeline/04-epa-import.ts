/**
 * 04-epa-import.ts — Import EPA Fuel Economy data (45k+ vehicles)
 *
 * SOURCE: https://fueleconomy.gov/feg/epadata/vehicles.csv.zip
 * FIELDS: make, model, year, city08, highway08, comb08, co2TailpipeGpm,
 *         fuelType1, displ, cylinders, trany, drive, VClass, etc.
 *
 * BEFORE RUNNING:
 *   1. Download: curl -L -o data/epa-vehicles.csv.zip "https://fueleconomy.gov/feg/epadata/vehicles.csv.zip"
 *   2. Unzip:    unzip data/epa-vehicles.csv.zip -d data/ && mv data/vehicles.csv data/epa-vehicles.csv
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/04-epa-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/04-epa-import.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = path.resolve(__dirname, '../../data/epa-vehicles.csv');
const SOURCE = 'EPA';
const BATCH_SIZE = 100;

// ═══════════ CSV Parser (no deps) ═══════════
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ═══════════ Normalization ═══════════
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// EPA uses different names than our DB — map common differences
const BRAND_ALIASES: Record<string, string> = {
  'volkswagen': 'volkswagen',
  'vw': 'volkswagen',
  'mercedes-benz': 'mercedes-benz',
  'mercedes benz': 'mercedes-benz',
  'bmw': 'bmw',
  'alfa romeo': 'alfa romeo',
  'aston martin': 'aston martin',
  'land rover': 'land rover',
  'rolls-royce': 'rolls-royce',
  'rolls royce': 'rolls-royce',
};

const MODEL_ALIASES: Record<string, Record<string, string>> = {
  'bmw': {
    '3 series': '3 series',
    '330i': '3 series',
    '330e': '3 series',
    '340i': '3 series',
    'm340i': '3 series',
    '5 series': '5 series',
    '530i': '5 series',
    '540i': '5 series',
    'x3': 'x3',
    'x5': 'x5',
    'x1': 'x1',
    'x7': 'x7',
  },
  'mercedes-benz': {
    'c300': 'c-class',
    'c43 amg': 'c-class',
    'c63 amg': 'c-class',
    'e350': 'e-class',
    'e450': 'e-class',
    'gle350': 'gle',
    'gle450': 'gle',
    'gla250': 'gla',
    'glb250': 'glb',
    'glc300': 'glc',
    'a220': 'a-class',
    's500': 's-class',
    's580': 's-class',
  },
  'audi': {
    'a4': 'a4',
    'a4 quattro': 'a4',
    'a6': 'a6',
    'a6 quattro': 'a6',
    'q5': 'q5',
    'q7': 'q7',
    'q3': 'q3',
    'e-tron': 'e-tron',
    'e-tron gt': 'e-tron gt',
    'q8 e-tron': 'q8 e-tron',
  },
  'volkswagen': {
    'golf': 'golf',
    'golf gti': 'golf',
    'golf r': 'golf',
    'tiguan': 'tiguan',
    'passat': 'passat',
    'id.4': 'id.4',
    'id.buzz': 'id. buzz',
    'taos': 'taos',
    'atlas': 'atlas',
    'jetta': 'jetta',
  },
  'toyota': {
    'camry': 'camry',
    'corolla': 'corolla',
    'rav4': 'rav4',
    'rav4 prime': 'rav4',
    'highlander': 'highlander',
    'tacoma': 'tacoma',
    'prius': 'prius',
    '4runner': '4runner',
    'land cruiser': 'land cruiser',
    'gr86': 'gr86',
    'bz4x': 'bz4x',
    'supra': 'supra',
  },
  'honda': {
    'civic': 'civic',
    'accord': 'accord',
    'cr-v': 'cr-v',
    'hr-v': 'hr-v',
    'pilot': 'pilot',
    'odyssey': 'odyssey',
  },
  'hyundai': {
    'tucson': 'tucson',
    'santa fe': 'santa fe',
    'ioniq 5': 'ioniq 5',
    'ioniq 6': 'ioniq 6',
    'elantra': 'elantra',
    'kona': 'kona',
    'palisade': 'palisade',
  },
  'kia': {
    'sportage': 'sportage',
    'sorento': 'sorento',
    'ev6': 'ev6',
    'ev9': 'ev9',
    'forte': 'forte',
    'seltos': 'seltos',
    'telluride': 'telluride',
    'niro': 'niro',
  },
};

// ═══════════ DB Cache ═══════════
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

// EPA spec types we extract
const EPA_SPEC_MAP: { csvCol: string; specType: string; unit: string; transform?: (v: string) => number | null }[] = [
  { csvCol: 'comb08', specType: 'fuel_consumption_combined_mpg', unit: 'MPG' },
  { csvCol: 'city08', specType: 'fuel_consumption_city_mpg', unit: 'MPG' },
  { csvCol: 'highway08', specType: 'fuel_consumption_highway_mpg', unit: 'MPG' },
  { csvCol: 'co2TailpipeGpm', specType: 'co2_gkm', unit: 'g/mi',
    transform: (v) => { const n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 0.621371); } // g/mile → g/km
  },
  { csvCol: 'displ', specType: 'displacement_l', unit: 'L' },
  { csvCol: 'cylinders', specType: 'cylinders', unit: '' },
  { csvCol: 'combE', specType: 'fuel_consumption_combined_kwh', unit: 'kWh/100mi',
    transform: (v) => { const n = parseFloat(v); return (isNaN(n) || n === 0) ? null : Math.round(n * 0.621371 * 10) / 10; } // kWh/100mi → kWh/100km
  },
  { csvCol: 'rangeA', specType: 'range_km', unit: 'mi',
    transform: (v) => { const n = parseFloat(v); return (isNaN(n) || n === 0) ? null : Math.round(n * 1.60934); } // mi → km
  },
  { csvCol: 'range', specType: 'range_conventional_km', unit: 'mi',
    transform: (v) => { const n = parseFloat(v); return (isNaN(n) || n === 0) ? null : Math.round(n * 1.60934); }
  },
];

// Convert MPG to L/100km and add as additional spec
function mpgToL100(mpg: number): number | null {
  if (mpg <= 0) return null;
  return Math.round((235.215 / mpg) * 10) / 10;
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  04-EPA-IMPORT — Fuel Economy Data (45k+ vehicles)');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Check CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌ File not found: ${CSV_PATH}`);
    console.error('\nDownload it first:');
    console.error('  curl -L -o data/epa-vehicles.csv.zip "https://fueleconomy.gov/feg/epadata/vehicles.csv.zip"');
    console.error('  cd data && unzip epa-vehicles.csv.zip && mv vehicles.csv epa-vehicles.csv');
    process.exit(1);
  }

  // Parse CSV
  console.log('\n  Parsing CSV...');
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`  Total rows: ${rows.length.toLocaleString()}`);

  // Show year range
  const years = rows.map(r => parseInt(r.year)).filter(y => !isNaN(y));
  console.log(`  Year range: ${Math.min(...years)} — ${Math.max(...years)}`);

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Load existing specs
  const existingSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type, source');
  const existingSet = new Set(
    existingSpecs.filter(s => s.source === SOURCE).map(s => `${s.generation_id}|${s.spec_type}`)
  );
  console.log(`  Existing EPA specs: ${existingSet.size}`);

  // Build lookup: normalize(brand)|normalize(model) → generation[] sorted by year
  const genLookup = new Map<string, { gen: any; startYear: number; endYear: number }[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brandName = model.brand.name.toLowerCase();
    const modelName = model.name.toLowerCase();
    const key = `${brandName}|${modelName}`;
    
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ gen, startYear, endYear });
  }
  console.log(`  Lookup keys: ${genLookup.size}`);

  // Match EPA rows to generations
  const stats = {
    total: rows.length,
    matched: 0,
    unmatched: 0,
    specsInserted: 0,
    specsSkipped: 0,
    brandMiss: new Map<string, number>(),
    modelMiss: new Map<string, number>(),
  };

  const toInsert: any[] = [];

  for (const row of rows) {
    const epaMake = (row.make || '').trim();
    const epaModel = (row.model || '').trim();
    const epaYear = parseInt(row.year);
    if (!epaMake || !epaModel || isNaN(epaYear)) continue;

    // Resolve brand
    const brandNorm = BRAND_ALIASES[epaMake.toLowerCase()] || epaMake.toLowerCase();

    // Resolve model — try aliases first, then direct match
    const brandAliases = MODEL_ALIASES[brandNorm] || {};
    const resolvedModel = brandAliases[epaModel.toLowerCase()] || epaModel.toLowerCase();

    // Find generation by brand|model + year range
    const key = `${brandNorm}|${resolvedModel}`;
    const genEntries = genLookup.get(key);

    if (!genEntries) {
      // Try fuzzy: check if any key starts with or contains the model
      let found = false;
      for (const [k, entries] of genLookup) {
        const [bk, mk] = k.split('|');
        if (bk !== brandNorm) continue;
        // Check containment both ways
        if (mk.includes(resolvedModel) || resolvedModel.includes(mk)) {
          const matchedEntry = entries.find(e => epaYear >= e.startYear && epaYear <= e.endYear);
          if (matchedEntry) {
            addSpecsForRow(row, matchedEntry.gen, toInsert, existingSet, stats);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        stats.unmatched++;
        // Track misses
        stats.brandMiss.set(brandNorm, (stats.brandMiss.get(brandNorm) || 0) + 1);
        const missKey = `${brandNorm}|${resolvedModel}`;
        stats.modelMiss.set(missKey, (stats.modelMiss.get(missKey) || 0) + 1);
      }
      continue;
    }

    // Match by year range
    const matchedEntry = genEntries.find(e => epaYear >= e.startYear && epaYear <= e.endYear)
      || genEntries[genEntries.length - 1]; // Fallback to latest

    addSpecsForRow(row, matchedEntry.gen, toInsert, existingSet, stats);
  }

  // Batch insert
  console.log(`\n  Inserting ${toInsert.length} specs...`);
  if (!DRY_RUN && toInsert.length > 0) {
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('third_party_specs').upsert(batch, {
        onConflict: 'generation_id,source,spec_type'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
        if (i % 1000 === 0) process.stdout.write(`  ${inserted}...`);
      }
    }
    stats.specsInserted = inserted;
    console.log(`\n  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  EPA IMPORT RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total EPA rows:     ${stats.total.toLocaleString()}`);
  console.log(`  Matched:            ${stats.matched.toLocaleString()}`);
  console.log(`  Unmatched:          ${stats.unmatched.toLocaleString()}`);
  console.log(`  Specs to insert:    ${toInsert.length.toLocaleString()}`);
  console.log(`  Specs inserted:     ${stats.specsInserted.toLocaleString()}`);
  console.log(`  Specs skipped:      ${stats.specsSkipped.toLocaleString()}`);

  // Top unmatched brands
  const topBrands = [...stats.brandMiss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (topBrands.length > 0) {
    console.log('\n  Top unmatched brands (not in DB):');
    for (const [brand, count] of topBrands) {
      console.log(`    ${brand}: ${count}`);
    }
  }

  // Top unmatched models (only from brands we DO have)
  const dbBrands = new Set([...genLookup.keys()].map(k => k.split('|')[0]));
  const topModels = [...stats.modelMiss.entries()]
    .filter(([k]) => dbBrands.has(k.split('|')[0]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  if (topModels.length > 0) {
    console.log('\n  Top unmatched models (brand exists, model missing):');
    for (const [key, count] of topModels) {
      console.log(`    ${key}: ${count}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

function addSpecsForRow(
  row: Record<string, string>,
  gen: any,
  toInsert: any[],
  existingSet: Set<string>,
  stats: { matched: number; specsSkipped: number }
) {
  stats.matched++;
  const epaYear = parseInt(row.year);

  for (const mapping of EPA_SPEC_MAP) {
    const rawVal = row[mapping.csvCol];
    if (!rawVal || rawVal === '' || rawVal === '0') continue;

    let value: number | null;
    if (mapping.transform) {
      value = mapping.transform(rawVal);
    } else {
      value = parseFloat(rawVal);
      if (isNaN(value)) value = null;
    }
    if (value === null || value === 0) continue;

    const existKey = `${gen.id}|${mapping.specType}`;
    if (existingSet.has(existKey)) { stats.specsSkipped++; continue; }

    toInsert.push({
      generation_id: gen.id,
      source: SOURCE,
      source_url: `https://fueleconomy.gov/feg/bymodel/${encodeURIComponent(row.make)}_${epaYear}.shtml`,
      spec_type: mapping.specType,
      spec_value: value,
      raw_data: {
        epa_make: row.make,
        epa_model: row.model,
        epa_year: epaYear,
        fuel_type: row.fuelType1 || row.fuelType,
        transmission: row.trany,
        drive: row.drive,
        vehicle_class: row.VClass,
      },
    });
    existingSet.add(existKey);
  }

  // Add L/100km conversions for combined, city, highway
  const combMpg = parseFloat(row.comb08);
  if (combMpg > 0) {
    const l100 = mpgToL100(combMpg);
    if (l100 !== null) {
      const existKey = `${gen.id}|fuel_consumption_combined_l100`;
      if (!existingSet.has(existKey)) {
        toInsert.push({
          generation_id: gen.id,
          source: SOURCE,
          source_url: `https://fueleconomy.gov/feg/bymodel/${encodeURIComponent(row.make)}_${epaYear}.shtml`,
          spec_type: 'fuel_consumption_combined_l100',
          spec_value: l100,
          raw_data: { converted_from: 'comb08', original_mpg: combMpg },
        });
        existingSet.add(existKey);
      }
    }
  }

  const cityMpg = parseFloat(row.city08);
  if (cityMpg > 0) {
    const l100 = mpgToL100(cityMpg);
    if (l100 !== null) {
      const existKey = `${gen.id}|fuel_consumption_city_l100`;
      if (!existingSet.has(existKey)) {
        toInsert.push({
          generation_id: gen.id,
          source: SOURCE,
          source_url: `https://fueleconomy.gov/feg/bymodel/${encodeURIComponent(row.make)}_${epaYear}.shtml`,
          spec_type: 'fuel_consumption_city_l100',
          spec_value: l100,
          raw_data: { converted_from: 'city08', original_mpg: cityMpg },
        });
        existingSet.add(existKey);
      }
    }
  }

  const hwyMpg = parseFloat(row.highway08);
  if (hwyMpg > 0) {
    const l100 = mpgToL100(hwyMpg);
    if (l100 !== null) {
      const existKey = `${gen.id}|fuel_consumption_highway_l100`;
      if (!existingSet.has(existKey)) {
        toInsert.push({
          generation_id: gen.id,
          source: SOURCE,
          source_url: `https://fueleconomy.gov/feg/bymodel/${encodeURIComponent(row.make)}_${epaYear}.shtml`,
          spec_type: 'fuel_consumption_highway_l100',
          spec_value: l100,
          raw_data: { converted_from: 'highway08', original_mpg: hwyMpg },
        });
        existingSet.add(existKey);
      }
    }
  }
}

main().catch(console.error);
