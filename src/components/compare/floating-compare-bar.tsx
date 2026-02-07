"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Scale, ChevronRight } from "lucide-react";
import { useCompareStore } from "@/stores/compare-store";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function FloatingCompareBar() {
  const vehicles = useCompareStore((s) => s.vehicles);
  const removeVehicle = useCompareStore((s) => s.removeVehicle);
  const clearAll = useCompareStore((s) => s.clearAll);

  if (vehicles.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      >
        <div className="flex items-center gap-4 rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur">
          {/* Selected vehicles */}
          <div className="flex gap-2">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="relative h-12 w-16 overflow-hidden rounded-lg bg-muted"
              >
                {v.image && (
                  <Image
                    src={v.image}
                    alt={v.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                )}
                <button
                  onClick={() => removeVehicle(v.id)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive"
                >
                  <X className="h-3 w-3 text-destructive-foreground" />
                </button>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 2 - vehicles.length) }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex h-12 w-16 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground"
                >
                  +
                </div>
              )
            )}
          </div>

          {/* Info */}
          <div className="text-sm">
            <p className="font-medium">{vehicles.length}/4</p>
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Effacer
            </button>
          </div>

          {/* Compare button */}
          <Link
            href={`/comparer?ids=${vehicles.map((v) => v.id).join(",")}`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition",
              vehicles.length >= 2
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
            onClick={(e) => {
              if (vehicles.length < 2) e.preventDefault();
            }}
          >
            <Scale className="h-4 w-4" />
            Comparer
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
