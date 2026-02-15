import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { getGenerationBySlug, genLabel, getYear } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Gauge, Package as PackageIcon, GitCompareArrows } from "lucide-react";
import { ViewTracker } from "@/components/view-tracker";
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
    title: `Alternatives \u00e0 la ${v.brand.name} ${v.model.name} ${label}`,
    description: `V\u00e9hicules concurrents et alternatives \u00e0 la ${v.brand.name} ${v.model.name} ${label} : m\u00eame segment, m\u00eame gamme de prix.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/alternatives` },
  };
}

interface AlternativeData {
  id: string;
  name: string;
  genLabel: string;
  slug: string;
  image_url: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  segment: string | null;
  powerHp: number | null;
  trunkLiters: number | null;
  safetyStars: number | null;
}

async function getCurrentVehicleSpecs(generationId: string) {
  const db = createStaticClient();

  const [{ data: topVariant }, { data: safety }, { data: interior }] = await Promise.all([
    db
      .from("engine_variants")
      .select("id, powertrain_specs(power_hp)")
      .eq("generation_id", generationId)
      .limit(10),
    db
      .from("safety_ratings")
      .select("stars")
      .eq("generation_id", generationId)
      .limit(1),
    db
      .from("interior_dimensions")
      .select("trunk_volume_liters")
      .eq("generation_id", generationId)
      .limit(1),
  ]);

  const variants = (topVariant || []).map((v: any) => {
    const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
    return pt?.power_hp || 0;
  });
  const maxPower = Math.max(0, ...variants);

  return {
    powerHp: maxPower || null,
    safetyStars: safety?.[0]?.stars || null,
    trunkLiters: interior?.[0]?.trunk_volume_liters || null,
  };
}

async function getAlternatives(generation: any, model: any, brandId: string): Promise<AlternativeData[]> {
  const db = createStaticClient();

  const segment = model.segment;
  const bodyStyle = generation.body_style;

  let query = db
    .from("generations")
    .select(
      "id, name, slug, internal_code, body_style, production_start, production_end, model:models!inner(id, name, slug, segment, brand:brands!inner(id, name, slug))"
    )
    .neq("id", generation.id)
    .limit(16);

  if (segment) {
    query = query.eq("models.segment", segment);
  } else if (bodyStyle) {
    query = query.eq("body_style", bodyStyle);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const filtered = data.filter((g: any) => g.model.brand.id !== brandId).slice(0, 12);
  const altIds = filtered.map((g: any) => g.id);

  // Parallel: images, top variant power, safety, trunk
  const [{ data: images }, { data: altVariants }, { data: altSafety }, { data: altInterior }] = await Promise.all([
    db
      .from("vehicle_images")
      .select("generation_id, url")
      .in("generation_id", altIds)
      .eq("image_type", "exterior")
      .limit(100),
    db
      .from("engine_variants")
      .select("generation_id, powertrain_specs(power_hp)")
      .in("generation_id", altIds)
      .limit(200),
    db
      .from("safety_ratings")
      .select("generation_id, stars")
      .in("generation_id", altIds),
    db
      .from("interior_dimensions")
      .select("generation_id, trunk_volume_liters")
      .in("generation_id", altIds),
  ]);

  const imageMap = new Map<string, string>();
  for (const img of images || []) {
    if (!imageMap.has(img.generation_id)) imageMap.set(img.generation_id, img.url);
  }

  // Max power per generation
  const powerMap = new Map<string, number>();
  for (const v of altVariants || []) {
    const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
    const hp = (pt as any)?.power_hp || 0;
    const cur = powerMap.get(v.generation_id) || 0;
    if (hp > cur) powerMap.set(v.generation_id, hp);
  }

  const safetyMap = new Map<string, number>();
  for (const s of altSafety || []) {
    safetyMap.set(s.generation_id, s.stars);
  }

  const trunkMap = new Map<string, number>();
  for (const d of altInterior || []) {
    if (d.trunk_volume_liters) trunkMap.set(d.generation_id, d.trunk_volume_liters);
  }

  return filtered.map((g: any) => ({
    id: g.id,
    name: `${g.model.brand.name} ${g.model.name}`,
    genLabel: g.internal_code || g.name,
    slug: `/marques/${g.model.brand.slug}/${g.model.slug}/${g.slug}`,
    image_url: imageMap.get(g.id) || null,
    yearStart: getYear(g.production_start),
    yearEnd: getYear(g.production_end),
    segment: g.model.segment,
    powerHp: powerMap.get(g.id) || null,
    trunkLiters: trunkMap.get(g.id) || null,
    safetyStars: safetyMap.get(g.id) || null,
  }));
}

function DiffChip({ current, alt, unit, higher = "better" }: {
  current: number | null;
  alt: number | null;
  unit: string;
  higher?: "better" | "worse";
}) {
  if (!current || !alt) return null;
  const diff = alt - current;
  if (diff === 0) return null;

  const isPositive = higher === "better" ? diff > 0 : diff < 0;
  const sign = diff > 0 ? "+" : "";

  return (
    <span className={`text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
      {sign}{diff} {unit}
    </span>
  );
}

export default async function AlternativesPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const [alternatives, currentSpecs] = await Promise.all([
    getAlternatives(v.generation, v.model, v.brand.id),
    getCurrentVehicleSpecs(v.generation.id),
  ]);

  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ViewTracker statKey="alternativesViewed" />
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Alternatives" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Alternatives &agrave; la <span className="text-primary">{v.brand.name} {v.model.name}</span> {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        V&eacute;hicules concurrents dans le m&ecirc;me segment
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
                <Card className="card-hover group overflow-hidden">
                  {alt.image_url && (
                    <div className="relative aspect-[16/10] surface-2">
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
                    <h3 className="font-semibold text-white">{alt.name}</h3>
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

                    {/* Comparison metrics */}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-3">
                      {alt.powerHp && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Gauge className="h-3.5 w-3.5" />
                          <span>{alt.powerHp} ch</span>
                          <DiffChip current={currentSpecs.powerHp} alt={alt.powerHp} unit="ch" />
                        </div>
                      )}
                      {alt.trunkLiters && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <PackageIcon className="h-3.5 w-3.5" />
                          <span>{alt.trunkLiters} L</span>
                          <DiffChip current={currentSpecs.trunkLiters} alt={alt.trunkLiters} unit="L" />
                        </div>
                      )}
                      {alt.safetyStars && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Shield className="h-3.5 w-3.5" />
                          <span>{alt.safetyStars}{"\u2605"}</span>
                        </div>
                      )}
                    </div>

                    {/* Compare link */}
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <GitCompareArrows className="h-3 w-3" />
                        Comparer
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Aucune alternative trouv&eacute;e pour ce v&eacute;hicule.
          </p>
        )}
      </div>
    </div>
  );
}
