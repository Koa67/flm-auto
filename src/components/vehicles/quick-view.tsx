"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { Zap, Fuel, Star, ExternalLink } from "lucide-react";

interface VehicleData {
  id: string;
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  name: string;
  slug: string;
  image?: string;
  year?: number;
  body_type?: string;
  power?: number;
  ncap_stars?: number;
}

export function QuickView({
  vehicle,
  trigger,
}: {
  vehicle: VehicleData;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const href = `/marques/${vehicle.brand_slug}/${vehicle.model_slug}/${vehicle.slug}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </div>

      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {vehicle.brand} {vehicle.model} {vehicle.name}
          </DialogTitle>
          <DialogDescription>Aperçu rapide du véhicule</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-[4/3] bg-muted">
            {vehicle.image ? (
              <Image
                src={vehicle.image}
                alt={`${vehicle.brand} ${vehicle.model}`}
                fill
                className="object-cover"
                sizes="400px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl">
                🚗
              </div>
            )}
            <div className="absolute right-3 top-3">
              <FavoriteButton generationId={vehicle.id} />
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 p-6">
            <div>
              <p className="text-sm text-muted-foreground">{vehicle.brand}</p>
              <h2 className="text-xl font-bold">
                {vehicle.model} {vehicle.name}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {vehicle.power && (
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {vehicle.power} ch
                </Badge>
              )}
              {vehicle.ncap_stars && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" />
                  {vehicle.ncap_stars}★ NCAP
                </Badge>
              )}
              {vehicle.year && (
                <Badge variant="outline">{vehicle.year}</Badge>
              )}
              {vehicle.body_type && (
                <Badge variant="outline">{vehicle.body_type}</Badge>
              )}
            </div>

            <div className="pt-4">
              <Link href={href} onClick={() => setOpen(false)}>
                <Button className="w-full gap-2">
                  Voir la fiche complète
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
