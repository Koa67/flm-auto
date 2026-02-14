/**
 * 60-safety-diagnostic.ts — Safety coverage diagnostic (read-only)
 *
 * Analyzes DB to find propagation opportunities:
 *   - Models with A ratings but missing B on sibling gens
 *   - Facelift inheritance opportunities
 *   - Body variant inheritance opportunities
 *   - Brand-level coverage gaps
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/60-safety-diagnostic.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

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

// Body variant suffixes that share the same crash test platform
const BODY_VARIANT_SUFFIXES = [
  'sw', 'variant', 'touring', 'alltrack', 'break', 'wagon', 'estate', 'avant',
  'sportback', 'gran coupe', 'gran turismo', 'shooting brake', 'cabriolet',
  'convertible', 'roadster', 'coupe', 'coupé', 'sedan', 'berline', 'limousine',
  'long wheelbase', 'lwb', 'short wheelbase', 'swb',
  '3 door', '5 door', '3 portes', '5 portes', '3 doors', '5 doors',
  'gti', 'gtd', 'gte', 'gts', 'r line', 'rs', 'amg', 'm sport', 'fr',
  'cross country', 'scout', 'allroad',
];

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  60-SAFETY-DIAGNOSTIC — Coverage analysis');
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, body_style, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const ratings = await paginateAll('safety_ratings', 'id, generation_id, stars, confidence, test_year');
  console.log(`  Safety ratings: ${ratings.length}`);

  // Build rating map
  const ratingMap = new Map<string, any>();
  for (const r of ratings) ratingMap.set(r.generation_id, r);

  // Confidence breakdown
  const confBreakdown: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null: 0 };
  for (const r of ratings) {
    const tier = r.confidence || 'null';
    confBreakdown[tier] = (confBreakdown[tier] || 0) + 1;
  }

  const withSafetyAny = ratings.length;
  const withSafetyAB = confBreakdown.A + confBreakdown.B;
  const withoutSafety = gens.length - withSafetyAny;

  console.log(`\n  Total gens: ${gens.length}`);
  console.log(`  With safety (any): ${withSafetyAny} (${(withSafetyAny / gens.length * 100).toFixed(1)}%)`);
  console.log(`  With safety (A+B): ${withSafetyAB} (${(withSafetyAB / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Without safety: ${withoutSafety}`);
  console.log(`  Confidence: A=${confBreakdown.A} B=${confBreakdown.B} C=${confBreakdown.C} D=${confBreakdown.D} E=${confBreakdown.E} null=${confBreakdown.null}`);

  // --- Analysis 1: Models with A but missing B on siblings ---
  console.log('\n  Analyzing models with A but missing B...');

  // Group gens by model_id
  const gensByModelId = new Map<string, any[]>();
  for (const gen of gens) {
    const modelId = gen.model?.id;
    if (!modelId) continue;
    if (!gensByModelId.has(modelId)) gensByModelId.set(modelId, []);
    gensByModelId.get(modelId)!.push(gen);
  }

  const modelsWithAButMissingB: any[] = [];
  let totalPotentialBGains = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    const gensWithA = modelGens.filter(g => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (gensWithA.length === 0) continue;

    const gensWithoutAB = modelGens.filter(g => {
      const r = ratingMap.get(g.id);
      return !r || (r.confidence !== 'A' && r.confidence !== 'B');
    });
    if (gensWithoutAB.length === 0) continue;

    const brand = modelGens[0].model?.brand?.name || 'Unknown';
    const model = modelGens[0].model?.name || 'Unknown';

    modelsWithAButMissingB.push({
      brand,
      model,
      model_id: modelId,
      gens_with_A: gensWithA.map(g => `${g.name} (${g.production_start || '?'})`),
      gens_without_AB: gensWithoutAB.map(g => `${g.name} (${g.production_start || '?'})`),
      potential_B_gains: gensWithoutAB.length,
    });
    totalPotentialBGains += gensWithoutAB.length;
  }

  modelsWithAButMissingB.sort((a, b) => b.potential_B_gains - a.potential_B_gains);
  console.log(`  Models with A + missing siblings: ${modelsWithAButMissingB.length}`);
  console.log(`  Total potential B gains (intra-model): ${totalPotentialBGains}`);

  // --- Analysis 2: Facelift opportunities ---
  console.log('\n  Analyzing facelift inheritance...');
  let faceliftOpportunities = 0;
  const faceliftExamples: string[] = [];

  for (const [modelId, modelGens] of gensByModelId) {
    const gensWithAB = modelGens.filter(g => {
      const r = ratingMap.get(g.id);
      return r && (r.confidence === 'A' || r.confidence === 'B');
    });
    if (gensWithAB.length === 0) continue;

    for (const gen of modelGens) {
      const r = ratingMap.get(gen.id);
      if (r && (r.confidence === 'A' || r.confidence === 'B')) continue;

      const genName = normalize(gen.name || '');
      const genSlug = normalize(gen.slug || '');
      const isFacelift = genName.includes('facelift') || genSlug.includes('facelift') ||
                          genName.includes('restyl') || genSlug.includes('restyl') ||
                          genName.includes('phase 2') || genName.includes('phase ii') ||
                          genName.includes('lci') || genSlug.includes('lci');

      if (isFacelift) {
        // Check if a source gen with A/B exists within 5 years
        const genStart = gen.production_start || 0;
        const sourceExists = gensWithAB.some(src => {
          const srcRating = ratingMap.get(src.id);
          return srcRating && Math.abs((srcRating.test_year || 0) - genStart) <= 5;
        });

        if (sourceExists) {
          faceliftOpportunities++;
          if (faceliftExamples.length < 10) {
            const brand = gen.model?.brand?.name;
            const model = gen.model?.name;
            faceliftExamples.push(`${brand} ${model} — ${gen.name} (${gen.production_start})`);
          }
        }
      }
    }
  }
  console.log(`  Facelift inheritance opportunities: ${faceliftOpportunities}`);
  if (faceliftExamples.length > 0) console.log(`  Examples: ${faceliftExamples.slice(0, 3).join(', ')}`);

  // --- Analysis 3: Body variant opportunities ---
  console.log('\n  Analyzing body variant inheritance...');
  let bodyVariantOpportunities = 0;
  const bodyVariantExamples: string[] = [];

  // Group by brand
  const gensByBrand = new Map<string, any[]>();
  for (const gen of gens) {
    const brand = gen.model?.brand?.name;
    if (!brand) continue;
    if (!gensByBrand.has(brand)) gensByBrand.set(brand, []);
    gensByBrand.get(brand)!.push(gen);
  }

  for (const [brand, brandGens] of gensByBrand) {
    // For each gen without A/B, check if a "base model" has A/B
    for (const gen of brandGens) {
      const r = ratingMap.get(gen.id);
      if (r && (r.confidence === 'A' || r.confidence === 'B')) continue;

      const genModelName = normalize(gen.model?.name || '');
      const genStart = gen.production_start || 0;

      // Try to find a base model with A/B
      for (const other of brandGens) {
        if (other.id === gen.id) continue;
        const otherR = ratingMap.get(other.id);
        if (!otherR || otherR.confidence !== 'A') continue;

        const otherModelName = normalize(other.model?.name || '');
        if (otherModelName === genModelName) continue; // same model — handled by intra-model

        // Check if one is a variant of the other
        const isVariant = BODY_VARIANT_SUFFIXES.some(suffix => {
          const base1 = genModelName.replace(new RegExp(`\\s+${suffix}$`), '').trim();
          const base2 = otherModelName.replace(new RegExp(`\\s+${suffix}$`), '').trim();
          return (base1 === otherModelName || base2 === genModelName) && base1.length >= 2;
        });

        if (isVariant) {
          const yearDiff = Math.abs(genStart - (otherR.test_year || 0));
          if (yearDiff <= 5) {
            bodyVariantOpportunities++;
            if (bodyVariantExamples.length < 10) {
              bodyVariantExamples.push(`${brand} ${gen.model?.name} (${genStart}) ← ${other.model?.name}`);
            }
            break; // Count each target only once
          }
        }
      }
    }
  }
  console.log(`  Body variant opportunities: ${bodyVariantOpportunities}`);
  if (bodyVariantExamples.length > 0) console.log(`  Examples: ${bodyVariantExamples.slice(0, 3).join(', ')}`);

  // --- Analysis 4: Extended year tolerance (±7 instead of ±5) ---
  console.log('\n  Analyzing extended year tolerance...');
  let extendedYearOpportunities = 0;

  for (const [modelId, modelGens] of gensByModelId) {
    const gensWithA = modelGens.filter(g => {
      const r = ratingMap.get(g.id);
      return r && r.confidence === 'A';
    });
    if (gensWithA.length === 0) continue;

    for (const gen of modelGens) {
      const r = ratingMap.get(gen.id);
      if (r && (r.confidence === 'A' || r.confidence === 'B')) continue;

      const genStart = gen.production_start || 0;
      if (genStart === 0) continue;

      // Already covered by ±5?
      const coveredBy5 = gensWithA.some(src => {
        const srcR = ratingMap.get(src.id);
        return Math.abs(genStart - (srcR?.test_year || src.production_start || 0)) <= 5;
      });
      if (coveredBy5) continue;

      // Would be covered by ±7?
      const coveredBy7 = gensWithA.some(src => {
        const srcR = ratingMap.get(src.id);
        return Math.abs(genStart - (srcR?.test_year || src.production_start || 0)) <= 7;
      });
      if (coveredBy7) {
        extendedYearOpportunities++;
      }
    }
  }
  console.log(`  Extended year (6-7y) additional opportunities: ${extendedYearOpportunities}`);

  // --- Analysis 5: Brand coverage ---
  console.log('\n  Brand coverage breakdown:');
  const brandsCoverage: Record<string, { total: number; AB: number; pct: number }> = {};

  for (const gen of gens) {
    const brand = gen.model?.brand?.name || 'Unknown';
    if (!brandsCoverage[brand]) brandsCoverage[brand] = { total: 0, AB: 0, pct: 0 };
    brandsCoverage[brand].total++;
    const r = ratingMap.get(gen.id);
    if (r && (r.confidence === 'A' || r.confidence === 'B')) {
      brandsCoverage[brand].AB++;
    }
  }

  for (const brand of Object.keys(brandsCoverage)) {
    brandsCoverage[brand].pct = Math.round(brandsCoverage[brand].AB / brandsCoverage[brand].total * 1000) / 10;
  }

  // Sort by total gens descending
  const sortedBrands = Object.entries(brandsCoverage).sort((a, b) => b[1].total - a[1].total);
  for (const [brand, data] of sortedBrands.slice(0, 15)) {
    console.log(`    ${brand.padEnd(20)} ${String(data.AB).padStart(4)}/${String(data.total).padStart(4)} = ${data.pct.toFixed(1)}%`);
  }

  // --- Analysis 6: Top unrated models ---
  const topMissingModels = modelsWithAButMissingB.slice(0, 20);

  // --- Build report ---
  const report = {
    timestamp: new Date().toISOString(),
    total_gens: gens.length,
    with_safety_any: withSafetyAny,
    with_safety_AB: withSafetyAB,
    without_safety: withoutSafety,
    pct_AB: Math.round(withSafetyAB / gens.length * 1000) / 10,
    confidence_breakdown: confBreakdown,
    propagation_opportunities: {
      intra_model_same_model_id: totalPotentialBGains,
      facelift_inheritance: faceliftOpportunities,
      body_variant_inheritance: bodyVariantOpportunities,
      extended_year_7y: extendedYearOpportunities,
      total_estimated: totalPotentialBGains + faceliftOpportunities + bodyVariantOpportunities + extendedYearOpportunities,
    },
    models_with_A_but_missing_B: topMissingModels,
    brands_coverage_pct: brandsCoverage,
  };

  const outPath = path.join(DATA_DIR, 'safety-diagnostic.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved to ${outPath}`);
  console.log(`\n  SUMMARY:`);
  console.log(`    Current A+B: ${withSafetyAB} / ${gens.length} = ${report.pct_AB}%`);
  console.log(`    Estimated total new B opportunities: ${report.propagation_opportunities.total_estimated}`);
  console.log(`    Target (55%): ${Math.ceil(gens.length * 0.55)} → need +${Math.ceil(gens.length * 0.55) - withSafetyAB}`);
}

main().catch(console.error);
