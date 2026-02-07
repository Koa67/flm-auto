import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Shield, Gauge, Fuel, Star } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slugs: string }>;
}

function parseSlugs(slugs: string) {
  const parts = slugs.split("-vs-");
  if (parts.length !== 2) return null;
  return parts.map((p) => {
    const segments = p.split("-");
    if (segments.length < 3) return null;
    // Pattern: brand-model-gen (each can have hyphens)
    // We take first as brand, last as gen, middle as model
    return { raw: p };
  });
}

async function getVehicleByCompositeSlug(raw: string) {
  const db = createServerClient();

  // Try to find a generation that matches the slug pattern
  // The composite slug is brand-model-gen, so we search all generations
  const { data: gens } = await db
    .from("generations")
    .select(
      "id, name, slug, internal_code, body_style, production_start, production_end, model:models!inner(id, name, slug, segment, brand:brands!inner(id, name, slug))"
    )
    .limit(5000);

  if (!gens) return null;

  // Find the generation whose composite slug matches
  for (const g of gens) {
    const model = g.model as any;
    const brand = model.brand;
    const composite = `${brand.slug}-${model.slug}-${g.slug}`;
    if (composite === raw) {
      return { generation: g, model, brand };
    }
  }

  return null;
}

async function getVehicleSpecs(generationId: string) {
  const db = createServerClient();

  const [{ data: variants }, { data: safety }, { data: images }, { data: specs }] =
    await Promise.all([
      db
        .from("engine_variants")
        .select("*, powertrain_specs(*), performance_specs(*)")
        .eq("generation_id", generationId)
        .limit(10),
      db
        .from("safety_ratings")
        .select("*")
        .eq("generation_id", generationId)
        .order("test_year", { ascending: false })
        .limit(1),
      db
        .from("vehicle_images")
        .select("image_url")
        .eq("generation_id", generationId)
        .eq("image_type", "exterior")
        .limit(1),
      db
        .from("third_party_specs")
        .select("spec_type, spec_value")
        .eq("generation_id", generationId)
        .in("spec_type", [
          "length_mm",
          "width_mm",
          "height_mm",
          "wheelbase_mm",
          "trunk_volume_l",
          "curb_weight_kg",
        ]),
    ]);

  // Get best variant (highest power)
  const best = (variants || [])
    .map((v: any) => {
      const pt = Array.isArray(v.powertrain_specs)
        ? v.powertrain_specs[0]
        : v.powertrain_specs;
      const perf = Array.isArray(v.performance_specs)
        ? v.performance_specs[0]
        : v.performance_specs;
      return {
        power_hp: pt?.power_hp,
        torque_nm: pt?.torque_nm,
        acceleration: perf?.acceleration_0_100_kmh,
        top_speed: perf?.top_speed_kmh,
      };
    })
    .sort((a: any, b: any) => (b.power_hp || 0) - (a.power_hp || 0))[0];

  const specMap: Record<string, string> = {};
  for (const s of specs || []) {
    specMap[s.spec_type] = s.spec_value;
  }

  return {
    image: images?.[0]?.image_url || null,
    safety: safety?.[0] || null,
    power_hp: best?.power_hp,
    torque_nm: best?.torque_nm,
    acceleration: best?.acceleration,
    top_speed: best?.top_speed,
    length: specMap.length_mm,
    width: specMap.width_mm,
    height: specMap.height_mm,
    wheelbase: specMap.wheelbase_mm,
    trunk: specMap.trunk_volume_l,
    weight: specMap.curb_weight_kg,
    variantCount: variants?.length || 0,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugs } = await params;
  const parsed = parseSlugs(slugs);
  if (!parsed || parsed.some((p) => !p)) return {};

  const [v1, v2] = await Promise.all([
    getVehicleByCompositeSlug(parsed[0]!.raw),
    getVehicleByCompositeSlug(parsed[1]!.raw),
  ]);

  if (!v1 || !v2) return {};

  const name1 = `${v1.brand.name} ${v1.model.name} ${v1.generation.internal_code || v1.generation.name}`;
  const name2 = `${v2.brand.name} ${v2.model.name} ${v2.generation.internal_code || v2.generation.name}`;

  return {
    title: `${name1} vs ${name2} — Comparatif`,
    description: `Comparatif complet ${name1} vs ${name2} : performances, dimensions, sécurité, prix. Qui l'emporte ?`,
    alternates: { canonical: `/comparatif/${slugs}` },
  };
}

export default async function ComparatifPage({ params }: Props) {
  const { slugs } = await params;
  const parsed = parseSlugs(slugs);
  if (!parsed || parsed.some((p) => !p)) notFound();

  const [v1, v2] = await Promise.all([
    getVehicleByCompositeSlug(parsed[0]!.raw),
    getVehicleByCompositeSlug(parsed[1]!.raw),
  ]);

  if (!v1 || !v2) notFound();

  const [specs1, specs2] = await Promise.all([
    getVehicleSpecs(v1.generation.id),
    getVehicleSpecs(v2.generation.id),
  ]);

  const name1 = `${v1.brand.name} ${v1.model.name}`;
  const gen1 = v1.generation.internal_code || v1.generation.name;
  const name2 = `${v2.brand.name} ${v2.model.name}`;
  const gen2 = v2.generation.internal_code || v2.generation.name;

  const slug1 = `/marques/${v1.brand.slug}/${v1.model.slug}/${v1.generation.slug}`;
  const slug2 = `/marques/${v2.brand.slug}/${v2.model.slug}/${v2.generation.slug}`;

  const rows = [
    { label: "Puissance", v1: specs1.power_hp ? `${specs1.power_hp} ch` : "—", v2: specs2.power_hp ? `${specs2.power_hp} ch` : "—", better: compare(specs1.power_hp, specs2.power_hp, "higher") },
    { label: "Couple", v1: specs1.torque_nm ? `${specs1.torque_nm} Nm` : "—", v2: specs2.torque_nm ? `${specs2.torque_nm} Nm` : "—", better: compare(specs1.torque_nm, specs2.torque_nm, "higher") },
    { label: "0-100 km/h", v1: specs1.acceleration ? `${specs1.acceleration}s` : "—", v2: specs2.acceleration ? `${specs2.acceleration}s` : "—", better: compare(specs1.acceleration, specs2.acceleration, "lower") },
    { label: "V.max", v1: specs1.top_speed ? `${specs1.top_speed} km/h` : "—", v2: specs2.top_speed ? `${specs2.top_speed} km/h` : "—", better: compare(specs1.top_speed, specs2.top_speed, "higher") },
    { label: "Longueur", v1: specs1.length ? `${specs1.length} mm` : "—", v2: specs2.length ? `${specs2.length} mm` : "—", better: null },
    { label: "Largeur", v1: specs1.width ? `${specs1.width} mm` : "—", v2: specs2.width ? `${specs2.width} mm` : "—", better: null },
    { label: "Coffre", v1: specs1.trunk ? `${specs1.trunk} L` : "—", v2: specs2.trunk ? `${specs2.trunk} L` : "—", better: compare(parseNum(specs1.trunk), parseNum(specs2.trunk), "higher") },
    { label: "Poids", v1: specs1.weight ? `${specs1.weight} kg` : "—", v2: specs2.weight ? `${specs2.weight} kg` : "—", better: compare(parseNum(specs1.weight), parseNum(specs2.weight), "lower") },
    { label: "Euro NCAP", v1: specs1.safety ? `${specs1.safety.stars}★` : "—", v2: specs2.safety ? `${specs2.safety.stars}★` : "—", better: compare(specs1.safety?.stars, specs2.safety?.stars, "higher") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Comparatif", href: "/comparer" },
          { label: `${name1} vs ${name2}` },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        {name1} {gen1} vs {name2} {gen2}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Comparaison détaillée : performances, dimensions, sécurité.
      </p>

      {/* Hero cards */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <VehicleCard
          name={name1}
          gen={gen1}
          image={specs1.image}
          href={slug1}
          stars={specs1.safety?.stars}
        />
        <VehicleCard
          name={name2}
          gen={gen2}
          image={specs2.image}
          href={slug2}
          stars={specs2.safety?.stars}
        />
      </div>

      {/* Comparison table */}
      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Caractéristique</TableHead>
                  <TableHead className="w-1/3 text-center">
                    {name1} {gen1}
                  </TableHead>
                  <TableHead className="w-1/3 text-center">
                    {name2} {gen2}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell
                      className={`text-center font-mono ${row.better === "v1" ? "font-bold text-green-600" : ""}`}
                    >
                      {row.v1}
                    </TableCell>
                    <TableCell
                      className={`text-center font-mono ${row.better === "v2" ? "font-bold text-green-600" : ""}`}
                    >
                      {row.v2}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Internal links */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href={slug1}>
          <Card className="transition-all hover:shadow-md">
            <CardContent className="p-4">
              <p className="font-semibold">
                Voir la fiche {name1} {gen1} &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={slug2}>
          <Card className="transition-all hover:shadow-md">
            <CardContent className="p-4">
              <p className="font-semibold">
                Voir la fiche {name2} {gen2} &rarr;
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function VehicleCard({
  name,
  gen,
  image,
  href,
  stars,
}: {
  name: string;
  gen: string;
  image: string | null;
  href: string;
  stars?: number | null;
}) {
  return (
    <Link href={href}>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        {image && (
          <div className="relative aspect-[16/10] bg-muted">
            <Image
              src={image}
              alt={`${name} ${gen}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold">{name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{gen}</span>
            {stars && (
              <Badge variant="secondary" className="text-xs">
                {stars}★ NCAP
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function parseNum(val: string | undefined | null): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function compare(
  a: number | undefined | null,
  b: number | undefined | null,
  prefer: "higher" | "lower"
): "v1" | "v2" | null {
  if (a == null || b == null) return null;
  if (a === b) return null;
  if (prefer === "higher") return a > b ? "v1" : "v2";
  return a < b ? "v1" : "v2";
}
