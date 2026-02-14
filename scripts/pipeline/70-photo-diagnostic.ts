/**
 * 70-photo-diagnostic.ts — Photo coverage diagnostic (read-only)
 *
 * Analyzes vehicle_images DB to find coverage gaps:
 *   - Gens with 0 photos
 *   - Gens with only C/D/null photos (no A/B)
 *   - Brand-level coverage breakdown
 *   - Null-confidence photos that could be reclassified
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/70-photo-diagnostic.ts
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

const CONF_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function bestConfidence(confs: (string | null)[]): string | null {
  let best: string | null = null;
  let bestRank = 99;
  for (const c of confs) {
    if (c && CONF_ORDER[c] && CONF_ORDER[c] < bestRank) {
      bestRank = CONF_ORDER[c];
      best = c;
    }
  }
  return best;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  70-PHOTO-DIAGNOSTIC — Coverage analysis');
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Load images — only need generation_id, confidence, image_type, source
  console.log('  Loading images (paginated)...');
  const images = await paginateAll('vehicle_images', 'generation_id, confidence, image_type, source');
  console.log(`  Images: ${images.length}`);

  // Build per-gen stats
  const genPhotoStats = new Map<string, {
    count: number;
    confidences: (string | null)[];
    hasExterior: boolean;
    sources: Set<string>;
  }>();

  for (const img of images) {
    if (!img.generation_id) continue;
    if (!genPhotoStats.has(img.generation_id)) {
      genPhotoStats.set(img.generation_id, { count: 0, confidences: [], hasExterior: false, sources: new Set() });
    }
    const stat = genPhotoStats.get(img.generation_id)!;
    stat.count++;
    stat.confidences.push(img.confidence);
    if (img.image_type === 'exterior') stat.hasExterior = true;
    if (img.source) stat.sources.add(img.source);
  }

  // Classify gens
  let gensWithAnyPhoto = 0;
  let gensWithABPhoto = 0;
  let gensZeroPhotos = 0;
  let gensOnlyCDNull = 0;
  let gensNullOnly = 0;

  const confBreakdownByGen: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null_only: 0, none: 0 };

  const gapsByBrand: Record<string, { total: number; withAB: number; missingAB: number; zeroPhotos: number }> = {};
  const topMissing: any[] = [];
  const gensDOnly: any[] = [];
  const gensNullConfidence: any[] = [];

  for (const gen of gens) {
    const brand = gen.model?.brand?.name || 'Unknown';
    if (!gapsByBrand[brand]) gapsByBrand[brand] = { total: 0, withAB: 0, missingAB: 0, zeroPhotos: 0 };
    gapsByBrand[brand].total++;

    const stat = genPhotoStats.get(gen.id);

    if (!stat || stat.count === 0) {
      gensZeroPhotos++;
      confBreakdownByGen.none++;
      gapsByBrand[brand].zeroPhotos++;
      gapsByBrand[brand].missingAB++;
      topMissing.push({
        brand,
        model: gen.model?.name,
        gen: gen.name,
        slug: gen.slug,
        photos: 0,
        best_tier: null,
      });
      continue;
    }

    gensWithAnyPhoto++;
    const best = bestConfidence(stat.confidences);

    if (best === 'A' || best === 'B') {
      gensWithABPhoto++;
      gapsByBrand[brand].withAB++;
      confBreakdownByGen[best]++;
    } else if (best === 'C') {
      gensOnlyCDNull++;
      gapsByBrand[brand].missingAB++;
      confBreakdownByGen.C++;
    } else if (best === 'D') {
      gensOnlyCDNull++;
      gapsByBrand[brand].missingAB++;
      confBreakdownByGen.D++;
      gensDOnly.push({
        brand,
        model: gen.model?.name,
        gen: gen.name,
        photo_count: stat.count,
        best_tier: 'D',
      });
    } else {
      // null confidence only
      gensNullOnly++;
      gensOnlyCDNull++;
      gapsByBrand[brand].missingAB++;
      confBreakdownByGen.null_only++;
      gensNullConfidence.push({
        brand,
        model: gen.model?.name,
        gen: gen.name,
        photo_count: stat.count,
        best_tier: null,
        sources: [...stat.sources],
      });
    }
  }

  // Image-level confidence breakdown
  const imgConfBreakdown: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null: 0 };
  for (const img of images) {
    const tier = img.confidence || 'null';
    imgConfBreakdown[tier] = (imgConfBreakdown[tier] || 0) + 1;
  }

  console.log(`\n  === GENERATION-LEVEL STATS ===`);
  console.log(`  Total gens: ${gens.length}`);
  console.log(`  With any photo: ${gensWithAnyPhoto} (${(gensWithAnyPhoto / gens.length * 100).toFixed(1)}%)`);
  console.log(`  With A/B photo: ${gensWithABPhoto} (${(gensWithABPhoto / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Zero photos: ${gensZeroPhotos}`);
  console.log(`  Only C/D/null: ${gensOnlyCDNull} (of which null-only: ${gensNullOnly})`);
  console.log(`  Best tier by gen: A=${confBreakdownByGen.A} B=${confBreakdownByGen.B} C=${confBreakdownByGen.C} D=${confBreakdownByGen.D} null_only=${confBreakdownByGen.null_only} none=${confBreakdownByGen.none}`);

  console.log(`\n  === IMAGE-LEVEL STATS ===`);
  console.log(`  Total images: ${images.length}`);
  console.log(`  Confidence: A=${imgConfBreakdown.A} B=${imgConfBreakdown.B} C=${imgConfBreakdown.C} D=${imgConfBreakdown.D} null=${imgConfBreakdown.null}`);

  // Brand breakdown
  console.log(`\n  === BRAND COVERAGE (top 15 by gap) ===`);
  const sortedBrands = Object.entries(gapsByBrand)
    .sort((a, b) => b[1].missingAB - a[1].missingAB);
  for (const [brand, data] of sortedBrands.slice(0, 15)) {
    const pct = data.total > 0 ? (data.withAB / data.total * 100).toFixed(1) : '0.0';
    console.log(`    ${brand.padEnd(20)} ${String(data.withAB).padStart(4)}/${String(data.total).padStart(4)} = ${pct.padStart(5)}%  (missing: ${data.missingAB}, zero: ${data.zeroPhotos})`);
  }

  // Null confidence analysis
  console.log(`\n  === NULL CONFIDENCE ANALYSIS ===`);
  console.log(`  Gens with ONLY null-confidence photos: ${gensNullOnly}`);
  console.log(`  Total null-confidence images: ${imgConfBreakdown.null}`);

  // By source for null images
  const nullBySource: Record<string, number> = {};
  for (const img of images) {
    if (img.confidence === null) {
      const src = img.source || 'null';
      nullBySource[src] = (nullBySource[src] || 0) + 1;
    }
  }
  console.log(`  Null images by source:`);
  for (const [src, count] of Object.entries(nullBySource).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${src.padEnd(30)} ${count}`);
  }

  // Report
  const report = {
    timestamp: new Date().toISOString(),
    total_gens: gens.length,
    gens_with_any_photo: gensWithAnyPhoto,
    gens_with_AB_photo: gensWithABPhoto,
    gens_zero_photos: gensZeroPhotos,
    gens_only_CD_null: gensOnlyCDNull,
    gens_null_confidence_only: gensNullOnly,
    pct_AB: Math.round(gensWithABPhoto / gens.length * 1000) / 10,
    gen_confidence_breakdown: confBreakdownByGen,
    image_confidence_breakdown: imgConfBreakdown,
    gaps_by_brand: sortedBrands.map(([brand, data]) => ({
      brand,
      total: data.total,
      with_AB: data.withAB,
      missing_AB: data.missingAB,
      zero_photos: data.zeroPhotos,
    })),
    top_50_missing: topMissing.slice(0, 50),
    gens_D_only: gensDOnly.slice(0, 50),
    gens_null_only: gensNullConfidence.slice(0, 100),
  };

  const outPath = path.join(DATA_DIR, 'photo-diagnostic.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved to ${outPath}`);
  console.log(`\n  SUMMARY:`);
  console.log(`    Current A+B: ${gensWithABPhoto} / ${gens.length} = ${report.pct_AB}%`);
  console.log(`    Target (90%): ${Math.ceil(gens.length * 0.9)} → need +${Math.ceil(gens.length * 0.9) - gensWithABPhoto}`);
  console.log(`    Quick wins: ${gensNullOnly} gens with null-only photos (reclassify → A/B)`);
}

main().catch(console.error);
