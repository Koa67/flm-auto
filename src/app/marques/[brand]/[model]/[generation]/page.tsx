import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Fuel,
  Gauge,
  Cog,
  Baby,
  Star,
} from "lucide-react";
import { VehicleNav } from "@/components/vehicle-nav";
import { AffiliationCTA } from "@/components/affiliation-cta";
import { NewsletterSection } from "@/components/newsletter-form";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string; generation: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: bs, model: ms, generation: gs } = await params;
  const data = await getVehicleData(bs, ms, gs);
  if (!data) return {};
  const { brand, model, generation } = data;
  const title = `${brand.name} ${model.name} ${generation.internal_code || generation.name}`;
  const ogStats: string[] = [];
  if (data.safety?.stars) ogStats.push(`${data.safety.stars}\u2605 NCAP`);
  if (data.variants[0]?.power_hp) ogStats.push(`${data.variants[0].power_hp} ch`);
  if (data.variants[0]?.acceleration_0_100) ogStats.push(`${data.variants[0].acceleration_0_100}s`);

  const ogUrl = new URL("/api/og", process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.vercel.app");
  ogUrl.searchParams.set("title", title);
  ogUrl.searchParams.set("subtitle", "Fiche technique compl\u00e8te");
  if (ogStats.length) ogUrl.searchParams.set("stats", ogStats.join("|"));

  return {
    title,
    description: `Fiche technique ${title} : motorisations, performances, s\u00e9curit\u00e9 Euro NCAP, photos.`,
    openGraph: {
      title,
      images: [ogUrl.toString()],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl.toString()],
    },
  };
}

async function getVehicleData(brandSlug: string, modelSlug: string, genSlug: string): Promise<{
  brand: any;
  model: any;
  generation: any;
  variants: any[];
  images: { exteriors: any[]; interiors: any[]; technicals: any[]; all: any[] };
  safety: any;
  familyFit: any;
  pricing: any;
} | null> {
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

  const { data: gens } = await db
    .from("generations")
    .select("*")
    .eq("model_id", model.id)
    .eq("slug", genSlug);
  const generation = gens?.[0];
  if (!generation) return null;

  // Parallel fetches
  const [
    { data: variants },
    { data: images },
    { data: safety },
    { data: familyFit },
    { data: pricing },
  ] = await Promise.all([
    db
      .from("engine_variants")
      .select("*, powertrain_specs(*), performance_specs(*)")
      .eq("generation_id", generation.id)
      .limit(50),
    db
      .from("vehicle_images")
      .select("id, image_url, image_type, source_name")
      .eq("generation_id", generation.id)
      .limit(30),
    db
      .from("safety_ratings")
      .select("*")
      .eq("generation_id", generation.id)
      .order("test_year", { ascending: false })
      .limit(1),
    db
      .from("family_fit_compatibility")
      .select("*")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("vehicle_pricing")
      .select("*")
      .eq("generation_id", generation.id)
      .limit(1),
  ]);

  // Format variants
  const formattedVariants = (variants || [])
    .map((v) => {
      const pt = Array.isArray(v.powertrain_specs)
        ? v.powertrain_specs[0]
        : v.powertrain_specs;
      const perf = Array.isArray(v.performance_specs)
        ? v.performance_specs[0]
        : v.performance_specs;
      return {
        id: v.id,
        name: v.name?.replace(/Specs$/, "").trim() || v.badge || "Variant",
        fuel_type: v.fuel_type,
        engine_code: v.engine_code,
        power_hp: pt?.power_hp,
        power_kw: pt?.power_kw,
        torque_nm: pt?.torque_nm,
        displacement_cc: pt?.displacement_cc,
        cylinders: pt?.cylinders,
        transmission: pt?.transmission_type,
        drivetrain: pt?.drivetrain,
        acceleration_0_100: perf?.acceleration_0_100_kmh,
        top_speed_kmh: perf?.top_speed_kmh,
      };
    })
    .filter((v) => v.power_hp || v.displacement_cc)
    .sort((a, b) => (b.power_hp || 0) - (a.power_hp || 0));

  // Group images
  const exteriors = (images || []).filter((i) => i.image_type === "exterior");
  const interiors = (images || []).filter((i) => i.image_type === "interior");
  const technicals = (images || []).filter((i) =>
    ["blueprint", "diagram", "technical", "cutaway"].includes(i.image_type)
  );

  return {
    brand,
    model,
    generation,
    variants: formattedVariants,
    images: { exteriors, interiors, technicals, all: images || [] },
    safety: safety?.[0] || null,
    familyFit: familyFit?.[0] || null,
    pricing: pricing?.[0] || null,
  };
}

function getYear(d: string | null) {
  return d ? new Date(d).getFullYear() : null;
}

export default async function VehiclePage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const data = await getVehicleData(bs, ms, gs);
  if (!data) notFound();

  const { brand, model, generation, variants, images, safety, familyFit, pricing } = data;
  const genLabel = generation.internal_code || generation.name;
  const yearStart = getYear(generation.production_start);
  const yearEnd = getYear(generation.production_end);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Link href="/marques" className="hover:text-foreground">Marques</Link>
        <span>/</span>
        <Link href={`/marques/${bs}`} className="hover:text-foreground">{brand.name}</Link>
        <span>/</span>
        <Link href={`/marques/${bs}/${ms}`} className="hover:text-foreground">{model.name}</Link>
        <span>/</span>
        <span className="text-foreground">{genLabel}</span>
      </div>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {brand.name} {model.name} {genLabel}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>{yearStart || "?"}&ndash;{yearEnd || "..."}</span>
            {generation.chassis_code && generation.chassis_code !== genLabel && (
              <Badge variant="outline">{generation.chassis_code}</Badge>
            )}
            {generation.body_style && (
              <Badge variant="secondary">{generation.body_style}</Badge>
            )}
            {variants.length > 0 && (
              <span>{variants.length} motorisations</span>
            )}
          </div>
        </div>
        {safety && (
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="font-semibold">{safety.stars}</span>
            <span className="text-sm text-muted-foreground">Euro NCAP {safety.test_year}</span>
          </div>
        )}
      </div>

      {/* Hero image */}
      {images.exteriors.length > 0 && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
          <Image
            src={images.exteriors[0].image_url}
            alt={`${brand.name} ${model.name} ${genLabel}`}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </div>
      )}

      {/* Content tabs */}
      <Tabs defaultValue="specs" className="mt-8">
        <TabsList>
          <TabsTrigger value="specs">Motorisations</TabsTrigger>
          <TabsTrigger value="safety">S&eacute;curit&eacute;</TabsTrigger>
          <TabsTrigger value="gallery">Photos ({images.all.length})</TabsTrigger>
          {familyFit && <TabsTrigger value="family">Family Fit</TabsTrigger>}
        </TabsList>

        {/* Motorisations */}
        <TabsContent value="specs" className="mt-6">
          {variants.length === 0 ? (
            <p className="text-muted-foreground">Aucune motorisation disponible.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorisation</TableHead>
                    <TableHead className="text-right">Puissance</TableHead>
                    <TableHead className="text-right">Couple</TableHead>
                    <TableHead className="text-right">0-100</TableHead>
                    <TableHead className="text-right">V.max</TableHead>
                    <TableHead>Transmission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.fuel_type && <span>{v.fuel_type}</span>}
                          {v.displacement_cc && (
                            <span> &middot; {(v.displacement_cc / 1000).toFixed(1)}L</span>
                          )}
                          {v.cylinders && <span> {v.cylinders}cyl</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {v.power_hp ? `${v.power_hp} ch` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {v.torque_nm ? `${v.torque_nm} Nm` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {v.acceleration_0_100 ? `${v.acceleration_0_100}s` : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {v.top_speed_kmh ? `${v.top_speed_kmh} km/h` : "\u2014"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {v.transmission || "\u2014"}
                        </div>
                        {v.drivetrain && (
                          <div className="text-xs text-muted-foreground">
                            {v.drivetrain}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pricing / Malus */}
          {pricing && pricing.co2_gkm && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fuel className="h-4 w-4" /> &Eacute;missions &amp; Malus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{pricing.co2_gkm}</div>
                    <div className="text-xs text-muted-foreground">g CO2/km</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {pricing.malus_2024_eur > 0
                        ? `${pricing.malus_2024_eur.toLocaleString("fr-FR")} \u20ac`
                        : "0 \u20ac"}
                    </div>
                    <div className="text-xs text-muted-foreground">Malus 2024</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {pricing.malus_2025_eur > 0
                        ? `${pricing.malus_2025_eur.toLocaleString("fr-FR")} \u20ac`
                        : "0 \u20ac"}
                    </div>
                    <div className="text-xs text-muted-foreground">Malus 2025</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Safety */}
        <TabsContent value="safety" className="mt-6">
          {safety ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Euro NCAP {safety.test_year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-6 w-6 ${
                        i < (safety.stars || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-lg font-bold">
                    {safety.stars}/5
                  </span>
                </div>
                <div className="space-y-4">
                  {safety.adult_occupant_pct != null && (
                    <ScoreBar label="Adultes" value={safety.adult_occupant_pct} />
                  )}
                  {safety.child_occupant_pct != null && (
                    <ScoreBar label="Enfants" value={safety.child_occupant_pct} />
                  )}
                  {safety.pedestrian_pct != null && (
                    <ScoreBar label="Pi\u00e9tons" value={safety.pedestrian_pct} />
                  )}
                  {safety.safety_assist_pct != null && (
                    <ScoreBar label="Aide \u00e0 la conduite" value={safety.safety_assist_pct} />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground">
              Pas de donn&eacute;es Euro NCAP disponibles pour ce v&eacute;hicule.
            </p>
          )}
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="mt-6">
          {images.all.length === 0 ? (
            <p className="text-muted-foreground">Aucune photo disponible.</p>
          ) : (
            <div className="space-y-8">
              {images.exteriors.length > 0 && (
                <section>
                  <h3 className="mb-3 font-semibold">
                    Ext&eacute;rieur ({images.exteriors.length})
                  </h3>
                  <ImageGrid images={images.exteriors} alt={`${brand.name} ${model.name}`} />
                </section>
              )}
              {images.interiors.length > 0 && (
                <section>
                  <h3 className="mb-3 font-semibold">
                    Int&eacute;rieur ({images.interiors.length})
                  </h3>
                  <ImageGrid images={images.interiors} alt={`${brand.name} ${model.name} int\u00e9rieur`} />
                </section>
              )}
              {images.technicals.length > 0 && (
                <section>
                  <h3 className="mb-3 font-semibold">
                    Technique ({images.technicals.length})
                  </h3>
                  <ImageGrid images={images.technicals} alt={`${brand.name} ${model.name} technique`} />
                </section>
              )}
            </div>
          )}
        </TabsContent>

        {/* Family Fit */}
        {familyFit && (
          <TabsContent value="family" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Baby className="h-5 w-5" /> Family Fit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="ISOFIX"
                    value={familyFit.isofix_points ?? 0}
                    suffix="points"
                  />
                  <StatCard
                    label="Score famille"
                    value={familyFit.family_fit_score ?? 0}
                    suffix="/ 100"
                  />
                  <StatCard
                    label="3-across"
                    value={familyFit.three_across_possible ? "Oui" : "Non"}
                  />
                  <StatCard
                    label="Largeur banquette"
                    value={familyFit.rear_bench_width_usable_mm ?? "\u2014"}
                    suffix="mm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Sub-page navigation */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Explorer en détail</h2>
        <VehicleNav basePath={`/marques/${bs}/${ms}/${gs}`} />
      </div>

      {/* Affiliation + Newsletter */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <AffiliationCTA brand={brand.name} model={model.name} />
        <NewsletterSection source="vehicle-page" />
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono font-medium">{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <div className="text-2xl font-bold">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ImageGrid({
  images,
  alt,
}: {
  images: { id: string; image_url: string; source_name: string }[];
  alt: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <div
          key={img.id}
          className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"
        >
          <Image
            src={img.image_url}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
      ))}
    </div>
  );
}
