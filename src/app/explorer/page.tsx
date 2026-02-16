import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Car,
  Fuel,
  Wallet,
  Calendar,
  ChevronRight,
} from "lucide-react";
import {
  SEGMENT_CATEGORIES,
  FUEL_CATEGORIES,
  BUDGET_CATEGORIES,
  DECADE_CATEGORIES,
} from "@/lib/explorer-config";
import type { Metadata } from "next";

export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

export const metadata: Metadata = {
  title: "Explorer — Parcourir par segment, carburant, budget et décennie",
  description:
    "Explorez 4 268 générations automobiles par segment (SUV, berline, coupé…), carburant (essence, diesel, électrique…), budget ou décennie.",
  alternates: { canonical: "/explorer" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Explorer&subtitle=Parcourir%20par%20segment%2C%20carburant%2C%20budget%20et%20d%C3%A9cennie",
      },
    ],
  },
};

const SECTIONS = [
  {
    title: "Par segment",
    icon: Car,
    base: "/explorer/segment",
    items: SEGMENT_CATEGORIES,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    title: "Par carburant",
    icon: Fuel,
    base: "/explorer/carburant",
    items: FUEL_CATEGORIES,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Par budget",
    icon: Wallet,
    base: "/explorer/budget",
    items: BUDGET_CATEGORIES,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    title: "Par décennie",
    icon: Calendar,
    base: "/explorer/decennie",
    items: DECADE_CATEGORIES,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
];

export default function ExplorerHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Explorer" }]} />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Explorer
      </h1>
      <p className="mt-2 text-muted-foreground">
        Parcourez l'encyclopédie automobile par segment, carburant, budget ou
        décennie.
      </p>

      <div className="mt-10 space-y-12">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title}>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-0.5 w-8 rounded-full bg-primary" />
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <Icon className={`h-5 w-5 ${section.color}`} />
                  {section.title}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((cat) => (
                  <Link key={cat.slug} href={`${section.base}/${cat.slug}`}>
                    <Card className="card-hover group h-full">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${section.bg} ${section.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-white">
                            {cat.label}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {cat.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Explorer — FLM AUTO",
            description:
              "Parcourez l'encyclopédie automobile par segment, carburant, budget ou décennie.",
            hasPart: SECTIONS.flatMap((s) =>
              s.items.map((cat) => ({
                "@type": "ItemList",
                name: cat.label,
                url: `${BASE}${s.base}/${cat.slug}`,
              }))
            ),
          }),
        }}
      />
    </div>
  );
}
