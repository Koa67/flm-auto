import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase-server";
import { RANKING_CATEGORIES } from "@/lib/rankings/categories";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

/** Sub-pages available for each generation */
const SUB_PAGES = [
  "fiche-technique",
  "securite",
  "photos",
  "videos",
  "dimensions",
  "alternatives",
  "fiabilite",
];

/** "Meilleur" editorial category pages — from centralized categories */
const MEILLEUR_CATEGORIES = RANKING_CATEGORIES.map((c) => c.slug);

/** Static pages of the site */
const STATIC_PAGES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/marques", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/comparer", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/family-fit", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/recherche", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/tco", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/coffre", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/meilleur", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/cgu", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/confidentialite", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/mentions-legales", changeFrequency: "yearly" as const, priority: 0.2 },
];

/**
 * Paginated fetch helper for Supabase.
 * Supabase limits queries to 1000 rows by default — this fetches all rows.
 */
async function paginateAll<T>(
  db: ReturnType<typeof createServerClient>,
  table: string,
  select: string,
  options?: {
    order?: { column: string; ascending: boolean };
    limit?: number;
  }
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const maxRows = options?.limit ?? Infinity;
  const results: T[] = [];
  let offset = 0;

  while (results.length < maxRows) {
    let query = db
      .from(table)
      .select(select)
      .range(offset, offset + PAGE_SIZE - 1);

    if (options?.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending,
      });
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    results.push(...(data as T[]));
    offset += PAGE_SIZE;

    // If we got fewer than PAGE_SIZE, we've fetched everything
    if (data.length < PAGE_SIZE) break;
  }

  return options?.limit ? results.slice(0, options.limit) : results;
}

interface BrandRow {
  slug: string;
  updated_at: string | null;
}

interface ModelRow {
  slug: string;
  brand: { slug: string };
}

interface GenerationRow {
  slug: string;
  production_start: string | null;
  updated_at: string | null;
  model: {
    slug: string;
    brand: { slug: string };
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createServerClient();

  // --- Static pages ---
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // --- Meilleur category pages ---
  const meilleurEntries: MetadataRoute.Sitemap = MEILLEUR_CATEGORIES.map(
    (cat) => ({
      url: `${BASE}/meilleur/${cat}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

  // --- Brand pages ---
  const brands = await paginateAll<BrandRow>(db, "brands", "slug, updated_at");
  const brandEntries: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${BASE}/marques/${b.slug}`,
    ...(b.updated_at ? { lastModified: b.updated_at } : {}),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // --- Model pages ---
  const models = await paginateAll<ModelRow>(
    db,
    "models",
    "slug, brand:brands!inner(slug)"
  );
  const modelEntries: MetadataRoute.Sitemap = models.map((m) => ({
    url: `${BASE}/marques/${m.brand.slug}/${m.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // --- Generation pages (top 10,000 by production_start DESC) ---
  const generations = await paginateAll<GenerationRow>(
    db,
    "generations",
    "slug, production_start, updated_at, model:models!inner(slug, brand:brands!inner(slug))",
    {
      order: { column: "production_start", ascending: false },
      limit: 10_000,
    }
  );

  const genEntries: MetadataRoute.Sitemap = [];
  for (const g of generations) {
    const m = g.model;
    const path = `/marques/${m.brand.slug}/${m.slug}/${g.slug}`;
    const lastMod = g.updated_at || g.production_start || undefined;

    // Main generation page
    genEntries.push({
      url: `${BASE}${path}`,
      ...(lastMod ? { lastModified: lastMod } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    });

    // Sub-pages (photos, securite, videos)
    for (const sub of SUB_PAGES) {
      genEntries.push({
        url: `${BASE}${path}/${sub}`,
        ...(lastMod ? { lastModified: lastMod } : {}),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    }
  }

  return [
    ...staticEntries,
    ...meilleurEntries,
    ...brandEntries,
    ...modelEntries,
    ...genEntries,
  ];
}
