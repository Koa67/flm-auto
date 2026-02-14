/**
 * 80-garbage-diagnostic.ts — Conservative garbage generation diagnostic
 *
 * Strategy: Only flag entries that are TRULY safe to delete.
 *
 * Category A (SAFE DELETE):
 *   - *Specs models with confirmed real counterpart
 *   - "LCI" model (facelift marker, not a model)
 *   - Model name "bmw" under BMW brand (scraper artifact)
 *   - Empty shells: 0 photos, 0 specs, 0 variants, 0 videos, 0 safety, 0 dims
 *
 * Category B (REVIEW): entries with some data but questionable names
 * Category C (LEGIT): real gens missing photos, never touch
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function paginateAll(table: string, select: string) {
  const rows: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function main() {
  console.log("=== CONSERVATIVE GARBAGE DIAGNOSTIC ===\n");

  // Fetch all generations with brand/model info
  const gens = await paginateAll("generations", "id, model_id, slug, name, production_start, production_end, chassis_code, internal_code");
  const models = await paginateAll("models", "id, brand_id, slug, name");
  const brands = await paginateAll("brands", "id, slug, name");

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  // Build model lookup by brand+name for duplicate detection
  const modelsByBrand = new Map<string, Map<string, any[]>>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, new Map());
    const bm = modelsByBrand.get(m.brand_id)!;
    const key = m.name.toLowerCase();
    if (!bm.has(key)) bm.set(key, []);
    bm.get(key)!.push(m);
  }

  // Fetch counts for each gen
  console.log("Fetching data counts...");
  const [photoRows, specRows, variantRows, videoRows, safetyRows, dimsRows] = await Promise.all([
    paginateAll("vehicle_images", "generation_id"),
    paginateAll("third_party_specs", "generation_id"),
    paginateAll("engine_variants", "generation_id"),
    paginateAll("vehicle_videos", "generation_id"),
    paginateAll("safety_ratings", "generation_id"),
    paginateAll("interior_dimensions", "generation_id"),
  ]);

  const countMap = (rows: any[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.generation_id, (m.get(r.generation_id) || 0) + 1);
    }
    return m;
  };

  const photoCounts = countMap(photoRows);
  const specCounts = countMap(specRows);
  const variantCounts = countMap(variantRows);
  const videoCounts = countMap(videoRows);
  const safetyCounts = countMap(safetyRows);
  const dimsCounts = countMap(dimsRows);

  const dataCount = (genId: string) => ({
    photos: photoCounts.get(genId) || 0,
    specs: specCounts.get(genId) || 0,
    variants: variantCounts.get(genId) || 0,
    videos: videoCounts.get(genId) || 0,
    safety: safetyCounts.get(genId) || 0,
    dims: dimsCounts.get(genId) || 0,
  });

  const totalData = (genId: string) => {
    const d = dataCount(genId);
    return d.photos + d.specs + d.variants + d.videos + d.safety + d.dims;
  };

  const isEmptyShell = (genId: string) => totalData(genId) === 0;

  const categoryA: any[] = [];
  const categoryB: any[] = [];
  const categoryC: any[] = [];

  for (const gen of gens) {
    const model = modelMap.get(gen.model_id);
    if (!model) continue;
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;

    const modelName = model.name;
    const genName = gen.name;
    const entry = {
      id: gen.id,
      model_id: model.id,
      brand: brand.name,
      model: modelName,
      gen: genName,
      slug: gen.slug,
      data: dataCount(gen.id),
      reason: "",
    };

    // === 1. *Specs models — clear scraping artifacts ===
    if (/Specs$/i.test(modelName)) {
      const realName = modelName.replace(/Specs$/i, "").toLowerCase();
      const brandModels = modelsByBrand.get(model.brand_id);
      const hasReal = brandModels?.has(realName);
      if (hasReal) {
        categoryA.push({ ...entry, reason: "specs_model_has_real_counterpart" });
      } else {
        // No real counterpart — might have unique data. Still delete if empty.
        if (isEmptyShell(gen.id)) {
          categoryA.push({ ...entry, reason: "specs_model_empty" });
        } else {
          categoryB.push({ ...entry, reason: "specs_model_no_counterpart_has_data" });
        }
      }
      continue;
    }

    // === 2. "LCI" model — facelift marker misused as model ===
    if (/^LCI$/i.test(modelName)) {
      categoryA.push({ ...entry, reason: "lci_model" });
      continue;
    }

    // === 3. Model name = brand name (e.g., BMW "bmw") ===
    if (modelName.toLowerCase() === brand.name.toLowerCase()) {
      if (isEmptyShell(gen.id)) {
        categoryA.push({ ...entry, reason: "model_equals_brand_empty" });
      } else {
        categoryB.push({ ...entry, reason: "model_equals_brand_has_data" });
      }
      continue;
    }

    // === 4. Truly empty shells with garbage names ===
    if (isEmptyShell(gen.id)) {
      // Gen slug = "default" and empty
      if (gen.slug === "default") {
        categoryA.push({ ...entry, reason: "default_slug_empty_shell" });
        continue;
      }
      // Check for other garbage patterns
      // Model name "New", "Type", "GT" (under BMW — not a real standalone model)
      if (brand.name === "BMW" && ["New", "Type"].includes(modelName)) {
        categoryA.push({ ...entry, reason: "nonsense_model_empty" });
        continue;
      }
      // Concept cars empty
      if (["Nuvolari", "Avantissimo", "Winnetou", "Nanuk"].includes(modelName) && isEmptyShell(gen.id)) {
        categoryA.push({ ...entry, reason: "concept_empty_shell" });
        continue;
      }
    }

    // === 5. Duplicate Audi models (slug pattern detection) ===
    // Audi has models like "100" with slug "audi-100" AND slug "100" — the non-prefixed ones are duplicates
    if (brand.name === "Audi") {
      const brandModels = modelsByBrand.get(model.brand_id);
      const sameNameModels = brandModels?.get(modelName.toLowerCase());
      if (sameNameModels && sameNameModels.length > 1) {
        // This model has duplicates — flag the non-prefixed one if it has fewer gens
        const prefixedVersions = sameNameModels.filter((m: any) => m.slug.startsWith("audi-"));
        const nonPrefixed = sameNameModels.filter((m: any) => !m.slug.startsWith("audi-"));
        if (nonPrefixed.some((m: any) => m.id === model.id) && prefixedVersions.length > 0 && isEmptyShell(gen.id)) {
          categoryA.push({ ...entry, reason: "duplicate_audi_model_empty" });
          continue;
        }
      }
    }

    // === Category C — legit but missing photos ===
    if ((photoCounts.get(gen.id) || 0) === 0) {
      categoryC.push({ ...entry, reason: "legit_no_photos" });
    }
  }

  // Sort by brand/model
  categoryA.sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));
  categoryB.sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));

  const report = {
    category_A_delete: categoryA,
    category_B_review: categoryB,
    category_C_legit_missing: categoryC,
    summary: {
      total_gens: gens.length,
      total_suspect: categoryA.length + categoryB.length,
      category_A: categoryA.length,
      category_B: categoryB.length,
      category_C: categoryC.length,
    },
  };

  const outPath = path.resolve(__dirname, "../../data/garbage-diagnostic.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSummary:`);
  console.log(`  Total generations: ${gens.length}`);
  console.log(`  Category A (safe delete): ${categoryA.length}`);
  console.log(`  Category B (review): ${categoryB.length}`);
  console.log(`  Category C (legit, no photos): ${categoryC.length}`);
  console.log(`\nCategory A reasons:`);
  const reasons = categoryA.reduce((acc: Record<string, number>, r: any) => {
    acc[r.reason] = (acc[r.reason] || 0) + 1;
    return acc;
  }, {});
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log(`\nCategory B reasons:`);
  const bReasons = categoryB.reduce((acc: Record<string, number>, r: any) => {
    acc[r.reason] = (acc[r.reason] || 0) + 1;
    return acc;
  }, {});
  for (const [reason, count] of Object.entries(bReasons).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log(`\nSaved to ${outPath}`);
}

main().catch(console.error);
