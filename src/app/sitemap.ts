import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase-server";

const BASE = "https://flm-auto.vercel.app";

const SUB_PAGES = [
  "fiche-technique",
  "dimensions",
  "securite",
  "photos",
  "videos",
  "alternatives",
];

const MEILLEUR_CATEGORIES = [
  "suv-familial-2024",
  "berline-sportive-2024",
  "voiture-5-etoiles-euroncap-2024",
  "suv-compact-2024",
  "voiture-3-sieges-auto-2024",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createServerClient();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/marques`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/comparer`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/family-fit`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/recherche`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Meilleur category pages
  const meilleurPages: MetadataRoute.Sitemap = MEILLEUR_CATEGORIES.map(
    (cat) => ({
      url: `${BASE}/meilleur/${cat}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

  // Brands
  const { data: brands } = await db
    .from("brands")
    .select("slug, updated_at");
  const brandPages: MetadataRoute.Sitemap = (brands || []).map((b) => ({
    url: `${BASE}/marques/${b.slug}`,
    lastModified: b.updated_at,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Models
  const { data: models } = await db
    .from("models")
    .select("slug, brand:brands!inner(slug)");
  const modelPages: MetadataRoute.Sitemap = (models || []).map((m: any) => ({
    url: `${BASE}/marques/${m.brand.slug}/${m.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Generations + sub-pages
  const { data: gens } = await db
    .from("generations")
    .select("slug, model:models!inner(slug, brand:brands!inner(slug))");

  const genPages: MetadataRoute.Sitemap = [];
  for (const g of gens || []) {
    const model = g.model as any;
    const path = `/marques/${model.brand.slug}/${model.slug}/${g.slug}`;

    // Main generation page
    genPages.push({
      url: `${BASE}${path}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    });

    // Sub-pages
    for (const sub of SUB_PAGES) {
      genPages.push({
        url: `${BASE}${path}/${sub}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    }
  }

  return [
    ...staticPages,
    ...meilleurPages,
    ...brandPages,
    ...modelPages,
    ...genPages,
  ];
}
