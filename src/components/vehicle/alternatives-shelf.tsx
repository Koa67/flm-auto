import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HorizontalScroll, ScrollCard } from "@/components/ui/horizontal-scroll";
import { ArrowRight } from "lucide-react";

interface Alternative {
  generation_id: string;
  brand_name: string;
  brand_slug: string;
  model_name: string;
  model_slug: string;
  generation_slug: string;
  internal_code: string | null;
  generation_name: string;
  thumbnail_url: string | null;
  power_hp: number | null;
  ncap_stars: number | null;
  year_start: number | null;
}

interface AlternativesShelfProps {
  alternatives: Alternative[];
  currentId: string;
  altPageHref: string;
}

export function AlternativesShelf({
  alternatives,
  currentId,
  altPageHref,
}: AlternativesShelfProps) {
  const filtered = alternatives.filter((a) => a.generation_id !== currentId);
  if (filtered.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-0.5 w-8 rounded-full bg-primary" />
        <h2 className="font-display text-xl font-semibold">
          Alternatives similaires
        </h2>
        <Link
          href={altPageHref}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <HorizontalScroll>
        {filtered.map((v) => (
          <ScrollCard key={v.generation_id}>
            <Link
              href={`/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`}
            >
              <Card className="card-hover group h-full overflow-hidden">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
                  {v.thumbnail_url ? (
                    <Image
                      src={v.thumbnail_url}
                      alt={`${v.brand_name} ${v.model_name}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="280px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-muted-foreground/20">
                      🚗
                    </div>
                  )}
                  {v.year_start && (
                    <Badge className="absolute right-2 top-2 bg-background/80 text-xs backdrop-blur-sm">
                      {v.year_start}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {v.brand_name} {v.model_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.internal_code || v.generation_name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {v.power_hp && <span>{v.power_hp} ch</span>}
                    {v.ncap_stars && (
                      <span className="text-amber-400">
                        {"★".repeat(v.ncap_stars)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </ScrollCard>
        ))}
      </HorizontalScroll>
    </div>
  );
}
