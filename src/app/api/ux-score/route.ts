import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generation_id");
  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id required" },
      { status: 400 }
    );
  }

  const db = createStaticClient();

  const { data: rating, error } = await db
    .from("ux_ratings")
    .select("*")
    .eq("generation_id", generationId)
    .single();

  if (error && error.code !== "PGRST116") {
    logError(error, { endpoint: "/api/ux-score" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(
    { data: rating || null },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
