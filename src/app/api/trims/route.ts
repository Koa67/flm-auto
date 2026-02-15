import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generation_id");
  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id required" },
      { status: 400 }
    );
  }

  const db = createStaticClient();

  // Fetch trims for this generation
  const { data: trims, error: trimErr } = await db
    .from("trims")
    .select("id, name, marketing_name, base_price, is_base_trim, sort_order, summary_fr")
    .eq("generation_id", generationId)
    .order("sort_order");

  if (trimErr) {
    return NextResponse.json({ error: trimErr.message }, { status: 500 });
  }

  if (!trims || trims.length === 0) {
    return NextResponse.json({ data: { trims: [], equipment: [], trim_equipment: [] } });
  }

  const trimIds = trims.map((t) => t.id);

  // Fetch equipment linked to these trims
  const { data: trimEquipment } = await db
    .from("trim_equipment")
    .select("trim_id, equipment_id, status, option_price, pack_name")
    .in("trim_id", trimIds);

  // Fetch all equipment
  const { data: equipment } = await db
    .from("equipment")
    .select("id, name, name_fr, category, description_fr, is_essential")
    .order("category");

  return NextResponse.json(
    {
      data: {
        trims: trims || [],
        equipment: equipment || [],
        trim_equipment: trimEquipment || [],
      },
    },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
