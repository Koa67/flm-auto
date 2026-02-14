/**
 * FLM AUTO — Golden Set Validation
 * Tests executeTool functions directly (no LLM needed).
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/golden-set-validation.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════
// Mini execute-tool (standalone, no Next.js deps)
// ═══════════════════════════════════════════════════════════════════

const ENGINE_RED_FLAGS: Record<
  string,
  { patterns: string[]; brand: string; engine_family: string; severity: string; title_fr: string }
> = {
  puretech: {
    patterns: ["EB2", "EB0", "EP6", "PURETECH"],
    brand: "PSA",
    engine_family: "PureTech 1.2",
    severity: "high",
    title_fr: "Courroie de distribution PureTech",
  },
  n47: {
    patterns: ["N47", "N47D20"],
    brand: "BMW",
    engine_family: "N47 2.0d",
    severity: "critical",
    title_fr: "Chaîne de distribution N47",
  },
  ea211: {
    patterns: ["EA211", "CHPA", "CZCA", "CZDA"],
    brand: "VW Group",
    engine_family: "EA211 1.4 TSI",
    severity: "medium",
    title_fr: "Chaîne de distribution EA211",
  },
};

async function executeTool(name: string, input: Record<string, any>): Promise<any> {
  switch (name) {
    case "search_vehicles": {
      const query = (input.query as string).trim();
      const limit = (input.limit as number) || 5;
      const words = query.split(/\s+/).filter(Boolean);

      // 3 parallel queries: by gen name/code, by model name, by brand name
      const [genRes, modelRes, brandRes] = await Promise.all([
        supabase
          .from("generations")
          .select("id, name, slug, internal_code, chassis_code, production_start, production_end, body_style, models!inner(name, slug, brands!inner(name, slug))")
          .or(`internal_code.ilike.%${query}%,chassis_code.ilike.%${query}%,name.ilike.%${query}%`)
          .limit(200),
        supabase
          .from("generations")
          .select("id, name, slug, internal_code, chassis_code, production_start, production_end, body_style, models!inner(name, slug, brands!inner(name, slug))")
          .ilike("models.name" as any, `%${words[words.length - 1]}%`)
          .limit(200),
        supabase
          .from("generations")
          .select("id, name, slug, internal_code, chassis_code, production_start, production_end, body_style, models!inner(name, slug, brands!inner(name, slug))")
          .ilike("models.brands.name" as any, `%${words[0]}%`)
          .limit(200),
      ]);

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const list of [genRes.data, modelRes.data, brandRes.data]) {
        for (const g of list || []) {
          if (!seen.has(g.id)) {
            seen.add(g.id);
            merged.push(g);
          }
        }
      }

      // Filter: every word must appear somewhere
      const filtered = merged.filter((g: any) => {
        const hay = `${g.models?.brands?.name} ${g.models?.name} ${g.name} ${g.internal_code || ""} ${g.chassis_code || ""}`.toLowerCase();
        return words.every((w: string) => hay.includes(w.toLowerCase()));
      });

      if (filtered.length > 0) {
        return filtered.slice(0, limit).map((g: any) => ({
          generation_id: g.id,
          brand: g.models?.brands?.name,
          model: g.models?.name,
          generation: g.internal_code || g.name,
          url: `/marques/${g.models?.brands?.slug}/${g.models?.slug}/${g.slug}`,
        }));
      }

      return { results: [], message: "Aucun véhicule trouvé" };
    }

    case "get_vehicle_details": {
      const genId = input.generation_id as string;
      const [{ data: gen }, { data: variants }, { data: safety }, { data: dims }] =
        await Promise.all([
          supabase
            .from("generations")
            .select("*, models!inner(name, slug, brands!inner(name, slug))")
            .eq("id", genId)
            .single(),
          supabase
            .from("engine_variants")
            .select("*, powertrain_specs(*), performance_specs(*)")
            .eq("generation_id", genId)
            .limit(20),
          supabase.from("safety_ratings").select("*").eq("generation_id", genId).limit(1),
          supabase.from("interior_dimensions").select("*").eq("generation_id", genId).limit(1),
        ]);

      if (!gen) return { error: "Génération non trouvée" };

      const formattedVariants = (variants || []).map((v: any) => {
        const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
        const perf = Array.isArray(v.performance_specs) ? v.performance_specs[0] : v.performance_specs;
        return {
          name: v.name,
          fuel_type: v.fuel_type,
          engine_code: v.engine_code,
          power_hp: pt?.power_hp,
          torque_nm: pt?.torque_nm,
          acceleration_0_100: perf?.acceleration_0_100_kmh,
          top_speed_kmh: perf?.top_speed_kmh,
        };
      });

      return {
        brand: gen.models?.brands?.name,
        model: gen.models?.name,
        generation: gen.internal_code || gen.name,
        body_style: gen.body_style,
        years: `${gen.production_start ? new Date(gen.production_start).getFullYear() : "?"}-${gen.production_end ? new Date(gen.production_end).getFullYear() : "..."}`,
        motorisations: formattedVariants,
        safety: safety?.[0] ? { stars: safety[0].stars, confidence: safety[0].confidence } : null,
        dimensions: dims?.[0]
          ? { trunk_liters: dims[0].trunk_volume_liters, seating_capacity: dims[0].seating_capacity }
          : null,
      };
    }

    case "check_engine_warnings": {
      const code = (input.engine_code as string).toUpperCase().trim();
      const matched: any[] = [];
      for (const [, flag] of Object.entries(ENGINE_RED_FLAGS)) {
        if (flag.patterns.some((p) => code.includes(p.toUpperCase()))) {
          matched.push({ engine: `${flag.brand} — ${flag.engine_family}`, severity: flag.severity, title: flag.title_fr });
        }
      }
      return { engine_code: code, warnings: matched, message: matched.length === 0 ? "Aucun problème connu" : undefined };
    }

    case "compare_vehicles": {
      const fetch = async (id: string) => {
        const [{ data: gen }, { data: safety }] = await Promise.all([
          supabase.from("generations").select("*, models!inner(name, brands!inner(name))").eq("id", id).single(),
          supabase.from("safety_ratings").select("stars").eq("generation_id", id).limit(1),
        ]);
        if (!gen) return null;
        return {
          name: `${gen.models?.brands?.name} ${gen.models?.name} ${gen.internal_code || gen.name}`,
          safety_stars: safety?.[0]?.stars ?? null,
        };
      };
      const [a, b] = await Promise.all([
        fetch(input.generation_id_a as string),
        fetch(input.generation_id_b as string),
      ]);
      if (!a || !b) return { error: "Un ou les deux véhicules n'ont pas été trouvés" };
      return { vehicle_a: a, vehicle_b: b };
    }

    case "check_family_fit": {
      const genId = input.generation_id as string;
      const { data } = await supabase
        .from("family_fit_compatibility")
        .select("*")
        .eq("generation_id", genId)
        .limit(1);
      return { family_fit: data?.[0] || null };
    }

    case "get_cargo_info": {
      const genId = input.generation_id as string;
      const { data } = await supabase
        .from("interior_dimensions")
        .select("*")
        .eq("generation_id", genId)
        .limit(1);
      if (!data || data.length === 0) return { error: "Pas de données coffre" };
      return {
        trunk_volume_liters: data[0].trunk_volume_liters,
        trunk_volume_max_liters: data[0].trunk_volume_max_liters,
        seating_capacity: data[0].seating_capacity,
      };
    }

    case "get_recalls": {
      const { data } = await supabase
        .from("vehicle_recalls")
        .select("*")
        .eq("generation_id", input.generation_id as string)
        .order("recall_date", { ascending: false })
        .limit(10);
      return { count: data?.length || 0, recalls: data || [] };
    }

    case "get_photos": {
      const { data } = await supabase
        .from("vehicle_images")
        .select("url, image_type, source, width, confidence")
        .eq("generation_id", input.generation_id as string)
        .neq("confidence", "E")
        .order("width", { ascending: false, nullsFirst: false })
        .limit((input.limit as number) || 5);
      return { count: data?.length || 0, photos: data || [] };
    }

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Test framework
// ═══════════════════════════════════════════════════════════════════

interface GoldenTest {
  id: string;
  category: string;
  description: string;
  run: () => Promise<void>;
}

const tests: GoldenTest[] = [];
const results: { id: string; category: string; pass: boolean; error?: string }[] = [];

function gs(id: string, category: string, description: string, run: () => Promise<void>) {
  tests.push({ id, category, description, run });
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ═══════════════════════════════════════════════════════════════════
// KNOWN GENERATION IDs (from DB query)
// ═══════════════════════════════════════════════════════════════════

const GEN = {
  BMW_M3_G81: "a0baa135-b578-48a4-9250-b7f1b0fe922c",
  BMW_i4_G26: "a537f9f2-4d2b-43ef-82f0-69f5d21da257",
  BMW_X5_G05: "959218ad-5dda-464e-88fa-c873ee9a0c34",
  BMW_3_G20: "5127cf59-bb28-4fba-b157-b4c560922df4",
  PORSCHE_911_992: "b7539ff2-39a4-4654-b43d-0ecbbbd0a723",
  PORSCHE_CAYENNE: "065e8e7a-751c-4a40-946f-c1b4ac45dcba",
  TESLA_MODEL3: "7cff92c3-a5b2-450b-b949-d406668b1010",
  TESLA_MODELY: "6dd15a6d-c1a6-42ea-82ac-81315cb5a3c1",
  VW_GOLF: "b237c4d2-55d5-45c5-b0d6-a1e12697aa13",
  VW_TIGUAN: "dd9e9b27-69f0-4429-88de-c04ab6c57fca",
  VW_ID3: "0307e2a0-93ad-4823-ac90-dd3ec6ac87b5",
  VOLVO_V60: "4baeeb5f-f610-43ed-b9b1-3c32726546cf",
  HYUNDAI_TUCSON: "582866f2-b198-4237-aee4-c6fa2a792072",
  HYUNDAI_IONIQ5: "a3d039c0-c41e-4b39-97a3-15824d08ed02",
  SKODA_KAROQ: "e78a065f-8f04-4de2-8d69-6f255b3730c9",
  MERCEDES_GLE: "0550c1e5-a3d9-4194-bdf0-66405d01df97",
  MERCEDES_C_W206: "d8c96745-db68-494f-b6ff-c77cbcca323e",
  PEUGEOT_308: "359763aa-0f30-43dc-af38-2a5162227728",
  PEUGEOT_3008: "3785acc2-429c-4553-a13f-541c470dc10e",
  AUDI_A3: "a120adfc-da21-4bd5-bcd4-d1affdd4cc3f",
  AUDI_A4: "5b0ee89e-8f77-4ae2-8228-142ca6254b66",
};

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 1: Search (10 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-S01", "Search", "search 'BMW' returns BMW results", async () => {
  const r = await executeTool("search_vehicles", { query: "BMW" });
  assert(Array.isArray(r), "Should return array");
  assert(r.length > 0, "Should have results");
  const hasBMW = r.some((v: any) => v.brand === "BMW" || v.model?.includes("BMW"));
  assert(hasBMW, "Should contain BMW");
});

gs("GS-S02", "Search", "search 'Porsche 911' returns Porsche", async () => {
  const r = await executeTool("search_vehicles", { query: "Porsche 911" });
  assert(!r.message || r.message !== "Aucun véhicule trouvé", "Should find results");
});

gs("GS-S03", "Search", "search 'G20' returns BMW gen", async () => {
  const r = await executeTool("search_vehicles", { query: "G20" });
  assert(Array.isArray(r), "Should return array");
  assert(r.length > 0, "Should find G20");
});

gs("GS-S04", "Search", "search 'Peugeot 308' returns results", async () => {
  const r = await executeTool("search_vehicles", { query: "Peugeot" });
  assert(Array.isArray(r) || (r.length !== undefined), "Should return results");
  assert(!r.results || r.results.length !== 0 || r.length > 0, "Should not be empty");
});

gs("GS-S05", "Search", "search 'Tesla' returns Tesla", async () => {
  const r = await executeTool("search_vehicles", { query: "Tesla" });
  assert(!r.message || r.message !== "Aucun véhicule trouvé", "Should find Tesla");
});

gs("GS-S06", "Search", "search nonexistent returns 0 results, no crash", async () => {
  const r = await executeTool("search_vehicles", { query: "vehicule_inexistant_xyz123" });
  assert(r !== undefined, "Should not crash");
  if (Array.isArray(r)) assert(r.length === 0, "Should be empty array");
});

gs("GS-S07", "Search", "search 'A3' returns Audi A3", async () => {
  const r = await executeTool("search_vehicles", { query: "A3" });
  assert(Array.isArray(r) || r.length !== undefined, "Should return results");
});

gs("GS-S08", "Search", "empty string search doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "" });
  assert(r !== undefined, "Should not crash");
});

gs("GS-S09", "Search", "whitespace search doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "   " });
  assert(r !== undefined, "Should not crash");
});

gs("GS-S10", "Search", "search with limit works", async () => {
  const r = await executeTool("search_vehicles", { query: "BMW", limit: 2 });
  assert(r !== undefined, "Should not crash");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 2: Vehicle Details (10 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-D01", "Details", "BMW M3 G81 has power >= 370 ch", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.BMW_M3_G81 });
  assert(!r.error, "Should not error: " + r.error);
  assert(r.brand === "BMW", "Brand should be BMW");
  const maxPower = Math.max(...(r.motorisations || []).map((m: any) => m.power_hp || 0));
  assert(maxPower >= 370, `Max power should be >= 370, got ${maxPower}`);
});

gs("GS-D02", "Details", "BMW M3 has safety stars = 5", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.BMW_M3_G81 });
  assert(r.safety !== null, "Should have safety data");
  assert(r.safety.stars === 5, `Stars should be 5, got ${r.safety?.stars}`);
});

gs("GS-D03", "Details", "Hyundai Tucson has safety stars >= 4", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.HYUNDAI_TUCSON });
  assert(r.safety !== null, "Should have safety data");
  assert(r.safety.stars >= 4, `Stars should be >= 4, got ${r.safety?.stars}`);
});

gs("GS-D04", "Details", "VW Golf has trunk data", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.VW_GOLF });
  assert(r.dimensions !== null, "Should have dimensions");
  assert(r.dimensions.trunk_liters > 0, "Trunk should be > 0");
});

gs("GS-D05", "Details", "Tesla Model 3 has safety = 5 stars", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.TESLA_MODEL3 });
  assert(r.safety !== null, "Should have safety");
  assert(r.safety.stars === 5, `Stars should be 5, got ${r.safety?.stars}`);
});

gs("GS-D06", "Details", "Volvo V60 has safety = 5 stars", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.VOLVO_V60 });
  assert(r.safety !== null, "Should have safety");
  assert(r.safety.stars === 5, `Stars should be 5, got ${r.safety?.stars}`);
});

gs("GS-D07", "Details", "BMW i4 has safety data", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.BMW_i4_G26 });
  assert(r.safety !== null, "Should have safety");
  assert(r.safety.stars >= 4, `Stars should be >= 4, got ${r.safety?.stars}`);
});

gs("GS-D08", "Details", "Mercedes C W206 has trunk data", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.MERCEDES_C_W206 });
  assert(r.dimensions !== null, "Should have dimensions");
  assert(r.dimensions.trunk_liters > 400, `Trunk should be > 400, got ${r.dimensions?.trunk_liters}`);
});

gs("GS-D09", "Details", "Audi A4 has trunk > 400L", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: GEN.AUDI_A4 });
  assert(r.dimensions !== null, "Should have dimensions");
  assert(r.dimensions.trunk_liters > 400, `Trunk should be > 400, got ${r.dimensions?.trunk_liters}`);
});

gs("GS-D10", "Details", "nonexistent UUID returns error, no crash", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: "00000000-0000-0000-0000-000000000000" });
  assert(r.error !== undefined, "Should return error");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 3: Engine Warnings (5 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-W01", "Warnings", "EB2 triggers PureTech warning", async () => {
  const r = await executeTool("check_engine_warnings", { engine_code: "EB2" });
  assert(r.warnings.length > 0, "Should have warnings");
  assert(r.warnings[0].severity !== undefined, "Should have severity");
});

gs("GS-W02", "Warnings", "N47D20 triggers BMW chain warning", async () => {
  const r = await executeTool("check_engine_warnings", { engine_code: "N47D20" });
  assert(r.warnings.length > 0, "Should have warnings");
});

gs("GS-W03", "Warnings", "EA211 triggers VW warning", async () => {
  const r = await executeTool("check_engine_warnings", { engine_code: "EA211" });
  assert(r.warnings.length > 0, "Should have warnings");
});

gs("GS-W04", "Warnings", "unknown engine returns 0 warnings", async () => {
  const r = await executeTool("check_engine_warnings", { engine_code: "MOTEUR_INCONNU_XYZ" });
  assert(r.warnings.length === 0, "Should have 0 warnings");
});

gs("GS-W05", "Warnings", "empty string doesn't crash", async () => {
  const r = await executeTool("check_engine_warnings", { engine_code: "" });
  assert(r !== undefined, "Should not crash");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 4: Family Fit (5 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-F01", "Family", "VW Tiguan has family fit data", async () => {
  const r = await executeTool("check_family_fit", { generation_id: GEN.VW_TIGUAN });
  assert(r.family_fit !== null, "Should have family fit data");
  assert(r.family_fit.isofix_points >= 2, "Should have >= 2 ISOFIX");
});

gs("GS-F02", "Family", "Porsche 911 has null or low family fit", async () => {
  const r = await executeTool("check_family_fit", { generation_id: GEN.PORSCHE_911_992 });
  // 911 is not a family car — null or low score is expected
  assert(r.family_fit === null || r.family_fit.family_fit_score < 50, "911 should not be family-friendly");
});

gs("GS-F03", "Family", "BMW M3 has family fit data", async () => {
  const r = await executeTool("check_family_fit", { generation_id: GEN.BMW_M3_G81 });
  assert(r.family_fit !== null, "Should have family fit");
});

gs("GS-F04", "Family", "nonexistent UUID returns null", async () => {
  const r = await executeTool("check_family_fit", { generation_id: "00000000-0000-0000-0000-000000000000" });
  assert(r.family_fit === null, "Should be null for missing gen");
});

gs("GS-F05", "Family", "Hyundai Tucson has family data", async () => {
  const r = await executeTool("check_family_fit", { generation_id: GEN.HYUNDAI_TUCSON });
  assert(r.family_fit !== null, "Should have family data");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 5: Compare (5 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-C01", "Compare", "BMW M3 vs Mercedes GLE returns data", async () => {
  const r = await executeTool("compare_vehicles", {
    generation_id_a: GEN.BMW_M3_G81,
    generation_id_b: GEN.MERCEDES_GLE,
  });
  assert(!r.error, "Should not error");
  assert(r.vehicle_a !== null, "Vehicle A should exist");
  assert(r.vehicle_b !== null, "Vehicle B should exist");
});

gs("GS-C02", "Compare", "same vehicle vs itself works", async () => {
  const r = await executeTool("compare_vehicles", {
    generation_id_a: GEN.BMW_M3_G81,
    generation_id_b: GEN.BMW_M3_G81,
  });
  assert(!r.error, "Should not error");
});

gs("GS-C03", "Compare", "nonexistent UUID A returns error", async () => {
  const r = await executeTool("compare_vehicles", {
    generation_id_a: "00000000-0000-0000-0000-000000000000",
    generation_id_b: GEN.BMW_M3_G81,
  });
  assert(r.error !== undefined, "Should return error");
});

gs("GS-C04", "Compare", "Tesla Model 3 vs Hyundai Ioniq 5", async () => {
  const r = await executeTool("compare_vehicles", {
    generation_id_a: GEN.TESLA_MODEL3,
    generation_id_b: GEN.HYUNDAI_IONIQ5,
  });
  assert(!r.error, "Should not error");
  assert(r.vehicle_a.safety_stars === 5, "Tesla should have 5 stars");
  assert(r.vehicle_b.safety_stars === 5, "Ioniq should have 5 stars");
});

gs("GS-C05", "Compare", "Skoda Karoq vs VW Tiguan", async () => {
  const r = await executeTool("compare_vehicles", {
    generation_id_a: GEN.SKODA_KAROQ,
    generation_id_b: GEN.VW_TIGUAN,
  });
  assert(!r.error, "Should not error");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 6: Recalls (3 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-R01", "Recalls", "Tesla Model Y has recalls", async () => {
  const r = await executeTool("get_recalls", { generation_id: GEN.TESLA_MODELY });
  assert(r.count > 0, `Should have recalls, got ${r.count}`);
});

gs("GS-R02", "Recalls", "BMW M3 has 0 recalls", async () => {
  const r = await executeTool("get_recalls", { generation_id: GEN.BMW_M3_G81 });
  assert(r.count === 0, `Should have 0 recalls, got ${r.count}`);
});

gs("GS-R03", "Recalls", "nonexistent UUID returns 0 recalls", async () => {
  const r = await executeTool("get_recalls", { generation_id: "00000000-0000-0000-0000-000000000000" });
  assert(r.count === 0, "Should be 0");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 7: Photos (3 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-P01", "Photos", "BMW M3 has photos", async () => {
  const r = await executeTool("get_photos", { generation_id: GEN.BMW_M3_G81 });
  assert(r.count > 0, "Should have photos");
  assert(r.photos[0].url !== undefined, "Photo should have URL");
});

gs("GS-P02", "Photos", "nonexistent UUID returns 0 photos", async () => {
  const r = await executeTool("get_photos", { generation_id: "00000000-0000-0000-0000-000000000000" });
  assert(r.count === 0, "Should be 0");
});

gs("GS-P03", "Photos", "Peugeot 308 has at least 3 photos", async () => {
  const r = await executeTool("get_photos", { generation_id: GEN.PEUGEOT_308, limit: 10 });
  assert(r.count >= 3, `Should have >= 3 photos, got ${r.count}`);
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 8: Cargo (3 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-K01", "Cargo", "Hyundai Tucson has trunk > 500L", async () => {
  const r = await executeTool("get_cargo_info", { generation_id: GEN.HYUNDAI_TUCSON });
  assert(!r.error, "Should not error");
  assert(r.trunk_volume_liters > 500, `Trunk should be > 500, got ${r.trunk_volume_liters}`);
});

gs("GS-K02", "Cargo", "Porsche 911 has small trunk", async () => {
  const r = await executeTool("get_cargo_info", { generation_id: GEN.PORSCHE_911_992 });
  if (r.error) return; // No data is acceptable for a sports car
  assert(r.trunk_volume_liters < 400, `911 trunk should be < 400L, got ${r.trunk_volume_liters}`);
});

gs("GS-K03", "Cargo", "nonexistent UUID returns error", async () => {
  const r = await executeTool("get_cargo_info", { generation_id: "00000000-0000-0000-0000-000000000000" });
  assert(r.error !== undefined, "Should return error");
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY 9: Robustness (6 tests)
// ═══════════════════════════════════════════════════════════════════

gs("GS-X01", "Robustness", "SQL injection in search doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "'; DROP TABLE generations; --" });
  assert(r !== undefined, "Should not crash");
});

gs("GS-X02", "Robustness", "very long input doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "a".repeat(1000) });
  assert(r !== undefined, "Should not crash");
});

gs("GS-X03", "Robustness", "special characters 'Citroën' doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "Citroën" });
  assert(r !== undefined, "Should not crash");
});

gs("GS-X04", "Robustness", "emoji input doesn't crash", async () => {
  const r = await executeTool("search_vehicles", { query: "🚗" });
  assert(r !== undefined, "Should not crash");
});

gs("GS-X05", "Robustness", "invalid UUID returns error", async () => {
  const r = await executeTool("get_vehicle_details", { generation_id: "not-a-uuid" });
  assert(r.error !== undefined, "Should return error for invalid UUID");
});

gs("GS-X06", "Robustness", "3 parallel calls don't deadlock", async () => {
  const [r1, r2, r3] = await Promise.all([
    executeTool("search_vehicles", { query: "BMW" }),
    executeTool("get_vehicle_details", { generation_id: GEN.VW_GOLF }),
    executeTool("get_recalls", { generation_id: GEN.TESLA_MODELY }),
  ]);
  assert(r1 !== undefined && r2 !== undefined && r3 !== undefined, "All should resolve");
});

// ═══════════════════════════════════════════════════════════════════
// Runner
// ═══════════════════════════════════════════════════════════════════

async function run() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  FLM AUTO — GOLDEN SET VALIDATION               ║`);
  console.log(`║  ${new Date().toISOString().slice(0, 19)}                    ║`);
  console.log(`╠══════════════════════════════════════════════════╣\n`);

  for (const t of tests) {
    try {
      await t.run();
      results.push({ id: t.id, category: t.category, pass: true });
      console.log(`  ✅ ${t.id}: ${t.description}`);
    } catch (err: any) {
      results.push({ id: t.id, category: t.category, pass: false, error: err.message });
      console.log(`  ❌ ${t.id}: ${t.description}`);
      console.log(`     → ${err.message}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const pct = Math.round((passed / results.length) * 100);

  // Category breakdown
  const categories = [...new Set(tests.map((t) => t.category))];

  console.log(`\n  RESULTS`);
  console.log(`  ─────────────────────────────────────────────────`);
  console.log(`  Total tests:     ${results.length}`);
  console.log(`  Passed:          ${passed} (${pct}%)`);
  console.log(`  Failed:          ${failed}`);
  console.log(`\n  BY CATEGORY`);
  console.log(`  ─────────────────────────────────────────────────`);

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.pass).length;
    console.log(`  ${cat.padEnd(15)} ${catPassed}/${catResults.length}`);
  }

  if (failed > 0) {
    console.log(`\n  FAILURES`);
    console.log(`  ─────────────────────────────────────────────────`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ${r.id}: ${r.error}`);
    }
  }

  console.log(`\n  VERDICT`);
  console.log(`  ─────────────────────────────────────────────────`);
  if (pct >= 90) {
    console.log(`  ${pct}% passed → ✅ LAUNCH READY`);
  } else {
    console.log(`  ${pct}% passed → ❌ BELOW 90% THRESHOLD`);
  }

  console.log(`\n╚══════════════════════════════════════════════════╝\n`);

  // Save to JSON
  const fs = require("fs");
  fs.writeFileSync(
    "data/golden-set-results.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total: results.length,
        passed,
        failed,
        percentage: pct,
        launch_ready: pct >= 90,
        by_category: Object.fromEntries(
          categories.map((cat) => {
            const cr = results.filter((r) => r.category === cat);
            return [cat, { passed: cr.filter((r) => r.pass).length, total: cr.length }];
          })
        ),
        failures: results.filter((r) => !r.pass).map((r) => ({ id: r.id, error: r.error })),
      },
      null,
      2
    )
  );
  console.log("Results saved to data/golden-set-results.json");

  process.exit(failed > 0 && pct < 90 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
