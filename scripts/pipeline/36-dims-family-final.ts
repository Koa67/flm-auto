/**
 * 36-dims-family-final.ts — Final push for dimensions & family fit
 *
 * Phase 1: Estimate interior dims from exterior dimensions (third_party_specs)
 * Phase 2: Propagate dims within model ±1 generation (facelift copy)
 * Phase 3: Recalculate family fit from fresh dims
 * Phase 4: Propagate family fit within model family
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/36-dims-family-final.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/36-dims-family-final.ts
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

async function paginateAll(table: string, select: string, filter?: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function seatFitRating(headroom: number | null, legroom: number | null): string | null {
  if (!headroom && !legroom) return null;
  const h = headroom || 950;
  const l = legroom || 800;
  if (h >= 980 && l >= 850) return 'excellent';
  if (h >= 950 && l >= 780) return 'good';
  if (h >= 920 && l >= 700) return 'tight';
  return 'not_recommended';
}

function threeAcrossScore(w: number): { possible: boolean; score: string } {
  if (w >= 1450) return { possible: true, score: 'excellent' };
  if (w >= 1380) return { possible: true, score: 'good' };
  if (w >= 1320) return { possible: true, score: 'tight' };
  return { possible: false, score: 'not_recommended' };
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  36-DIMS-FAMILY-FINAL');
  console.log('  Final push for dimensions & family fit');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load all data
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const dims = await paginateAll('interior_dimensions', '*');
  const fits = await paginateAll('family_fit_compatibility', 'generation_id');

  const dimsByGen = new Map<string, any>();
  for (const d of dims) dimsByGen.set(d.generation_id, d);
  const fitGens = new Set(fits.map((f: any) => f.generation_id));

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  console.log(`  Gens: ${gens.length}`);
  console.log(`  Dims: ${dimsByGen.size} (${(dimsByGen.size / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Family Fit: ${fitGens.size} (${(fitGens.size / gens.length * 100).toFixed(1)}%)`);

  const stats = { p1Estimated: 0, p2Propagated: 0, p3FitCreated: 0, p4FitPropagated: 0 };

  // ── Phase 1: Estimate from exterior specs ──
  console.log('\n  ── Phase 1: Estimate interior dims from exterior ──');
  // Load exterior specs
  const extSpecs = await paginateAll(
    'third_party_specs', 'generation_id, spec_type, spec_value, raw_data',
    (q: any) => q.in('spec_type', [
      'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm',
      'how_long_is_', 'how_wide_is_', 'how_high_is_',
    ])
  );

  // Group exterior by gen
  const extByGen = new Map<string, Record<string, number>>();
  for (const s of extSpecs) {
    if (!extByGen.has(s.generation_id)) extByGen.set(s.generation_id, {});
    const data = extByGen.get(s.generation_id)!;
    const val = parseFloat(s.spec_value);
    if (isNaN(val)) continue;
    if (s.spec_type.includes('length') || s.spec_type.includes('long')) data.length = val;
    if (s.spec_type.includes('width') || s.spec_type.includes('wide')) data.width = val;
    if (s.spec_type.includes('height') || s.spec_type.includes('high')) data.height = val;
    if (s.spec_type.includes('wheelbase')) data.wheelbase = val;
  }

  const dimsToUpsert: any[] = [];

  for (const gen of gens) {
    if (dimsByGen.has(gen.id)) continue;
    const ext = extByGen.get(gen.id);
    if (!ext) continue;

    const row: any = { generation_id: gen.id };
    let fields = 0;

    // Estimate from exterior
    if (ext.height && ext.height >= 1300 && ext.height <= 2200) {
      // rear_headroom ≈ height - 680 (for sedans/SUVs)
      const headroom = Math.round(ext.height - 680);
      if (headroom >= 800 && headroom <= 1300) {
        row.rear_headroom_mm = headroom;
        row.front_headroom_mm = headroom + 20;
        fields += 2;
      }
    }

    if (ext.wheelbase && ext.wheelbase >= 2200 && ext.wheelbase <= 3500) {
      // rear_legroom ≈ wheelbase - 1200
      const legroom = Math.round(ext.wheelbase - 1200);
      if (legroom >= 600 && legroom <= 1200) {
        row.rear_legroom_mm = legroom;
        row.front_legroom_mm = legroom + 100;
        fields += 2;
      }
    }

    if (ext.width && ext.width >= 1500 && ext.width <= 2200) {
      // rear_shoulder_room ≈ width - 300
      const shoulder = Math.round(ext.width - 300);
      if (shoulder >= 1000 && shoulder <= 1700) {
        row.rear_shoulder_room_mm = shoulder;
        row.front_shoulder_room_mm = shoulder + 30;
        fields += 2;
      }
    }

    // Estimate trunk from length + body type
    if (ext.length) {
      const bt = (gen.body_type || '').toLowerCase();
      let trunkEstimate: number | null = null;
      if (bt.includes('suv') || bt.includes('crossover')) {
        trunkEstimate = Math.round((ext.length - 3800) * 0.5 + 350);
      } else if (bt.includes('sedan') || bt.includes('berline')) {
        trunkEstimate = Math.round((ext.length - 4000) * 0.4 + 400);
      } else if (bt.includes('wagon') || bt.includes('break') || bt.includes('estate')) {
        trunkEstimate = Math.round((ext.length - 3900) * 0.6 + 450);
      } else if (bt.includes('hatchback') || bt.includes('compact')) {
        trunkEstimate = Math.round((ext.length - 3600) * 0.4 + 280);
      }
      if (trunkEstimate && trunkEstimate >= 50 && trunkEstimate <= 2500) {
        row.trunk_volume_liters = trunkEstimate;
        fields++;
      }
    }

    if (fields > 0) {
      dimsToUpsert.push(row);
      dimsByGen.set(gen.id, row);
      stats.p1Estimated++;
    }
  }
  console.log(`  Phase 1: ${stats.p1Estimated} estimated from exterior`);

  // ── Phase 2: Propagate dims within model ──
  console.log('\n  ── Phase 2: Propagate dims within model ──');
  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withDims = modelGens.filter((g: any) => dimsByGen.has(g.id));
    const withoutDims = modelGens.filter((g: any) => !dimsByGen.has(g.id));
    if (withDims.length === 0 || withoutDims.length === 0) continue;

    for (const uGen of withoutDims) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;

      let bestSource: any = null;
      let bestDist = Infinity;
      for (const rGen of withDims) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!uStart || !rStart) {
          // No year info — just copy from any sibling
          if (bestSource === null) bestSource = rGen;
          continue;
        }
        const dist = Math.abs(uStart - rStart);
        if (dist <= 10 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const sourceDim = dimsByGen.get(bestSource.id);
      if (!sourceDim) continue;

      const row: any = { generation_id: uGen.id };
      let fields = 0;
      const dimCols = ['front_headroom_mm', 'rear_headroom_mm', 'front_legroom_mm', 'rear_legroom_mm',
        'front_shoulder_room_mm', 'rear_shoulder_room_mm', 'front_hip_room_mm', 'rear_hip_room_mm',
        'trunk_volume_liters', 'trunk_volume_max_liters', 'fuel_tank_liters', 'seating_capacity',
        'rear_bench_width_mm', 'rear_bench_width_total_mm'];
      for (const col of dimCols) {
        if (sourceDim[col] !== null && sourceDim[col] !== undefined) {
          row[col] = sourceDim[col];
          fields++;
        }
      }
      if (fields > 0) {
        dimsToUpsert.push(row);
        dimsByGen.set(uGen.id, row);
        stats.p2Propagated++;
      }
    }
  }
  console.log(`  Phase 2: ${stats.p2Propagated} propagated within model`);

  // Upsert dims
  if (!DRY_RUN && dimsToUpsert.length > 0) {
    // Dedup by generation_id
    const mergedDims = new Map<string, any>();
    for (const row of dimsToUpsert) {
      if (mergedDims.has(row.generation_id)) {
        const existing = mergedDims.get(row.generation_id)!;
        for (const [k, v] of Object.entries(row)) {
          if (k === 'generation_id') continue;
          if (v !== null && v !== undefined && (existing[k] === null || existing[k] === undefined)) existing[k] = v;
        }
      } else {
        mergedDims.set(row.generation_id, { ...row });
      }
    }
    const finalDims = Array.from(mergedDims.values());
    console.log(`\n  Upserting ${finalDims.length} dim rows...`);
    let upserted = 0;
    for (let i = 0; i < finalDims.length; i += BATCH_SIZE) {
      const batch = finalDims.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // ── Phase 3: Create family_fit from fresh dims ──
  console.log('\n  ── Phase 3: Create family fit from fresh dims ──');
  const fitsToUpsert: any[] = [];

  for (const gen of gens) {
    if (fitGens.has(gen.id)) continue;
    const dim = dimsByGen.get(gen.id);
    if (!dim) continue;
    if (!dim.rear_headroom_mm && !dim.rear_legroom_mm && !dim.rear_shoulder_room_mm) continue;

    const row: any = { generation_id: gen.id, source: 'derived_from_dims_v2' };
    let fields = 0;

    if (dim.rear_headroom_mm) { row.rear_headroom_mm = dim.rear_headroom_mm; fields++; }
    if (dim.rear_legroom_mm) { row.rear_legroom_max_mm = dim.rear_legroom_mm; fields++; }

    const benchWidth = dim.rear_bench_width_total_mm || dim.rear_bench_width_mm || dim.rear_shoulder_room_mm;
    if (benchWidth) {
      row.rear_bench_width_usable_mm = benchWidth;
      const ta = threeAcrossScore(benchWidth);
      row.three_across_possible = ta.possible;
      row.three_across_fit_score = ta.score;
      fields += 3;
    }

    const fit = seatFitRating(dim.rear_headroom_mm, dim.rear_legroom_mm);
    if (fit) {
      row.infant_seat_fit = fit;
      row.toddler_seat_fit = fit;
      row.booster_seat_fit = fit;
      fields += 3;
    }

    const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    if (prodYear && prodYear >= 2014) {
      row.isofix_points = 2;
      row.isofix_positions = ['rear_outboard'];
      fields += 2;
    }

    if (fields > 0) {
      fitsToUpsert.push(row);
      fitGens.add(gen.id);
      stats.p3FitCreated++;
    }
  }
  console.log(`  Phase 3: ${stats.p3FitCreated} family fit rows`);

  // ── Phase 4: Propagate family fit within model ──
  console.log('\n  ── Phase 4: Propagate family fit within model ──');
  const existingFits = await paginateAll('family_fit_compatibility', '*');
  const fitByGen = new Map<string, any>();
  for (const f of existingFits) fitByGen.set(f.generation_id, f);
  // Also include phase 3 rows
  for (const r of fitsToUpsert) fitByGen.set(r.generation_id, r);

  const FIT_COLS = [
    'isofix_points', 'isofix_positions', 'center_isofix', 'top_tether_points',
    'rear_bench_width_usable_mm',
    'rear_headroom_mm', 'rear_legroom_max_mm',
    'infant_seat_fit', 'toddler_seat_fit', 'booster_seat_fit',
    'three_across_possible', 'three_across_fit_score',
  ];

  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withFit = modelGens.filter((g: any) => fitGens.has(g.id));
    const withoutFit = modelGens.filter((g: any) => !fitGens.has(g.id));
    if (withFit.length === 0 || withoutFit.length === 0) continue;

    for (const uGen of withoutFit) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withFit) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!uStart || !rStart) {
          if (!bestSource) bestSource = rGen;
          continue;
        }
        const dist = Math.abs(uStart - rStart);
        if (dist <= 12 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const sourceFit = fitByGen.get(bestSource.id);
      if (!sourceFit) continue;

      const row: any = { generation_id: uGen.id, source: 'propagated_v2' };
      let fields = 0;
      for (const col of FIT_COLS) {
        if (sourceFit[col] !== null && sourceFit[col] !== undefined) {
          row[col] = sourceFit[col];
          fields++;
        }
      }
      if (fields > 0) {
        fitsToUpsert.push(row);
        fitGens.add(uGen.id);
        stats.p4FitPropagated++;
      }
    }
  }
  console.log(`  Phase 4: ${stats.p4FitPropagated} propagated`);

  // Upsert fits
  if (!DRY_RUN && fitsToUpsert.length > 0) {
    const mergedFits = new Map<string, any>();
    for (const row of fitsToUpsert) {
      if (mergedFits.has(row.generation_id)) {
        const existing = mergedFits.get(row.generation_id)!;
        for (const [k, v] of Object.entries(row)) {
          if (k === 'generation_id') continue;
          if (v !== null && v !== undefined && (existing[k] === null || existing[k] === undefined)) existing[k] = v;
        }
      } else {
        mergedFits.set(row.generation_id, { ...row });
      }
    }
    const finalFits = Array.from(mergedFits.values());
    console.log(`\n  Upserting ${finalFits.length} fit rows...`);
    let upserted = 0;
    for (let i = 0; i < finalFits.length; i += BATCH_SIZE) {
      const batch = finalFits.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('family_fit_compatibility').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  DIMS + FAMILY FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`  Dims estimated:      ${stats.p1Estimated}`);
  console.log(`  Dims propagated:     ${stats.p2Propagated}`);
  console.log(`  Dims coverage:       ${dimsByGen.size} / ${gens.length} (${(dimsByGen.size / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Fit created:         ${stats.p3FitCreated}`);
  console.log(`  Fit propagated:      ${stats.p4FitPropagated}`);
  console.log(`  Fit coverage:        ${fitGens.size} / ${gens.length} (${(fitGens.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'dims-family-final-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, dims: dimsByGen.size, fits: fitGens.size, total: gens.length }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
