/**
 * FLM AUTO - Import Family Fit Data
 * 
 * Imports consolidated Family Fit data into family_fit_compatibility table
 * Source: family-fit-consolidated.json
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-family-fit.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FamilyFitVehicle {
  brand: string;
  model: string;
  generation: string;
  body_types: string[];
  isofix: {
    points: number;
    positions: string[];
    center_isofix: boolean;
    top_tether_points: number;
  };
  rear_dimensions_mm: {
    headroom: number;
    legroom: number;
    shoulder_room: number;
    hip_room: number;
  };
  three_across: {
    fit_score: string;
    notes: string;
  };
  family_fit_score: {
    infant: string;
    toddler: string;
    booster: string;
  };
}

// Brand normalization
const BRAND_MAP: Record<string, string> = {
  "BMW": "BMW",
  "Audi": "Audi",
  "Mercedes": "Mercedes",
  "Volkswagen": "Volkswagen",
  "Skoda": "Skoda",
  "Hyundai": "Hyundai",
  "Tesla": "Tesla",
  "Volvo": "Volvo",
};

async function importFamilyFit() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        FLM AUTO - Import Family Fit Data                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Load data
  const dataPath = "/Users/koa/Dev/flm-auto/data/family-fit/family-fit-consolidated.json";
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  
  console.log(`📦 Loaded ${data.vehicles.length} vehicles\n`);

  // First, check if family_fit_compatibility table exists
  const { error: tableCheck } = await supabase
    .from("family_fit_compatibility")
    .select("id")
    .limit(1);

  if (tableCheck) {
    console.log("⚠️  Table 'family_fit_compatibility' may not exist yet.");
    console.log("   Run migration first:\n");
    console.log("   CREATE TABLE IF NOT EXISTS family_fit_compatibility (...);");
    console.log("\n   Or insert into third_party_specs as fallback...\n");
  }

  // Get generations for matching
  const { data: generations, error: genError } = await supabase
    .from("generations")
    .select(`
      id,
      name,
      production_start,
      production_end,
      models!inner (
        id,
        name,
        brands!inner (
          id,
          name
        )
      )
    `);

  if (genError) {
    console.error("❌ Error fetching generations:", genError);
    return;
  }

  console.log(`📊 Found ${generations?.length || 0} generations in DB\n`);

  const stats = {
    matched: 0,
    unmatched: 0,
    inserted: 0,
    errors: 0,
  };

  const unmatchedList: string[] = [];

  for (const vehicle of data.vehicles as FamilyFitVehicle[]) {
    const brandSearch = BRAND_MAP[vehicle.brand] || vehicle.brand;
    const modelSearch = vehicle.model.toLowerCase()
      .replace("-class", "")
      .replace("-series", "")
      .replace(" ", "");

    // Find matching generation
    const gen = generations?.find(g => {
      const dbBrand = ((g.models as any).brands as any).name.toLowerCase();
      const dbModel = ((g.models as any).name as string).toLowerCase().replace(" ", "");
      
      const brandMatch = dbBrand.includes(brandSearch.toLowerCase()) || 
                         brandSearch.toLowerCase().includes(dbBrand);
      
      const modelMatch = dbModel.includes(modelSearch) || modelSearch.includes(dbModel);
      
      return brandMatch && modelMatch;
    });

    const vehicleName = `${vehicle.brand} ${vehicle.model}`;

    if (!gen) {
      stats.unmatched++;
      unmatchedList.push(vehicleName);
      continue;
    }

    stats.matched++;

    // Insert into third_party_specs (as fallback until family_fit_compatibility exists)
    const specs = [
      {
        generation_id: gen.id,
        source: "family_fit_scrape",
        source_url: "https://www.safelytravelled.co.uk",
        spec_type: "isofix_points",
        spec_value: vehicle.isofix.points,
        raw_data: {
          positions: vehicle.isofix.positions,
          center_isofix: vehicle.isofix.center_isofix,
          top_tether_points: vehicle.isofix.top_tether_points,
          generation: vehicle.generation,
        },
      },
      {
        generation_id: gen.id,
        source: "family_fit_scrape",
        source_url: "scraped:dimensions",
        spec_type: "rear_hip_room_mm",
        spec_value: vehicle.rear_dimensions_mm.hip_room,
        raw_data: {
          shoulder_room_mm: vehicle.rear_dimensions_mm.shoulder_room,
        },
      },
      {
        generation_id: gen.id,
        source: "family_fit_scrape",
        source_url: "scraped:family_fit",
        spec_type: "three_across_fit",
        spec_value: ["excellent", "good", "tight", "not_recommended"].indexOf(vehicle.three_across.fit_score),
        raw_data: {
          fit_score: vehicle.three_across.fit_score,
          notes: vehicle.three_across.notes,
          infant_fit: vehicle.family_fit_score.infant,
          toddler_fit: vehicle.family_fit_score.toddler,
          booster_fit: vehicle.family_fit_score.booster,
        },
      },
    ];

    for (const spec of specs) {
      const { error } = await supabase.from("third_party_specs").upsert(spec, {
        onConflict: "generation_id,source,spec_type",
      });

      if (error) {
        if (error.code !== "23505") {
          console.error(`❌ Error: ${error.message}`);
          stats.errors++;
        }
      } else {
        stats.inserted++;
      }
    }
  }

  // Results
  console.log("\n" + "═".repeat(60));
  console.log("RESULTS");
  console.log("═".repeat(60));
  
  console.log(`\n✅ Matched:   ${stats.matched} vehicles`);
  console.log(`❌ Unmatched: ${stats.unmatched} vehicles`);
  console.log(`📥 Inserted:  ${stats.inserted} spec records`);
  console.log(`⚠️  Errors:    ${stats.errors}`);

  if (unmatchedList.length > 0) {
    console.log("\n📋 Unmatched vehicles:");
    unmatchedList.forEach(v => console.log(`   - ${v}`));
  }

  console.log("\n✅ Family Fit import complete!");
  console.log("\n💡 Next: Run migration to create family_fit_compatibility table for full schema.");
}

importFamilyFit().catch(console.error);
