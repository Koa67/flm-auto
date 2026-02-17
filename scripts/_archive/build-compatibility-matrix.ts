/**
 * FLM AUTO — Family Fit Builder
 * Phase 1: Build compatibility matrix (child seats × vehicles)
 * Phase 2: Calculate Family Fit scores for all generations
 *
 * Targets: ≥10,000 compatibility pairs, ≥1,000 generations with score
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/build-compatibility-matrix.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

interface ChildSeat {
  id: string;
  brand: string;
  model: string;
  seat_type: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  isofix_compatible: boolean;
  belt_compatible: boolean;
  swivel: boolean;
}

interface GenDimensions {
  generation_id: string;
  front_headroom_mm: number | null;
  rear_headroom_mm: number | null;
  front_legroom_mm: number | null;
  rear_legroom_mm: number | null;
  front_shoulder_room_mm: number | null;
  rear_shoulder_room_mm: number | null;
  trunk_volume_liters: number | null;
  trunk_volume_max_liters: number | null;
  seating_capacity: number | null;
}

interface FamilyFitRow {
  generation_id: string;
  isofix_points: number | null;
  rear_headroom_mm: number | null;
  rear_legroom_max_mm: number | null;
  rear_bench_width_usable_mm: number | null;
}

function calculateFitRating(seat: ChildSeat, dims: GenDimensions, familyFit: FamilyFitRow | null): {
  compatible: boolean;
  fit_rating: string;
  notes: string[];
} {
  const notes: string[] = [];
  let score = 100;

  const hasIsofix = familyFit && familyFit.isofix_points && familyFit.isofix_points > 0;
  if (seat.isofix_compatible && !seat.belt_compatible && !hasIsofix) {
    return { compatible: false, fit_rating: 'incompatible', notes: ['ISOFIX required but not available'] };
  }

  if (seat.height_mm && dims.rear_headroom_mm) {
    const clearance = dims.rear_headroom_mm - seat.height_mm;
    if (clearance < 0) { score -= 50; notes.push('Seat too tall'); }
    else if (clearance < 30) { score -= 20; notes.push('Very tight headroom'); }
    else if (clearance < 80) { score -= 5; notes.push('Adequate headroom'); }
  }

  if (seat.width_mm && dims.rear_shoulder_room_mm) {
    const widthRatio = seat.width_mm / dims.rear_shoulder_room_mm;
    if (widthRatio > 0.45) { score -= 15; notes.push('Wide seat - 3-across difficult'); }
    else if (widthRatio > 0.38) { score -= 5; }
  }

  if (seat.swivel && seat.depth_mm && dims.rear_legroom_mm) {
    const depthClearance = dims.rear_legroom_mm - seat.depth_mm;
    if (depthClearance < 0) { score -= 30; notes.push('Swivel seat too deep'); }
    else if (depthClearance < 50) { score -= 10; notes.push('Tight for swivel'); }
  }

  if (seat.isofix_compatible && hasIsofix) { score += 10; notes.push('ISOFIX available'); }

  let fit_rating: string;
  if (score >= 90) fit_rating = 'perfect';
  else if (score >= 70) fit_rating = 'good';
  else if (score >= 50) fit_rating = 'tight';
  else fit_rating = 'incompatible';

  return { compatible: score >= 50, fit_rating, notes };
}

function calculateFamilyFitScore(
  dims: GenDimensions | null,
  familyFit: FamilyFitRow | null,
  safetyRating: { stars: number; adult_occupant_pct: number | null } | null,
): number {
  let score = 0;

  // ESPACE (40 points)
  if (dims) {
    const trunk = dims.trunk_volume_liters || 0;
    if (trunk >= 600) score += 15;
    else if (trunk >= 500) score += 12;
    else if (trunk >= 400) score += 8;
    else if (trunk >= 300) score += 5;
    else if (trunk > 0) score += 2;

    const legroom = dims.rear_legroom_mm || 0;
    if (legroom >= 1000) score += 10;
    else if (legroom >= 900) score += 8;
    else if (legroom >= 800) score += 5;
    else if (legroom > 0) score += 2;

    const headroom = dims.rear_headroom_mm || 0;
    if (headroom >= 1000) score += 10;
    else if (headroom >= 950) score += 8;
    else if (headroom >= 900) score += 5;
    else if (headroom > 0) score += 2;

    const seats = dims.seating_capacity || 0;
    if (seats >= 7) score += 5;
    else if (seats >= 5) score += 3;
    else if (seats > 0) score += 1;
  }

  // ISOFIX (30 points)
  if (familyFit) {
    const isofix = familyFit.isofix_points || 0;
    if (isofix >= 3) score += 25;
    else if (isofix >= 2) score += 15;
    else if (isofix >= 1) score += 8;
    if (familyFit.rear_bench_width_usable_mm && familyFit.rear_bench_width_usable_mm > 1300) score += 5;
  } else {
    score += 10; // Most post-2014 cars have 2 ISOFIX
  }

  // SÉCURITÉ (20 points)
  if (safetyRating) {
    if (safetyRating.stars >= 5) score += 20;
    else if (safetyRating.stars >= 4) score += 15;
    else if (safetyRating.stars >= 3) score += 10;
    else if (safetyRating.stars >= 2) score += 5;
  } else {
    score += 5;
  }

  // PRATICITÉ baseline (10 points) - without spec data, give moderate
  score += 3;

  return Math.min(100, Math.max(0, score));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Family Fit Builder');
  console.log('  Phase 1: Compatibility Matrix (≥10,000 pairs)');
  console.log('  Phase 2: Family Fit Scores (≥1,000 generations)');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Loading data...\n');

  const childSeats = await paginateAll('child_seats', 'id, brand, model, seat_type, width_mm, height_mm, depth_mm, isofix_compatible, belt_compatible, swivel');
  console.log(`  Child seats: ${childSeats.length}`);

  const dimensions = await paginateAll('interior_dimensions', 'generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, front_shoulder_room_mm, rear_shoulder_room_mm, trunk_volume_liters, trunk_volume_max_liters, seating_capacity');
  console.log(`  Generations with dimensions: ${dimensions.length}`);

  const familyFitData = await paginateAll('family_fit_compatibility', 'generation_id, isofix_points, rear_headroom_mm, rear_legroom_max_mm, rear_bench_width_usable_mm');
  console.log(`  Family fit records: ${familyFitData.length}`);

  const safetyRatings = await paginateAll('safety_ratings', 'generation_id, stars, adult_occupant_pct');
  console.log(`  Safety ratings: ${safetyRatings.length}`);

  const allGens = await paginateAll('generations', 'id');
  console.log(`  Total generations: ${allGens.length}\n`);

  const dimsMap = new Map<string, GenDimensions>();
  for (const d of dimensions) dimsMap.set(d.generation_id, d);

  const familyFitMap = new Map<string, FamilyFitRow>();
  for (const f of familyFitData) familyFitMap.set(f.generation_id, f);

  const safetyMap = new Map<string, any>();
  for (const s of safetyRatings) safetyMap.set(s.generation_id, s);

  // ═══ PHASE 1: Compatibility Matrix ═══
  console.log('═══ PHASE 1: Building Compatibility Matrix ═══\n');

  let compatInserted = 0;
  let compatErrors = 0;
  const batchSize = 200;
  let batch: any[] = [];

  const genIds = dimensions.map(d => d.generation_id);
  const totalPairs = genIds.length * childSeats.length;
  console.log(`  Generating ${totalPairs} compatibility pairs (${genIds.length} gens × ${childSeats.length} seats)\n`);

  for (let gi = 0; gi < genIds.length; gi++) {
    const genId = genIds[gi];
    const dims = dimsMap.get(genId)!;
    const familyFit = familyFitMap.get(genId) || null;

    for (const seat of childSeats) {
      const result = calculateFitRating(seat, dims, familyFit);

      batch.push({
        child_seat_id: seat.id,
        generation_id: genId,
        position: 'rear_left',
        compatible: result.compatible,
        fit_rating: result.fit_rating,
        notes: result.notes.join('; ') || null,
        source: 'calculated',
      });

      if (batch.length >= batchSize) {
        const { error } = await supabase.from('child_seat_vehicle_compatibility').upsert(batch, {
          onConflict: 'child_seat_id,generation_id,position',
        });
        if (!error) compatInserted += batch.length;
        else {
          compatErrors += batch.length;
          if (compatErrors <= 500) console.log(`  BATCH ERROR: ${error.message}`);
        }
        batch = [];
      }
    }

    if ((gi + 1) % 200 === 0 || gi === genIds.length - 1) {
      console.log(`  [Gen ${gi + 1}/${genIds.length}] Pairs: ${compatInserted}, Errors: ${compatErrors}`);
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('child_seat_vehicle_compatibility').upsert(batch, {
      onConflict: 'child_seat_id,generation_id,position',
    });
    if (!error) compatInserted += batch.length; else compatErrors += batch.length;
  }

  const { count: totalCompat } = await supabase.from('child_seat_vehicle_compatibility').select('*', { count: 'exact', head: true });
  console.log(`\n  Total compatibility pairs: ${totalCompat}\n`);

  // ═══ PHASE 2: Family Fit Scores ═══
  console.log('═══ PHASE 2: Calculating Family Fit Scores ═══\n');

  let scoresInserted = 0;
  let scoresUpdated = 0;
  let scoresErrors = 0;
  let scoresSkipped = 0;
  let scoreBatch: any[] = [];

  for (let i = 0; i < allGens.length; i++) {
    const gen = allGens[i];
    const dims = dimsMap.get(gen.id) || null;
    const familyFit = familyFitMap.get(gen.id) || null;
    const safety = safetyMap.get(gen.id) || null;

    if (!dims && !familyFit && !safety) {
      scoresSkipped++;
      continue;
    }

    const score = calculateFamilyFitScore(dims, familyFit, safety);

    scoreBatch.push({
      generation_id: gen.id,
      family_fit_score: score,
      source: 'calculated',
    });

    if (scoreBatch.length >= 100) {
      const { error } = await supabase.from('family_fit_compatibility').upsert(scoreBatch, {
        onConflict: 'generation_id',
      });
      if (!error) scoresInserted += scoreBatch.length;
      else {
        scoresErrors += scoreBatch.length;
        if (scoresErrors <= 5) console.log(`  SCORE ERROR: ${error.message}`);
      }
      scoreBatch = [];
    }

    if ((i + 1) % 500 === 0 || i === allGens.length - 1) {
      console.log(`  [${i + 1}/${allGens.length}] Scored: ${scoresInserted}, Skipped: ${scoresSkipped}, Errors: ${scoresErrors}`);
    }
  }

  if (scoreBatch.length > 0) {
    const { error } = await supabase.from('family_fit_compatibility').upsert(scoreBatch, {
      onConflict: 'generation_id',
    });
    if (!error) scoresInserted += scoreBatch.length; else scoresErrors += scoreBatch.length;
  }

  const { count: totalScores } = await supabase.from('family_fit_compatibility').select('*', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  FAMILY FIT BUILD COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Compatibility pairs:     ${totalCompat}`);
  console.log(`  Family fit total rows:   ${totalScores}`);
  console.log(`  Scores calculated:       ${scoresInserted}`);
  console.log(`  Skipped (no data):       ${scoresSkipped}`);
  console.log(`  Errors:                  ${scoresErrors}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
