import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/wishlist/details?ids=uuid1,uuid2,...
 * Returns generation data (with brand, model, slug, image) for given IDs.
 * Max 50 IDs per request.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids") || "";

  if (!idsParam) {
    return NextResponse.json({ data: [] });
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ data: [] });
  }

  try {
    // Fetch generations with model/brand info
    const { data: generations, error: genError } = await supabase
      .from("generations")
      .select(
        `
        id,
        name,
        slug,
        internal_code,
        production_start,
        production_end,
        models!inner (
          id,
          name,
          slug,
          brands!inner (
            id,
            name,
            slug
          )
        )
      `
      )
      .in("id", ids);

    if (genError) {
      logError(genError, { endpoint: "/api/wishlist/details" });
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    if (!generations || generations.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch one image per generation (exterior preferred)
    const genIds = generations.map((g) => g.id);
    const { data: images } = await supabase
      .from("vehicle_images")
      .select("generation_id, url, image_type")
      .in("generation_id", genIds)
      .in("image_type", ["exterior", "press", "stock"])
      .limit(200);

    // Build a map: generation_id -> first image URL
    const imageMap = new Map<string, string>();
    for (const img of images || []) {
      if (!imageMap.has(img.generation_id)) {
        imageMap.set(img.generation_id, img.url);
      }
    }

    // Transform response, preserving the order of the input IDs
    const genMap = new Map(generations.map((g) => [g.id, g]));
    const data = ids
      .map((id) => {
        const gen = genMap.get(id);
        if (!gen) return null;
        const model = gen.models as any;
        const brand = model.brands;
        return {
          id: gen.id,
          brand: brand.name,
          brand_slug: brand.slug,
          model: model.name,
          model_slug: model.slug,
          generation: gen.internal_code || gen.name,
          generation_slug: gen.slug,
          year_start: gen.production_start
            ? new Date(gen.production_start).getFullYear()
            : null,
          year_end: gen.production_end
            ? new Date(gen.production_end).getFullYear()
            : null,
          image: imageMap.get(gen.id) || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ data });
  } catch (err) {
    logError(err, { endpoint: "/api/wishlist/details" });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
