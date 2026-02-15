import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get("generation_id");

  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id is required" },
      { status: 400 }
    );
  }

  const db = createStaticClient();

  // Get exterior dimensions from third_party_specs (stored as exterior_dimensions raw_data JSON)
  const { data: extSpec } = await db
    .from("third_party_specs")
    .select("raw_data")
    .eq("generation_id", generationId)
    .eq("spec_type", "exterior_dimensions")
    .limit(1);

  const raw = extSpec?.[0]?.raw_data;
  const ext = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Get interior_dimensions
  const { data: dims } = await db
    .from("interior_dimensions")
    .select("*")
    .eq("generation_id", generationId)
    .limit(1);

  const dim = dims?.[0];

  return NextResponse.json({
    length_mm: ext?.length_mm || null,
    width_mm: ext?.width_mm || null,
    width_mirrors_mm: ext?.width_with_mirrors_mm || null,
    height_mm: ext?.height_mm || null,
    wheelbase_mm: ext?.wheelbase_mm || null,
    ground_clearance_mm: ext?.ground_clearance_mm || null,
    trunk_volume_liters: dim?.trunk_volume_liters || null,
    trunk_volume_max_liters: dim?.trunk_volume_max_liters || null,
    frunk_volume_liters: dim?.frunk_volume_liters || null,
    fuel_tank_liters: dim?.fuel_tank_liters || null,
    seating_capacity: dim?.seating_capacity || null,
    front_headroom_mm: dim?.front_headroom_mm || null,
    rear_headroom_mm: dim?.rear_headroom_mm || null,
    front_legroom_mm: dim?.front_legroom_mm || null,
    rear_legroom_mm: dim?.rear_legroom_mm || null,
    front_shoulder_room_mm: dim?.front_shoulder_room_mm || null,
    rear_shoulder_room_mm: dim?.rear_shoulder_room_mm || null,
  });
}
