"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Camera,
  Car,
  Armchair,
  Grid,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

interface GalleryImage {
  id: string;
  url: string;
  image_type?: string;
  alt_text?: string;
  source?: string;
}

interface GalleryProProps {
  images: GalleryImage[];
  vehicleName: string;
}

const CATEGORIES = [
  { id: "all", label: "Toutes", icon: Grid },
  { id: "exterior", label: "Extérieur", icon: Car },
  { id: "interior", label: "Intérieur", icon: Armchair },
  { id: "other", label: "Autres", icon: Camera },
];

export function GalleryPro({ images, vehicleName }: GalleryProProps) {
  const [category, setCategory] = useState("all");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const filtered =
    category === "all"
      ? images
      : category === "other"
        ? images.filter(
            (i) => !["exterior", "interior"].includes(i.image_type || "")
          )
        : images.filter((i) => i.image_type === category);

  const counts: Record<string, number> = {
    all: images.length,
    exterior: images.filter((i) => i.image_type === "exterior").length,
    interior: images.filter((i) => i.image_type === "interior").length,
    other: images.filter(
      (i) => !["exterior", "interior"].includes(i.image_type || "")
    ).length,
  };

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
    setZoom(1);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setZoom(1);
  };

  const next = useCallback(() => {
    setLightboxIdx((i) => (i + 1) % filtered.length);
    setZoom(1);
  }, [filtered.length]);

  const prev = useCallback(() => {
    setLightboxIdx((i) => (i - 1 + filtered.length) % filtered.length);
    setZoom(1);
  }, [filtered.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowRight":
          next();
          break;
        case "ArrowLeft":
          prev();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, next, prev]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  return (
    <div className="space-y-6">
      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const count = counts[cat.id];
          if (count === 0 && cat.id !== "all") return null;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  category === cat.id ? "bg-primary-foreground/20" : "bg-background"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Featured Carousel (first 5 images) */}
      {category === "all" && filtered.length > 3 && (
        <div className="relative overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {filtered.slice(0, 5).map((img, i) => (
              <div
                key={img.id}
                className="relative min-w-0 flex-[0_0_100%] cursor-pointer"
                onClick={() => openLightbox(i)}
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text || `${vehicleName} ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 to-transparent pb-8 opacity-0 transition-opacity hover:opacity-100">
                    <span className="flex items-center gap-2 text-white">
                      <ZoomIn className="h-5 w-5" />
                      Agrandir
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            aria-label="Image précédente"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Image suivante"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {filtered
          .slice(category === "all" && filtered.length > 3 ? 5 : 0)
          .map((img, i) => {
            const actualIdx =
              category === "all" && filtered.length > 3 ? i + 5 : i;
            return (
              <div
                key={img.id}
                className="group relative cursor-pointer overflow-hidden rounded-xl"
                onClick={() => openLightbox(actualIdx)}
              >
                <div className="relative aspect-4/3 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text || `${vehicleName} ${actualIdx + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
            );
          })}
      </div>

      {/* Photo Count */}
      <p className="text-center text-sm text-muted-foreground">
        <Camera className="mr-2 inline h-4 w-4" />
        {filtered.length} photos
        {category !== "all" &&
          ` — ${CATEGORIES.find((c) => c.id === category)?.label}`}
      </p>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && filtered[lightboxIdx] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              aria-label="Fermer"
              onClick={closeLightbox}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 hover:bg-white/20"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Counter */}
            <div className="absolute left-4 top-4 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
              {lightboxIdx + 1} / {filtered.length}
            </div>

            {/* Nav */}
            <button
              aria-label="Photo précédente"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 hover:bg-white/20"
            >
              <ChevronLeft className="h-8 w-8 text-white" />
            </button>
            <button
              aria-label="Photo suivante"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 hover:bg-white/20"
            >
              <ChevronRight className="h-8 w-8 text-white" />
            </button>

            {/* Image */}
            <motion.img
              key={lightboxIdx}
              src={filtered[lightboxIdx].url}
              alt=""
              className="max-h-[85vh] max-w-[90vw] object-contain"
              style={{ transform: `scale(${zoom})` }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: zoom }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Zoom Controls */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-white/10 px-6 py-3 backdrop-blur-sm">
              <button
                aria-label="Réduire"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom((z) => Math.max(z - 0.5, 1));
                }}
                className="text-white"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="w-16 text-center text-sm text-white">
                {Math.round(zoom * 100)}%
              </span>
              <button
                aria-label="Agrandir"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom((z) => Math.min(z + 0.5, 3));
                }}
                className="text-white"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>

            {/* Thumbnail Strip */}
            <div className="absolute bottom-16 left-1/2 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto pb-2">
              {filtered
                .slice(
                  Math.max(0, lightboxIdx - 5),
                  Math.min(filtered.length, lightboxIdx + 6)
                )
                .map((img, i) => {
                  const idx = Math.max(0, lightboxIdx - 5) + i;
                  return (
                    <button
                      key={img.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIdx(idx);
                        setZoom(1);
                      }}
                      className={`h-12 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition-all ${
                        idx === lightboxIdx
                          ? "scale-110 border-white"
                          : "border-transparent opacity-50 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
