"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Car,
  GitCompareArrows,
  Baby,
  Shield,
  Gauge,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  { label: "Marques", value: "32", icon: Car },
  { label: "G\u00e9n\u00e9rations", value: "4 268", icon: Gauge },
  { label: "Photos", value: "47 000+", icon: Search },
  { label: "Fiches techniques", value: "343 000+", icon: Shield },
];

const features = [
  {
    title: "Comparateur",
    description:
      "Comparez jusqu'\u00e0 4 v\u00e9hicules c\u00f4te \u00e0 c\u00f4te : puissance, performance, s\u00e9curit\u00e9.",
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
    title: "Euro NCAP",
    description:
      "Notes de s\u00e9curit\u00e9 Euro NCAP, scores adultes, enfants, pi\u00e9tons.",
    href: "/recherche",
    icon: Shield,
  },
];

const popularBrands = [
  { name: "BMW", slug: "bmw" },
  { name: "Mercedes-Benz", slug: "mercedes-benz" },
  { name: "Audi", slug: "audi" },
  { name: "Porsche", slug: "porsche" },
  { name: "Volkswagen", slug: "volkswagen" },
  { name: "Tesla", slug: "tesla" },
  { name: "Toyota", slug: "toyota" },
  { name: "Volvo", slug: "volvo" },
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          L&apos;encyclop&eacute;die
          <br />
          <span className="text-primary">automobile</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          32 marques, 4 268 g&eacute;n&eacute;rations, fiches techniques
          compl&egrave;tes, photos, comparateur et outils famille.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="mt-8 flex w-full max-w-md items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BMW M3, Porsche 911, Golf GTI..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Rechercher</Button>
        </form>

        {/* Popular brands */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {popularBrands.map((brand) => (
            <Link key={brand.slug} href={`/marques/${brand.slug}`}>
              <Button variant="outline" size="sm" className="text-xs">
                {brand.name}
              </Button>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/30 px-4 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2">
              <stat.icon className="h-6 w-6 text-muted-foreground" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold">Outils</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-6">
                    <feature.icon className="h-8 w-8 text-primary" />
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                      D&eacute;couvrir{" "}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Explorez toutes les marques</h2>
        <p className="mt-2 text-muted-foreground">
          De Alfa Romeo &agrave; Volvo, d&eacute;couvrez chaque mod&egrave;le en
          d&eacute;tail.
        </p>
        <Link href="/marques">
          <Button size="lg" className="mt-6">
            Voir les 32 marques <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
