/**
 * FLM AUTO - Migrate Family Fit Data
 * Migrates data from third_party_specs to family_fit_compatibility table
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateFamilyFit() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     FLM AUTO - Migrate to family_fit_compatibility         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // 1. Get all family fit related specs from third_party_specs
  const { data: specs, error } = await supabase
    .from("third_party_specs")
    .select("*")
    .in("spec_type", [
      "isofix_points",
      "rear_hip_room_mm", 
      "three_across_fit",
      "headroom_rear_mm",
      "legroom_rear_mm",
    ]);

  if (error) {
    console.error("❌ Error fetching specs:", error);
    return;
  }

  console.log(`📦 Found ${specs?.length || 0} family fit specs in third_party_specs\n`);

  // 2. Group by generation_id
  const byGeneration = new Map<string, any>();
  
  for (const spec of specs || []) {
    if (!spec.generation_id) continue;
    
    if (!byGeneration.has(spec.generation_id)) {
      byGeneration.set(spec.generation_id, {
        generation_id: spec.generation_id,
        source: spec.source || "scraped",
      });
    }
    
    const entry = byGeneration.get(spec.generation_id);
    
    switch (spec.spec_type) {
      case "isofix_points":
        entry.isofix_points = spec.spec_value;
        if (spec.raw_data) {
          entry.isofix_positions = spec.raw_data.positions;
          entry.center_isofix = spec.raw_data.center_isofix;
          entry.top_tether_points = spec.raw_data.top_tether_points;
        }
        break;
      case "rear_hip_room_mm":
        entry.rear_bench_width_usable_mm = spec.spec_value;
        break;
      case "headroom_rear_mm":
        entry.rear_headroom_mm = spec.spec_value;
        break;
      case "legroom_rear_mm":
        entry.rear_legroom_max_mm = spec.spec_value;
        break;
      case "three_across_fit":
        if (spec.raw_data) {
          entry.three_across_fit_score = spec.raw_data.fit_score;
          entry.three_across_notes = spec.raw_data.notes;
          entry.infant_seat_fit = spec.raw_data.infant_fit;
          entry.toddler_seat_fit = spec.raw_data.toddler_fit;
          entry.booster_seat_fit = spec.raw_data.booster_fit;
          entry.three_across_possible = ["excellent", "good"].includes(spec.raw_data.fit_score);
        }
        break;
    }
  }

  console.log(`📊 Grouped into ${byGeneration.size} generations\n`);

  // 3. Insert/update family_fit_compatibility
  let inserted = 0;
  let errors = 0;

  for (const [genId, data] of byGeneration) {
    const { error: insertError } = await supabase
      .from("family_fit_compatibility")
      .upsert(data, { onConflict: "generation_id" });

    if (insertError) {
      console.error(`❌ ${genId}: ${insertError.message}`);
      errors++;
    } else {
      inserted++;
    }
  }

  // 4. Results
  console.log("═".repeat(60));
  console.log("RESULTS");
  console.log("═".repeat(60));
  console.log(`\n✅ Migrated: ${inserted} generations`);
  console.log(`❌ Errors: ${errors}`);

  // 5. Show sample data
  const { data: sample } = await supabase
    .from("family_fit_compatibility")
    .select(`
      *,
      generations!inner (
        name,
        models!inner (
          name,
          brands!inner (name)
        )
      )
    `)
    .limit(5);

  if (sample && sample.length > 0) {
    console.log("\n📋 Sample data:");
    for (const row of sample) {
      const brand = (row.generations as any).models.brands.name;
      const model = (row.generations as any).models.name;
      const gen = (row.generations as any).name;
      console.log(`   ${brand} ${model} (${gen}): ISOFIX=${row.isofix_points}, 3-across=${row.three_across_fit_score || "N/A"}`);
    }
  }

  console.log("\n✅ Migration complete!");
}

migrateFamilyFit().catch(console.error);
