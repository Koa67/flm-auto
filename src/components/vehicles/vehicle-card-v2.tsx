"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Zap, Fuel, Baby } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: {
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
    consumption?: number;
    ncap_stars?: number;
    family_fit_score?: number;
  };
  variant?: "default" | "compact" | "wide";
}

export function VehicleCardV2({
  vehicle,
  variant = "default",
}: VehicleCardProps) {
  const href = `/marques/${vehicle.brand_slug}/${vehicle.model_slug}/${vehicle.slug}`;

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4 }}
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/30",
          variant === "wide" && "flex"
        )}
      >
        {/* Image */}
        <div
          className={cn(
            "relative bg-muted",
            variant === "wide" ? "w-48 shrink-0" : "aspect-[16/10]"
          )}
        >
          {vehicle.image ? (
            <Image
              src={vehicle.image}
              alt={`${vehicle.brand} ${vehicle.model}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes={
                variant === "wide"
                  ? "192px"
                  : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
              🚗
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute left-2 top-2 flex gap-1">
            {vehicle.ncap_stars === 5 && (
              <span className="rounded bg-green-600/90 px-1.5 py-0.5 text-xs font-medium text-white">
                5★
              </span>
            )}
            {vehicle.family_fit_score != null &&
              vehicle.family_fit_score >= 80 && (
                <span className="flex items-center gap-0.5 rounded bg-blue-600/90 px-1.5 py-0.5 text-xs font-medium text-white">
                  <Baby className="h-3 w-3" />
                  {vehicle.family_fit_score}
                </span>
              )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {vehicle.brand}
          </p>
          <h3 className="font-semibold transition-colors group-hover:text-primary">
            {vehicle.model} {vehicle.name}
          </h3>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {vehicle.power && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {vehicle.power} ch
              </span>
            )}
            {vehicle.consumption && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {vehicle.consumption} L
              </span>
            )}
            {vehicle.year && <span>{vehicle.year}</span>}
          </div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform group-hover:scale-x-100" />
      </motion.div>
    </Link>
  );
}
