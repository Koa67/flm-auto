/**
 * 93-ademe-co2-import.ts — Import ADEME Car Labelling data → third_party_specs
 *
 * Downloads the official ADEME CO2/consumption CSV and inserts WLTP data
 * as third_party_specs records matched to our generations.
 *
 * Data source: https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/raw
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/93-ademe-co2-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/93-ademe-co2-import.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE = 'ademe-car-labelling';
const CSV_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/raw';
const CACHE_FILE = path.resolve(__dirname, '../../data/ademe-car-labelling.csv');
const CHECKPOINT_FILE = path.resolve(__dirname, '../../data/ademe-import-checkpoint.json');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
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

// Brand name normalization: ADEME → our DB
const BRAND_MAP: Record<string, string> = {
  'mercedes': 'mercedesbenz',
  'mercedesbenz': 'mercedesbenz',
  'mercedesamg': 'mercedesbenz',
  'bmwalpina': 'bmw',
  'vw': 'volkswagen',
  'alfaromeo': 'alfaromeo',
  'landroverjaguar': 'landrover',
  'ds': 'ds',
  'dsautomobiles': 'ds',
  'rollsroyce': 'rollsroyce',
  'astonmartin': 'astonmartin',
};

async function downloadCSV(): Promise<string> {
  if (fs.existsSync(CACHE_FILE)) {
    const stat = fs.statSync(CACHE_FILE);
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      console.log('  Using cached CSV (< 24h old)');
      return fs.readFileSync(CACHE_FILE, 'utf-8');
    }
  }

  console.log(`  Downloading from ${CSV_URL}...`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  fs.writeFileSync(CACHE_FILE, text);
  console.log(`  Downloaded ${(text.length / 1024).toFixed(0)} KB`);
  return text;
}

interface ADEMERecord {
  brand: string;
  model: string;
  description: string;
  fuel: string;
  co2_mixed: number | null;
  consumption_mixed: number | null;
  consumption_low: number | null;
  consumption_high: number | null;
  power_kw: number | null;
  weight_kg: number | null;
  displacement_cc: number | null;
  gearbox: string;
  bonus_malus: string;
  price: number | null;
  electric_range_km: number | null;
}

function parseCSV(csv: string): ADEMERecord[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Find column indices
  const findCol = (patterns: string[]): number => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const colBrand = findCol(['marque']);
  const colModel = findCol(['modèle', 'modele', 'mod']);
  const colDesc = findCol(['description commerciale', 'désignation', 'designation', 'libellé']);
  const colFuel = findCol(['energie', 'énergie', 'carburant']);
  const colCO2 = findCol(['co2', 'co²']);
  const colConsoMixed = findCol(['consommation mixte', 'conso mixte']);
  const colConsoLow = findCol(['consommation urbaine', 'conso urbaine', 'basse vitesse']);
  const colConsoHigh = findCol(['consommation extra', 'conso route', 'très haute vitesse', 'haute vitesse']);
  const colPower = findCol(['puissance maximale']);
  const colWeight = findCol(['poids', 'masse']);
  const colDisplacement = findCol(['cylindrée', 'cylindree']);
  const colGearbox = findCol(['boite', 'boîte']);
  const colBonusMalus = findCol(['bonus', 'malus']);
  const colPrice = findCol(['prix']);
  const colElecRange = findCol(['autonomie', 'range']);

  console.log(`  CSV columns found: brand=${colBrand} model=${colModel} fuel=${colFuel} co2=${colCO2} conso=${colConsoMixed}`);

  const records: ADEMERecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 5) continue;

    const brand = colBrand >= 0 ? vals[colBrand] : '';
    const model = colModel >= 0 ? vals[colModel] : '';
    if (!brand || !model) continue;

    records.push({
      brand,
      model,
      description: colDesc >= 0 ? vals[colDesc] || '' : '',
      fuel: colFuel >= 0 ? vals[colFuel] || '' : '',
      co2_mixed: colCO2 >= 0 ? parseFloat(vals[colCO2]) || null : null,
      consumption_mixed: colConsoMixed >= 0 ? parseFloat(vals[colConsoMixed]) || null : null,
      consumption_low: colConsoLow >= 0 ? parseFloat(vals[colConsoLow]) || null : null,
      consumption_high: colConsoHigh >= 0 ? parseFloat(vals[colConsoHigh]) || null : null,
      power_kw: colPower >= 0 ? parseFloat(vals[colPower]) || null : null,
      weight_kg: colWeight >= 0 ? parseInt(vals[colWeight]) || null : null,
      displacement_cc: colDisplacement >= 0 ? parseInt(vals[colDisplacement]) || null : null,
      gearbox: colGearbox >= 0 ? vals[colGearbox] || '' : '',
      bonus_malus: colBonusMalus >= 0 ? vals[colBonusMalus] || '' : '',
      price: colPrice >= 0 ? parseInt(vals[colPrice]) || null : null,
      electric_range_km: colElecRange >= 0 ? parseFloat(vals[colElecRange]) || null : null,
    });
  }

  return records;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  93-ADEME-CO2-IMPORT — Official WLTP data');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));

  // Download / cache CSV
  const csv = await downloadCSV();
  const records = parseCSV(csv);
  console.log(`  Parsed ${records.length} ADEME records`);

  if (records.length === 0) {
    console.error('  No records parsed — check CSV format');
    process.exit(1);
  }

  // Show sample
  console.log(`  Sample: ${records[0].brand} ${records[0].model} — ${records[0].co2_mixed}g CO2, ${records[0].consumption_mixed}L/100km`);

  // Load generations from DB
  console.log('  Loading generations...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, internal_code, production_start, model:models(id, name, brand:brands(id, name))'
  );
  console.log(`  ${gens.length} generations loaded`);

  // Build lookup: normalized brand+model → generations[]
  const genLookup = new Map<string, any[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const brandNorm = normalize(model.brand.name);
    const modelNorm = normalize(model.name);
    const key = `${brandNorm}|${modelNorm}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push(gen);
  }

  // Check for existing ADEME data to avoid duplicates
  const { count: existingCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', SOURCE);
  console.log(`  Existing ADEME records: ${existingCount || 0}`);

  if ((existingCount || 0) > 500) {
    console.log('  ADEME data already imported (>500 rows). Skipping.');
    console.log('  Use --force to re-import.');
    if (!process.argv.includes('--force')) return;
  }

  let matched = 0;
  let unmatched = 0;
  const specsToInsert: any[] = [];
  const matchedBrands = new Set<string>();

  for (const rec of records) {
    const brandNorm = normalize(rec.brand);
    const mappedBrand = BRAND_MAP[brandNorm] || brandNorm;
    const modelNorm = normalize(rec.model);

    // Try exact match
    let key = `${mappedBrand}|${modelNorm}`;
    let matchedGens = genLookup.get(key);

    // Fuzzy model match
    if (!matchedGens) {
      for (const [k, g] of genLookup.entries()) {
        const [bNorm, mNorm] = k.split('|');
        if (bNorm !== mappedBrand) continue;
        if (mNorm.includes(modelNorm) || modelNorm.includes(mNorm)) {
          matchedGens = g;
          break;
        }
      }
    }

    if (!matchedGens || matchedGens.length === 0) {
      unmatched++;
      continue;
    }

    matched++;
    matchedBrands.add(rec.brand);

    // Pick the most recent generation
    const gen = matchedGens.sort((a: any, b: any) => {
      const ya = a.production_start ? new Date(a.production_start).getTime() : 0;
      const yb = b.production_start ? new Date(b.production_start).getTime() : 0;
      return yb - ya;
    })[0];

    // Create spec entries
    const rawData = JSON.stringify({
      description: rec.description,
      fuel: rec.fuel,
      gearbox: rec.gearbox,
      bonus_malus: rec.bonus_malus,
    });

    if (rec.co2_mixed) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_co2_wltp_gkm',
        spec_value: String(rec.co2_mixed),
        source: SOURCE,
        raw_data: rawData,
      });
    }
    if (rec.consumption_mixed) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_conso_wltp_mixed',
        spec_value: String(rec.consumption_mixed),
        source: SOURCE,
      });
    }
    if (rec.consumption_low) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_conso_wltp_low',
        spec_value: String(rec.consumption_low),
        source: SOURCE,
      });
    }
    if (rec.consumption_high) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_conso_wltp_high',
        spec_value: String(rec.consumption_high),
        source: SOURCE,
      });
    }
    if (rec.power_kw) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_power_kw',
        spec_value: String(rec.power_kw),
        source: SOURCE,
      });
    }
    if (rec.weight_kg) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_weight_kg',
        spec_value: String(rec.weight_kg),
        source: SOURCE,
      });
    }
    if (rec.price) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_price_eur',
        spec_value: String(rec.price),
        source: SOURCE,
      });
    }
    if (rec.electric_range_km) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: 'ademe_electric_range_km',
        spec_value: String(rec.electric_range_km),
        source: SOURCE,
      });
    }
  }

  console.log(`\n  Matched: ${matched}/${records.length} (${Math.round(matched/records.length*100)}%)`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Specs to insert: ${specsToInsert.length}`);
  console.log(`  Brands matched: ${[...matchedBrands].sort().join(', ')}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No writes performed.');
    // Save checkpoint
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      records: records.length,
      matched,
      unmatched,
      specs_count: specsToInsert.length,
      brands: [...matchedBrands].sort(),
    }, null, 2));
    console.log(`  Checkpoint saved to ${CHECKPOINT_FILE}`);
  } else if (specsToInsert.length > 0) {
    let totalInserted = 0;
    for (let i = 0; i < specsToInsert.length; i += 500) {
      const batch = specsToInsert.slice(i, i + 500);
      const { error } = await supabase
        .from('third_party_specs')
        .upsert(batch, { onConflict: 'generation_id,spec_type,source' });
      if (error) {
        // Try insert on upsert failure
        const { error: insertErr } = await supabase.from('third_party_specs').insert(batch);
        if (insertErr) {
          console.error(`  Insert error (batch ${i}): ${insertErr.message}`);
        } else {
          totalInserted += batch.length;
        }
      } else {
        totalInserted += batch.length;
      }
      if (i % 2000 === 0 && i > 0) {
        console.log(`  Progress: ${i}/${specsToInsert.length}`);
      }
    }
    console.log(`  Inserted: ${totalInserted}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  ADEME import complete.`);
  console.log('='.repeat(60));
}

main().catch(console.error);
