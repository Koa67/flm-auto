/**
 * 03-tuv-import.ts — Import TUV reliability data → third_party_specs
 *
 * Reads TUV report files and inserts reliability scores as specs
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/03-tuv-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/03-tuv-import.ts --dry-run
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
const SOURCE = 'tuv-report';

// TUV data files (try multiple locations)
const TUV_FILES = [
  path.resolve(__dirname, '../../data/raw/tuv/mega_tuv_all.json'),
  path.resolve(__dirname, '../../data/raw/tuv/tuv_all_years.json'),
  path.resolve(__dirname, '../../data/tuv-report-2024.json'),
];

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
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  03-TUV-IMPORT — Reliability data to DB');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));

  // Find available TUV file
  let tuvData: any[] = [];
  for (const file of TUV_FILES) {
    if (fs.existsSync(file)) {
      console.log(`\n  Loading: ${path.basename(file)}`);
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const entries = Array.isArray(raw) ? raw : (raw.data || raw.records || []);
      tuvData = [...tuvData, ...entries];
      console.log(`  -> ${entries.length} records`);
    }
  }

  if (tuvData.length === 0) {
    console.error('  No TUV data files found!');
    process.exit(1);
  }

  // Deduplicate by brand+model+year
  const seen = new Set<string>();
  tuvData = tuvData.filter(r => {
    const key = `${(r.brand || '').toLowerCase()}|${(r.model || '').toLowerCase()}|${r.year || r.report_year || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`  Unique TUV records: ${tuvData.length}`);

  // Load generations
  console.log('  Loading generations...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, brand:brands(id, name))'
  );
  console.log(`  ${gens.length} generations loaded`);

  const genLookup = new Map<string, any[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${normalize(model.brand.name)}|${normalize(model.name)}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push(gen);
  }

  let totalInserted = 0;
  let matched = 0;
  let unmatched = 0;
  const specsToInsert: any[] = [];

  for (const record of tuvData) {
    const brand = record.brand || '';
    const model = record.model || '';
    if (!brand || !model) { unmatched++; continue; }

    // Find matching generation
    const key = `${normalize(brand)}|${normalize(model)}`;
    let matchedGens = genLookup.get(key);

    // Fuzzy match
    if (!matchedGens) {
      for (const [k, g] of genLookup.entries()) {
        const [bNorm, mNorm] = k.split('|');
        if (bNorm === normalize(brand) && (mNorm.includes(normalize(model)) || normalize(model).includes(mNorm))) {
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
    const gen = matchedGens[0];

    // Extract reliability specs
    const specs: Record<string, string> = {};
    const year = record.year || record.report_year || '';

    if (record.failure_rate != null) specs[`tuv_failure_rate_${year}`] = String(record.failure_rate);
    if (record.defect_rate != null) specs[`tuv_defect_rate_${year}`] = String(record.defect_rate);
    if (record.ranking != null) specs[`tuv_ranking_${year}`] = String(record.ranking);
    if (record.age_group) specs[`tuv_age_group_${year}`] = String(record.age_group);
    if (record.category) specs[`tuv_category_${year}`] = String(record.category);

    // Common defects
    if (record.common_defects && Array.isArray(record.common_defects)) {
      specs[`tuv_common_defects_${year}`] = record.common_defects.join(', ');
    }

    // Overall score
    if (record.overall_score != null) specs[`tuv_score_${year}`] = String(record.overall_score);
    if (record.mileage_avg_km != null) specs[`tuv_mileage_avg_${year}`] = String(record.mileage_avg_km);

    for (const [specType, specValue] of Object.entries(specs)) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: specType,
        spec_value: specValue,
        source: SOURCE,
      });
    }
  }

  console.log(`\n  Matched: ${matched} | Unmatched: ${unmatched}`);
  console.log(`  Specs to insert: ${specsToInsert.length}`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] No writes performed.');
  } else if (specsToInsert.length > 0) {
    for (let i = 0; i < specsToInsert.length; i += 500) {
      const batch = specsToInsert.slice(i, i + 500);
      const { error } = await supabase.from('third_party_specs').insert(batch);
      if (error) {
        console.error(`  Insert error (batch ${i}): ${error.message}`);
      } else {
        totalInserted += batch.length;
      }
    }
    console.log(`  Inserted: ${totalInserted}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  TUV import complete. ${totalInserted} rows inserted.`);
  console.log('='.repeat(60));
}

main().catch(console.error);
