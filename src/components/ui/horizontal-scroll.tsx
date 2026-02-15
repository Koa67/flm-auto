"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
  gap?: number;
  showArrows?: boolean;
}

export function HorizontalScroll({
  children,
  className = "",
  gap = 16,
  showArrows = true,
}: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className={`group/scroll relative ${className}`}>
      {/* Fade edges */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
      )}

      {/* Arrows */}
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow-md backdrop-blur-sm opacity-0 transition-opacity group-hover/scroll:opacity-100"
          aria-label="Défiler à gauche"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {showArrows && canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow-md backdrop-blur-sm opacity-0 transition-opacity group-hover/scroll:opacity-100"
          aria-label="Défiler à droite"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={ref}
        className="scrollbar-none flex overflow-x-auto scroll-smooth snap-x snap-mandatory"
        style={{ gap }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScrollCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-[260px] flex-shrink-0 snap-start sm:w-[280px] ${className}`}>
      {children}
    </div>
  );
}
