import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel, getYear } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string; generation: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) return {};
  const label = genLabel(v.generation);
  return {
    title: `Alternatives à la ${v.brand.name} ${v.model.name} ${label}`,
    description: `Véhicules concurrents et alternatives à la ${v.brand.name} ${v.model.name} ${label} : même segment, même gamme de prix.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/alternatives` },
  };
}

async function getAlternatives(generation: any, model: any, brandId: string) {
  const db = createServerClient();

  // Find similar generations: same segment or body_style, overlapping production years
  const segment = model.segment;
  const bodyStyle = generation.body_style;

  let query = db
    .from("generations")
    .select(
      "id, name, slug, internal_code, body_style, production_start, production_end, model:models!inner(id, name, slug, segment, brand:brands!inner(id, name, slug))"
    )
    .neq("id", generation.id)
    .limit(12);

  // Filter by segment if available
  if (segment) {
    query = query.eq("models.segment", segment);
  } else if (bodyStyle) {
    query = query.eq("body_style", bodyStyle);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  // Get images for alternatives
  const altIds = data.map((g) => g.id);
  const { data: images } = await db
    .from("vehicle_images")
    .select("generation_id, image_url")
    .in("generation_id", altIds)
    .eq("image_type", "exterior")
    .limit(100);

  const imageMap = new Map<string, string>();
  if (images) {
    for (const img of images) {
      if (!imageMap.has(img.generation_id)) {
        imageMap.set(img.generation_id, img.image_url);
      }
    }
  }

  // Exclude same brand, sort by relevance (overlapping years)
  return data
    .filter((g: any) => g.model.brand.id !== brandId)
    .map((g: any) => ({
      id: g.id,
      name: `${g.model.brand.name} ${g.model.name}`,
      genLabel: g.internal_code || g.name,
      slug: `/marques/${g.model.brand.slug}/${g.model.slug}/${g.slug}`,
      image_url: imageMap.get(g.id) || null,
      yearStart: getYear(g.production_start),
      yearEnd: getYear(g.production_end),
      segment: g.model.segment,
    }))
    .slice(0, 8);
}

export default async function AlternativesPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const alternatives = await getAlternatives(
    v.generation,
    v.model,
    v.brand.id
  );
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Alternatives" },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        Alternatives à la {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Véhicules concurrents dans le même segment
        {v.model.segment && ` (${v.model.segment})`}.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="alternatives" />
      </div>

      <div className="mt-8">
        {alternatives.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {alternatives.map((alt) => (
              <Link key={alt.id} href={alt.slug}>
                <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
                  {alt.image_url && (
                    <div className="relative aspect-[16/10] bg-muted">
                      <Image
                        src={alt.image_url}
                        alt={alt.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{alt.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {alt.genLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {alt.yearStart || "?"}&ndash;{alt.yearEnd || "..."}
                      </span>
                      {alt.segment && (
                        <Badge variant="outline" className="text-xs">
                          {alt.segment}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Aucune alternative trouvée pour ce véhicule.
          </p>
        )}
      </div>
    </div>
  );
}
