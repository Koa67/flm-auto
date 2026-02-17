/**
 * FLM AUTO - Import Interior Dimensions
 * 
 * Imports scraped interior dimensions into third_party_specs table
 * Source: scraped-dimensions-v4.json (48 vehicles)
 * 
 * Usage: npx tsx scripts/import-interior-dimensions.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ScrapedVehicle {
  brand: string;
  model: string;
  year: number;
  variant: string;
  golden_set_id?: string;
  body_type: string;
  source: string;
  interior: {
    front_headroom_mm?: number;
    rear_headroom_mm?: number;
    front_legroom_mm?: number;
    rear_legroom_mm?: number;
    front_shoulder_room_mm?: number;
    rear_shoulder_room_mm?: number;
    front_hip_room_mm?: number;
    rear_hip_room_mm?: number;
    notes?: string;
  };
  exterior?: {
    length_mm?: number;
    width_mm?: number;
    height_mm?: number;
    wheelbase_mm?: number;
  };
  cargo?: {
    volume_l?: number;
    volume_max_l?: number;
    frunk_l?: number;
  };
  notes?: string;
}

interface ScrapedData {
  metadata: {
    version: string;
    total_vehicles: number;
    golden_set_coverage: string;
  };
  vehicles: ScrapedVehicle[];
}

// Brand name normalization
const BRAND_MAP: Record<string, string> = {
  "bmw": "BMW",
  "audi": "Audi",
  "mercedes-benz": "Mercedes",
  "mercedes-amg": "Mercedes",
  "volkswagen": "Volkswagen",
  "vw": "Volkswagen",
  "skoda": "Skoda",
  "porsche": "Porsche",
  "tesla": "Tesla",
  "hyundai": "Hyundai",
  "renault": "Renault",
  "volvo": "Volvo",
};

// Model name normalization for matching
function normalizeModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/series/g, "")
    .replace(/class/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function importInteriorDimensions() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     FLM AUTO - Import Interior Dimensions                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Load scraped data
  const dataPath = "/Users/koa/Dev/flm-auto/data/interior-dimensions/scraped-dimensions-v4.json";
  const data: ScrapedData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  
  console.log(`📦 Loaded ${data.vehicles.length} vehicles from v${data.metadata.version}`);
  console.log(`🎯 Golden Set coverage: ${data.metadata.golden_set_coverage}\n`);

  // Fetch all generations with their models and brands
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

  console.log(`📊 Found ${generations?.length || 0} generations in database\n`);

  const stats = {
    matched: 0,
    unmatched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
  };

  const unmatchedList: string[] = [];
  const matchedList: { vehicle: string; generation: string }[] = [];

  for (const vehicle of data.vehicles) {
    // Skip Porsche vehicles with no interior data
    if (vehicle.interior.notes?.includes("does NOT publish")) {
      console.log(`⏭️  Skipping ${vehicle.brand} ${vehicle.model} (no interior data available)`);
      stats.skipped++;
      continue;
    }

    // Normalize brand name
    const brandNorm = BRAND_MAP[vehicle.brand.toLowerCase()] || vehicle.brand;
    const modelNorm = normalizeModel(vehicle.model);

    // Find matching generation
    const gen = generations?.find(g => {
      const dbBrand = ((g.models as any).brands as any).name.toLowerCase();
      const dbModel = ((g.models as any).name as string).toLowerCase();
      
      // Brand matching
      const brandMatch = 
        dbBrand.includes(brandNorm.toLowerCase()) || 
        brandNorm.toLowerCase().includes(dbBrand);
      
      if (!brandMatch) return false;

      // Model matching (fuzzy)
      const dbModelNorm = normalizeModel(dbModel);
      const modelMatch = 
        dbModelNorm.includes(modelNorm) || 
        modelNorm.includes(dbModelNorm) ||
        // Handle specific cases
        (modelNorm.includes("3") && dbModelNorm.includes("3")) ||
        (modelNorm.includes("5") && dbModelNorm.includes("5")) ||
        (modelNorm.includes("x1") && dbModelNorm.includes("x1")) ||
        (modelNorm.includes("x3") && dbModelNorm.includes("x3")) ||
        (modelNorm.includes("x5") && dbModelNorm.includes("x5")) ||
        (modelNorm.includes("a3") && dbModelNorm.includes("a3")) ||
        (modelNorm.includes("a4") && dbModelNorm.includes("a4")) ||
        (modelNorm.includes("q5") && dbModelNorm.includes("q5")) ||
        (modelNorm.includes("q7") && dbModelNorm.includes("q7")) ||
        (modelNorm.includes("glc") && dbModelNorm.includes("glc")) ||
        (modelNorm.includes("gle") && dbModelNorm.includes("gle")) ||
        (modelNorm.includes("tiguan") && dbModelNorm.includes("tiguan")) ||
        (modelNorm.includes("golf") && dbModelNorm.includes("golf"));
      
      return modelMatch;
    });

    const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`;

    if (!gen) {
      stats.unmatched++;
      unmatchedList.push(vehicleName);
      continue;
    }

    stats.matched++;
    matchedList.push({
      vehicle: vehicleName,
      generation: `${((gen.models as any).brands as any).name} ${(gen.models as any).name} (${gen.name})`,
    });

    // Prepare records to insert
    const records = [];

    // Interior dimensions
    if (vehicle.interior.front_headroom_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "headroom_front_mm",
        spec_value: vehicle.interior.front_headroom_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    if (vehicle.interior.rear_headroom_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "headroom_rear_mm",
        spec_value: vehicle.interior.rear_headroom_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    if (vehicle.interior.front_legroom_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "legroom_front_mm",
        spec_value: vehicle.interior.front_legroom_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    if (vehicle.interior.rear_legroom_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "legroom_rear_mm",
        spec_value: vehicle.interior.rear_legroom_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    if (vehicle.interior.front_shoulder_room_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "shoulder_room_front_mm",
        spec_value: vehicle.interior.front_shoulder_room_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    if (vehicle.interior.rear_shoulder_room_mm) {
      records.push({
        generation_id: gen.id,
        source: vehicle.source,
        source_url: getSourceUrl(vehicle.source),
        spec_type: "shoulder_room_rear_mm",
        spec_value: vehicle.interior.rear_shoulder_room_mm,
        raw_data: { golden_set_id: vehicle.golden_set_id, body_type: vehicle.body_type },
      });
    }

    // Insert records
    for (const record of records) {
      const { error } = await supabase.from("third_party_specs").upsert(record, {
        onConflict: "generation_id,source,spec_type",
      });

      if (error) {
        if (error.code === "23505") {
          // Duplicate - already exists
        } else {
          console.error(`❌ Error inserting ${record.spec_type}: ${error.message}`);
          stats.errors++;
        }
      } else {
        stats.inserted++;
      }
    }
  }

  // Print results
  console.log("\n" + "═".repeat(60));
  console.log("RESULTS");
  console.log("═".repeat(60));
  
  console.log(`\n✅ Matched:   ${stats.matched}`);
  console.log(`❌ Unmatched: ${stats.unmatched}`);
  console.log(`⏭️  Skipped:   ${stats.skipped} (no data)`);
  console.log(`📥 Inserted:  ${stats.inserted} spec records`);
  console.log(`⚠️  Errors:    ${stats.errors}`);

  if (unmatchedList.length > 0) {
    console.log("\n📋 Unmatched vehicles (not in DB):");
    unmatchedList.forEach(v => console.log(`   - ${v}`));
  }

  if (matchedList.length > 0 && matchedList.length <= 20) {
    console.log("\n✅ Matched vehicles:");
    matchedList.forEach(m => console.log(`   ${m.vehicle} → ${m.generation}`));
  }

  console.log("\n✅ Import complete!");
}

function getSourceUrl(source: string): string {
  const urls: Record<string, string> = {
    edmunds: "https://www.edmunds.com",
    autopadre: "https://www.autopadre.com",
    carsdirect: "https://www.carsdirect.com",
    usnews: "https://cars.usnews.com",
    caranddriver: "https://www.caranddriver.com",
    thecarconnection: "https://www.thecarconnection.com",
    bmw_dealer: "https://www.bmwusa.com",
    mercedes_dealer: "https://www.mbusa.com",
    audi_dealer: "https://www.audiusa.com",
    skoda_official: "https://www.skoda-auto.com",
    vw_official: "https://www.volkswagen.com",
    hyundai_dealer: "https://www.hyundaiusa.com",
    volvo_dealer: "https://www.volvocars.com",
    truecar: "https://www.truecar.com",
    motortrend: "https://www.motortrend.com",
  };
  return urls[source] || `scraped:${source}`;
}

importInteriorDimensions().catch(console.error);
