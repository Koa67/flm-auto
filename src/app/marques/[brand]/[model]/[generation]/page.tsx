import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
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
import {
  Shield,
  Fuel,
  Baby,
  Star,
  Package,
  Calculator,
} from "lucide-react";
import { VehicleNav } from "@/components/vehicle-nav";
import { AffiliationCTA } from "@/components/affiliation-cta";
import { NewsletterSection } from "@/components/newsletter-form";
import {
  EmptyVariants,
  EmptySafety,
  EmptyPhotos,
} from "@/components/empty-states";
import { RedFlagAlert } from "@/components/engine/red-flag-alert";
import { PriceAlertButton } from "@/components/price-alert-button";
import { RecallAlerts } from "@/components/safety/recall-alerts";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { HeroSection } from "@/components/vehicle/hero-section";
import { ImageGrid } from "@/components/vehicle/image-grid";
import dynamic from "next/dynamic";
import { generateBreadcrumbSchema } from "@/lib/schema/breadcrumb-schema";
import { RelatedLinks } from "@/components/seo/related-links";
const SpecsRadar = dynamic(() => import("@/components/vehicle/specs-radar").then(m => m.SpecsRadar));
const SeatConfigurator = dynamic(() => import("@/components/family/seat-configurator").then(m => m.SeatConfigurator));
const CargoCalculator = dynamic(() => import("@/components/cargo/cargo-calculator").then(m => m.CargoCalculator));
const TrimDecoder = dynamic(() => import("@/components/trims/trim-decoder").then(m => m.TrimDecoder));
const UXScore = dynamic(() => import("@/components/interior/ux-score").then(m => m.UXScore));
const GarageFit = dynamic(() => import("@/components/garage/garage-fit").then(m => m.GarageFit));
const ISOFIXSchema = dynamic(() => import("@/components/family/isofix-schema").then(m => m.ISOFIXSchema));
const ModelViewer = dynamic(() => import("@/components/3d/model-viewer").then(m => m.ModelViewer));
const ProsCons = dynamic(() => import("@/components/vehicle/pros-cons").then(m => m.ProsCons));
const ProfileLens = dynamic(() => import("@/components/vehicle/profile-lens").then(m => m.ProfileLens));
const UsedCarPricing = dynamic(() => import("@/components/vehicle/used-car-pricing").then(m => m.UsedCarPricing));
const CompatibilityScore = dynamic(() => import("@/components/vehicle/compatibility-score").then(m => m.CompatibilityScore));
import { generateProsCons } from "@/lib/generate-pros-cons";
import { generateVehicleSchema } from "@/lib/schema/vehicle-schema";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ViewTracker } from "@/components/view-tracker";
import { EssentialStats } from "@/components/vehicle/essential-stats";
import { CompareQuickAction } from "@/components/vehicle/quick-actions";
import { AlternativesShelf } from "@/components/vehicle/alternatives-shelf";
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
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}` },
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
  interiorDims: any;
  hasSeatCompat: boolean;
  hasTrims: boolean;
  hasUXRating: boolean;
  model3d: any;
  realConsumption: string | null;
  segment: string | null;
} | null> {
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
    { data: interiorDims },
    { data: seatCompat },
    { data: trimCheck },
    { data: uxCheck },
    { data: model3dData },
    { data: realConsoData },
  ] = await Promise.all([
    db
      .from("engine_variants")
      .select("*, powertrain_specs(*), performance_specs(*)")
      .eq("generation_id", generation.id)
      .limit(50),
    db
      .from("vehicle_images")
      .select("id, url, image_type, source, confidence, width")
      .eq("generation_id", generation.id)
      .neq("confidence", "E")
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
    db
      .from("interior_dimensions")
      .select("trunk_volume_liters, trunk_volume_max_liters, frunk_volume_liters, fuel_tank_liters, seating_capacity")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("child_seat_vehicle_compatibility")
      .select("id")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("trims")
      .select("id")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("ux_ratings")
      .select("generation_id")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("vehicle_3d_models")
      .select("embed_url, thumbnail_url, model_url, author, license")
      .eq("generation_id", generation.id)
      .limit(1),
    db
      .from("third_party_specs")
      .select("spec_type, spec_value, raw_data")
      .eq("generation_id", generation.id)
      .eq("source", "spritmonitor")
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

  // Sort images by quality: confidence tier + type + width
  const CONF_WEIGHT: Record<string, number> = { A: 10, B: 8, C: 6, D: 4, E: 2 };
  const TYPE_WEIGHT: Record<string, number> = { exterior: 6, interior: 4, blueprint: 3, technical: 3, cutaway: 3, diagram: 2 };
  const sortedImages = (images || []).sort((a, b) => {
    const sa = (CONF_WEIGHT[a.confidence] || 2) + (TYPE_WEIGHT[a.image_type] || 1) + Math.min((a.width || 0) / 200, 5);
    const sb = (CONF_WEIGHT[b.confidence] || 2) + (TYPE_WEIGHT[b.image_type] || 1) + Math.min((b.width || 0) / 200, 5);
    return sb - sa;
  });

  // Group images
  const exteriors = sortedImages.filter((i) => i.image_type === "exterior");
  const interiors = sortedImages.filter((i) => i.image_type === "interior");
  const technicals = sortedImages.filter((i) =>
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
    interiorDims: interiorDims?.[0] || null,
    hasSeatCompat: (seatCompat || []).length > 0,
    hasTrims: (trimCheck || []).length > 0,
    hasUXRating: (uxCheck || []).length > 0,
    model3d: model3dData?.[0] || null,
    realConsumption: realConsoData?.[0]?.spec_value || null,
    segment: model.segment || generation.body_style || null,
  };
}

function getYear(d: string | null) {
  return d ? new Date(d).getFullYear() : null;
}

export default async function VehiclePage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const data = await getVehicleData(bs, ms, gs);
  if (!data) notFound();

  const { brand, model, generation, variants, images, safety, familyFit, pricing, interiorDims, hasSeatCompat, hasTrims, hasUXRating, model3d, realConsumption, segment } = data;
  const genLbl = generation.internal_code || generation.name;
  const yearStart = getYear(generation.production_start);
  const yearEnd = getYear(generation.production_end);

  // Fetch alternatives from search index (same segment, different vehicle)
  const db2 = createStaticClient();
  const altQuery = segment
    ? db2
        .from("vehicle_search_index")
        .select("*")
        .eq("segment", segment)
        .neq("generation_id", generation.id)
        .order("ncap_stars", { ascending: false, nullsFirst: false })
        .limit(12)
    : null;
  const alternatives = altQuery ? (await altQuery).data || [] : [];

  const vehicleSchema = generateVehicleSchema({
    brand,
    model,
    generation,
    variants,
    safety,
    interiorDims,
    images: images.all,
  });

  // Get top variant stats for hero + radar
  const topVariant = variants[0] || null;

  // Generate pros/cons
  const prosCons = generateProsCons({
    safetyStars: safety?.stars,
    powerHp: topVariant?.power_hp,
    trunkVolume: interiorDims?.trunk_volume_liters,
    isofixPoints: familyFit?.isofix_points,
    acceleration: topVariant?.acceleration_0_100,
    topSpeed: topVariant?.top_speed_kmh,
  });

  return (
    <div>
      <ViewTracker
        statKey="vehiclesViewed"
        recentlyViewed={{
          id: generation.id,
          brand: brand.name,
          model: model.name,
          gen: generation.internal_code || generation.name,
          slug: `/marques/${bs}/${ms}/${gs}`,
          thumbnail: images.exteriors[0]?.url || null,
        }}
      />
      <ViewTracker statKey="brandsViewed" uniqueSetKey="brands" uniqueValue={bs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Accueil", url: "/" },
              { name: "Marques", url: "/marques" },
              { name: brand.name, url: `/marques/${bs}` },
              { name: model.name, url: `/marques/${bs}/${ms}` },
              { name: generation.internal_code || generation.name },
            ])
          ),
        }}
      />

      {/* Breadcrumb — always visible */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <nav className="flex flex-wrap gap-2 text-sm text-muted-foreground" aria-label="Fil d'Ariane">
          <Link href="/marques" className="hover:text-primary">Marques</Link>
          <span>/</span>
          <Link href={`/marques/${bs}`} className="hover:text-primary">{brand.name}</Link>
          <span>/</span>
          <Link href={`/marques/${bs}/${ms}`} className="hover:text-primary">{model.name}</Link>
          <span>/</span>
          <span className="text-white">{genLbl}</span>
          {segment && (
            <Badge variant="secondary" className="ml-2 surface-3 text-xs">
              {segment}
            </Badge>
          )}
        </nav>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <WishlistButton generationId={generation.id} />
          <CompareQuickAction
            generationId={generation.id}
            vehicleName={`${brand.name} ${model.name} ${genLbl}`}
            thumbnail={images.exteriors[0]?.url || null}
          />
          <PriceAlertButton generationId={generation.id} vehicleName={`${brand.name} ${model.name} ${genLbl}`} />
        </div>
      </div>

      {/* Hero Section */}
      {images.exteriors.length > 0 ? (
        <HeroSection
          generationId={generation.id}
          brandName={brand.name}
          modelName={model.name}
          genLabel={genLbl}
          yearStart={yearStart}
          yearEnd={yearEnd}
          images={images.exteriors.slice(0, 4)}
          powerHp={topVariant?.power_hp}
          fuelType={topVariant?.fuel_type}
          safetyStars={safety?.stars}
          acceleration={topVariant?.acceleration_0_100}
        />
      ) : (
        /* Fallback header when no images */
        <div className="grain mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">
            {brand.name} <span className="text-primary">{model.name}</span> {genLbl}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="text-mono">{yearStart || "?"}&ndash;{yearEnd || "..."}</span>
            {generation.body_style && (
              <Badge variant="secondary" className="surface-3">{generation.body_style}</Badge>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        {/* Essential Stats Grid */}
        <div className="mt-6">
          <EssentialStats
            powerHp={topVariant?.power_hp}
            torqueNm={topVariant?.torque_nm}
            acceleration={topVariant?.acceleration_0_100}
            topSpeed={topVariant?.top_speed_kmh}
            trunkVolume={interiorDims?.trunk_volume_liters}
            safetyStars={safety?.stars}
            fuelType={topVariant?.fuel_type}
          />
        </div>

        {/* Specs Radar + Pros/Cons */}
        {(topVariant || safety) && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <SpecsRadar
              specs={{
                power_hp: topVariant?.power_hp,
                torque_nm: topVariant?.torque_nm,
                acceleration_0_100: topVariant?.acceleration_0_100,
                trunk_volume: interiorDims?.trunk_volume_liters,
                safety_rating: safety?.stars,
                top_speed: topVariant?.top_speed_kmh,
              }}
            />
            <ProsCons pros={prosCons.pros} cons={prosCons.cons} />
          </div>
        )}

        {/* Profile Lenses */}
        <ProfileLens
          data={{
            safetyStars: safety?.stars,
            isofixPoints: familyFit?.isofix_points,
            familyFitScore: familyFit?.family_fit_score,
            threeAcross: familyFit?.three_across_possible,
            trunkVolume: interiorDims?.trunk_volume_liters,
            seatingCapacity: interiorDims?.seating_capacity,
            powerHp: topVariant?.power_hp,
            torqueNm: topVariant?.torque_nm,
            acceleration: topVariant?.acceleration_0_100,
            topSpeed: topVariant?.top_speed_kmh,
            drivetrain: topVariant?.drivetrain,
            bodyStyle: generation.body_style,
            yearStart,
            yearEnd,
            internalCode: generation.internal_code,
            variantsCount: variants.length,
          }}
        />

        {/* Profile Compatibility Score */}
        <div className="mt-6">
          <CompatibilityScore
            vehicle={{
              power_hp: topVariant?.power_hp,
              fuel_type: topVariant?.fuel_type,
              trunk_liters: interiorDims?.trunk_volume_liters,
              safety_stars: safety?.stars,
              seats: interiorDims?.seating_capacity,
              isofix_count: familyFit?.isofix_points,
            }}
          />
        </div>

        {/* 3D Model */}
        {model3d?.embed_url && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" /> Mod&egrave;le 3D
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ModelViewer
                  embedUrl={model3d.embed_url}
                  thumbnailUrl={model3d.thumbnail_url}
                  title={`${brand.name} ${model.name} ${genLbl}`}
                  author={model3d.author}
                  license={model3d.license}
                  modelUrl={model3d.model_url}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Engine Red Flags */}
        {variants.length > 0 && (
          <div className="mt-6">
            <RedFlagAlert
              engineCodes={variants
                .map((v) => v.engine_code)
                .filter((c): c is string => !!c)}
            />
          </div>
        )}

        {/* Content tabs */}
        <Tabs defaultValue="specs" className="mt-8">
          <TabsList className="surface-2 w-full flex-nowrap justify-start overflow-x-auto scroll-smooth snap-x">
            <TabsTrigger value="specs">Motorisations</TabsTrigger>
            <TabsTrigger value="safety">S&eacute;curit&eacute;</TabsTrigger>
            <TabsTrigger value="gallery">Photos ({images.all.length})</TabsTrigger>
            {familyFit && <TabsTrigger value="family">Family Fit</TabsTrigger>}
            {hasSeatCompat && <TabsTrigger value="seats">Si&egrave;ges enfants</TabsTrigger>}
            {interiorDims?.trunk_volume_liters && <TabsTrigger value="coffre">Coffre</TabsTrigger>}
            {hasTrims && <TabsTrigger value="trims">Finitions</TabsTrigger>}
            {hasUXRating && <TabsTrigger value="ux">UX Score</TabsTrigger>}
            <TabsTrigger value="recalls">Rappels</TabsTrigger>
          </TabsList>

          {/* Motorisations */}
          <TabsContent value="specs" className="mt-6">
            {variants.length === 0 ? (
              <EmptyVariants />
            ) : (
              <div className="overflow-x-auto rounded-lg surface-2 border border-[var(--border-subtle)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--border-subtle)]">
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Motorisation</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Puissance</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Couple</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">0-100</TableHead>
                      <TableHead className="hidden text-right text-xs uppercase tracking-wider text-muted-foreground lg:table-cell">V.max</TableHead>
                      <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground lg:table-cell">Transmission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v, i) => (
                      <TableRow key={v.id} className={`border-[var(--border-subtle)] transition-colors hover:bg-(--bg-hover) ${i % 2 === 1 ? "surface-3" : ""}`}>
                        <TableCell>
                          <div className="font-medium text-white">{v.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {v.fuel_type && <span>{v.fuel_type}</span>}
                            {v.displacement_cc && (
                              <span> &middot; {(v.displacement_cc / 1000).toFixed(1)}L</span>
                            )}
                            {v.cylinders && <span> {v.cylinders}cyl</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-mono font-bold text-white">
                          {v.power_hp ? `${v.power_hp} ch` : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right text-mono text-white">
                          {v.torque_nm ? `${v.torque_nm} Nm` : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right text-mono text-white">
                          {v.acceleration_0_100 ? `${v.acceleration_0_100}s` : "\u2014"}
                        </TableCell>
                        <TableCell className="hidden text-right text-mono text-white lg:table-cell">
                          {v.top_speed_kmh ? `${v.top_speed_kmh} km/h` : "\u2014"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm text-white">
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
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="surface-3 rounded-xl border border-[var(--border-subtle)] p-4 text-center">
                  <Fuel className="mx-auto mb-2 h-4 w-4 text-primary/50" />
                  <div className="text-mono text-2xl font-bold text-white">{pricing.co2_gkm}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">g CO2/km</div>
                </div>
                <div className="surface-3 rounded-xl border border-[var(--border-subtle)] p-4 text-center">
                  <div className="text-mono text-2xl font-bold text-white">
                    {pricing.malus_2024_eur > 0
                      ? `${pricing.malus_2024_eur.toLocaleString("fr-FR")} \u20ac`
                      : "0 \u20ac"}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Malus 2024</div>
                </div>
                <div className="surface-3 rounded-xl border border-[var(--border-subtle)] p-4 text-center">
                  <div className="text-mono text-2xl font-bold text-white">
                    {pricing.malus_2025_eur > 0
                      ? `${pricing.malus_2025_eur.toLocaleString("fr-FR")} \u20ac`
                      : "0 \u20ac"}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Malus 2025</div>
                </div>
              </div>
            )}

            {/* Real Consumption */}
            {realConsumption && (
              <div className="mt-6 surface-3 rounded-xl border border-[var(--border-subtle)] p-4 flex items-center gap-4">
                <Fuel className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">Consommation réelle</div>
                  <div className="text-xs text-muted-foreground">Moyenne mesurée par les conducteurs (Spritmonitor)</div>
                </div>
                <div className="ml-auto text-mono text-xl font-bold text-white">{realConsumption} L/100km</div>
              </div>
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
                  <div className="mb-6 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-7 w-7 ${
                          i < (safety.stars || 0)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                    <span className="ml-3 text-mono text-xl font-bold text-white">
                      {safety.stars}/5
                    </span>
                    <ConfidenceBadge tier={safety.confidence} size="sm" />
                  </div>
                  {safety.confidence === "D" && (
                    <p className="mb-4 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-sm text-orange-400">
                      Ces donn&eacute;es sont estim&eacute;es par heuristique (segment, marque, &eacute;poque) et n&apos;ont pas &eacute;t&eacute; v&eacute;rifi&eacute;es par un crash test officiel.
                    </p>
                  )}
                  <div className="space-y-5">
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
              <EmptySafety />
            )}
          </TabsContent>

          {/* Gallery */}
          <TabsContent value="gallery" className="mt-6">
            {images.all.length === 0 ? (
              <EmptyPhotos />
            ) : (
              <div className="space-y-8">
                {images.exteriors.length > 0 && (
                  <section>
                    <h3 className="mb-3 font-display font-semibold text-white">
                      Ext&eacute;rieur ({images.exteriors.length})
                    </h3>
                    <ImageGrid images={images.exteriors} alt={`${brand.name} ${model.name}`} />
                  </section>
                )}
                {images.interiors.length > 0 && (
                  <section>
                    <h3 className="mb-3 font-display font-semibold text-white">
                      Int&eacute;rieur ({images.interiors.length})
                    </h3>
                    <ImageGrid images={images.interiors} alt={`${brand.name} ${model.name} int\u00e9rieur`} />
                  </section>
                )}
                {images.technicals.length > 0 && (
                  <section>
                    <h3 className="mb-3 font-display font-semibold text-white">
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

              {/* ISOFIX Schema */}
              {familyFit.isofix_positions && familyFit.isofix_positions.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Sch&eacute;ma ISOFIX</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ISOFIXSchema
                      isofixPositions={familyFit.isofix_positions}
                      centerIsofix={familyFit.center_isofix ?? false}
                      topTetherPoints={familyFit.top_tether_points ?? 0}
                      rearBenchWidthMm={familyFit.rear_bench_width_usable_mm}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Seat Configurator */}
          {hasSeatCompat && (
            <TabsContent value="seats" className="mt-6">
              <SeatConfigurator
                generationId={generation.id}
                vehicleName={`${brand.name} ${model.name} ${genLbl}`}
              />
            </TabsContent>
          )}

          {/* Cargo Calculator */}
          {interiorDims?.trunk_volume_liters && (
            <TabsContent value="coffre" className="mt-6">
              <CargoCalculator
                vehicleName={`${brand.name} ${model.name} ${genLbl}`}
                cargoData={{
                  trunk_volume_liters: interiorDims.trunk_volume_liters,
                  trunk_volume_max_liters: interiorDims.trunk_volume_max_liters,
                  frunk_volume_liters: interiorDims.frunk_volume_liters,
                  max_load_kg: null,
                  vehicle_length_mm: null,
                }}
              />
            </TabsContent>
          )}

          {/* Trim Decoder */}
          {hasTrims && (
            <TabsContent value="trims" className="mt-6">
              <TrimDecoder generationId={generation.id} />
            </TabsContent>
          )}

          {/* UX Score */}
          {hasUXRating && (
            <TabsContent value="ux" className="mt-6">
              <UXScore generationId={generation.id} />
            </TabsContent>
          )}

          {/* Recalls */}
          <TabsContent value="recalls" className="mt-6">
            <RecallAlerts generationId={generation.id} />
          </TabsContent>
        </Tabs>

        {/* TCO Preview */}
        {(pricing?.co2_gkm || realConsumption) && (
          <div className="mt-6 surface-3 rounded-xl border border-[var(--border-subtle)] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg surface-2">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">Combien co&ucirc;te vraiment cette voiture ?</p>
                <p className="text-sm text-muted-foreground">
                  D&eacute;couvrez le co&ucirc;t mensuel r&eacute;el avec notre calculateur TCO
                </p>
              </div>
              <a
                href={`/tco?vehicle=${generation.id}`}
                className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
              >
                Calculer
              </a>
            </div>
          </div>
        )}

        {/* Used Car Pricing */}
        <div className="mt-6">
          <UsedCarPricing brandName={brand.name} modelName={model.name} />
        </div>

        {/* Garage Fit */}
        <div className="mt-6">
          <GarageFit
            generationId={generation.id}
            vehicleName={`${brand.name} ${model.name} ${genLbl}`}
          />
        </div>

        {/* Alternatives carousel */}
        <AlternativesShelf
          alternatives={alternatives}
          currentId={generation.id}
          altPageHref={`/marques/${bs}/${ms}/${gs}/alternatives`}
        />

        {/* Sub-page navigation */}
        <div className="mt-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-0.5 w-8 rounded-full bg-primary" />
            <h2 className="font-display text-2xl font-bold">Explorer en d&eacute;tail</h2>
          </div>
          <VehicleNav basePath={`/marques/${bs}/${ms}/${gs}`} />
        </div>

        {/* Related links for internal linking / SEO */}
        <RelatedLinks
          links={[
            { label: `Fiche technique`, href: `/marques/${bs}/${ms}/${gs}/fiche-technique` },
            { label: `Sécurité Euro NCAP`, href: `/marques/${bs}/${ms}/${gs}/securite` },
            { label: `Photos`, href: `/marques/${bs}/${ms}/${gs}/photos` },
            { label: `Vidéos`, href: `/marques/${bs}/${ms}/${gs}/videos` },
            { label: `Alternatives`, href: `/marques/${bs}/${ms}/${gs}/alternatives` },
            { label: `Fiabilité`, href: `/marques/${bs}/${ms}/${gs}/fiabilite` },
            { label: `Dimensions`, href: `/marques/${bs}/${ms}/${gs}/dimensions` },
            { label: `Tous les ${model.name}`, href: `/marques/${bs}/${ms}` },
            { label: `Tous les ${brand.name}`, href: `/marques/${bs}` },
          ]}
        />

        {/* Affiliation + Newsletter */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <AffiliationCTA brand={brand.name} model={model.name} />
          <NewsletterSection source="vehicle-page" />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tier =
    value >= 80 ? "excellent" : value >= 60 ? "good" : value >= 40 ? "average" : "poor";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-mono font-bold text-white">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={`bar-animate h-full rounded-full bar-perf-${tier}`}
          style={{ width: `${value}%` }}
        />
      </div>
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
    <div className="surface-3 rounded-xl border border-[var(--border-subtle)] p-4 text-center">
      <div className="text-mono text-2xl font-bold text-white">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

