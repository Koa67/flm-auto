/**
 * 85-safety-gap-analysis.ts — Safety coverage gap analysis (read-only)
 *
 * Queries all generations and safety_ratings, then produces a gap report:
 *   - Gens WITHOUT safety A/B ratings by production period
 *   - Count per brand of missing safety
 *   - Confidence tier breakdown
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/85-safety-gap-analysis.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = path.resolve(__dirname, "../../data");

async function paginateAll(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

interface PeriodBucket {
  label: string;
  total: number;
  withAB: number;
  withAny: number;
  missing: number;
  missingPct: number;
}

interface BrandGap {
  brand: string;
  total: number;
  withAB: number;
  withAny: number;
  missingAB: number;
  missingABPct: number;
  missingAny: number;
  missingAnyPct: number;
}

function getYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  return isNaN(y) ? null : y;
}

function periodLabel(year: number | null): string {
  if (year === null) return "date_unknown";
  if (year >= 2015) return "2015+";
  if (year >= 2010) return "2010-2014";
  if (year >= 2000) return "2000-2009";
  return "pre-2000";
}

async function main() {
  console.log("");
  console.log("=".repeat(60));
  console.log("  85-SAFETY-GAP-ANALYSIS -- Coverage gap report");
  console.log("=".repeat(60));

  // 1. Load all generations
  console.log("\n  Loading generations...");
  const gens = await paginateAll(
    "generations",
    "id, name, slug, production_start, production_end, model_id"
  );
  console.log(`  Generations: ${gens.length}`);

  // 2. Load all models + brands for name lookup
  console.log("  Loading models + brands...");
  const models = await paginateAll("models", "id, name, slug, brand_id");
  const brands = await paginateAll("brands", "id, name, slug");
  console.log(`  Models: ${models.length}, Brands: ${brands.length}`);

  // 3. Load all safety_ratings
  console.log("  Loading safety_ratings...");
  const ratings = await paginateAll(
    "safety_ratings",
    "id, generation_id, stars, confidence"
  );
  console.log(`  Safety ratings: ${ratings.length}`);

  // Build lookup maps
  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  // Build rating lookup: generation_id -> rating
  const ratingByGen = new Map<string, any>();
  for (const r of ratings) {
    ratingByGen.set(r.generation_id, r);
  }

  // ---- Confidence breakdown ----
  const confBreakdown: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    null: 0,
  };
  for (const r of ratings) {
    const tier = r.confidence || "null";
    confBreakdown[tier] = (confBreakdown[tier] || 0) + 1;
  }

  // ---- Period analysis ----
  const periodKeys = ["2015+", "2010-2014", "2000-2009", "pre-2000", "date_unknown"];
  const periodData: Record<string, { total: number; withAB: number; withAny: number }> = {};
  for (const key of periodKeys) {
    periodData[key] = { total: 0, withAB: 0, withAny: 0 };
  }

  // ---- Brand analysis ----
  const brandData: Record<
    string,
    { total: number; withAB: number; withAny: number }
  > = {};

  // ---- Per-gen analysis ----
  const missingGens: {
    brand: string;
    model: string;
    gen: string;
    period: string;
    production_start: string | null;
  }[] = [];

  for (const gen of gens) {
    const model = modelMap.get(gen.model_id);
    const brand = model ? brandMap.get(model.brand_id) : null;
    const brandName = brand?.name || "Unknown";

    const startYear = getYear(gen.production_start);
    const period = periodLabel(startYear);

    // Period stats
    periodData[period].total++;

    // Brand stats
    if (!brandData[brandName]) {
      brandData[brandName] = { total: 0, withAB: 0, withAny: 0 };
    }
    brandData[brandName].total++;

    const rating = ratingByGen.get(gen.id);
    const hasAny = !!rating;
    const hasAB =
      hasAny && (rating.confidence === "A" || rating.confidence === "B");

    if (hasAny) {
      periodData[period].withAny++;
      brandData[brandName].withAny++;
    }
    if (hasAB) {
      periodData[period].withAB++;
      brandData[brandName].withAB++;
    }

    // Track missing gens (no A/B rating)
    if (!hasAB) {
      missingGens.push({
        brand: brandName,
        model: model?.name || "Unknown",
        gen: gen.name || gen.slug || gen.id,
        period,
        production_start: gen.production_start,
      });
    }
  }

  // ---- Build period buckets ----
  const periods: PeriodBucket[] = periodKeys.map((label) => {
    const d = periodData[label];
    const missing = d.total - d.withAB;
    return {
      label,
      total: d.total,
      withAB: d.withAB,
      withAny: d.withAny,
      missing,
      missingPct: d.total > 0 ? Math.round((missing / d.total) * 1000) / 10 : 0,
    };
  });

  // ---- Build brand gaps ----
  const brandGaps: BrandGap[] = Object.entries(brandData)
    .map(([brandName, d]) => ({
      brand: brandName,
      total: d.total,
      withAB: d.withAB,
      withAny: d.withAny,
      missingAB: d.total - d.withAB,
      missingABPct:
        d.total > 0
          ? Math.round(((d.total - d.withAB) / d.total) * 1000) / 10
          : 0,
      missingAny: d.total - d.withAny,
      missingAnyPct:
        d.total > 0
          ? Math.round(((d.total - d.withAny) / d.total) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.missingAB - a.missingAB);

  // ---- Totals ----
  const totalWithAny = ratings.length;
  const totalWithAB = confBreakdown.A + confBreakdown.B;
  const totalMissingAB = gens.length - totalWithAB;
  const totalMissingAny = gens.length - totalWithAny;

  // ---- Console output ----
  console.log("\n  CONFIDENCE BREAKDOWN:");
  for (const [tier, count] of Object.entries(confBreakdown)) {
    console.log(`    ${tier}: ${count}`);
  }

  console.log("\n  COVERAGE BY PRODUCTION PERIOD (missing A/B):");
  for (const p of periods) {
    console.log(
      `    ${p.label.padEnd(15)} ${String(p.missing).padStart(5)} / ${String(p.total).padStart(5)} missing = ${p.missingPct.toFixed(1)}%`
    );
  }

  console.log("\n  TOP 15 BRANDS BY MISSING A/B RATINGS:");
  for (const b of brandGaps.slice(0, 15)) {
    console.log(
      `    ${b.brand.padEnd(20)} ${String(b.missingAB).padStart(5)} / ${String(b.total).padStart(5)} missing = ${b.missingABPct.toFixed(1)}%`
    );
  }

  console.log("\n  SUMMARY:");
  console.log(`    Total generations:    ${gens.length}`);
  console.log(`    With safety (any):    ${totalWithAny} (${(totalWithAny / gens.length * 100).toFixed(1)}%)`);
  console.log(`    With safety (A+B):    ${totalWithAB} (${(totalWithAB / gens.length * 100).toFixed(1)}%)`);
  console.log(`    Missing any rating:   ${totalMissingAny}`);
  console.log(`    Missing A/B rating:   ${totalMissingAB}`);

  // ---- Sample of missing gens (recent first) ----
  const recentMissing = missingGens
    .filter((g) => g.period === "2015+")
    .slice(0, 30)
    .map((g) => `${g.brand} ${g.model} - ${g.gen} (${g.production_start || "?"})`);

  if (recentMissing.length > 0) {
    console.log("\n  SAMPLE MISSING 2015+ GENS:");
    for (const ex of recentMissing.slice(0, 10)) {
      console.log(`    ${ex}`);
    }
  }

  // ---- Save report ----
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_generations: gens.length,
      with_safety_any: totalWithAny,
      with_safety_AB: totalWithAB,
      missing_any: totalMissingAny,
      missing_AB: totalMissingAB,
      pct_with_any: Math.round((totalWithAny / gens.length) * 1000) / 10,
      pct_with_AB: Math.round((totalWithAB / gens.length) * 1000) / 10,
    },
    confidence_breakdown: confBreakdown,
    by_period: periods,
    by_brand: brandGaps,
    sample_missing_2015_plus: recentMissing,
  };

  const outPath = path.join(DATA_DIR, "safety-gap-analysis.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: ${outPath}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
