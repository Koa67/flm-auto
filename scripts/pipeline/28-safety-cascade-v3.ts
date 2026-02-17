/**
 * 28-safety-cascade-v3.ts — Aggressive safety propagation v3
 *
 * Phase 1: Facelift propagation (same model, overlapping production)
 * Phase 2: Sibling models (e.g., 3 Series → 4 Series, Golf → Golf Variant)
 * Phase 3: Badge engineering (same car, different brand)
 * Phase 4: Wider same-model propagation (±10 years)
 *
 * Never overwrites existing safety ratings.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/28-safety-cascade-v3.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/28-safety-cascade-v3.ts
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

// Sibling model pairs: if one is rated, the other gets the same rating
const SIBLING_PAIRS: [string, string, string, string][] = [
  // [brand1, model1, brand2, model2]
  ['BMW', '3 Series', 'BMW', '4 Series'],
  ['BMW', '3 Series', 'BMW', '3 Series Gran Turismo'],
  ['BMW', '5 Series', 'BMW', '6 Series'],
  ['BMW', '5 Series', 'BMW', '6 Series Gran Turismo'],
  ['BMW', 'X3', 'BMW', 'X4'],
  ['BMW', 'X5', 'BMW', 'X6'],
  ['BMW', 'X1', 'BMW', 'X2'],
  ['Mercedes-Benz', 'C-Class', 'Mercedes-Benz', 'GLC'],
  ['Mercedes-Benz', 'E-Class', 'Mercedes-Benz', 'GLE'],
  ['Mercedes-Benz', 'A-Class', 'Mercedes-Benz', 'CLA'],
  ['Mercedes-Benz', 'A-Class', 'Mercedes-Benz', 'GLA'],
  ['Mercedes-Benz', 'B-Class', 'Mercedes-Benz', 'GLA'],
  ['Volkswagen', 'Golf', 'Volkswagen', 'Golf Variant'],
  ['Volkswagen', 'Golf', 'Volkswagen', 'Golf Sportsvan'],
  ['Volkswagen', 'Tiguan', 'Volkswagen', 'Tiguan Allspace'],
  ['Volkswagen', 'Passat', 'Volkswagen', 'Passat Variant'],
  ['Volkswagen', 'T-Roc', 'Volkswagen', 'T-Roc Cabriolet'],
  ['Audi', 'A4', 'Audi', 'A4 Avant'],
  ['Audi', 'A4', 'Audi', 'A5'],
  ['Audi', 'A6', 'Audi', 'A6 Avant'],
  ['Audi', 'A6', 'Audi', 'A7'],
  ['Audi', 'Q3', 'Audi', 'Q3 Sportback'],
  ['Audi', 'Q5', 'Audi', 'Q5 Sportback'],
  ['Peugeot', '3008', 'Peugeot', '5008'],
  ['Peugeot', '208', 'Peugeot', '2008'],
  ['Peugeot', '308', 'Peugeot', '308 SW'],
  ['Citroen', 'C4', 'Citroen', 'C4 Cactus'],
  ['Renault', 'Megane', 'Renault', 'Megane Estate'],
  ['Renault', 'Clio', 'Renault', 'Captur'],
  ['Hyundai', 'Tucson', 'Kia', 'Sportage'],
  ['Hyundai', 'i30', 'Kia', 'Ceed'],
  ['Hyundai', 'i20', 'Kia', 'Rio'],
  ['Hyundai', 'Kona', 'Kia', 'Niro'],
  ['Hyundai', 'Ioniq 5', 'Kia', 'EV6'],
  ['Toyota', 'Yaris', 'Mazda', '2'],
  ['Toyota', 'RAV4', 'Lexus', 'NX'],
  ['Toyota', 'Camry', 'Lexus', 'ES'],
  ['Toyota', 'Corolla', 'Lexus', 'UX'],
  ['Nissan', 'Qashqai', 'Renault', 'Kadjar'],
  ['Nissan', 'Juke', 'Renault', 'Captur'],
  ['Skoda', 'Octavia', 'Volkswagen', 'Golf'],
  ['Skoda', 'Kodiaq', 'Volkswagen', 'Tiguan Allspace'],
  ['Skoda', 'Karoq', 'Volkswagen', 'T-Roc'],
  ['SEAT', 'Leon', 'Volkswagen', 'Golf'],
  ['Volvo', 'XC60', 'Volvo', 'V60'],
  ['Volvo', 'XC90', 'Volvo', 'V90'],
  ['Volvo', 'XC40', 'Volvo', 'V40'],
  ['Honda', 'Civic', 'Honda', 'Civic Tourer'],
  ['Honda', 'CR-V', 'Honda', 'HR-V'],
  ['Mazda', 'CX-5', 'Mazda', 'CX-50'],
  ['Mazda', '3', 'Mazda', 'CX-30'],
  ['Porsche', 'Cayenne', 'Porsche', 'Cayenne Coupe'],
  ['Porsche', 'Macan', 'Porsche', 'Macan S'],
];

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  28-SAFETY-CASCADE-V3');
  console.log('  Aggressive safety propagation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, production_end, model_id');
  const models = await paginateAll('models', 'id, name, brand:brands(id, name)');
  const safety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');

  const safetyByGenId = new Map<string, any>();
  for (const s of safety) safetyByGenId.set(s.generation_id, s);

  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Safety ratings: ${safety.length}`);

  const stats = { phase1: 0, phase2: 0, phase3: 0, phase4: 0 };
  const toInsert: any[] = [];

  // ── Phase 1: Facelift propagation ──
  console.log('\n  ── Phase 1: Facelift propagation ──');
  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withSafety = modelGens.filter((g: any) => safetyByGenId.has(g.id));
    const withoutSafety = modelGens.filter((g: any) => !safetyByGenId.has(g.id));
    if (withSafety.length === 0 || withoutSafety.length === 0) continue;

    for (const uGen of withoutSafety) {
      if (safetyByGenId.has(uGen.id)) continue;
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      const uEnd = uGen.production_end ? new Date(uGen.production_end).getFullYear() : null;
      if (!uStart) continue;

      // Find overlapping production period (facelift/LCI)
      for (const rGen of withSafety) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        const rEnd = rGen.production_end ? new Date(rGen.production_end).getFullYear() : null;
        if (!rStart) continue;

        // Check overlap: one starts before the other ends
        const overlap = (uStart <= (rEnd || rStart + 10)) && (rStart <= (uEnd || uStart + 10));
        const dist = Math.abs(uStart - rStart);

        if (overlap && dist <= 5) {
          const source = safetyByGenId.get(rGen.id);
          if (source) {
            toInsert.push({
              generation_id: uGen.id,
              stars: source.stars,
              source_url: `propagated_from:${rGen.id}`,
            });
            safetyByGenId.set(uGen.id, source);
            stats.phase1++;
            break;
          }
        }
      }
    }
  }
  console.log(`  Phase 1: ${stats.phase1}`);

  // ── Phase 2: Sibling models ──
  console.log('\n  ── Phase 2: Sibling models ──');

  // Build brand+model → model_id lookup
  const brandModelToModelId = new Map<string, string>();
  for (const m of models) {
    const brand = (m.brand as any)?.name || '';
    const key = `${brand.toLowerCase()}|${m.name.toLowerCase()}`;
    brandModelToModelId.set(key, m.id);
  }

  for (const [brand1, model1, brand2, model2] of SIBLING_PAIRS) {
    const mid1 = brandModelToModelId.get(`${brand1.toLowerCase()}|${model1.toLowerCase()}`);
    const mid2 = brandModelToModelId.get(`${brand2.toLowerCase()}|${model2.toLowerCase()}`);
    if (!mid1 || !mid2) continue;

    const gens1 = gensByModel.get(mid1) || [];
    const gens2 = gensByModel.get(mid2) || [];

    // Propagate both directions
    for (const [sourceGens, targetGens] of [[gens1, gens2], [gens2, gens1]]) {
      const rated = sourceGens.filter((g: any) => safetyByGenId.has(g.id));
      const unrated = targetGens.filter((g: any) => !safetyByGenId.has(g.id));

      for (const uGen of unrated) {
        const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
        if (!uStart) continue;

        let bestSource: any = null;
        let bestDist = Infinity;

        for (const rGen of rated) {
          const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
          if (!rStart) continue;
          const dist = Math.abs(uStart - rStart);
          if (dist <= 4 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
        }

        if (bestSource) {
          const source = safetyByGenId.get(bestSource.id);
          if (source) {
            toInsert.push({
              generation_id: uGen.id,
              stars: source.stars,
              source_url: `propagated_platform:${bestSource.id}`,
            });
            safetyByGenId.set(uGen.id, source);
            stats.phase2++;
          }
        }
      }
    }
  }
  console.log(`  Phase 2: ${stats.phase2}`);

  // ── Phase 3: Badge engineering (not implemented — few exact matches in our DB) ──
  // Skip for now

  // ── Phase 4: Wider same-model propagation (±10 years) ──
  console.log('\n  ── Phase 4: Wider same-model (±10 years) ──');
  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withSafety = modelGens.filter((g: any) => safetyByGenId.has(g.id));
    const withoutSafety = modelGens.filter((g: any) => !safetyByGenId.has(g.id));
    if (withSafety.length === 0 || withoutSafety.length === 0) continue;

    for (const uGen of withoutSafety) {
      if (safetyByGenId.has(uGen.id)) continue;
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withSafety) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= 10 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const source = safetyByGenId.get(bestSource.id);
      if (source) {
        toInsert.push({
          generation_id: uGen.id,
          stars: source.stars,
          source_url: `propagated_from:${bestSource.id}`,
        });
        safetyByGenId.set(uGen.id, source);
        stats.phase4++;
      }
    }
  }
  console.log(`  Phase 4: ${stats.phase4}`);

  // Deduplicate
  const seen = new Set<string>();
  const dedupedInsert = toInsert.filter(r => {
    if (seen.has(r.generation_id)) return false;
    seen.add(r.generation_id);
    return true;
  });
  // Remove any that already exist
  const existingGenIds = new Set(safety.map((s: any) => s.generation_id));
  const finalInsert = dedupedInsert.filter(r => !existingGenIds.has(r.generation_id));
  console.log(`\n  Deduped: ${toInsert.length} → ${dedupedInsert.length} → ${finalInsert.length} new`);

  if (!DRY_RUN && finalInsert.length > 0) {
    console.log(`  Inserting ${finalInsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < finalInsert.length; i += BATCH_SIZE) {
      const batch = finalInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted}`);
  }

  const newTotal = safety.length + finalInsert.length;
  console.log('\n' + '='.repeat(60));
  console.log('  SAFETY CASCADE V3 RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (facelift):     ${stats.phase1}`);
  console.log(`  Phase 2 (siblings):     ${stats.phase2}`);
  console.log(`  Phase 4 (wide model):   ${stats.phase4}`);
  console.log(`  Total new:              ${finalInsert.length}`);
  console.log(`  Coverage:               ${safety.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-cascade-v3-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: safety.length, after: newTotal }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
