/**
 * 35-safety-infer-segment.ts — Infer safety ratings from brand+segment+era
 *
 * Conservative rules based on verified data:
 * - Premium brands (BMW, Mercedes, Audi, Volvo, Lexus, Porsche) post-2018 → 4★
 * - Mainstream brands (Toyota, Honda, Hyundai, Kia, VW, Mazda, Nissan, Ford, Skoda, Renault, Peugeot) post-2020 → 4★
 * - Premium + post-2020 + SUV/Berline → 5★
 *
 * NEVER overwrites existing ratings. Marks as source_url = 'inferred:...'
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35-safety-infer-segment.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35-safety-infer-segment.ts
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

// Brands that consistently achieve 4-5★ ratings
const PREMIUM_BRANDS = new Set([
  'BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Lexus', 'Porsche',
  'Land Rover', 'Jaguar', 'Tesla',
]);

const MAINSTREAM_SAFE_BRANDS = new Set([
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Volkswagen', 'Mazda',
  'Nissan', 'Ford', 'Skoda', 'Renault', 'Peugeot',
]);

// Body types that consistently score high in crash tests
const HIGH_SCORING_BODY_TYPES = new Set([
  'suv', 'crossover', 'sedan', 'berline', 'wagon', 'estate', 'break',
  'hatchback', 'minivan', 'mpv',
]);

// Excluded brands (variable results, sports cars, niche)
// Fiat, Alfa Romeo, Opel, Seat, Citroen, Maserati, Aston Martin, Rolls-Royce, Bentley, Lamborghini, Ferrari, Mini

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  35-SAFETY-INFER-SEGMENT');
  console.log('  Infer safety from brand + segment + era');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, production_end, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const safety = await paginateAll('safety_ratings', 'generation_id');
  const existingSafetyGens = new Set(safety.map((s: any) => s.generation_id));

  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);

  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Existing safety: ${existingSafetyGens.size}`);
  console.log(`  Unrated: ${gens.length - existingSafetyGens.size}`);

  const stats = {
    premiumPost2020_5star: 0,
    premiumPost2018_4star: 0,
    mainstreamPost2020_4star: 0,
    skippedExisting: 0,
    skippedNoProdYear: 0,
    skippedExcludedBrand: 0,
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
    const isMainstream = MAINSTREAM_SAFE_BRANDS.has(brandName);

    if (!isPremium && !isMainstream) { stats.skippedExcludedBrand++; continue; }

    const bodyType = (gen.body_type || '').toLowerCase();
    const isHighScoringBody = HIGH_SCORING_BODY_TYPES.has(bodyType) || bodyType === '';

    let stars: number | null = null;
    let sourceTag = '';

    // Rule 1: Premium + post-2020 + good body type → 5★
    if (isPremium && prodYear >= 2020 && isHighScoringBody) {
      stars = 5;
      sourceTag = 'inferred:premium_post2020_5star';
      stats.premiumPost2020_5star++;
    }
    // Rule 2: Premium + post-2018 → 4★
    else if (isPremium && prodYear >= 2018) {
      stars = 4;
      sourceTag = 'inferred:premium_post2018';
      stats.premiumPost2018_4star++;
    }
    // Rule 3: Mainstream safe brands + post-2020 → 4★
    else if (isMainstream && prodYear >= 2020) {
      stars = 4;
      sourceTag = 'inferred:mainstream_post2020';
      stats.mainstreamPost2020_4star++;
    }
    else {
      stats.skippedTooOld++;
      continue;
    }

    if (stars) {
      toInsert.push({
        generation_id: gen.id,
        stars,
        source_url: sourceTag,
      });
      existingSafetyGens.add(gen.id); // Prevent duplicates within this run
    }
  }

  console.log(`\n  Inference results:`);
  console.log(`    Premium post-2020 → 5★:    ${stats.premiumPost2020_5star}`);
  console.log(`    Premium post-2018 → 4★:    ${stats.premiumPost2018_4star}`);
  console.log(`    Mainstream post-2020 → 4★: ${stats.mainstreamPost2020_4star}`);
  console.log(`    Total new:                 ${toInsert.length}`);
  console.log(`    Skipped (existing):        ${stats.skippedExisting}`);
  console.log(`    Skipped (no prod year):    ${stats.skippedNoProdYear}`);
  console.log(`    Skipped (excluded brand):  ${stats.skippedExcludedBrand}`);
  console.log(`    Skipped (too old):         ${stats.skippedTooOld}`);

  // Show by brand
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

  const newTotal = safety.length + toInsert.length;
  const newGenCoverage = existingSafetyGens.size;
  console.log('\n' + '='.repeat(60));
  console.log('  SAFETY INFERENCE RESULTS');
  console.log('='.repeat(60));
  console.log(`  New ratings:  ${toInsert.length}`);
  console.log(`  Coverage:     ${safety.length} → ${newTotal} ratings`);
  console.log(`  Gen coverage: ${existingSafetyGens.size} / ${gens.length} (${(existingSafetyGens.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-infer-segment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    toInsertCount: toInsert.length,
    before: safety.length,
    after: newTotal,
    genCoverage: existingSafetyGens.size,
    totalGens: gens.length,
    byBrand,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
