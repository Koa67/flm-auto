import { NextRequest, NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = createStaticClient();

  const { data, error } = await db
    .from("generation_data_quality")
    .select("*")
    .eq("generation_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
