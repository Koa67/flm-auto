import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeQuery } from "@/lib/validators";
import { logError } from "@/lib/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/search
 * Search vehicles by query string — searches ALL generations in DB.
 *
 * Query params:
 * - q: search query (searches brand, model, generation)
 * - limit: max results (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawQuery = searchParams.get("q") || "";
  const query = sanitizeQuery(rawQuery, 200);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20") || 20, 50);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2).slice(0, 4);
    if (words.length === 0) {
      return NextResponse.json({ data: [], query, count: 0 });
    }

    // Use the first word as the primary DB filter via ilike on gen name/code,
    // then filter remaining words client-side across brand+model+gen.
    // This avoids the old .limit(500) approach that missed 88% of data.
    const primary = words[0];
    const pattern = `%${primary}%`;

    const { data, error } = await supabase
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
      .or(`name.ilike.${pattern},internal_code.ilike.${pattern}`)
      .limit(200);

    // Also search by model name — separate query because Supabase
    // doesn't support .or() across parent table fields easily.
    const { data: modelData } = await supabase
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
      .ilike("models.name", pattern)
      .limit(200);

    // Also search by brand name
    const { data: brandData } = await supabase
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
      .ilike("models.brands.name", pattern)
      .limit(200);

    if (error) {
      logError(error, { endpoint: "/api/search" });
    }

    // Merge and deduplicate results
    const seen = new Set<string>();
    const merged: typeof data = [];
    for (const row of [...(data || []), ...(modelData || []), ...(brandData || [])]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }

    // Filter by all search words across brand+model+gen fields
    const queryLower = query.toLowerCase();
    const filtered = merged.filter((gen) => {
      const brand = (gen.models as any).brands.name.toLowerCase();
      const model = (gen.models as any).name.toLowerCase();
      const genCode = (gen.internal_code || "").toLowerCase();
      const genName = (gen.name || "").toLowerCase();
      const combined = `${brand} ${model} ${genCode} ${genName}`;
      return words.every(w => combined.includes(w));
    });

    // Format and sort results
    const results = filtered
      .map((gen) => {
        const brand = (gen.models as any).brands.name;
        const model = (gen.models as any).name;
        const genCode = gen.internal_code || gen.name;

        return {
          id: gen.id,
          label: `${brand} ${model} ${genCode}`,
          brand,
          model,
          generation: genCode,
          slug: `${(gen.models as any).brands.slug}/${(gen.models as any).slug}/${gen.slug}`,
          year_start: gen.production_start
            ? new Date(gen.production_start).getFullYear()
            : null,
          year_end: gen.production_end
            ? new Date(gen.production_end).getFullYear()
            : null,
        };
      })
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.label.toLowerCase().startsWith(queryLower)
          ? 0
          : a.model.toLowerCase().startsWith(queryLower)
            ? 1
            : a.brand.toLowerCase().startsWith(queryLower)
              ? 2
              : 3;
        const bExact = b.label.toLowerCase().startsWith(queryLower)
          ? 0
          : b.model.toLowerCase().startsWith(queryLower)
            ? 1
            : b.brand.toLowerCase().startsWith(queryLower)
              ? 2
              : 3;
        return aExact - bExact;
      })
      .slice(0, limit);

    return NextResponse.json({
      data: results,
      query,
      count: results.length,
    });
  } catch (err) {
    logError(err, { endpoint: "/api/search" });
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}
