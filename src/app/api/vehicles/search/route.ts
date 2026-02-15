import { createStaticClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/logger";

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  brands: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  body_styles: z.array(z.string()).optional(),
  fuel_types: z.array(z.string()).optional(),
  power_min: z.number().min(0).optional(),
  power_max: z.number().max(3000).optional(),
  year_min: z.number().min(1886).optional(),
  year_max: z.number().max(2030).optional(),
  seats_min: z.number().min(2).max(9).optional(),
  isofix_min: z.number().min(0).max(4).optional(),
  three_across: z.boolean().optional(),
  ncap_min: z.number().min(1).max(5).optional(),
  trunk_min: z.number().min(0).optional(),
  sort: z
    .enum([
      "relevance",
      "power_desc",
      "power_asc",
      "year_desc",
      "year_asc",
      "trunk_desc",
      "safety_desc",
      "name_asc",
    ])
    .default("relevance"),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(24),
});

export type SearchFilters = z.infer<typeof searchSchema>;

const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  power_desc: { column: "power_hp", ascending: false },
  power_asc: { column: "power_hp", ascending: true },
  year_desc: { column: "year_start", ascending: false },
  year_asc: { column: "year_start", ascending: true },
  trunk_desc: { column: "trunk_volume_liters", ascending: false },
  safety_desc: { column: "ncap_stars", ascending: false },
  name_asc: { column: "brand_name", ascending: true },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Filtres invalides" }, { status: 400 });
    }

    const filters = parsed.data;
    const db = createStaticClient();
    const offset = (filters.page - 1) * filters.per_page;

    // Build query on vehicle_search_index
    let query = db
      .from("vehicle_search_index")
      .select("*", { count: "exact" });

    // Text search (trigram similarity via ilike on concatenated fields)
    if (filters.q) {
      const q = `%${filters.q}%`;
      query = query.or(
        `brand_name.ilike.${q},model_name.ilike.${q},generation_name.ilike.${q},internal_code.ilike.${q}`
      );
    }

    // Taxonomy filters
    if (filters.brands?.length) {
      query = query.in("brand_slug", filters.brands);
    }
    if (filters.segments?.length) {
      query = query.in("segment", filters.segments);
    }
    if (filters.body_styles?.length) {
      query = query.in("body_style", filters.body_styles);
    }
    if (filters.fuel_types?.length) {
      query = query.in("fuel_type", filters.fuel_types);
    }

    // Range filters
    if (filters.power_min != null) {
      query = query.gte("power_hp", filters.power_min);
    }
    if (filters.power_max != null) {
      query = query.lte("power_hp", filters.power_max);
    }
    if (filters.year_min != null) {
      query = query.gte("year_start", filters.year_min);
    }
    if (filters.year_max != null) {
      query = query.lte("year_start", filters.year_max);
    }

    // Family filters
    if (filters.isofix_min != null) {
      query = query.gte("isofix_points", filters.isofix_min);
    }
    if (filters.three_across === true) {
      query = query.eq("three_across", true);
    }

    // Safety
    if (filters.ncap_min != null) {
      query = query.gte("ncap_stars", filters.ncap_min);
    }

    // Trunk
    if (filters.trunk_min != null) {
      query = query.gte("trunk_volume_liters", filters.trunk_min);
    }

    // Sort
    const sortConfig = SORT_MAP[filters.sort];
    if (sortConfig) {
      query = query.order(sortConfig.column, {
        ascending: sortConfig.ascending,
        nullsFirst: false,
      });
    } else {
      // Relevance: prioritize vehicles with more data
      query = query
        .order("ncap_stars", { ascending: false, nullsFirst: false })
        .order("power_hp", { ascending: false, nullsFirst: false });
    }

    // Pagination
    query = query.range(offset, offset + filters.per_page - 1);

    const { data, count, error } = await query;

    if (error) {
      logError(error, { endpoint: "/api/vehicles/search" });
      return NextResponse.json({ error: "Erreur recherche" }, { status: 500 });
    }

    // Compute facets in parallel (counts on the unfiltered-by-that-dimension set)
    const facetQuery = db.from("vehicle_search_index").select("brand_slug, brand_name, fuel_type, segment, year_start, power_hp, ncap_stars");
    // We fetch a summary — for performance, limit to 5000 rows
    const { data: facetData } = await facetQuery.limit(5000);

    const facets = computeFacets(facetData || []);

    const results = (data || []).map((row: any) => ({
      generation_id: row.generation_id,
      brand: row.brand_name,
      brand_slug: row.brand_slug,
      model: row.model_name,
      model_slug: row.model_slug,
      generation: row.generation_name,
      generation_slug: row.generation_slug,
      internal_code: row.internal_code,
      year_start: row.year_start,
      year_end: row.year_end,
      body_style: row.body_style,
      thumbnail: row.thumbnail_url,
      specs: {
        power_hp: row.power_hp,
        fuel_type: row.fuel_type,
        trunk_volume_liters: row.trunk_volume_liters,
        ncap_rating: row.ncap_stars,
        acceleration_0_100: row.acceleration_0_100,
        top_speed_kmh: row.top_speed_kmh,
      },
    }));

    return NextResponse.json({
      results,
      total: count || 0,
      page: filters.page,
      per_page: filters.per_page,
      facets,
    });
  } catch (err) {
    logError(err, { endpoint: "/api/vehicles/search" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

function computeFacets(rows: any[]) {
  const brandCounts = new Map<string, { name: string; count: number }>();
  const fuelCounts = new Map<string, number>();
  const segmentCounts = new Map<string, number>();
  const ncapCounts = new Map<number, number>();
  let yearMin = 9999,
    yearMax = 0,
    powerMin = 99999,
    powerMax = 0;

  for (const row of rows) {
    // Brands
    if (row.brand_slug) {
      const existing = brandCounts.get(row.brand_slug);
      if (existing) {
        existing.count++;
      } else {
        brandCounts.set(row.brand_slug, { name: row.brand_name, count: 1 });
      }
    }

    // Fuel
    if (row.fuel_type) {
      fuelCounts.set(row.fuel_type, (fuelCounts.get(row.fuel_type) || 0) + 1);
    }

    // Segment
    if (row.segment) {
      segmentCounts.set(row.segment, (segmentCounts.get(row.segment) || 0) + 1);
    }

    // NCAP
    if (row.ncap_stars) {
      ncapCounts.set(row.ncap_stars, (ncapCounts.get(row.ncap_stars) || 0) + 1);
    }

    // Ranges
    if (row.year_start) {
      yearMin = Math.min(yearMin, row.year_start);
      yearMax = Math.max(yearMax, row.year_start);
    }
    if (row.power_hp) {
      powerMin = Math.min(powerMin, row.power_hp);
      powerMax = Math.max(powerMax, row.power_hp);
    }
  }

  const FUEL_LABELS: Record<string, string> = {
    petrol: "Essence",
    diesel: "Diesel",
    electric: "Électrique",
    hybrid: "Hybride",
    plugin_hybrid: "Hybride rechargeable",
  };

  return {
    brands: [...brandCounts.entries()]
      .map(([slug, { name, count }]) => ({ slug, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 32),
    fuel_types: [...fuelCounts.entries()]
      .map(([value, count]) => ({
        value,
        label: FUEL_LABELS[value] || value,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    segments: [...segmentCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count),
    year_range: {
      min: yearMin === 9999 ? 1990 : yearMin,
      max: yearMax === 0 ? 2026 : yearMax,
    },
    power_range: {
      min: powerMin === 99999 ? 50 : powerMin,
      max: powerMax === 0 ? 600 : powerMax,
    },
    ncap_distribution: [...ncapCounts.entries()]
      .map(([stars, count]) => ({ stars, count }))
      .sort((a, b) => b.stars - a.stars),
  };
}
