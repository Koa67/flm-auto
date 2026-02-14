/**
 * 94-tuv-enhanced-import.ts — Import TÜV Report 2024 data → third_party_specs
 *
 * Reads data/tuv-report-2024.json (605 records, 23 brands, 5 age categories)
 * and inserts defect rates as third_party_specs records.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/94-tuv-enhanced-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/94-tuv-enhanced-import.ts --dry-run
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
const SOURCE = 'tuv-report-2024';
const DATA_FILE = path.resolve(__dirname, '../../data/tuv-report-2024.json');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

const BRAND_MAP: Record<string, string> = {
  'mercedesbenz': 'mercedesbenz',
  'mercedes': 'mercedesbenz',
  'citroen': 'citroen',
  'mini': 'mini',
};

interface TUVRecord {
  brand: string;
  model: string;
  age_category: string;      // "2-3", "4-5", "6-7", "8-9", "10-11"
  defect_rate_pct: number;    // e.g. 2.8
  common_defects: string[];   // e.g. ["brake discs", "axle springs"]
  rank: number;               // e.g. 1 (best in category)
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  94-TUV-ENHANCED-IMPORT — TÜV Report 2024');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`  Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const tuvData: TUVRecord[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`  Loaded ${tuvData.length} TÜV records`);

  // Load generations
  console.log('  Loading generations...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, internal_code, production_start, production_end, model:models(id, name, brand:brands(id, name))'
  );
  console.log(`  ${gens.length} generations loaded`);

  // Build lookup
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

  let matched = 0;
  let unmatched = 0;
  const specsToInsert: any[] = [];
  const unmatchedModels = new Set<string>();

  for (const rec of tuvData) {
    const brandNorm = BRAND_MAP[normalize(rec.brand)] || normalize(rec.brand);
    const modelNorm = normalize(rec.model);

    let matchedGens = genLookup.get(`${brandNorm}|${modelNorm}`);

    // Fuzzy model match
    if (!matchedGens) {
      for (const [k, g] of genLookup.entries()) {
        const [bNorm, mNorm] = k.split('|');
        if (bNorm !== brandNorm) continue;
        if (mNorm.includes(modelNorm) || modelNorm.includes(mNorm)) {
          matchedGens = g;
          break;
        }
      }
    }

    if (!matchedGens || matchedGens.length === 0) {
      unmatched++;
      unmatchedModels.add(`${rec.brand} ${rec.model}`);
      continue;
    }

    matched++;

    // Match age category to appropriate generation based on production years
    // age_category "2-3" means 2-3 years old → produced ~2021-2022
    const currentYear = 2024;
    const ageRange = rec.age_category.split('-').map(Number);
    const productionYearMin = currentYear - ageRange[1];
    const productionYearMax = currentYear - ageRange[0];

    // Find the best matching generation by production year
    let bestGen = matchedGens[0];
    for (const gen of matchedGens) {
      if (!gen.production_start) continue;
      const genYear = new Date(gen.production_start).getFullYear();
      if (genYear >= productionYearMin - 2 && genYear <= productionYearMax + 2) {
        bestGen = gen;
        break;
      }
    }

    const ageSuffix = rec.age_category.replace('-', '_');

    // Insert defect rate
    specsToInsert.push({
      generation_id: bestGen.id,
      spec_type: `tuv_defect_rate_${ageSuffix}yr`,
      spec_value: String(rec.defect_rate_pct),
      source: SOURCE,
      raw_data: JSON.stringify({
        rank: rec.rank,
        common_defects: rec.common_defects,
        age_category: rec.age_category,
      }),
    });

    // Insert rank
    specsToInsert.push({
      generation_id: bestGen.id,
      spec_type: `tuv_rank_${ageSuffix}yr`,
      spec_value: String(rec.rank),
      source: SOURCE,
    });

    // Insert common defects
    if (rec.common_defects.length > 0) {
      specsToInsert.push({
        generation_id: bestGen.id,
        spec_type: `tuv_defects_${ageSuffix}yr`,
        spec_value: rec.common_defects.join(', '),
        source: SOURCE,
      });
    }
  }

  console.log(`\n  Matched: ${matched}/${tuvData.length} (${Math.round(matched / tuvData.length * 100)}%)`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Specs to insert: ${specsToInsert.length}`);
  if (unmatchedModels.size > 0) {
    console.log(`  Unmatched models: ${[...unmatchedModels].slice(0, 10).join(', ')}${unmatchedModels.size > 10 ? '...' : ''}`);
  }

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No writes performed.');
  } else if (specsToInsert.length > 0) {
    let totalInserted = 0;
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
  console.log(`  TÜV enhanced import complete.`);
  console.log('='.repeat(60));
}

main().catch(console.error);
