import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generation_id");
  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id required" },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const { data: rating, error } = await db
    .from("ux_ratings")
    .select("*")
    .eq("generation_id", generationId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("UX score GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(
    { data: rating || null },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
