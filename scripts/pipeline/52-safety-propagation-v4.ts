/**
 * 52-safety-propagation-v4.ts — Intelligent safety rating propagation
 *
 * Three-tier propagation strategy:
 *   1. Intra-model (→ confidence B): Same brand+model, ≤5 year gap
 *   2. Same platform (→ confidence C): Shared platforms (MQB, CLAR, EMP2, etc.)
 *   3. Segment + brand + decade (→ confidence D): Median from same segment/brand/era
 *
 * Rules:
 *   - Never overwrite higher confidence (A > B > C > D)
 *   - Never create confidence E
 *   - Log every propagation with reason
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/52-safety-propagation-v4.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/52-safety-propagation-v4.ts
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
const YEAR_TOLERANCE = 5;
const DATA_DIR = path.resolve(__dirname, '../../data');

// Known shared platforms — maps platform name to known models
const PLATFORM_MAP: Record<string, string[][]> = {
  // VW Group
  'MQB': [
    ['Volkswagen', 'Golf'], ['Volkswagen', 'Tiguan'], ['Volkswagen', 'Passat'],
    ['Volkswagen', 'T-Roc'], ['Volkswagen', 'T-Cross'], ['Volkswagen', 'Taigo'],
    ['Volkswagen', 'Arteon'], ['Volkswagen', 'Touran'], ['Volkswagen', 'Caddy'],
    ['Audi', 'A3'], ['Audi', 'Q2'], ['Audi', 'Q3'], ['Audi', 'TT'],
    ['Skoda', 'Octavia'], ['Skoda', 'Karoq'], ['Skoda', 'Kodiaq'], ['Skoda', 'Superb'],
    ['Skoda', 'Scala'], ['Skoda', 'Kamiq'],
    ['SEAT', 'Leon'], ['SEAT', 'Ateca'], ['SEAT', 'Tarraco'], ['SEAT', 'Arona'], ['SEAT', 'Ibiza'],
    ['Cupra', 'Born'], ['Cupra', 'Formentor'], ['Cupra', 'Leon'],
  ],
  'MEB': [
    ['Volkswagen', 'ID.3'], ['Volkswagen', 'ID.4'], ['Volkswagen', 'ID.5'],
    ['Volkswagen', 'ID.7'], ['Skoda', 'Enyaq'], ['Cupra', 'Born'], ['Audi', 'Q4 e-tron'],
  ],
  'MLB': [
    ['Audi', 'A4'], ['Audi', 'A5'], ['Audi', 'A6'], ['Audi', 'A7'],
    ['Audi', 'Q5'], ['Audi', 'Q7'], ['Audi', 'Q8'],
    ['Porsche', 'Cayenne'], ['Porsche', 'Macan'],
    ['Bentley', 'Bentayga'], ['Lamborghini', 'Urus'],
  ],
  // BMW Group
  'CLAR': [
    ['BMW', 'Série 3'], ['BMW', 'Série 4'], ['BMW', 'Série 5'], ['BMW', 'Série 7'],
    ['BMW', 'X3'], ['BMW', 'X4'], ['BMW', 'X5'], ['BMW', 'X6'], ['BMW', 'X7'],
    ['BMW', 'Z4'],
  ],
  'FAAR': [
    ['BMW', 'Série 1'], ['BMW', 'Série 2'], ['BMW', 'X1'], ['BMW', 'X2'],
    ['MINI', 'Mini'], ['MINI', 'Countryman'], ['MINI', 'Clubman'],
  ],
  // Stellantis
  'CMP': [
    ['Peugeot', '208'], ['Peugeot', '2008'],
    ['Citroën', 'C3'], ['Citroën', 'C3 Aircross'],
    ['Opel', 'Corsa'], ['Opel', 'Mokka'],
    ['DS', 'DS 3'],
  ],
  'EMP2': [
    ['Peugeot', '308'], ['Peugeot', '3008'], ['Peugeot', '5008'], ['Peugeot', '508'],
    ['Citroën', 'C4'], ['Citroën', 'C5 Aircross'], ['Citroën', 'C5 X'],
    ['Opel', 'Astra'], ['Opel', 'Grandland'],
    ['DS', 'DS 4'], ['DS', 'DS 7'], ['DS', 'DS 9'],
  ],
  'STLA Medium': [
    ['Peugeot', '3008'], ['Peugeot', '5008'], ['Opel', 'Grandland'],
  ],
  // Renault
  'CMF-B': [
    ['Renault', 'Clio'], ['Renault', 'Captur'],
    ['Nissan', 'Juke'], ['Nissan', 'Micra'],
    ['Dacia', 'Sandero'], ['Dacia', 'Jogger'],
  ],
  'CMF-C/D': [
    ['Renault', 'Megane'], ['Renault', 'Kadjar'], ['Renault', 'Austral'],
    ['Nissan', 'Qashqai'], ['Nissan', 'X-Trail'],
  ],
  // Toyota
  'TNGA-C': [
    ['Toyota', 'Corolla'], ['Toyota', 'C-HR'],
    ['Lexus', 'UX'],
  ],
  'TNGA-K': [
    ['Toyota', 'Camry'], ['Toyota', 'RAV4'], ['Toyota', 'Highlander'],
    ['Lexus', 'ES'], ['Lexus', 'NX'], ['Lexus', 'RX'],
  ],
  // Hyundai-Kia
  'E-GMP': [
    ['Hyundai', 'Ioniq 5'], ['Hyundai', 'Ioniq 6'],
    ['Kia', 'EV6'], ['Genesis', 'GV60'],
  ],
  // Mercedes
  'MRA2': [
    ['Mercedes-Benz', 'Classe C'], ['Mercedes-Benz', 'Classe E'],
    ['Mercedes-Benz', 'Classe S'], ['Mercedes-Benz', 'GLC'],
    ['Mercedes-Benz', 'GLE'],
  ],
  'MFA2': [
    ['Mercedes-Benz', 'Classe A'], ['Mercedes-Benz', 'Classe B'],
    ['Mercedes-Benz', 'CLA'], ['Mercedes-Benz', 'GLA'], ['Mercedes-Benz', 'GLB'],
  ],
  // Volvo
  'SPA': [
    ['Volvo', 'XC60'], ['Volvo', 'XC90'], ['Volvo', 'S60'], ['Volvo', 'V60'],
    ['Volvo', 'S90'], ['Volvo', 'V90'],
  ],
  'CMA': [
    ['Volvo', 'XC40'], ['Volvo', 'C40'],
  ],
};

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

const CONFIDENCE_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function canOverwrite(existing: string | null, incoming: string): boolean {
  if (!existing) return true;
  return (CONFIDENCE_ORDER[incoming] || 5) < (CONFIDENCE_ORDER[existing] || 5);
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  52-SAFETY-PROPAGATION-V4 — Intelligent propagation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, internal_code, body_style, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const existingRatings = await paginateAll('safety_ratings', 'id, generation_id, stars, confidence, source_url');
  const ratingMap = new Map<string, any>();
  for (const r of existingRatings) {
    ratingMap.set(r.generation_id, r);
  }
  console.log(`  Existing ratings: ${existingRatings.length}`);

  // Build lookup maps
  const genById = new Map<string, any>();
  const gensByBrandModel = new Map<string, any[]>();
  const gensByBodyStyleBrand = new Map<string, any[]>();

  for (const gen of gens) {
    genById.set(gen.id, gen);
    const brand = gen.model?.brand?.name;
    const model = gen.model?.name;
    if (!brand || !model) continue;

    const bmKey = `${normalize(brand)}|${normalize(model)}`;
    if (!gensByBrandModel.has(bmKey)) gensByBrandModel.set(bmKey, []);
    gensByBrandModel.get(bmKey)!.push(gen);

    const bsKey = `${normalize(brand)}|${gen.body_style || 'unknown'}`;
    if (!gensByBodyStyleBrand.has(bsKey)) gensByBodyStyleBrand.set(bsKey, []);
    gensByBodyStyleBrand.get(bsKey)!.push(gen);
  }

  // Build platform → generation IDs map
  const platformGens = new Map<string, Set<string>>();
  for (const [platform, models] of Object.entries(PLATFORM_MAP)) {
    const genIds = new Set<string>();
    for (const [brand, model] of models) {
      const key = `${normalize(brand)}|${normalize(model)}`;
      const matchedGens = gensByBrandModel.get(key) || [];
      for (const g of matchedGens) genIds.add(g.id);
    }
    if (genIds.size > 0) platformGens.set(platform, genIds);
  }

  const toUpsert: any[] = [];
  const logs: string[] = [];
  let phase1Count = 0, phase2Count = 0, phase3Count = 0;

  // ═══════════ PHASE 1: Intra-model (→ B) ═══════════
  console.log('\n  Phase 1: Intra-model propagation (→ confidence B)...');

  for (const [bmKey, modelGens] of gensByBrandModel) {
    // Find gens with A-rated ratings
    const rated = modelGens.filter(g => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });

    if (rated.length === 0) continue;

    // Find unrated gens within year tolerance
    const unrated = modelGens.filter(g => {
      const existing = ratingMap.get(g.id);
      return !existing || canOverwrite(existing.confidence, 'B');
    });

    for (const target of unrated) {
      const targetStart = target.production_start ? new Date(target.production_start).getFullYear() : null;
      if (!targetStart) continue;

      // Find closest rated gen within tolerance
      let bestSource: any = null;
      let bestDist = Infinity;

      for (const source of rated) {
        const sourceStart = source.production_start ? new Date(source.production_start).getFullYear() : null;
        if (!sourceStart) continue;
        const dist = Math.abs(targetStart - sourceStart);
        if (dist <= YEAR_TOLERANCE && dist < bestDist) {
          bestDist = dist;
          bestSource = source;
        }
      }

      if (bestSource) {
        const sourceRating = ratingMap.get(bestSource.id);
        toUpsert.push({
          generation_id: target.id,
          stars: sourceRating.stars,
          adult_occupant_pct: null,
          child_occupant_pct: null,
          pedestrian_pct: null,
          safety_assist_pct: null,
          test_year: null,
          source_url: `propagated_intra_model:${bestSource.id}`,
          confidence: 'B',
        });
        ratingMap.set(target.id, { ...sourceRating, generation_id: target.id, confidence: 'B' });
        phase1Count++;
        logs.push(`[B] ${bmKey} → ${target.internal_code || target.name} (from ${bestSource.internal_code || bestSource.name}, ${bestDist}yr gap)`);
      }
    }
  }

  console.log(`  Phase 1: ${phase1Count} propagations`);

  // ═══════════ PHASE 2: Same platform (→ C) ═══════════
  console.log('\n  Phase 2: Platform propagation (→ confidence C)...');

  for (const [platform, genIds] of platformGens) {
    // Find best rating on this platform
    let bestRating: any = null;
    let bestConfidence = 'Z';

    for (const genId of genIds) {
      const r = ratingMap.get(genId);
      if (r && r.stars && (CONFIDENCE_ORDER[r.confidence] || 5) < (CONFIDENCE_ORDER[bestConfidence] || 5)) {
        bestRating = r;
        bestConfidence = r.confidence;
      }
    }

    if (!bestRating || bestConfidence === 'D' || bestConfidence === 'E') continue;

    // Propagate to unrated gens on same platform
    for (const genId of genIds) {
      const existing = ratingMap.get(genId);
      if (existing && !canOverwrite(existing.confidence, 'C')) continue;

      // Only propagate to gens from similar era (post-2015 for modern platforms)
      const gen = genById.get(genId);
      if (!gen) continue;
      const genYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 0;
      if (genYear < 2010) continue; // Platform sharing is mostly modern

      toUpsert.push({
        generation_id: genId,
        stars: bestRating.stars,
        source_url: `propagated_platform:${platform}:${bestRating.generation_id}`,
        confidence: 'C',
      });
      ratingMap.set(genId, { ...bestRating, generation_id: genId, confidence: 'C' });
      phase2Count++;
      logs.push(`[C] Platform ${platform} → ${gen.model?.brand?.name} ${gen.model?.name} ${gen.internal_code || gen.name}`);
    }
  }

  console.log(`  Phase 2: ${phase2Count} propagations`);

  // ═══════════ PHASE 3: Segment + brand + decade (→ D) ═══════════
  console.log('\n  Phase 3: Segment inference (→ confidence D)...');

  // Calculate median stars per brand + body_style + decade
  const segmentMedians = new Map<string, number>();

  for (const [bsKey, segGens] of gensByBodyStyleBrand) {
    // Group by decade
    const byDecade = new Map<number, number[]>();
    for (const gen of segGens) {
      const rating = ratingMap.get(gen.id);
      if (!rating || !rating.stars || rating.confidence === 'D' || rating.confidence === 'E') continue;
      const year = gen.production_start ? new Date(gen.production_start).getFullYear() : 0;
      if (year === 0) continue;
      const decade = Math.floor(year / 10) * 10;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      byDecade.get(decade)!.push(rating.stars);
    }

    for (const [decade, stars] of byDecade) {
      stars.sort();
      const median = stars[Math.floor(stars.length / 2)];
      segmentMedians.set(`${bsKey}|${decade}`, median);
    }
  }

  // Apply to unrated gens
  for (const gen of gens) {
    const existing = ratingMap.get(gen.id);
    if (existing && !canOverwrite(existing.confidence, 'D')) continue;

    const brand = gen.model?.brand?.name;
    if (!brand) continue;
    const bsKey = `${normalize(brand)}|${gen.body_style || 'unknown'}`;
    const year = gen.production_start ? new Date(gen.production_start).getFullYear() : 0;
    if (year === 0) continue;
    const decade = Math.floor(year / 10) * 10;

    const median = segmentMedians.get(`${bsKey}|${decade}`);
    if (!median) continue;

    toUpsert.push({
      generation_id: gen.id,
      stars: median,
      source_url: `inferred_segment:${gen.body_style}:${brand}:${decade}s`,
      confidence: 'D',
    });
    ratingMap.set(gen.id, { generation_id: gen.id, stars: median, confidence: 'D' });
    phase3Count++;
    logs.push(`[D] ${brand} ${gen.model?.name} ${gen.internal_code || gen.name} → ${median}★ (segment median ${decade}s)`);
  }

  console.log(`  Phase 3: ${phase3Count} inferences`);

  // ═══════════ UPSERT ═══════════
  console.log(`\n  Total propagations: ${toUpsert.length} (B:${phase1Count} C:${phase2Count} D:${phase3Count})`);

  // Deduplicate: keep highest confidence per gen
  const deduped = new Map<string, any>();
  for (const item of toUpsert) {
    const existing = deduped.get(item.generation_id);
    if (!existing || (CONFIDENCE_ORDER[item.confidence] || 5) < (CONFIDENCE_ORDER[existing.confidence] || 5)) {
      deduped.set(item.generation_id, item);
    }
  }

  const finalUpsert = Array.from(deduped.values());
  console.log(`  After dedup: ${finalUpsert.length}`);

  let upserted = 0;
  if (!DRY_RUN && finalUpsert.length > 0) {
    for (let i = 0; i < finalUpsert.length; i += BATCH_SIZE) {
      const batch = finalUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, { onConflict: 'generation_id' });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    phase1_intra_model: phase1Count,
    phase2_platform: phase2Count,
    phase3_segment: phase3Count,
    total_propagated: finalUpsert.length,
    upserted,
    sample_logs: logs.slice(0, 50),
  };

  fs.writeFileSync(path.join(DATA_DIR, 'safety-propagation-v4-report.json'), JSON.stringify(report, null, 2));
  console.log('\n  Report saved to data/safety-propagation-v4-report.json');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : `DONE — ${upserted} ratings upserted`}`);
}

main().catch(console.error);
