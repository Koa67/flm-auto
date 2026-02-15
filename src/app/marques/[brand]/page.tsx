import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Car,
  Gauge,
  Camera,
  Shield,
  Calendar,
} from "lucide-react";
import type { Metadata } from "next";
import { generateBreadcrumbSchema } from "@/lib/schema/breadcrumb-schema";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: slug } = await params;
  const db = createStaticClient();
  const { data } = await db
    .from("brands")
    .select("name")
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.name} \u2014 Tous les mod\u00e8les | FLM AUTO`,
    description: `${data.name} : tous les mod\u00e8les, fiches techniques, s\u00e9curit\u00e9 Euro NCAP, photos et comparaisons.`,
    alternates: { canonical: `/marques/${slug}` },
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(data.name)}&subtitle=Tous%20les%20mod%C3%A8les`,
        },
      ],
    },
  };
}

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

async function getBrandData(slug: string) {
  const db = createStaticClient();

  const { data: brand } = await db
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!brand) return null;

  const [{ data: models }, { count: photoCount }, { data: searchRows }] =
    await Promise.all([
      db
        .from("models")
        .select(
          "id, name, slug, segment, body_styles, first_year, last_year, is_current"
        )
        .eq("brand_id", brand.id)
        .order("name"),
      db
        .from("vehicle_images")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", brand.id),
      db
        .from("vehicle_search_index")
        .select(
          "generation_id, model_name, model_slug, generation_name, generation_slug, internal_code, segment, thumbnail_url, power_hp, ncap_stars, year_start"
        )
        .eq("brand_slug", slug)
        .order("year_start", { ascending: false, nullsFirst: false })
        .limit(500),
    ]);

  const modelIds = models?.map((m) => m.id) || [];

  let generations: any[] = [];
  if (modelIds.length > 0) {
    const { data } = await db
      .from("generations")
      .select("id, model_id, name, slug, production_start, production_end")
      .in("model_id", modelIds);
    generations = data || [];
  }

  const genCountByModel = new Map<string, number>();
  for (const g of generations) {
    genCountByModel.set(
      g.model_id,
      (genCountByModel.get(g.model_id) || 0) + 1
    );
  }

  // Segment distribution
  const segmentCounts = new Map<string, number>();
  for (const m of models || []) {
    if (m.segment) {
      segmentCounts.set(m.segment, (segmentCounts.get(m.segment) || 0) + 1);
    }
  }

  // Thumbnail for each model (first search row with photo)
  const modelThumbnails = new Map<string, string>();
  for (const r of searchRows || []) {
    if (r.thumbnail_url && !modelThumbnails.has(r.model_slug)) {
      modelThumbnails.set(r.model_slug, r.thumbnail_url);
    }
  }

  return {
    brand,
    models: (models || []).map((m) => ({
      ...m,
      generation_count: genCountByModel.get(m.id) || 0,
      thumbnail: modelThumbnails.get(m.slug) || null,
    })),
    totalGenerations: generations.length,
    photoCount: photoCount || 0,
    segments: [...segmentCounts.entries()]
      .map(([value, count]) => ({ value, label: SEGMENT_LABELS[value] || value, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export default async function BrandPage({ params }: Props) {
  const { brand: slug } = await params;
  const data = await getBrandData(slug);

  if (!data) notFound();

  const { brand, models, totalGenerations, photoCount, segments } = data;

  const current = models.filter((m) => m.is_current);
  const discontinued = models.filter((m) => !m.is_current);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Accueil", url: "/" },
              { name: "Marques", url: "/marques" },
              { name: brand.name },
            ])
          ),
        }}
      />

      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: brand.name },
        ]}
      />

      {/* Brand banner */}
      <div className="mt-4 rounded-2xl surface-2 border border-[var(--border-subtle)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl surface-3 border border-[var(--border-subtle)]">
            <span className="font-display text-3xl font-bold text-primary">
              {brand.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              {brand.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {brand.country_origin && `${brand.country_origin}`}
              {brand.country_origin && brand.founded_year && " · "}
              {brand.founded_year && `Fondé en ${brand.founded_year}`}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBadge icon={Car} label="Modèles" value={models.length} />
          <StatBadge icon={Gauge} label="Générations" value={totalGenerations} />
          <StatBadge icon={Camera} label="Photos" value={photoCount} />
          <StatBadge
            icon={Calendar}
            label="Depuis"
            value={brand.founded_year || "—"}
          />
        </div>

        {/* Segment distribution */}
        {segments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {segments.map((seg) => (
              <Link
                key={seg.value}
                href={`/explorer/segment/${seg.value === "SUV" ? "suv" : seg.value === "sedan" ? "berline" : seg.value === "hatchback" ? "citadine" : seg.value === "wagon" ? "break" : seg.value === "convertible" ? "cabriolet" : seg.value === "van" ? "monospace" : seg.value === "pickup" ? "pickup" : seg.value}`}
              >
                <Badge
                  variant="secondary"
                  className="surface-3 cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {seg.label}{" "}
                  <span className="ml-1 text-muted-foreground">
                    {seg.count}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {current.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-0.5 w-8 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-semibold">
              Modèles actuels ({current.length})
            </h2>
          </div>
          <ModelGrid models={current} brandSlug={slug} />
        </section>
      )}

      {discontinued.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-0.5 w-8 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-semibold">
              Anciens modèles ({discontinued.length})
            </h2>
          </div>
          <ModelGrid models={discontinued} brandSlug={slug} />
        </section>
      )}
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  const display =
    typeof value === "number"
      ? value >= 1000
        ? `${Math.round(value / 1000)}k`
        : String(value)
      : value;

  return (
    <div className="flex items-center gap-3 rounded-xl surface-3 border border-[var(--border-subtle)] p-3">
      <Icon className="h-4 w-4 shrink-0 text-primary/60" />
      <div>
        <div className="text-mono text-lg font-bold leading-tight text-white">
          {display}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function ModelGrid({
  models,
  brandSlug,
}: {
  models: any[];
  brandSlug: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {models.map((model) => (
        <Link key={model.id} href={`/marques/${brandSlug}/${model.slug}`}>
          <Card className="card-hover group h-full overflow-hidden">
            {model.thumbnail && (
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
                <Image
                  src={model.thumbnail}
                  alt={model.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
            )}
            <CardContent className="p-4">
              <h3 className="font-semibold text-white">{model.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {model.generation_count} gén.
                </span>
                {model.segment && (
                  <Badge variant="outline" className="text-xs">
                    {SEGMENT_LABELS[model.segment] || model.segment}
                  </Badge>
                )}
                {model.first_year && (
                  <span className="text-xs text-muted-foreground">
                    {model.first_year}–{model.last_year || "..."}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
