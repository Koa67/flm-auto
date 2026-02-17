/**
 * 35b-safety-infer-wider.ts — Wider safety inference for remaining gaps
 *
 * Extended rules (still conservative):
 * - Premium brands post-2012 → 4★ (EU mandatory AEB from 2014, tested since 2012)
 * - Mainstream safe brands post-2015 → 3★ (pre-AEB mandate but major models tested)
 * - Premium brands post-2005 → 3★ (crashworthiness was already very good)
 * - Mainstream + post-2010 → 3★ (modern platforms, ESC mandatory EU 2011)
 * - Excluded brands (Fiat, Opel, Seat, Citroen, Alfa) post-2018 → 3★ (EU GSR mandatory 2019/2022)
 *
 * Never overwrites existing ratings.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35b-safety-infer-wider.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35b-safety-infer-wider.ts
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
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

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

const PREMIUM_BRANDS = new Set([
  'BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Lexus', 'Porsche',
  'Land Rover', 'Jaguar', 'Tesla',
]);

const MAINSTREAM_SAFE = new Set([
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Volkswagen', 'Mazda',
  'Nissan', 'Ford', 'Skoda', 'Renault', 'Peugeot',
]);

const SECONDARY_BRANDS = new Set([
  'Fiat', 'Opel', 'SEAT', 'Citroen', 'Alfa Romeo', 'Mini',
]);

// Sports/luxury niche — no inference (too variable)
// Ferrari, Lamborghini, Maserati, Aston Martin, Rolls-Royce, Bentley

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  35b-SAFETY-INFER-WIDER');
  console.log('  Extended safety inference for remaining gaps');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const safety = await paginateAll('safety_ratings', 'generation_id');
  const existingSafetyGens = new Set(safety.map((s: any) => s.generation_id));

  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);

  console.log(`  Existing safety: ${existingSafetyGens.size} / ${gens.length}`);

  const stats: Record<string, number> = {
    premiumPost2012_4star: 0,
    premiumPost2005_3star: 0,
    mainstreamPost2015_3star: 0,
    mainstreamPost2010_3star: 0,
    secondaryPost2018_3star: 0,
    skippedExisting: 0,
    skippedNoProdYear: 0,
    skippedExcluded: 0,
    skippedTooOld: 0,
  };

  const toInsert: any[] = [];

  for (const gen of gens) {
    if (existingSafetyGens.has(gen.id)) { stats.skippedExisting++; continue; }

    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;

    const brandName = brand.name;
    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (!prodYear) { stats.skippedNoProdYear++; continue; }

    const isPremium = PREMIUM_BRANDS.has(brandName);
    const isMainstream = MAINSTREAM_SAFE.has(brandName);
    const isSecondary = SECONDARY_BRANDS.has(brandName);

    let stars: number | null = null;
    let sourceTag = '';

    if (isPremium) {
      if (prodYear >= 2012) {
        stars = 4; sourceTag = 'inferred:premium_post2012'; stats.premiumPost2012_4star++;
      } else if (prodYear >= 2005) {
        stars = 3; sourceTag = 'inferred:premium_post2005'; stats.premiumPost2005_3star++;
      } else { stats.skippedTooOld++; continue; }
    } else if (isMainstream) {
      if (prodYear >= 2015) {
        stars = 3; sourceTag = 'inferred:mainstream_post2015'; stats.mainstreamPost2015_3star++;
      } else if (prodYear >= 2010) {
        stars = 3; sourceTag = 'inferred:mainstream_post2010'; stats.mainstreamPost2010_3star++;
      } else { stats.skippedTooOld++; continue; }
    } else if (isSecondary) {
      if (prodYear >= 2018) {
        stars = 3; sourceTag = 'inferred:secondary_post2018'; stats.secondaryPost2018_3star++;
      } else { stats.skippedTooOld++; continue; }
    } else {
      stats.skippedExcluded++; continue;
    }

    if (stars) {
      toInsert.push({ generation_id: gen.id, stars, source_url: sourceTag });
      existingSafetyGens.add(gen.id);
    }
  }

  console.log('\n  Inference results:');
  for (const [k, v] of Object.entries(stats)) {
    if (v > 0) console.log(`    ${k.padEnd(30)} ${v}`);
  }
  console.log(`    Total new:                 ${toInsert.length}`);

  // By brand
  const byBrand: Record<string, number> = {};
  for (const r of toInsert) {
    const gen = gens.find((g: any) => g.id === r.generation_id);
    if (!gen) continue;
    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;
    byBrand[brand.name] = (byBrand[brand.name] || 0) + 1;
  }
  console.log('\n  By brand:');
  for (const [b, c] of Object.entries(byBrand).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${b.padEnd(18)} +${c}`);
  }

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  WIDER INFERENCE RESULTS');
  console.log('='.repeat(60));
  console.log(`  New ratings:  ${toInsert.length}`);
  console.log(`  Gen coverage: ${existingSafetyGens.size} / ${gens.length} (${(existingSafetyGens.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-infer-wider-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, count: toInsert.length, coverage: existingSafetyGens.size, byBrand }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
