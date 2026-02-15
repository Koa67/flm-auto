import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Gauge, Calendar, Car } from "lucide-react";
import type { Metadata } from "next";
import { generateBreadcrumbSchema } from "@/lib/schema/breadcrumb-schema";

export const revalidate = 3600;

const SEGMENT_LABELS: Record<string, string> = {
  SUV: "SUV",
  sedan: "Berline",
  hatchback: "Citadine",
  wagon: "Break",
  coupe: "Coupé",
  convertible: "Cabriolet",
  van: "Monospace",
  pickup: "Pick-up",
};

interface Props {
  params: Promise<{ brand: string; model: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: brandSlug, model: modelSlug } = await params;
  const db = createStaticClient();
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
    title: `${brand.name} ${model.name} \u2014 Toutes les g\u00e9n\u00e9rations | FLM AUTO`,
    description: `${brand.name} ${model.name} : toutes les g\u00e9n\u00e9rations, motorisations et fiches techniques sur FLM AUTO.`,
    alternates: { canonical: `/marques/${brandSlug}/${modelSlug}` },
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(`${brand.name} ${model.name}`)}&subtitle=Toutes%20les%20g%C3%A9n%C3%A9rations`,
        },
      ],
    },
  };
}

async function getModelData(brandSlug: string, modelSlug: string) {
  const db = createStaticClient();

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
    .select(
      "id, name, slug, chassis_code, internal_code, production_start, production_end, body_style"
    )
    .eq("model_id", model.id)
    .order("production_start", { ascending: false });

  const genIds = generations?.map((g) => g.id) || [];
  const imageMap = new Map<string, string>();
  const variantCountMap = new Map<string, number>();

  if (genIds.length > 0) {
    const [{ data: images }, { data: variants }] = await Promise.all([
      db
        .from("vehicle_images")
        .select("generation_id, url")
        .in("generation_id", genIds)
        .eq("image_type", "exterior")
        .limit(100),
      db
        .from("engine_variants")
        .select("generation_id")
        .in("generation_id", genIds),
    ]);

    if (images) {
      for (const img of images) {
        if (!imageMap.has(img.generation_id)) {
          imageMap.set(img.generation_id, img.url);
        }
      }
    }
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
  const totalVariants = generations.reduce(
    (sum, g) => sum + g.variant_count,
    0
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Accueil", url: "/" },
              { name: "Marques", url: "/marques" },
              { name: brand.name, url: `/marques/${brandSlug}` },
              { name: model.name },
            ])
          ),
        }}
      />

      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: brand.name, href: `/marques/${brandSlug}` },
          { label: model.name },
        ]}
      />

      {/* Model header */}
      <div className="mt-4">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {brand.name} <span className="text-primary">{model.name}</span>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {model.segment && (
            <Badge variant="secondary" className="surface-3">
              {SEGMENT_LABELS[model.segment] || model.segment}
            </Badge>
          )}
          {model.first_year && (
            <span className="text-sm text-muted-foreground">
              {model.first_year}–{model.last_year || "..."}
            </span>
          )}
        </div>
      </div>

      {/* Model stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl surface-3 border border-[var(--border-subtle)] p-3">
          <Calendar className="h-4 w-4 shrink-0 text-primary/60" />
          <div>
            <div className="text-mono text-lg font-bold text-white">
              {generations.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Générations
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl surface-3 border border-[var(--border-subtle)] p-3">
          <Gauge className="h-4 w-4 shrink-0 text-primary/60" />
          <div>
            <div className="text-mono text-lg font-bold text-white">
              {totalVariants}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Motorisations
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl surface-3 border border-[var(--border-subtle)] p-3">
          <Car className="h-4 w-4 shrink-0 text-primary/60" />
          <div>
            <div className="text-mono text-lg font-bold text-white">
              {model.first_year
                ? `${(model.last_year || new Date().getFullYear()) - model.first_year}`
                : "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Années
            </div>
          </div>
        </div>
      </div>

      {/* Generation timeline */}
      <div className="mt-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-0.5 w-8 rounded-full bg-primary" />
          <h2 className="font-display text-xl font-semibold">
            Chronologie des générations
          </h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-subtle)] sm:left-6" />

          <div className="space-y-6">
            {generations.map((gen, index) => {
              const yearStart = getYear(gen.production_start);
              const yearEnd = getYear(gen.production_end);
              const isCurrent = !gen.production_end;

              return (
                <div key={gen.id} className="relative pl-12 sm:pl-16">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 sm:left-4.5 ${
                      isCurrent
                        ? "border-primary bg-primary shadow-sm shadow-primary/50"
                        : "border-[var(--border-default)] bg-[var(--bg-tertiary)]"
                    }`}
                  />

                  {/* Year label */}
                  <div className="absolute left-0 top-3.5 hidden w-6 text-right text-mono text-[10px] font-bold text-muted-foreground sm:block sm:left-0 sm:w-4">
                    {/* empty — the dot is the marker */}
                  </div>

                  <Link
                    href={`/marques/${brandSlug}/${modelSlug}/${gen.slug}`}
                  >
                    <Card className="card-hover group overflow-hidden">
                      <div className="flex flex-col sm:flex-row">
                        {/* Image */}
                        {gen.image_url && (
                          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-accent sm:aspect-auto sm:w-48">
                            <Image
                              src={gen.image_url}
                              alt={`${brand.name} ${model.name} ${gen.internal_code || gen.name}`}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, 192px"
                            />
                          </div>
                        )}

                        {/* Content */}
                        <CardContent className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-white">
                                {gen.internal_code || gen.name}
                              </h3>
                              {gen.chassis_code &&
                                gen.chassis_code !== gen.internal_code && (
                                  <p className="text-xs text-muted-foreground">
                                    {gen.chassis_code}
                                  </p>
                                )}
                            </div>
                            {isCurrent && (
                              <Badge className="shrink-0 bg-primary/10 text-primary text-xs">
                                Actuel
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-mono text-sm font-medium text-white">
                              {yearStart || "?"}–{yearEnd || "..."}
                            </span>
                            {gen.body_style && (
                              <Badge variant="outline" className="text-xs">
                                {SEGMENT_LABELS[gen.body_style] || gen.body_style}
                              </Badge>
                            )}
                            {gen.variant_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {gen.variant_count} motorisation
                                {gen.variant_count > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
