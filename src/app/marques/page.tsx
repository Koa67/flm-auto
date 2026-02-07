import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedGrid, AnimatedGridItem } from "@/components/animated-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Toutes les marques",
  description:
    "D\u00e9couvrez les 32 marques automobiles de notre encyclop\u00e9die : BMW, Mercedes-Benz, Audi, Porsche, Tesla, et plus.",
};

export const revalidate = 3600;

async function getBrands() {
  const db = createServerClient();
  const { data: brands } = await db
    .from("brands")
    .select("id, name, slug, country_origin, logo_url, founded_year")
    .order("name");

  if (!brands) return [];

  const { data: modelCounts } = await db.from("models").select("brand_id");

  const countMap = new Map<string, number>();
  modelCounts?.forEach((m) => {
    countMap.set(m.brand_id, (countMap.get(m.brand_id) || 0) + 1);
  });

  return brands.map((b) => ({ ...b, model_count: countMap.get(b.id) || 0 }));
}

const countryFlag: Record<string, string> = {
  Germany: "\ud83c\udde9\ud83c\uddea",
  Italy: "\ud83c\uddee\ud83c\uddf9",
  France: "\ud83c\uddeb\ud83c\uddf7",
  Japan: "\ud83c\uddef\ud83c\uddf5",
  "South Korea": "\ud83c\uddf0\ud83c\uddf7",
  Sweden: "\ud83c\uddf8\ud83c\uddea",
  "United States": "\ud83c\uddfa\ud83c\uddf8",
  "United Kingdom": "\ud83c\uddec\ud83c\udde7",
  "Czech Republic": "\ud83c\udde8\ud83c\uddff",
  Spain: "\ud83c\uddea\ud83c\uddf8",
  Romania: "\ud83c\uddf7\ud83c\uddf4",
};

export default async function MarquesPage() {
  const brands = await getBrands();

  const byCountry = new Map<string, typeof brands>();
  for (const b of brands) {
    const c = b.country_origin || "Other";
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c)!.push(b);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Toutes les marques</h1>
      <p className="mt-2 text-muted-foreground">
        {brands.length} marques automobiles, {brands.reduce((s, b) => s + b.model_count, 0)} mod&egrave;les
      </p>

      <AnimatedGrid className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {brands.map((brand) => (
          <AnimatedGridItem key={brand.id}>
          <Link href={`/marques/${brand.slug}`}>
            <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                  {countryFlag[brand.country_origin || ""] || "\ud83d\ude97"}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">{brand.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {brand.model_count} mod&egrave;les
                    </span>
                    {brand.founded_year && (
                      <Badge variant="secondary" className="text-xs">
                        {brand.founded_year}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          </AnimatedGridItem>
        ))}
      </AnimatedGrid>
    </div>
  );
}
