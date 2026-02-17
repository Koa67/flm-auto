/**
 * 12-safety-propagation.ts — Propagate safety ratings within model families
 *
 * If BMW 3 Series G20 has a rating, and there's a G20 facelift or
 * similar generation without a rating in the same year range, propagate it.
 *
 * Rules:
 *   - Same brand + same model
 *   - Overlapping production years (±3 years tolerance)
 *   - Only propagate to generations WITHOUT existing ratings
 *   - Mark source as 'propagated_from:{original_gen_id}'
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/12-safety-propagation.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/12-safety-propagation.ts
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
const YEAR_TOLERANCE = 3;
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

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  12-SAFETY-PROPAGATION — Propagate ratings within models');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load all generations
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Load existing safety ratings with full data
  const ratings = await paginateAll(
    'safety_ratings',
    'id, generation_id, stars, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, test_year, source_url, euroncap_id'
  );
  const ratingsByGenId = new Map<string, any>();
  for (const r of ratings) ratingsByGenId.set(r.generation_id, r);
  console.log(`  Existing safety_ratings: ${ratings.length}`);

  // Group generations by brand|model
  const modelGroups = new Map<string, any[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    if (!modelGroups.has(key)) modelGroups.set(key, []);
    modelGroups.get(key)!.push(gen);
  }
  console.log(`  Model groups: ${modelGroups.size}`);

  // For each model group, find rated generations and propagate to unrated ones
  const stats = {
    modelsWithRatings: 0,
    modelsWithoutRatings: 0,
    candidatePairs: 0,
    propagated: 0,
    alreadyHas: 0,
    tooFarApart: 0,
    inserted: 0,
  };

  const toInsert: any[] = [];

  for (const [modelKey, modelGens] of Array.from(modelGroups.entries())) {
    // Split into rated and unrated
    const rated = modelGens.filter(g => ratingsByGenId.has(g.id));
    const unrated = modelGens.filter(g => !ratingsByGenId.has(g.id));

    if (rated.length === 0) { stats.modelsWithoutRatings++; continue; }
    if (unrated.length === 0) { stats.modelsWithRatings++; continue; }
    stats.modelsWithRatings++;

    // For each unrated generation, find the closest rated generation
    for (const uGen of unrated) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      const uEnd = uGen.production_end ? new Date(uGen.production_end).getFullYear() : null;

      let bestRated: any = null;
      let bestDistance = Infinity;

      for (const rGen of rated) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        const rEnd = rGen.production_end ? new Date(rGen.production_end).getFullYear() : null;

        if (!uStart || !rStart) continue;

        // Check overlap or proximity
        const rEndYear = rEnd || 2030;
        const uEndYear = uEnd || 2030;

        // Overlap check
        const overlaps = uStart <= rEndYear + YEAR_TOLERANCE && uEndYear >= rStart - YEAR_TOLERANCE;
        if (!overlaps) continue;

        // Distance: how close are the start years?
        const dist = Math.abs(uStart - rStart);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestRated = rGen;
        }
      }

      if (!bestRated) { stats.tooFarApart++; continue; }
      if (bestDistance > YEAR_TOLERANCE * 2) { stats.tooFarApart++; continue; }

      stats.candidatePairs++;

      // Propagate rating
      const sourceRating = ratingsByGenId.get(bestRated.id);
      if (!sourceRating) continue;

      toInsert.push({
        generation_id: uGen.id,
        euroncap_id: sourceRating.euroncap_id,
        source_url: `propagated_from:${bestRated.id}`,
        stars: sourceRating.stars,
        adult_occupant_pct: sourceRating.adult_occupant_pct,
        child_occupant_pct: sourceRating.child_occupant_pct,
        pedestrian_pct: sourceRating.pedestrian_pct,
        safety_assist_pct: sourceRating.safety_assist_pct,
        test_year: sourceRating.test_year,
      });

      // Mark as "rated" to prevent cascading propagation issues
      ratingsByGenId.set(uGen.id, sourceRating);
      stats.propagated++;
    }
  }

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} propagated ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error: ${error.message}`);
      else inserted += batch.length;
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  SAFETY PROPAGATION RESULTS');
  console.log('='.repeat(60));
  console.log(`  Models with ratings:    ${stats.modelsWithRatings}`);
  console.log(`  Models without ratings: ${stats.modelsWithoutRatings}`);
  console.log(`  Candidate pairs:        ${stats.candidatePairs}`);
  console.log(`  Propagated:             ${stats.propagated}`);
  console.log(`  Too far apart:          ${stats.tooFarApart}`);
  console.log(`  Inserted:               ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  const newTotal = ratings.length + stats.propagated;
  console.log(`\n  Safety coverage: ${ratings.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-propagation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
