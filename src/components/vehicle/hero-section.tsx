"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Shield, Fuel, Gauge, ChevronDown, Share2 } from "lucide-react";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { PriceAlertButton } from "@/components/price-alert-button";

interface HeroSectionProps {
  generationId: string;
  brandName: string;
  modelName: string;
  genLabel: string;
  yearStart: number | null;
  yearEnd: number | null;
  images: { url: string }[];
  powerHp?: number | null;
  fuelType?: string | null;
  safetyStars?: number | null;
  acceleration?: number | null;
}

export function HeroSection({
  generationId,
  brandName,
  modelName,
  genLabel,
  yearStart,
  yearEnd,
  images,
  powerHp,
  fuelType,
  safetyStars,
  acceleration,
}: HeroSectionProps) {
  const [currentImg, setCurrentImg] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const heroImages = images.slice(0, 4);

  // Auto-rotate
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImg((i) => (i + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const years = `${yearStart || "?"}\u2013${yearEnd || "..."}`;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${brandName} ${modelName} ${genLabel}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative -mx-4 -mt-8 h-[70vh] min-h-[500px] overflow-hidden sm:-mx-6"
    >
      {/* Background Images */}
      <motion.div className="absolute inset-0" style={{ y: imageY }}>
        {heroImages.map((img, i) => (
          <motion.div
            key={img.url}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: i === currentImg ? 1 : 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`${brandName} ${modelName}`}
              className="h-full w-full object-cover"
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </motion.div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
      </motion.div>

      {/* Image Dots */}
      {heroImages.length > 1 && (
        <div className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {heroImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentImg(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentImg
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <motion.div
        className="relative z-10 flex h-full flex-col justify-end px-6 pb-12 lg:px-12"
        style={{ opacity }}
      >
        <div className="mx-auto w-full max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h1 className="font-display text-4xl font-bold lg:text-6xl">
              <span className="text-white">{brandName}</span>
              <span className="ml-3 text-primary">{modelName}</span>
            </h1>
            <p className="mt-2 font-display text-xl text-muted-foreground lg:text-2xl">
              {genLabel}
            </p>
            <p className="text-mono text-muted-foreground">{years}</p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            className="mt-6 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {powerHp && (
              <div className="flex items-center gap-2 rounded-full surface-3 border border-[var(--border-subtle)] px-4 py-2 backdrop-blur-md">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="text-mono font-bold text-white">{powerHp}</span>
                <span className="text-muted-foreground">ch</span>
              </div>
            )}
            {fuelType && (
              <div className="flex items-center gap-2 rounded-full surface-3 border border-[var(--border-subtle)] px-4 py-2 backdrop-blur-md">
                <Fuel className="h-4 w-4 text-green-500" />
                <span>{fuelType}</span>
              </div>
            )}
            {safetyStars != null && safetyStars > 0 && (
              <div className="flex items-center gap-2 rounded-full surface-3 border border-[var(--border-subtle)] px-4 py-2 backdrop-blur-md">
                <Shield className="h-4 w-4 text-yellow-500" />
                <span className="text-mono font-bold text-white">{safetyStars}</span>
                <span className="text-muted-foreground">{"\u2605"} NCAP</span>
              </div>
            )}
            {acceleration && (
              <div className="flex items-center gap-2 rounded-full surface-3 border border-[var(--border-subtle)] px-4 py-2 backdrop-blur-md">
                <span className="text-mono font-bold text-white">{acceleration}s</span>
                <span className="text-muted-foreground">0-100</span>
              </div>
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="mt-6 flex gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <WishlistButton generationId={generationId} />
            <PriceAlertButton
              generationId={generationId}
              vehicleName={`${brandName} ${modelName} ${genLabel}`}
            />
            <button
              onClick={share}
              className="flex items-center gap-2 rounded-xl surface-3 border border-[var(--border-subtle)] px-4 py-2.5 text-sm backdrop-blur-md transition-colors hover:border-primary/50"
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <ChevronDown className="h-6 w-6 text-muted-foreground" />
      </motion.div>
    </div>
  );
}
