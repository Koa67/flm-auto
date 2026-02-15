import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const anonId = cookieStore.get("flm_user_id")?.value;

    if (!anonId) {
      return NextResponse.json({ merged: 0 });
    }

    // Get anonymous wishlist items
    const { data: anonItems } = await supabase
      .from("wishlists")
      .select("id, generation_id")
      .eq("user_id", anonId)
      .is("auth_user_id", null);

    if (!anonItems || anonItems.length === 0) {
      return NextResponse.json({ merged: 0 });
    }

    // Get existing auth wishlist to avoid duplicates
    const { data: authItems } = await supabase
      .from("wishlists")
      .select("generation_id")
      .eq("auth_user_id", user.id);

    const existingIds = new Set((authItems || []).map((i) => i.generation_id));

    let merged = 0;
    for (const item of anonItems) {
      if (existingIds.has(item.generation_id)) {
        // Delete duplicate anonymous record
        await supabase.from("wishlists").delete().eq("id", item.id);
      } else {
        // Claim anonymous record
        await supabase
          .from("wishlists")
          .update({ auth_user_id: user.id })
          .eq("id", item.id);
        merged++;
      }
    }

    return NextResponse.json({ merged });
  } catch (err) {
    logError(err, { endpoint: "/api/wishlist/merge" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
