import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generation_id");
  if (!generationId) {
    return NextResponse.json({ error: "generation_id required" }, { status: 400 });
  }

  const db = createStaticClient();

  // Fetch interior dimensions (trunk volumes)
  const { data: dims } = await db
    .from("interior_dimensions")
    .select("trunk_volume_liters, trunk_volume_max_liters, frunk_volume_liters, fuel_tank_liters, seating_capacity")
    .eq("generation_id", generationId)
    .limit(1);

  // Also check third_party_specs for additional trunk data
  const { data: specs } = await db
    .from("third_party_specs")
    .select("spec_type, spec_value")
    .eq("generation_id", generationId)
    .in("spec_type", [
      "trunk_volume_liters", "trunk_volume_max_liters",
      "cargo_volume_liters", "cargo_volume_max_liters",
      "vehicle_length_mm", "vehicle_width_mm", "vehicle_height_mm",
      "curb_weight_kg", "max_load_kg",
    ]);

  const dim = dims?.[0] || null;
  const specMap: Record<string, number> = {};
  for (const s of specs || []) {
    const val = parseFloat(String(s.spec_value));
    if (!isNaN(val)) specMap[s.spec_type] = val;
  }

  // Merge: prefer interior_dimensions, fall back to third_party_specs
  const trunkVolume = dim?.trunk_volume_liters || specMap["trunk_volume_liters"] || specMap["cargo_volume_liters"] || null;
  const trunkVolumeMax = dim?.trunk_volume_max_liters || specMap["trunk_volume_max_liters"] || specMap["cargo_volume_max_liters"] || null;

  return NextResponse.json({
    data: {
      trunk_volume_liters: trunkVolume,
      trunk_volume_max_liters: trunkVolumeMax,
      frunk_volume_liters: dim?.frunk_volume_liters || null,
      fuel_tank_liters: dim?.fuel_tank_liters || null,
      seating_capacity: dim?.seating_capacity || null,
      max_load_kg: specMap["max_load_kg"] || null,
      vehicle_length_mm: specMap["vehicle_length_mm"] || null,
      vehicle_width_mm: specMap["vehicle_width_mm"] || null,
    },
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
