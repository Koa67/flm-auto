import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Car,
  GitCompareArrows,
  Baby,
  Shield,
  Gauge,
  ArrowRight,
  Camera,
  Film,
  Package,
  Calculator,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { GradientDivider } from "@/components/ui/gradient-divider";
import { InstantSearch } from "@/components/search/instant-search";
import { ProfileRecommendations } from "@/components/home/profile-recommendations";
import { createServerClient } from "@/lib/supabase-server";
import { generateWebSiteSchema } from "@/lib/schema/website-schema";

export const revalidate = 3600;

const tools = [
  {
    title: "Comparateur",
    description:
      "Comparez jusqu\u2019\u00e0 4 v\u00e9hicules c\u00f4te \u00e0 c\u00f4te : puissance, performance, s\u00e9curit\u00e9.",
    href: "/comparer",
    icon: GitCompareArrows,
  },
  {
    title: "Family Fit",
    description:
      "Trouvez la voiture id\u00e9ale pour votre famille : ISOFIX, si\u00e8ges enfants, 3-across.",
    href: "/family-fit",
    icon: Baby,
  },
  {
    title: "Coffre",
    description:
      "V\u00e9rifiez si votre chargement rentre dans le coffre : poussettes, valises, v\u00e9los.",
    href: "/coffre",
    icon: Package,
  },
  {
    title: "TCO",
    description:
      "Calculez le co\u00fbt total de possession : d\u00e9cote, carburant, assurance, entretien.",
    href: "/tco",
    icon: Calculator,
  },
  {
    title: "Classements",
    description:
      "Top s\u00e9curit\u00e9, plus grand coffre, meilleur SUV familial et 30+ classements.",
    href: "/meilleur",
    icon: Trophy,
  },
  {
    title: "Recherche avanc\u00e9e",
    description:
      "Filtrez par marque, puissance, segment, motorisation, s\u00e9curit\u00e9 NCAP.",
    href: "/recherche",
    icon: Search,
  },
];

async function getHomeData() {
  const db = createServerClient();

  const [
    { count: brandsCount },
    { count: generationsCount },
    { count: photosCount },
    { count: specsCount },
    { count: videosCount },
    { data: popularGens },
    { data: brands },
  ] = await Promise.all([
    db.from("brands").select("*", { count: "exact", head: true }),
    db.from("generations").select("*", { count: "exact", head: true }),
    db.from("vehicle_images").select("*", { count: "exact", head: true }),
    db.from("third_party_specs").select("*", { count: "exact", head: true }),
    db.from("vehicle_videos").select("*", { count: "exact", head: true }),
    db.rpc("get_popular_generations", {}).limit(8),
    db.from("brands").select("id, name, slug").order("name"),
  ]);

  let popular = popularGens;
  if (!popular || popular.length === 0) {
    const { data: fallback } = await db
      .from("generations")
      .select("id, name, slug, internal_code, production_start, model:models!inner(name, slug, brand:brands!inner(name, slug))")
      .order("created_at", { ascending: false })
      .limit(8);
    popular = fallback;
  }

  const popIds = (popular || []).map((g: any) => g.id);
  const { data: popImages } = popIds.length > 0
    ? await db
        .from("vehicle_images")
        .select("generation_id, url")
        .in("generation_id", popIds)
        .eq("image_type", "exterior")
        .limit(50)
    : { data: [] };

  const imageMap = new Map<string, string>();
  for (const img of popImages || []) {
    if (!imageMap.has(img.generation_id)) {
      imageMap.set(img.generation_id, img.url);
    }
  }

  return {
    stats: {
      brands: brandsCount || 32,
      generations: generationsCount || 4268,
      photos: photosCount || 355000,
      specs: specsCount || 346000,
      videos: videosCount || 38000,
    },
    popular: (popular || []).map((g: any) => {
      const m = g.model || g.models;
      const b = m?.brand || m?.brands;
      return {
        id: g.id,
        name: `${b?.name || ""} ${m?.name || ""}`,
        genLabel: g.internal_code || g.name,
        slug: `/marques/${b?.slug}/${m?.slug}/${g.slug}`,
        imageUrl: imageMap.get(g.id) || null,
        year: g.production_start ? new Date(g.production_start).getFullYear() : null,
      };
    }),
    brands: brands || [],
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default async function Home() {
  const { stats, popular, brands } = await getHomeData();

  return (
    <div className="flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteSchema()) }}
      />
      {/* Hero */}
      <section className="grain relative flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        {/* Gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl md:text-7xl">
          L&apos;encyclop&eacute;die
          <br />
          <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">automobile</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          {stats.brands} marques, {formatNumber(stats.generations)} g&eacute;n&eacute;rations,
          fiches techniques compl&egrave;tes, photos, comparateur et outils famille.
        </p>

        {/* Animated counter */}
        <p className="animate-count mt-3 text-mono text-sm text-primary/70">
          {formatNumber(stats.generations)} v&eacute;hicules analys&eacute;s
        </p>

        {/* Search bar */}
        <div className="mt-8 w-full max-w-xl">
          <InstantSearch />
        </div>

        {/* Quick brand buttons */}
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="navigation" aria-label="Marques populaires">
          {["BMW", "Mercedes-Benz", "Audi", "Porsche", "Volkswagen", "Tesla", "Toyota", "Volvo"].map(
            (name) => {
              const slug = name.toLowerCase().replace(/\s+/g, "-");
              return (
                <Link key={slug} href={`/marques/${slug}`} aria-label={`Voir ${name}`}>
                  <button className="surface-3 rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground transition-all hover:border-primary hover:text-white sm:px-3 sm:py-1.5">
                    {name}
                  </button>
                </Link>
              );
            }
          )}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="section-accent px-4 py-12">
        <div className="stagger-reveal mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 sm:gap-12">
          {[
            { label: "Marques", value: stats.brands, icon: Car },
            { label: "G\u00e9n\u00e9rations", value: stats.generations, icon: Gauge },
            { label: "Photos", value: stats.photos, icon: Camera },
            { label: "Fiches techniques", value: stats.specs, icon: Shield },
            { label: "Vid\u00e9os", value: stats.videos, icon: Film },
          ].map((stat, i, arr) => (
            <div key={stat.label} className="flex items-center gap-8 sm:gap-12">
              <div className="flex flex-col items-center gap-2">
                <stat.icon className="h-6 w-6 text-primary/50" />
                <span className="font-display text-2xl font-bold text-white sm:text-3xl">
                  {formatNumber(stat.value)}
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="hidden h-8 w-px bg-[var(--border-subtle)] sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Personalized Recommendations (profile-based) */}
      <ProfileRecommendations />

      {/* Popular Vehicles */}
      {popular.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeader title="V\u00e9hicules populaires" />
            <div className="stagger-reveal grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((v: any) => (
                <Link key={v.id} href={v.slug}>
                  <Card className="card-hover group overflow-hidden">
                    <div className="relative aspect-[16/10] bg-[var(--bg-tertiary)]">
                      {v.imageUrl ? (
                        <>
                          <Image
                            src={v.imageUrl}
                            alt={v.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent" />
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Car className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-white">{v.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{v.genLabel}</span>
                        {v.year && (
                          <Badge variant="outline" className="surface-4 text-mono text-xs">
                            {v.year}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tools */}
      <section className="section-accent px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <SectionHeader title="Outils" />
          <div className="stagger-reveal grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((feature) => (
              <Link key={feature.href} href={feature.href}>
                <Card className="card-hover group h-full">
                  <CardContent className="flex flex-col gap-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg surface-3">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      D&eacute;couvrir <ArrowRight className="h-3 w-3" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Showcase */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeader title="Toutes les marques" />
          <div className="stagger-reveal grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {brands.map((brand: any) => (
              <Link
                key={brand.id}
                href={`/marques/${brand.slug}`}
                className="group flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-all hover:scale-105"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full surface-2 border border-[var(--border-subtle)] transition-shadow group-hover:glow-blue">
                  <span className="font-display text-xl text-primary">
                    {brand.name.charAt(0)}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-white">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="grain relative px-4 py-16 text-center">
        <GradientDivider className="absolute inset-x-0 top-0" />
        <h2 className="font-display text-2xl font-bold">Explorez l&apos;encyclop&eacute;die</h2>
        <p className="mt-2 text-muted-foreground">
          De Alfa Romeo &agrave; Volvo, d&eacute;couvrez chaque mod&egrave;le en d&eacute;tail.
        </p>
        <Link href="/marques">
          <Button size="lg" className="mt-6 shadow-lg shadow-primary/20">
            Voir les {stats.brands} marques <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
