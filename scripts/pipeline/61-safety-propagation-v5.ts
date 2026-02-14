/**
 * 61-safety-propagation-v5.ts — Enhanced safety propagation (B tier)
 *
 * Additive rules on top of v4. Only propagates FROM existing A ratings → new B.
 * Never overwrites A or B with lower confidence.
 *
 * New rules:
 *   B1: Facelift inheritance — gens with "facelift"/"phase ii"/"lci" in slug/name
 *   B2: Body variant inheritance — "308 SW" inherits from "308" (cross-model within brand)
 *   B3: Extended year tolerance — ±7 years for same model_id (v4 uses ±5)
 *   B4: Null production_start recovery — extract year from slug, then apply B3
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/61-safety-propagation-v5.ts
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

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract year from production_start date string or from slug */
function extractYear(gen: any): number | null {
  // From production_start (e.g. "2017-01-01")
  if (gen.production_start) {
    const y = parseInt(gen.production_start.substring(0, 4));
    if (y >= 1950 && y <= 2030) return y;
  }
  // Fallback: extract from slug (e.g. "peugeot-308-ii-phase-i-2015")
  if (gen.slug) {
    const match = gen.slug.match(/(\d{4})$/);
    if (match) {
      const y = parseInt(match[1]);
      if (y >= 1950 && y <= 2030) return y;
    }
  }
  return null;
}

/** Check if a gen name/slug indicates a facelift */
function isFacelift(gen: any): boolean {
  const text = `${gen.name || ''} ${gen.slug || ''}`.toLowerCase();
  return /facelift|restyl|phase.?(?:2|ii)|lci|fl\b|mid.?life/.test(text);
}

/** Body variant suffixes that share the same crash test platform */
const BODY_SUFFIXES = [
  'sw', 'variant', 'touring', 'alltrack', 'break', 'wagon', 'estate', 'avant',
  'sportback', 'gran coupe', 'gran turismo', 'shooting brake', 'cabriolet',
  'convertible', 'roadster', 'coupe', 'sedan', 'berline', 'limousine',
  'cross country', 'scout', 'allroad',
  'gti', 'gtd', 'gte', 'gts', 'r line', 'rs', 'amg', 'fr', 'st',
  '3 door', '5 door', '3 portes', '5 portes',
  'long', 'short', 'lwb', 'swb', 'maxi',
  'cc', 'cabrio',
];

/** Extract the base model name by stripping body variant suffixes */
function baseModelName(modelName: string): string {
  let base = normalize(modelName);
  for (const suffix of BODY_SUFFIXES) {
    base = base.replace(new RegExp(`\\s+${suffix}$`), '').trim();
  }
  return base;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  61-SAFETY-PROPAGATION-V5 — Enhanced B propagation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, body_style, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const existingRatings = await paginateAll(
    'safety_ratings',
    'id, generation_id, stars, confidence, test_year, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, source_url'
  );
  const ratingMap = new Map<string, any>();
  for (const r of existingRatings) ratingMap.set(r.generation_id, r);
  console.log(`  Existing ratings: ${existingRatings.length}`);

  // Pre-compute years
  const yearMap = new Map<string, number | null>();
  for (const gen of gens) yearMap.set(gen.id, extractYear(gen));

  // Index by model_id and brand
  const gensByModelId = new Map<string, any[]>();
  const gensByBrand = new Map<string, any[]>();
  for (const gen of gens) {
    const modelId = gen.model?.id;
    const brandName = gen.model?.brand?.name;
    if (modelId) {
      if (!gensByModelId.has(modelId)) gensByModelId.set(modelId, []);
      gensByModelId.get(modelId)!.push(gen);
    }
    if (brandName) {
      if (!gensByBrand.has(brandName)) gensByBrand.set(brandName, []);
      gensByBrand.get(brandName)!.push(gen);
    }
  }

  // Collect A-rated sources
  const aRatings: any[] = [];
  for (const r of existingRatings) {
    if (r.confidence === 'A') aRatings.push(r);
  }
  console.log(`  A-rated sources: ${aRatings.length}`);

  // Build A source map: generation_id → full rating + gen info
  const aSourceMap = new Map<string, { rating: any; gen: any }>();
  for (const r of aRatings) {
    const gen = gens.find((g: any) => g.id === r.generation_id);
    if (gen) aSourceMap.set(r.generation_id, { rating: r, gen });
  }

  // --- Propagation tracking ---
  const toUpsert: any[] = [];
  const reasons: any[] = [];
  const alreadyCounted = new Set<string>();

  function addPropagation(targetGen: any, sourceRating: any, rule: string) {
    if (alreadyCounted.has(targetGen.id)) return;

    // Check existing rating — never overwrite A or B
    const existing = ratingMap.get(targetGen.id);
    if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) return;

    alreadyCounted.add(targetGen.id);

    const entry = {
      generation_id: targetGen.id,
      stars: sourceRating.stars,
      adult_occupant_pct: sourceRating.adult_occupant_pct,
      child_occupant_pct: sourceRating.child_occupant_pct,
      pedestrian_pct: sourceRating.pedestrian_pct,
      safety_assist_pct: sourceRating.safety_assist_pct,
      test_year: sourceRating.test_year,
      confidence: 'B',
      source_url: `propagated_v5_${rule}_from:${sourceRating.generation_id}`,
    };
    toUpsert.push(entry);
    reasons.push({
      target: `${targetGen.model?.brand?.name} ${targetGen.model?.name} — ${targetGen.name}`,
      source: `${sourceRating.generation_id}`,
      rule,
    });
  }

  // ========================================
  // Rule B3: Extended year tolerance (±7 years, same model_id)
  // This is the biggest lever — catches what v4's ±5 missed
  // ========================================
  console.log('\n  Rule B3: Extended year tolerance (±7y, same model_id)...');
  let b3Count = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    // Find A-rated gens in this model
    const aSources = modelGens.filter((g: any) => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (aSources.length === 0) continue;

    for (const gen of modelGens) {
      const existing = ratingMap.get(gen.id);
      if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

      const genYear = yearMap.get(gen.id);
      if (!genYear) continue;

      // Find closest A source within ±7 years
      let bestSource: any = null;
      let bestDist = Infinity;
      for (const src of aSources) {
        const srcRating = ratingMap.get(src.id);
        const srcYear = srcRating?.test_year || yearMap.get(src.id);
        if (!srcYear) continue;

        const dist = Math.abs(genYear - srcYear);
        if (dist <= 7 && dist < bestDist) {
          bestDist = dist;
          bestSource = srcRating;
        }
      }

      if (bestSource) {
        addPropagation(gen, bestSource, 'B3_extended_year');
        b3Count++;
      }
    }
  }
  console.log(`    B3 hits: ${b3Count}`);

  // ========================================
  // Rule B1: Facelift inheritance
  // If gen has "facelift"/"phase ii"/"lci" in name/slug AND model has an A/B source
  // ========================================
  console.log('\n  Rule B1: Facelift inheritance...');
  let b1Count = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    const aSources = modelGens.filter((g: any) => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (aSources.length === 0) continue;

    for (const gen of modelGens) {
      if (alreadyCounted.has(gen.id)) continue;
      const existing = ratingMap.get(gen.id);
      if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

      if (!isFacelift(gen)) continue;

      const genYear = yearMap.get(gen.id);

      // Find closest A source (facelift is always close to base)
      let bestSource: any = null;
      let bestDist = Infinity;
      for (const src of aSources) {
        const srcRating = ratingMap.get(src.id);
        const srcYear = srcRating?.test_year || yearMap.get(src.id);

        // If we have years, use ±10 tolerance for facelifts (very lenient)
        if (genYear && srcYear) {
          const dist = Math.abs(genYear - srcYear);
          if (dist <= 10 && dist < bestDist) {
            bestDist = dist;
            bestSource = srcRating;
          }
        } else {
          // No year info — still propagate if same model (facelift = same platform)
          if (!bestSource) bestSource = srcRating;
        }
      }

      if (bestSource) {
        addPropagation(gen, bestSource, 'B1_facelift');
        b1Count++;
      }
    }
  }
  console.log(`    B1 hits: ${b1Count}`);

  // ========================================
  // Rule B2: Body variant inheritance (cross-model within brand)
  // "308 SW" inherits from "308", "Golf GTI" from "Golf", etc.
  // ========================================
  console.log('\n  Rule B2: Body variant inheritance...');
  let b2Count = 0;

  // Build index: brand → base_model_name → A-rated gens
  const brandBaseModelSources = new Map<string, Map<string, { rating: any; year: number | null }[]>>();

  for (const [brandName, brandGens] of gensByBrand) {
    const baseMap = new Map<string, { rating: any; year: number | null }[]>();
    for (const gen of brandGens) {
      const r = ratingMap.get(gen.id);
      if (!r || r.confidence !== 'A') continue;
      const base = baseModelName(gen.model?.name || '');
      if (!base) continue;
      if (!baseMap.has(base)) baseMap.set(base, []);
      baseMap.get(base)!.push({ rating: r, year: yearMap.get(gen.id) ?? null });
    }
    brandBaseModelSources.set(brandName, baseMap);
  }

  for (const [brandName, brandGens] of gensByBrand) {
    const baseMap = brandBaseModelSources.get(brandName);
    if (!baseMap) continue;

    for (const gen of brandGens) {
      if (alreadyCounted.has(gen.id)) continue;
      const existing = ratingMap.get(gen.id);
      if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

      const genBase = baseModelName(gen.model?.name || '');
      const genModelNorm = normalize(gen.model?.name || '');
      if (!genBase || genBase === genModelNorm) {
        // Model name doesn't have a suffix — try if this IS the base and a variant has A
        // (e.g., "308" might not have A but "308" gens covered by B3 already)
        continue;
      }

      // Look up the base model's A ratings
      const sources = baseMap.get(genBase);
      if (!sources || sources.length === 0) continue;

      const genYear = yearMap.get(gen.id);

      // Find closest source within ±7 years
      let bestSource: any = null;
      let bestDist = Infinity;
      for (const src of sources) {
        if (genYear && src.year) {
          const dist = Math.abs(genYear - (src.rating.test_year || src.year));
          if (dist <= 7 && dist < bestDist) {
            bestDist = dist;
            bestSource = src.rating;
          }
        } else if (!bestSource) {
          bestSource = src.rating;
        }
      }

      if (bestSource) {
        addPropagation(gen, bestSource, 'B2_body_variant');
        b2Count++;
      }
    }
  }
  console.log(`    B2 hits: ${b2Count}`);

  // ========================================
  // Rule B4: Same model_id, no year info — just propagate if same model
  // For gens with null production_start AND no year in slug
  // ========================================
  console.log('\n  Rule B4: Same-model null-year recovery...');
  let b4Count = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    const aSources = modelGens.filter((g: any) => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (aSources.length === 0) continue;

    for (const gen of modelGens) {
      if (alreadyCounted.has(gen.id)) continue;
      const existing = ratingMap.get(gen.id);
      if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

      const genYear = yearMap.get(gen.id);
      if (genYear) continue; // Already handled by B3

      // No year info at all — propagate from the most recent A source
      const bestSource = aSources
        .map((s: any) => ratingMap.get(s.id))
        .filter(Boolean)
        .sort((a: any, b: any) => (b.test_year || 0) - (a.test_year || 0))[0];

      if (bestSource) {
        addPropagation(gen, bestSource, 'B4_null_year_same_model');
        b4Count++;
      }
    }
  }
  console.log(`    B4 hits: ${b4Count}`);

  // ========================================
  // Rule B5: Same model_id, any year distance (most aggressive same-model rule)
  // If a model was crash-tested at ANY point, all its gens get B.
  // Rationale: same model family = similar platform & engineering lineage.
  // ========================================
  console.log('\n  Rule B5: Same model_id, unlimited year range...');
  let b5Count = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    const aSources = modelGens.filter((g: any) => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (aSources.length === 0) continue;

    // Pick the most recent A source
    const bestASource = aSources
      .map((s: any) => ratingMap.get(s.id))
      .filter(Boolean)
      .sort((a: any, b: any) => (b.test_year || 0) - (a.test_year || 0))[0];

    if (!bestASource) continue;

    for (const gen of modelGens) {
      if (alreadyCounted.has(gen.id)) continue;
      const existing = ratingMap.get(gen.id);
      if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

      addPropagation(gen, bestASource, 'B5_same_model_any_year');
      b5Count++;
    }
  }
  console.log(`    B5 hits: ${b5Count}`);

  // ========================================
  // Rule B6: Cross-brand platform sharing (known shared platforms)
  // VW Group: Golf/A3/Leon/Octavia share MQB. Polo/Ibiza/Fabia share MQB-A0.
  // ========================================
  console.log('\n  Rule B6: Cross-brand platform sharing...');
  let b6Count = 0;

  // Platform families: [[brand, model_name], ...] that share the same platform
  const PLATFORM_FAMILIES: string[][][] = [
    // MQB platform (VW Group compact)
    [['Volkswagen', 'Golf'], ['Audi', 'A3'], ['SEAT', 'Leon'], ['Skoda', 'Octavia']],
    // MQB-A0 (VW Group sub-compact)
    [['Volkswagen', 'Polo'], ['SEAT', 'Ibiza'], ['Skoda', 'Fabia'], ['Audi', 'A1']],
    // MLB (VW Group mid-size)
    [['Audi', 'A4'], ['Audi', 'A5']],
    // MEB (VW Group electric)
    [['Volkswagen', 'ID.3'], ['Volkswagen', 'ID.4'], ['Skoda', 'Enyaq']],
    // EMP2 (PSA Group)
    [['Peugeot', '308'], ['Citroën', 'C4'], ['Opel', 'Astra']],
    [['Peugeot', '3008'], ['Citroën', 'C5 Aircross'], ['Opel', 'Grandland']],
    [['Peugeot', '208'], ['Citroën', 'C3'], ['Opel', 'Corsa']],
    // CMF-C/D (Renault-Nissan)
    [['Renault', 'Megane'], ['Nissan', 'Qashqai']],
    [['Renault', 'Captur'], ['Nissan', 'Juke']],
    // TNGA (Toyota)
    [['Toyota', 'Corolla'], ['Toyota', 'C-HR']],
    [['Toyota', 'RAV4'], ['Toyota', 'Highlander']],
    // Hyundai-Kia shared platforms
    [['Hyundai', 'Tucson'], ['Kia', 'Sportage']],
    [['Hyundai', 'i30'], ['Kia', 'Ceed']],
    [['Hyundai', 'i20'], ['Kia', 'Rio']],
    [['Hyundai', 'Kona'], ['Kia', 'Niro']],
    [['Hyundai', 'Ioniq 5'], ['Kia', 'EV6']],
    // BMW shared
    [['BMW', 'X1'], ['BMW', 'X2']],
    [['BMW', 'X3'], ['BMW', 'X4']],
    [['BMW', 'X5'], ['BMW', 'X6']],
  ];

  // Build model lookup: "brand|model_norm" → gens
  const modelLookup = new Map<string, any[]>();
  for (const gen of gens) {
    const key = `${gen.model?.brand?.name}|${normalize(gen.model?.name || '')}`;
    if (!modelLookup.has(key)) modelLookup.set(key, []);
    modelLookup.get(key)!.push(gen);
  }

  for (const family of PLATFORM_FAMILIES) {
    // Find A-rated sources across the family
    const familySources: { rating: any; year: number | null }[] = [];
    for (const [brand, model] of family) {
      const key = `${brand}|${normalize(model)}`;
      const familyGens = modelLookup.get(key) || [];
      for (const gen of familyGens) {
        const r = ratingMap.get(gen.id);
        if (r && r.confidence === 'A') {
          familySources.push({ rating: r, year: yearMap.get(gen.id) ?? null });
        }
      }
    }
    if (familySources.length === 0) continue;

    // Propagate to unrated gens in the family
    for (const [brand, model] of family) {
      const key = `${brand}|${normalize(model)}`;
      const familyGens = modelLookup.get(key) || [];
      for (const gen of familyGens) {
        if (alreadyCounted.has(gen.id)) continue;
        const existing = ratingMap.get(gen.id);
        if (existing && (existing.confidence === 'A' || existing.confidence === 'B')) continue;

        const genYear = yearMap.get(gen.id);

        // Find closest A source within ±7 years
        let bestSource: any = null;
        let bestDist = Infinity;
        for (const src of familySources) {
          if (genYear && src.year) {
            const dist = Math.abs(genYear - (src.rating.test_year || src.year));
            if (dist <= 7 && dist < bestDist) {
              bestDist = dist;
              bestSource = src.rating;
            }
          } else if (!bestSource) {
            bestSource = src.rating;
          }
        }

        if (bestSource) {
          addPropagation(gen, bestSource, 'B6_platform_sharing');
          b6Count++;
        }
      }
    }
  }
  console.log(`    B6 hits: ${b6Count}`);

  // ========================================
  // Summary & Upsert
  // ========================================
  const totalNew = toUpsert.length;
  console.log(`\n  TOTAL new B ratings to insert: ${totalNew}`);
  console.log(`    B3 (extended year ±7): ${b3Count}`);
  console.log(`    B1 (facelift): ${b1Count}`);
  console.log(`    B2 (body variant): ${b2Count}`);
  console.log(`    B4 (null year): ${b4Count}`);
  console.log(`    B5 (same model, any year): ${b5Count}`);
  console.log(`    B6 (platform sharing): ${b6Count}`);

  const currentAB = existingRatings.filter((r: any) => r.confidence === 'A' || r.confidence === 'B').length;
  const newAB = currentAB + totalNew;
  console.log(`\n  Current A+B: ${currentAB} / ${gens.length} = ${(currentAB / gens.length * 100).toFixed(1)}%`);
  console.log(`  After v5:    ${newAB} / ${gens.length} = ${(newAB / gens.length * 100).toFixed(1)}%`);

  // Sample propagations
  console.log('\n  Sample propagations (first 20):');
  for (const r of reasons.slice(0, 20)) {
    console.log(`    [${r.rule}] ${r.target}`);
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no DB writes');
  } else {
    console.log('\n  Writing to DB...');
    let written = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, {
        onConflict: 'generation_id',
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        written += batch.length;
      }
    }
    console.log(`  Written: ${written} / ${totalNew}`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    rules: {
      B3_extended_year: b3Count,
      B1_facelift: b1Count,
      B2_body_variant: b2Count,
      B4_null_year: b4Count,
      B5_same_model_any_year: b5Count,
      B6_platform_sharing: b6Count,
    },
    total_new_B: totalNew,
    before: { AB: currentAB, total: gens.length, pct: Math.round(currentAB / gens.length * 1000) / 10 },
    after: { AB: newAB, total: gens.length, pct: Math.round(newAB / gens.length * 1000) / 10 },
    sample_propagations: reasons.slice(0, 50),
  };

  const outPath = path.join(DATA_DIR, 'safety-propagation-v5-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`  Report saved to ${outPath}`);
}

main().catch(console.error);
