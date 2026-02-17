/**
 * 35c-safety-infer-noprod.ts — Safety inference for gens without production_start
 *
 * Phase 1: Infer prod year from model siblings (same model, other gens have dates)
 * Phase 2: For old premium (pre-2005) and old mainstream (pre-2010), assign 2★
 * Phase 3: For gens with no prod year at all, if model has other rated gens → same rating
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35c-safety-infer-noprod.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/35c-safety-infer-noprod.ts
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

const PREMIUM = new Set(['BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Lexus', 'Porsche', 'Land Rover', 'Jaguar', 'Tesla']);
const MAINSTREAM = new Set(['Toyota', 'Honda', 'Hyundai', 'Kia', 'Volkswagen', 'Mazda', 'Nissan', 'Ford', 'Skoda', 'Renault', 'Peugeot']);
const SECONDARY = new Set(['Fiat', 'Opel', 'SEAT', 'Citroen', 'Alfa Romeo', 'Mini']);

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  35c-SAFETY-INFER-NOPROD');
  console.log('  Safety inference for remaining gaps');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const safety = await paginateAll('safety_ratings', 'generation_id, stars');
  const existingSafetyGens = new Set(safety.map((s: any) => s.generation_id));

  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }
  // Safety by gen
  const safetyByGen = new Map<string, number>();
  for (const s of safety) safetyByGen.set(s.generation_id, s.stars);

  console.log(`\n  Safety: ${existingSafetyGens.size} / ${gens.length} (${(existingSafetyGens.size / gens.length * 100).toFixed(1)}%)`);

  const toInsert: any[] = [];
  const stats = { phase1: 0, phase2: 0, phase3: 0 };

  // ── Phase 1: Old premium (pre-2005) → 3★ ; Old mainstream (pre-2010) → 2★ ──
  console.log('\n  ── Phase 1: Old vehicles with known production year ──');
  for (const gen of gens) {
    if (existingSafetyGens.has(gen.id)) continue;
    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (!prodYear) continue; // Phase 3 handles these

    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;

    const isPremium = PREMIUM.has(brand.name);
    const isMainstream = MAINSTREAM.has(brand.name);
    const isSecondary = SECONDARY.has(brand.name);

    let stars: number | null = null;
    let tag = '';

    if (isPremium && prodYear >= 1995) {
      stars = 3; tag = 'inferred:premium_pre2005';
    } else if (isMainstream && prodYear >= 2000) {
      stars = 2; tag = 'inferred:mainstream_pre2010';
    } else if (isSecondary && prodYear >= 2010) {
      stars = 2; tag = 'inferred:secondary_post2010';
    } else if ((isPremium || isMainstream || isSecondary) && prodYear >= 1990) {
      stars = 2; tag = 'inferred:old_known_brand';
    }

    if (stars) {
      toInsert.push({ generation_id: gen.id, stars, source_url: tag });
      existingSafetyGens.add(gen.id);
      stats.phase1++;
    }
  }
  console.log(`  Phase 1: ${stats.phase1}`);

  // ── Phase 2: Niche brands (Ferrari, Lambo, etc.) → 3★ if post-2010 ──
  console.log('\n  ── Phase 2: Niche/exotic brands ──');
  for (const gen of gens) {
    if (existingSafetyGens.has(gen.id)) continue;
    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (!prodYear || prodYear < 2010) continue;

    const model = modelById.get(gen.model_id);
    if (!model) continue;
    const brand = brandById.get(model.brand_id);
    if (!brand) continue;

    // If not already handled by premium/mainstream/secondary
    toInsert.push({ generation_id: gen.id, stars: 3, source_url: 'inferred:niche_post2010' });
    existingSafetyGens.add(gen.id);
    stats.phase2++;
  }
  console.log(`  Phase 2: ${stats.phase2}`);

  // ── Phase 3: Gens without production_start → copy from model siblings ──
  console.log('\n  ── Phase 3: No production year → model sibling copy ──');
  for (const gen of gens) {
    if (existingSafetyGens.has(gen.id)) continue;
    if (gen.production_start) continue; // Already has date — was handled above or excluded

    if (!gen.model_id) continue;
    const modelGens = gensByModel.get(gen.model_id) || [];

    // Find the most common rating for this model
    const ratings: number[] = [];
    for (const mg of modelGens) {
      const r = safetyByGen.get(mg.id);
      if (r) ratings.push(r);
    }
    if (ratings.length === 0) continue;

    // Use the median rating
    ratings.sort((a, b) => a - b);
    const median = ratings[Math.floor(ratings.length / 2)];

    toInsert.push({ generation_id: gen.id, stars: median, source_url: 'inferred:model_sibling_median' });
    existingSafetyGens.add(gen.id);
    stats.phase3++;
  }
  console.log(`  Phase 3: ${stats.phase3}`);

  console.log(`\n  Total new: ${toInsert.length}`);

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`  Inserting ${toInsert.length}...`);
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
  console.log('  RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (old dated):      ${stats.phase1}`);
  console.log(`  Phase 2 (niche):          ${stats.phase2}`);
  console.log(`  Phase 3 (no date sibling): ${stats.phase3}`);
  console.log(`  Coverage: ${existingSafetyGens.size} / ${gens.length} (${(existingSafetyGens.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-infer-noprod-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, total: toInsert.length, coverage: existingSafetyGens.size }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
