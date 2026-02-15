import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
import { saveComparisonSchema, uuidSchema, validateBody } from "@/lib/validators";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("saved_comparisons")
      .select("id, name, generation_ids, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError(error, { endpoint: "/api/saved-comparisons" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-comparisons" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const result = await validateBody(request, saveComparisonSchema);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { name, generation_ids } = result.data;

    const { data, error } = await supabase
      .from("saved_comparisons")
      .insert({
        user_id: user.id,
        name,
        generation_ids,
      })
      .select("id")
      .single();

    if (error) {
      logError(error, { endpoint: "/api/saved-comparisons" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-comparisons" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = uuidSchema.safeParse(body?.id);

    if (!parsed.success) {
      return NextResponse.json({ error: "id UUID invalide" }, { status: 400 });
    }

    const { error } = await supabase
      .from("saved_comparisons")
      .delete()
      .eq("id", parsed.data)
      .eq("user_id", user.id);

    if (error) {
      logError(error, { endpoint: "/api/saved-comparisons" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-comparisons" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
