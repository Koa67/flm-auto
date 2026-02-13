/**
 * 53-safety-audit-post.ts — Post-blitz safety audit
 *
 * Counts ratings by confidence tier, calculates verified %,
 * and lists top 20 unrated models by variant count.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/53-safety-audit-post.ts
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

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  53-SAFETY-AUDIT-POST — Post-blitz audit');
  console.log('='.repeat(60));

  // Load all data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, internal_code, body_style, model:models(id, name, brand:brands(id, name))'
  );
  const ratings = await paginateAll('safety_ratings', 'generation_id, stars, confidence, source_url');
  const variants = await paginateAll('engine_variants', 'id, generation_id');

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Safety ratings: ${ratings.length}`);
  console.log(`  Engine variants: ${variants.length}`);

  // Count by confidence tier
  const byTier: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, null: 0 };
  const ratedGenIds = new Set<string>();
  const ratingMap = new Map<string, any>();

  for (const r of ratings) {
    const tier = r.confidence || 'null';
    byTier[tier] = (byTier[tier] || 0) + 1;
    ratedGenIds.add(r.generation_id);
    ratingMap.set(r.generation_id, r);
  }

  const totalGens = gens.length;
  const verifiedCount = byTier.A + byTier.B;
  const trustworthyCount = verifiedCount + byTier.C;
  const allRatedCount = trustworthyCount + byTier.D;
  const unratedCount = totalGens - ratedGenIds.size;

  const verifiedPct = ((verifiedCount / totalGens) * 100).toFixed(1);
  const trustworthyPct = ((trustworthyCount / totalGens) * 100).toFixed(1);
  const allRatedPct = ((allRatedCount / totalGens) * 100).toFixed(1);
  const coveragePct = ((ratedGenIds.size / totalGens) * 100).toFixed(1);

  console.log('\n  ┌─────────────────────────────────────────────┐');
  console.log('  │        SAFETY RATINGS — POST-BLITZ AUDIT    │');
  console.log('  ├─────────────────────────────────────────────┤');
  console.log(`  │  Confidence A (verified):        ${String(byTier.A).padStart(5)} │`);
  console.log(`  │  Confidence B (propagated close): ${String(byTier.B).padStart(5)} │`);
  console.log(`  │  Confidence C (platform):         ${String(byTier.C).padStart(5)} │`);
  console.log(`  │  Confidence D (inferred):         ${String(byTier.D).padStart(5)} │`);
  console.log(`  │  Confidence E (suspect):          ${String(byTier.E).padStart(5)} │`);
  console.log(`  │  No confidence set:               ${String(byTier.null).padStart(5)} │`);
  console.log('  ├─────────────────────────────────────────────┤');
  console.log(`  │  Total rated:    ${String(ratedGenIds.size).padStart(5)} / ${totalGens}         │`);
  console.log(`  │  Unrated:        ${String(unratedCount).padStart(5)}                    │`);
  console.log('  ├─────────────────────────────────────────────┤');
  console.log(`  │  Verified (A+B):      ${verifiedPct.padStart(5)}%              │`);
  console.log(`  │  Trustworthy (A+B+C): ${trustworthyPct.padStart(5)}%              │`);
  console.log(`  │  All rated (A-D):     ${allRatedPct.padStart(5)}%              │`);
  console.log(`  │  Coverage:            ${coveragePct.padStart(5)}%              │`);
  console.log('  └─────────────────────────────────────────────┘');

  // Count variants per generation
  const variantsByGen = new Map<string, number>();
  for (const v of variants) {
    variantsByGen.set(v.generation_id, (variantsByGen.get(v.generation_id) || 0) + 1);
  }

  // Find top 20 unrated models by variant count
  const unratedGens = gens.filter(g => !ratedGenIds.has(g.id));
  const unratedWithVariants = unratedGens.map(g => ({
    id: g.id,
    brand: g.model?.brand?.name || '?',
    model: g.model?.name || '?',
    gen: g.internal_code || g.name,
    body_style: g.body_style || '?',
    variants: variantsByGen.get(g.id) || 0,
  }));

  unratedWithVariants.sort((a, b) => b.variants - a.variants);
  const top20 = unratedWithVariants.slice(0, 20);

  console.log('\n  Top 20 unrated models (by variant count):');
  console.log('  ─'.repeat(35));
  for (let i = 0; i < top20.length; i++) {
    const m = top20[i];
    console.log(`  ${String(i + 1).padStart(3)}. ${m.brand} ${m.model} ${m.gen} [${m.body_style}] — ${m.variants} variants`);
  }

  // Star distribution
  const starDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    if (r.stars >= 1 && r.stars <= 5) starDist[r.stars]++;
  }

  console.log('\n  Star distribution:');
  for (let s = 5; s >= 1; s--) {
    const count = starDist[s];
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(starDist)) * 30));
    console.log(`    ${s}★ ${bar} ${count}`);
  }

  // By brand summary
  const brandStats = new Map<string, { total: number; rated: number; verified: number }>();
  for (const gen of gens) {
    const brand = gen.model?.brand?.name || '?';
    if (!brandStats.has(brand)) brandStats.set(brand, { total: 0, rated: 0, verified: 0 });
    const stats = brandStats.get(brand)!;
    stats.total++;
    const r = ratingMap.get(gen.id);
    if (r) {
      stats.rated++;
      if (r.confidence === 'A' || r.confidence === 'B') stats.verified++;
    }
  }

  console.log('\n  By brand (verified / total):');
  const sortedBrands = Array.from(brandStats.entries()).sort((a, b) => b[1].total - a[1].total);
  for (const [brand, stats] of sortedBrands) {
    const pct = ((stats.verified / stats.total) * 100).toFixed(0);
    console.log(`    ${brand.padEnd(20)} ${String(stats.verified).padStart(4)} / ${String(stats.total).padStart(4)} (${pct.padStart(3)}%)`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    total_generations: totalGens,
    by_tier: byTier,
    verified_count: verifiedCount,
    verified_pct: parseFloat(verifiedPct),
    trustworthy_count: trustworthyCount,
    trustworthy_pct: parseFloat(trustworthyPct),
    all_rated_count: allRatedCount,
    all_rated_pct: parseFloat(allRatedPct),
    coverage_pct: parseFloat(coveragePct),
    unrated_count: unratedCount,
    star_distribution: starDist,
    top_20_unrated: top20,
    by_brand: Object.fromEntries(sortedBrands),
  };

  fs.writeFileSync(path.join(DATA_DIR, 'safety-audit-post-report.json'), JSON.stringify(report, null, 2));
  console.log('\n  Report saved to data/safety-audit-post-report.json');
}

main().catch(console.error);
