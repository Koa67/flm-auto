import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase-server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createServerClient();
  const base = "https://flm-auto.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/marques`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/comparer`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/family-fit`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/recherche`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Brands
  const { data: brands } = await db
    .from("brands")
    .select("slug, updated_at");
  const brandPages: MetadataRoute.Sitemap = (brands || []).map((b) => ({
    url: `${base}/marques/${b.slug}`,
    lastModified: b.updated_at,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...brandPages];
}
