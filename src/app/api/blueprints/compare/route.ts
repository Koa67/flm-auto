import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/validators";

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(isValidUUID).slice(0, 4);
  if (ids.length < 2) {
    return NextResponse.json({ error: "Need at least 2 valid IDs" }, { status: 400 });
  }

  const db = createStaticClient();

  // Get generation info
  const { data: gens } = await db
    .from("generations")
    .select("id, name, internal_code, models!inner(name, brands!inner(name))")
    .in("id", ids);

  // Get exterior_dimensions raw_data for all
  const { data: specs } = await db
    .from("third_party_specs")
    .select("generation_id, raw_data")
    .in("generation_id", ids)
    .eq("spec_type", "exterior_dimensions");

  const vehicles = (gens || []).map((g) => {
    const spec = specs?.find((s) => s.generation_id === g.id);
    const raw = spec?.raw_data;
    const ext = typeof raw === "string" ? JSON.parse(raw) : raw;
    const m = g.models as any;

    return {
      id: g.id,
      label: `${m.brands.name} ${m.name} ${g.internal_code || g.name}`,
      length_mm: ext?.length_mm || null,
      width_mm: ext?.width_mm || null,
      height_mm: ext?.height_mm || null,
      wheelbase_mm: ext?.wheelbase_mm || null,
      ground_clearance_mm: ext?.ground_clearance_mm || null,
    };
  });

  return NextResponse.json({ vehicles });
}
