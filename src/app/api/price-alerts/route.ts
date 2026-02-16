import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
import {
  priceAlertCreateSchema,
  uuidSchema,
  validateBody,
} from "@/lib/validators";
import { logError } from "@/lib/logger";

async function requireAuth() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase, email: null };
  return { user, supabase, email: user.email! };
}

export async function POST(request: Request) {
  try {
    const { user, supabase, email } = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const result = await validateBody(request, priceAlertCreateSchema);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { generation_id, target_price_eur, alert_type } = result.data;

    const { data, error } = await supabase
      .from("price_alerts")
      .insert({
        email,
        generation_id,
        target_price_eur: target_price_eur || null,
        alert_type,
      })
      .select("id, created_at")
      .single();

    if (error) {
      logError(error, { endpoint: "/api/price-alerts" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alert_id: data.id,
      message: "Alerte créée avec succès",
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { user, supabase, email } = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("price_alerts")
      .select(
        `id, target_price_eur, alert_type, is_active, created_at,
         generations!inner(id, name, internal_code, slug, models!inner(name, slug, brands!inner(name, slug)))`
      )
      .eq("email", email)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      logError(error, { endpoint: "/api/price-alerts" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ alerts: data || [] });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, supabase, email } = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("id");

    const parsed = uuidSchema.safeParse(alertId);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "id UUID invalide" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("price_alerts")
      .update({ is_active: false })
      .eq("id", parsed.data)
      .eq("email", email);

    if (error) {
      logError(error, { endpoint: "/api/price-alerts" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
