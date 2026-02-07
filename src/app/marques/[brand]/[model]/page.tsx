import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: brandSlug, model: modelSlug } = await params;
  const db = createServerClient();
  const { data: brand } = await db
    .from("brands")
    .select("name")
    .eq("slug", brandSlug)
    .single();
  const { data: models } = await db
    .from("models")
    .select("name")
    .eq("slug", modelSlug)
    .limit(1);
  const model = models?.[0];
  if (!brand || !model) return {};
  return {
    title: `${brand.name} ${model.name}`,
    description: `Toutes les g\u00e9n\u00e9rations de la ${brand.name} ${model.name} : fiches techniques, photos, motorisations.`,
  };
}

async function getModelData(brandSlug: string, modelSlug: string) {
  const db = createServerClient();

  const { data: brand } = await db
    .from("brands")
    .select("id, name, slug")
    .eq("slug", brandSlug)
    .single();
  if (!brand) return null;

  const { data: models } = await db
    .from("models")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("slug", modelSlug);
  const model = models?.[0];
  if (!model) return null;

  const { data: generations } = await db
    .from("generations")
    .select("id, name, slug, chassis_code, internal_code, production_start, production_end, body_style")
    .eq("model_id", model.id)
    .order("production_start", { ascending: false });

  // Get images for generations (first exterior per gen)
  const genIds = generations?.map((g) => g.id) || [];
  let imageMap = new Map<string, string>();
  if (genIds.length > 0) {
    const { data: images } = await db
      .from("vehicle_images")
      .select("generation_id, image_url")
      .in("generation_id", genIds)
      .eq("image_type", "exterior")
      .limit(100);
    if (images) {
      for (const img of images) {
        if (!imageMap.has(img.generation_id)) {
          imageMap.set(img.generation_id, img.image_url);
        }
      }
    }
  }

  // Get variant counts
  let variantCountMap = new Map<string, number>();
  if (genIds.length > 0) {
    const { data: variants } = await db
      .from("engine_variants")
      .select("generation_id")
      .in("generation_id", genIds);
    if (variants) {
      for (const v of variants) {
        variantCountMap.set(
          v.generation_id,
          (variantCountMap.get(v.generation_id) || 0) + 1
        );
      }
    }
  }

  return {
    brand,
    model,
    generations: (generations || []).map((g) => ({
      ...g,
      image_url: imageMap.get(g.id) || null,
      variant_count: variantCountMap.get(g.id) || 0,
    })),
  };
}

function getYear(date: string | null) {
  if (!date) return null;
  return new Date(date).getFullYear();
}

export default async function ModelPage({ params }: Props) {
  const { brand: brandSlug, model: modelSlug } = await params;
  const data = await getModelData(brandSlug, modelSlug);
  if (!data) notFound();

  const { brand, model, generations } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Link href="/marques" className="hover:text-foreground">
            Marques
          </Link>
          <span>/</span>
          <Link
            href={`/marques/${brandSlug}`}
            className="hover:text-foreground"
          >
            {brand.name}
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold">
          {brand.name} {model.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {generations.length} g&eacute;n&eacute;rations
          {model.first_year && ` \u00b7 ${model.first_year}\u2013${model.last_year || "..."}`}
          {model.segment && ` \u00b7 ${model.segment}`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {generations.map((gen) => (
          <Link
            key={gen.id}
            href={`/marques/${brandSlug}/${modelSlug}/${gen.slug}`}
          >
            <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
              {gen.image_url && (
                <div className="relative aspect-[16/10] bg-muted">
                  <Image
                    src={gen.image_url}
                    alt={`${brand.name} ${model.name} ${gen.name}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <h3 className="font-semibold">
                  {gen.internal_code || gen.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {gen.chassis_code && gen.chassis_code !== gen.internal_code && (
                    <Badge variant="outline" className="text-xs">
                      {gen.chassis_code}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {getYear(gen.production_start) || "?"}&ndash;
                    {getYear(gen.production_end) || "..."}
                  </span>
                  {gen.variant_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {gen.variant_count} motorisations
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
