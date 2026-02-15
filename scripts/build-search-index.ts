/**
 * Build vehicle_search_index — denormalized table for fast faceted search.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/build-search-index.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function paginateAll<T>(table: string, select: string, filters?: (q: any) => any): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    let query = supabase.from(table).select(select).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

interface GenRow {
  id: string;
  name: string;
  slug: string;
  internal_code: string | null;
  body_style: string | null;
  production_start: string | null;
  production_end: string | null;
  models: {
    name: string;
    slug: string;
    segment: string | null;
    brands: { name: string; slug: string };
  };
}

async function main() {
  console.log("Building vehicle search index...");

  // 1. Fetch all generations with model + brand
  const generations = await paginateAll<GenRow>(
    "generations",
    "id, name, slug, internal_code, body_style, production_start, production_end, models!inner(name, slug, segment, brands!inner(name, slug))"
  );
  console.log(`Fetched ${generations.length} generations`);

  // 2. Fetch top variant per generation (highest power)
  const variants = await paginateAll<{
    generation_id: string;
    fuel_type: string | null;
    powertrain_specs: { power_hp: number | null }[];
    performance_specs: { acceleration_0_100_kmh: number | null; top_speed_kmh: number | null }[];
  }>(
    "engine_variants",
    "generation_id, fuel_type, powertrain_specs(power_hp), performance_specs(acceleration_0_100_kmh, top_speed_kmh)"
  );

  // Build map: generation_id → best variant
  const variantMap = new Map<string, { fuel_type: string | null; power_hp: number | null; accel: number | null; top_speed: number | null }>();
  for (const v of variants) {
    const power = v.powertrain_specs?.[0]?.power_hp || null;
    const existing = variantMap.get(v.generation_id);
    if (!existing || (power && (!existing.power_hp || power > existing.power_hp))) {
      variantMap.set(v.generation_id, {
        fuel_type: v.fuel_type,
        power_hp: power,
        accel: v.performance_specs?.[0]?.acceleration_0_100_kmh || null,
        top_speed: v.performance_specs?.[0]?.top_speed_kmh || null,
      });
    }
  }
  console.log(`Mapped ${variantMap.size} variant entries`);

  // 3. Fetch safety ratings
  const safetyRows = await paginateAll<{ generation_id: string; stars: number | null }>(
    "safety_ratings",
    "generation_id, stars"
  );
  const safetyMap = new Map(safetyRows.map((r) => [r.generation_id, r.stars]));
  console.log(`Mapped ${safetyMap.size} safety ratings`);

  // 4. Fetch interior dimensions (trunk)
  const dimsRows = await paginateAll<{ generation_id: string; trunk_volume_liters: number | null }>(
    "interior_dimensions",
    "generation_id, trunk_volume_liters"
  );
  const dimsMap = new Map(dimsRows.map((r) => [r.generation_id, r.trunk_volume_liters]));
  console.log(`Mapped ${dimsMap.size} dimension entries`);

  // 5. Fetch family fit
  const ffRows = await paginateAll<{ generation_id: string; isofix_points: number | null; three_across_possible: boolean | null }>(
    "family_fit_compatibility",
    "generation_id, isofix_points, three_across_possible"
  );
  const ffMap = new Map(ffRows.map((r) => [r.generation_id, { isofix: r.isofix_points, three_across: r.three_across_possible }]));
  console.log(`Mapped ${ffMap.size} family fit entries`);

  // 6. Fetch one thumbnail per generation
  const imgRows = await paginateAll<{ generation_id: string; url: string }>(
    "vehicle_images",
    "generation_id, url",
    (q: any) => q.eq("image_type", "exterior").order("confidence", { ascending: true }).limit(5000)
  );
  // Deduplicate: keep first per generation_id
  const thumbMap = new Map<string, string>();
  for (const img of imgRows) {
    if (!thumbMap.has(img.generation_id)) {
      thumbMap.set(img.generation_id, img.url);
    }
  }
  console.log(`Mapped ${thumbMap.size} thumbnails`);

  // 7. Build index rows
  const rows = generations.map((g) => {
    const v = variantMap.get(g.id);
    const ff = ffMap.get(g.id);
    return {
      generation_id: g.id,
      brand_name: g.models.brands.name,
      brand_slug: g.models.brands.slug,
      model_name: g.models.name,
      model_slug: g.models.slug,
      segment: g.models.segment,
      generation_name: g.name,
      generation_slug: g.slug,
      internal_code: g.internal_code,
      body_style: g.body_style,
      year_start: g.production_start ? new Date(g.production_start).getFullYear() : null,
      year_end: g.production_end ? new Date(g.production_end).getFullYear() : null,
      fuel_type: v?.fuel_type || null,
      power_hp: v?.power_hp || null,
      acceleration_0_100: v?.accel || null,
      top_speed_kmh: v?.top_speed || null,
      ncap_stars: safetyMap.get(g.id) || null,
      trunk_volume_liters: dimsMap.get(g.id) || null,
      isofix_points: ff?.isofix || null,
      three_across: ff?.three_across || null,
      thumbnail_url: thumbMap.get(g.id) || null,
      updated_at: new Date().toISOString(),
    };
  });

  console.log(`Built ${rows.length} index rows`);

  // 8. Upsert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("vehicle_search_index")
      .upsert(batch, { onConflict: "generation_id" });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Done! Inserted/updated ${inserted}/${rows.length} rows.`);
}

main().catch(console.error);
