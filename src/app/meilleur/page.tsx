import Link from "next/link";
import { createStaticClient } from "@/lib/supabase/server";
import {
  RANKING_CATEGORIES,
  RANKING_GROUPS,
} from "@/lib/rankings/categories";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Baby,
  Shield,
  Gauge,
  Package,
  Car,
  Trophy,
  Users,
  Anchor,
  Timer,
  Zap,
  RotateCcw,
  Maximize,
  Cpu,
  PersonStanding,
  UserCheck,
  Rocket,
  Heart,
  Flame,
} from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h

export const metadata: Metadata = {
  title: "Classements automobiles 2026 — Les meilleurs véhicules par catégorie",
  description:
    "32 classements automobiles : meilleur SUV familial, voiture 5 étoiles Euro NCAP, plus grand coffre, voiture la plus rapide, et plus encore.",
  alternates: { canonical: "/meilleur" },
  openGraph: {
    images: [{ url: "/api/og?title=Classements&subtitle=32%20classements%20automobiles%202026" }],
  },
};

const ICON_MAP: Record<string, any> = {
  Baby,
  Shield,
  Gauge,
  Package,
  Car,
  Trophy,
  Users,
  Anchor,
  Timer,
  Zap,
  RotateCcw,
  Maximize,
  Cpu,
  PersonStanding,
  UserCheck,
  Rocket,
  Heart,
  Flame,
};

const GROUP_ICONS: Record<string, any> = {
  famille: Baby,
  securite: Shield,
  performance: Gauge,
  coffre: Package,
  segment: Car,
  divers: Trophy,
};

async function getCategoryCounts(db: any) {
  const counts = await Promise.all(
    RANKING_CATEGORIES.map(async (cat) => {
      try {
        const results = await cat.query(db);
        const uniqueIds = new Set(results.map((r: any) => r.generation_id));
        return { slug: cat.slug, count: uniqueIds.size };
      } catch {
        return { slug: cat.slug, count: 0 };
      }
    })
  );
  return Object.fromEntries(counts.map((c) => [c.slug, c.count]));
}

export default async function MeilleurIndexPage() {
  const db = createStaticClient();
  const counts = await getCategoryCounts(db);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Classements" }]} />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Classements automobiles 2025
      </h1>
      <p className="mt-2 text-muted-foreground">
        {RANKING_CATEGORIES.length} classements basés sur des données vérifiées
        : sécurité Euro NCAP, performances, coffre, famille et plus.
      </p>

      <div className="mt-10 space-y-12">
        {RANKING_GROUPS.map((group) => {
          const GroupIcon = GROUP_ICONS[group.key] || Trophy;
          const cats = RANKING_CATEGORIES.filter(
            (c) => c.group === group.key
          );
          if (cats.length === 0) return null;

          return (
            <section key={group.key}>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-0.5 w-8 rounded-full bg-primary" />
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <GroupIcon className="h-5 w-5 text-primary" />
                  {group.label}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cats.map((cat) => {
                  const Icon = ICON_MAP[cat.icon] || Trophy;
                  const count = counts[cat.slug] || 0;

                  return (
                    <Link key={cat.slug} href={`/meilleur/${cat.slug}`}>
                      <Card className="card-hover group h-full">
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg surface-3 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium leading-tight text-white">
                              {cat.title}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {count} véhicule{count !== 1 ? "s" : ""} classé
                              {count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
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
            name: "Classements automobiles 2025",
            description:
              "32 classements automobiles basés sur des données vérifiées.",
            hasPart: RANKING_CATEGORIES.map((cat) => ({
              "@type": "ItemList",
              name: cat.title,
              url: `https://flm-auto.vercel.app/meilleur/${cat.slug}`,
            })),
          }),
        }}
      />
    </div>
  );
}
