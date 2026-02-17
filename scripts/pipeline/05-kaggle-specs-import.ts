/**
 * 05-kaggle-specs-import.ts — Import Kaggle Car Specifications 1945-2020 (71k rows)
 *
 * SOURCE: https://www.kaggle.com/datasets/jahaidulislam/car-specification-dataset-1945-2020
 * FIELDS: Make, Model, Generation, Year From, Year To, Body Type, Length, Width, Height,
 *         Wheelbase, Curb Weight, Displacement, Power HP, Torque Nm, Fuel Type, etc.
 *
 * BEFORE RUNNING:
 *   1. Download the dataset from Kaggle (CSV)
 *   2. Place it at: data/kaggle-car-specs.csv
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/05-kaggle-specs-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/05-kaggle-specs-import.ts --dry-run
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
const CSV_PATH = path.resolve(__dirname, '../../data/kaggle-car-specs.csv');
const SOURCE = 'Kaggle-CarSpecs';
const BATCH_SIZE = 100;

// ═══════════ CSV Parser ═══════════
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
      row[headers[j].trim()] = (values[j] || '').trim();
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
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d.,\-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

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

// ═══════════ Column auto-detect ═══════════
// Kaggle datasets have varying column names. We map common patterns.
function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const lower = headers.map(h => h.toLowerCase().trim());

  const patterns: [string[], string][] = [
    [['make', 'brand', 'manufacturer'], 'make'],
    [['model'], 'model'],
    [['generation', 'gen'], 'generation'],
    [['year from', 'year_from', 'start year', 'from_year', 'year'], 'year_from'],
    [['year to', 'year_to', 'end year', 'to_year'], 'year_to'],
    [['body', 'body type', 'body_type', 'category'], 'body_type'],
    [['length'], 'length_mm'],
    [['width'], 'width_mm'],
    [['height'], 'height_mm'],
    [['wheelbase'], 'wheelbase_mm'],
    [['curb weight', 'kerb weight', 'weight', 'curb_weight'], 'curb_weight_kg'],
    [['displacement', 'engine size', 'engine_size'], 'displacement_cc'],
    [['power', 'hp', 'horsepower', 'power_hp'], 'power_hp'],
    [['torque', 'nm', 'torque_nm'], 'torque_nm'],
    [['fuel type', 'fuel_type', 'fuel'], 'fuel_type'],
    [['drivetrain', 'drive', 'driven wheels'], 'drivetrain'],
    [['cylinders', 'cylinder', 'no. of cylinders'], 'cylinders'],
    [['seats', 'no. of seats'], 'seats'],
    [['doors', 'no. of doors'], 'doors'],
    [['trunk', 'boot', 'cargo', 'trunk volume'], 'trunk_volume_l'],
    [['fuel tank', 'tank', 'fuel capacity'], 'fuel_tank_l'],
    [['top speed'], 'top_speed_kmh'],
    [['0-100', '0 to 100', 'acceleration'], 'acceleration_0_100'],
    [['consumption', 'fuel consumption', 'combined'], 'fuel_consumption_combined'],
    [['co2', 'emission', 'co2 emission'], 'co2_gkm'],
    [['ground clearance'], 'ground_clearance_mm'],
  ];

  for (const [candidates, target] of patterns) {
    for (let i = 0; i < lower.length; i++) {
      for (const candidate of candidates) {
        if (lower[i] === candidate || lower[i].includes(candidate)) {
          if (!map[target]) {
            map[target] = headers[i];
            break;
          }
        }
      }
    }
  }

  return map;
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  05-KAGGLE-SPECS — Car Specifications Import (71k rows)');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌ File not found: ${CSV_PATH}`);
    console.error('\nDownload from Kaggle:');
    console.error('  1. Go to: https://www.kaggle.com/datasets/jahaidulislam/car-specification-dataset-1945-2020');
    console.error('  2. Download and place CSV at: data/kaggle-car-specs.csv');
    console.error('\nOr with Kaggle CLI:');
    console.error('  kaggle datasets download -d jahaidulislam/car-specification-dataset-1945-2020 -p data/');
    console.error('  unzip data/car-specification-dataset-1945-2020.zip -d data/');
    console.error('  mv data/*.csv data/kaggle-car-specs.csv');
    process.exit(1);
  }

  console.log('\n  Parsing CSV...');
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`  Total rows: ${rows.length.toLocaleString()}`);

  // Auto-detect columns
  const firstRow = rows[0];
  const colMap = buildColumnMap(Object.keys(firstRow));
  console.log('\n  Column mapping:');
  for (const [target, csvCol] of Object.entries(colMap)) {
    console.log(`    ${target.padEnd(25)} ← ${csvCol}`);
  }

  if (!colMap.make || !colMap.model) {
    console.error('\n❌ Cannot detect Make/Model columns. Headers:', Object.keys(firstRow));
    process.exit(1);
  }

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, chassis_code, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Build lookup
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

  // Load existing
  const existingSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type, source');
  const existingSet = new Set(
    existingSpecs.filter(s => s.source === SOURCE).map(s => `${s.generation_id}|${s.spec_type}`)
  );
  console.log(`  Existing ${SOURCE} specs: ${existingSet.size}`);

  // Process rows
  const stats = { total: rows.length, matched: 0, unmatched: 0, specsToInsert: 0, inserted: 0, skipped: 0 };
  const toInsert: any[] = [];
  const unmatchedBrands = new Map<string, number>();

  // Spec types to extract
  const SPEC_TYPES: { colKey: string; specType: string; unit: string }[] = [
    { colKey: 'length_mm', specType: 'length_mm', unit: 'mm' },
    { colKey: 'width_mm', specType: 'width_mm', unit: 'mm' },
    { colKey: 'height_mm', specType: 'height_mm', unit: 'mm' },
    { colKey: 'wheelbase_mm', specType: 'wheelbase_mm', unit: 'mm' },
    { colKey: 'curb_weight_kg', specType: 'curb_weight_kg', unit: 'kg' },
    { colKey: 'displacement_cc', specType: 'displacement_cc', unit: 'cc' },
    { colKey: 'power_hp', specType: 'power_hp', unit: 'HP' },
    { colKey: 'torque_nm', specType: 'torque_nm', unit: 'Nm' },
    { colKey: 'cylinders', specType: 'cylinders', unit: '' },
    { colKey: 'doors', specType: 'doors', unit: '' },
    { colKey: 'seats', specType: 'seats', unit: '' },
    { colKey: 'trunk_volume_l', specType: 'trunk_volume_l', unit: 'L' },
    { colKey: 'fuel_tank_l', specType: 'fuel_tank_l', unit: 'L' },
    { colKey: 'top_speed_kmh', specType: 'top_speed_kmh', unit: 'km/h' },
    { colKey: 'acceleration_0_100', specType: 'acceleration_0_100', unit: 's' },
    { colKey: 'fuel_consumption_combined', specType: 'fuel_consumption_combined', unit: 'L/100km' },
    { colKey: 'co2_gkm', specType: 'co2_gkm', unit: 'g/km' },
    { colKey: 'ground_clearance_mm', specType: 'ground_clearance_mm', unit: 'mm' },
  ];

  for (const row of rows) {
    const make = (row[colMap.make] || '').trim();
    const model = (row[colMap.model] || '').trim();
    if (!make || !model) continue;

    const yearFrom = parseInt(row[colMap.year_from]) || 0;
    const yearTo = parseInt(row[colMap.year_to]) || yearFrom;
    const midYear = yearFrom > 0 ? Math.round((yearFrom + (yearTo || yearFrom)) / 2) : 0;

    // Find generation
    const brandNorm = make.toLowerCase();
    const modelNorm = model.toLowerCase();
    const key = `${brandNorm}|${modelNorm}`;
    let entries = genLookup.get(key);

    // Fuzzy if no exact match
    if (!entries) {
      for (const [k, v] of genLookup) {
        const [bk, mk] = k.split('|');
        if (bk !== brandNorm) continue;
        if (mk.includes(modelNorm) || modelNorm.includes(mk)) {
          entries = v;
          break;
        }
      }
    }

    if (!entries) {
      stats.unmatched++;
      unmatchedBrands.set(brandNorm, (unmatchedBrands.get(brandNorm) || 0) + 1);
      continue;
    }

    // Match by year
    let matchedGen: any;
    if (midYear > 0) {
      const yearMatch = entries.find(e => midYear >= e.startYear && midYear <= e.endYear);
      matchedGen = yearMatch?.gen || entries[entries.length - 1].gen;
    } else {
      matchedGen = entries[0].gen;
    }

    stats.matched++;

    // Extract specs
    for (const spec of SPEC_TYPES) {
      const csvCol = colMap[spec.colKey];
      if (!csvCol) continue;
      const rawVal = row[csvCol];
      if (!rawVal) continue;

      const value = parseNum(rawVal);
      if (value === null || value === 0) continue;

      const existKey = `${matchedGen.id}|${spec.specType}`;
      if (existingSet.has(existKey)) { stats.skipped++; continue; }

      toInsert.push({
        generation_id: matchedGen.id,
        source: SOURCE,
        source_url: 'https://www.kaggle.com/datasets/jahaidulislam/car-specification-dataset-1945-2020',
        spec_type: spec.specType,
        spec_value: value,
        raw_data: {
          kaggle_make: make,
          kaggle_model: model,
          kaggle_generation: row[colMap.generation] || '',
          year_from: yearFrom,
          year_to: yearTo,
        },
      });
      existingSet.add(existKey);
      stats.specsToInsert++;
    }
  }

  // Insert
  console.log(`\n  Inserting ${toInsert.length} specs...`);
  if (!DRY_RUN && toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('third_party_specs').upsert(batch, {
        onConflict: 'generation_id,source,spec_type'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        stats.inserted += batch.length;
        if (i % 1000 === 0) process.stdout.write(`  ${stats.inserted}...`);
      }
    }
    console.log('');
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  KAGGLE IMPORT RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total rows:         ${stats.total.toLocaleString()}`);
  console.log(`  Matched:            ${stats.matched.toLocaleString()}`);
  console.log(`  Unmatched:          ${stats.unmatched.toLocaleString()}`);
  console.log(`  Specs to insert:    ${stats.specsToInsert.toLocaleString()}`);
  console.log(`  Specs inserted:     ${stats.inserted.toLocaleString()}`);
  console.log(`  Skipped (exists):   ${stats.skipped.toLocaleString()}`);

  const topMissed = [...unmatchedBrands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (topMissed.length > 0) {
    console.log('\n  Top unmatched brands:');
    for (const [brand, count] of topMissed) {
      console.log(`    ${brand}: ${count}`);
    }
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
