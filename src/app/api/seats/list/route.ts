import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export async function GET() {
  const db = createStaticClient();

  const { data: seats, error } = await db
    .from("child_seats")
    .select("id, brand, model, seat_type, group_ece, width_mm, depth_mm, height_mm, weight_kg, isofix_compatible, belt_compatible, swivel, price_eur, adac_rating")
    .eq("is_active", true)
    .order("brand");

  if (error) {
    logError(error, { endpoint: "/api/seats/list" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // Group by seat_type
  const grouped: Record<string, typeof seats> = {};
  for (const seat of seats || []) {
    const type = seat.seat_type || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(seat);
  }

  return NextResponse.json({
    data: { seats: seats || [], grouped },
  }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
