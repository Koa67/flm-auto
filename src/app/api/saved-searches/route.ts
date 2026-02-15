import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
import { saveSearchSchema, uuidSchema, validateBody } from "@/lib/validators";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("saved_searches")
      .select("id, name, query, filters, result_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError(error, { endpoint: "/api/saved-searches" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-searches" });
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

    const result = await validateBody(request, saveSearchSchema);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { name, query, filters, result_count } = result.data;

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name,
        query,
        filters,
        result_count,
      })
      .select("id")
      .single();

    if (error) {
      logError(error, { endpoint: "/api/saved-searches" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-searches" });
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
      .from("saved_searches")
      .delete()
      .eq("id", parsed.data)
      .eq("user_id", user.id);

    if (error) {
      logError(error, { endpoint: "/api/saved-searches" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError(err, { endpoint: "/api/saved-searches" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
