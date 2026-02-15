"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HorizontalScroll, ScrollCard } from "@/components/ui/horizontal-scroll";
import { useRecentlyViewed } from "@/lib/recently-viewed-store";

export function RecentlyViewedShelf() {
  const items = useRecentlyViewed((s) => s.items);
  const clearAll = useRecentlyViewed((s) => s.clearAll);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || items.length === 0) return null;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">
            Consultés récemment
          </h2>
          <span className="text-xs text-muted-foreground">
            {items.length} véhicule{items.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto h-7 text-xs text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Effacer
          </Button>
        </div>
        <HorizontalScroll>
          {items.map((item) => (
            <ScrollCard key={item.id}>
              <Link href={item.slug}>
                <Card className="card-hover group h-full overflow-hidden">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={`${item.brand} ${item.model}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="280px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl text-muted-foreground/20">
                        🚗
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.brand} {item.model}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.gen}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </ScrollCard>
          ))}
        </HorizontalScroll>
      </div>
    </section>
  );
}
