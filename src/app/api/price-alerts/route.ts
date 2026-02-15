import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import {
  priceAlertCreateSchema,
  uuidSchema,
  emailSchema,
  validateBody,
} from "@/lib/validators";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const result = await validateBody(request, priceAlertCreateSchema);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { email, generation_id, target_price_eur, alert_type } = result.data;
    const db = createStaticClient();

    const { data, error } = await db
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawEmail = searchParams.get("email");

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "email invalide" },
      { status: 400 }
    );
  }

  const db = createStaticClient();

  const { data, error } = await db
    .from("price_alerts")
    .select(
      `id, target_price_eur, alert_type, is_active, created_at,
       generations!inner(id, name, internal_code, slug, models!inner(name, slug, brands!inner(name, slug)))`
    )
    .eq("email", parsed.data)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    logError(error, { endpoint: "/api/price-alerts" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ alerts: data || [] });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("id");

  const parsed = uuidSchema.safeParse(alertId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "id UUID invalide" },
      { status: 400 }
    );
  }

  const db = createStaticClient();

  const { error } = await db
    .from("price_alerts")
    .update({ is_active: false })
    .eq("id", parsed.data);

  if (error) {
    logError(error, { endpoint: "/api/price-alerts" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
