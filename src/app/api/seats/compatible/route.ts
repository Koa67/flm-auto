import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generation_id");
  if (!generationId) {
    return NextResponse.json({ error: "generation_id required" }, { status: 400 });
  }

  const db = createStaticClient();

  // Fetch compatibility data with child seat details
  const { data: compat, error: compatErr } = await db
    .from("child_seat_vehicle_compatibility")
    .select("child_seat_id, position, compatible, fit_rating, notes")
    .eq("generation_id", generationId);

  if (compatErr) {
    return NextResponse.json({ error: compatErr.message }, { status: 500 });
  }

  // Fetch all child seats
  const { data: seats } = await db
    .from("child_seats")
    .select("id, brand, model, seat_type, group_ece, width_mm, depth_mm, height_mm, weight_kg, isofix_compatible, belt_compatible, swivel, price_eur, adac_rating")
    .eq("is_active", true)
    .order("brand");

  // Fetch bench data from family_fit_compatibility
  const { data: familyFit } = await db
    .from("family_fit_compatibility")
    .select("isofix_points, isofix_positions, center_isofix, rear_bench_width_usable_mm, rear_bench_width_total_mm, three_across_possible, three_across_fit_score")
    .eq("generation_id", generationId)
    .limit(1);

  const bench = familyFit?.[0] || null;

  // Group compatibility by seat ID → { position → { compatible, fit_rating } }
  const compatMap: Record<string, Record<string, { compatible: boolean; fit_rating: string | null }>> = {};
  for (const c of compat || []) {
    if (!compatMap[c.child_seat_id]) compatMap[c.child_seat_id] = {};
    compatMap[c.child_seat_id][c.position] = {
      compatible: c.compatible,
      fit_rating: c.fit_rating,
    };
  }

  // Enrich seats with per-position compatibility
  const enrichedSeats = (seats || []).map((s) => ({
    ...s,
    positions: {
      rear_left: compatMap[s.id]?.rear_left || null,
      rear_center: compatMap[s.id]?.rear_center || null,
      rear_right: compatMap[s.id]?.rear_right || null,
    },
  }));

  return NextResponse.json({
    data: {
      bench: bench
        ? {
            width_usable_mm: bench.rear_bench_width_usable_mm,
            width_total_mm: bench.rear_bench_width_total_mm,
            isofix_points: bench.isofix_points,
            isofix_positions: bench.isofix_positions || [],
            center_isofix: bench.center_isofix,
            three_across_possible: bench.three_across_possible,
            three_across_fit_score: bench.three_across_fit_score,
          }
        : null,
      seats: enrichedSeats,
      total_compatibility_records: (compat || []).length,
    },
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
