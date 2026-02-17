"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFavorites } from "@/hooks/use-favorites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VehicleDetail {
  id: string;
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  generation: string;
  generation_slug: string;
  year_start: number | null;
  year_end: number | null;
  image: string | null;
}

export function WishlistGrid() {
  const { favorites, toggle } = useFavorites();
  const [vehicles, setVehicles] = useState<VehicleDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (favorites.length === 0) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/wishlist/details?ids=${favorites.join(",")}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setVehicles(json.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [favorites]);

  const handleRemove = (generationId: string) => {
    toggle(generationId);
    // Fire-and-forget server sync
    fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation_id: generationId }),
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <Heart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Aucun favori</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Explorez les fiches vehicules et appuyez sur le coeur pour
          sauvegarder vos modeles preferes ici.
        </p>
        <Link href="/marques" className="mt-4">
          <Button variant="outline">Explorer les marques</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {favorites.length} vehicule{favorites.length !== 1 ? "s" : ""} sauvegarde
        {favorites.length !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {vehicles.map((v) => (
            <motion.div
              key={v.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                {/* Image */}
                <Link
                  href={`/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`}
                >
                  <div className="relative aspect-[16/10] bg-muted">
                    {v.image ? (
                      <Image
                        src={v.image}
                        alt={`${v.brand} ${v.model} ${v.generation}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-3xl font-bold text-muted-foreground/30">
                          {v.brand.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(v.id)}
                  aria-label={`Retirer ${v.brand} ${v.model} des favoris`}
                  className={cn(
                    "absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm",
                    "opacity-0 transition-opacity group-hover:opacity-100",
                    "hover:bg-destructive hover:text-destructive-foreground",
                    "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Info */}
                <Link
                  href={`/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {v.brand} {v.model}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {v.generation}
                        </p>
                      </div>
                      {v.year_start && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {v.year_start}&ndash;{v.year_end || "..."}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
