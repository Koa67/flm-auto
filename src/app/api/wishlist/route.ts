import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createAuthServerClient } from "@/lib/supabase/server";
import { wishlistBodySchema, uuidSchema } from "@/lib/validators";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUserId(): Promise<{ userId: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get("flm_user_id")?.value;
  if (existing) return { userId: existing, isNew: false };
  const userId = crypto.randomUUID();
  return { userId, isNew: true };
}

function setUserCookie(response: NextResponse, userId: string) {
  response.cookies.set("flm_user_id", userId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
  return response;
}

async function getAuthUser() {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * GET /api/wishlist
 */
export async function GET() {
  const authUser = await getAuthUser();

  if (authUser) {
    try {
      const { data, error } = await supabase
        .from("wishlists")
        .select("generation_id, notes, priority, created_at")
        .eq("auth_user_id", authUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Wishlist GET error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
      }
      return NextResponse.json({ data: data || [] });
    } catch (err) {
      console.error("Wishlist GET error:", err);
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
  }

  // Anonymous fallback
  const { userId, isNew } = await getUserId();
  if (isNew) {
    const res = NextResponse.json({ data: [] });
    return setUserCookie(res, userId);
  }

  try {
    const { data, error } = await supabase
      .from("wishlists")
      .select("generation_id, notes, priority, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Wishlist GET error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("Wishlist GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * POST /api/wishlist
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  const { userId, isNew } = await getUserId();

  try {
    const body = await request.json();
    const parsed = wishlistBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { generation_id, notes, priority } = parsed.data;

    const record: Record<string, unknown> = {
      user_id: userId,
      generation_id,
      notes: notes || null,
      priority: priority ?? 0,
    };

    if (authUser) {
      record.auth_user_id = authUser.id;
    }

    const { error } = await supabase
      .from("wishlists")
      .upsert(record, { onConflict: "user_id,generation_id" });

    if (error) {
      console.error("Wishlist POST error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    if (isNew) setUserCookie(res, userId);
    return res;
  } catch (err) {
    console.error("Wishlist POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * DELETE /api/wishlist
 */
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser();

  try {
    const body = await request.json();
    const parsed = uuidSchema.safeParse(body?.generation_id);

    if (!parsed.success) {
      return NextResponse.json({ error: "generation_id invalide" }, { status: 400 });
    }

    const generation_id = parsed.data;

    if (authUser) {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("auth_user_id", authUser.id)
        .eq("generation_id", generation_id);

      if (error) {
        console.error("Wishlist DELETE error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // Anonymous fallback
    const { userId, isNew } = await getUserId();
    if (isNew) return NextResponse.json({ ok: true });

    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("user_id", userId)
      .eq("generation_id", generation_id);

    if (error) {
      console.error("Wishlist DELETE error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Wishlist DELETE error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
