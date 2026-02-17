"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  duration?: number;
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  barClassName,
  duration = 800,
}: AnimatedProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pct = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div
      ref={ref}
      className={cn("h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-all ease-out",
          barClassName
        )}
        style={{
          width: visible ? `${pct}%` : "0%",
          transitionDuration: `${duration}ms`,
        }}
      />
    </div>
  );
}
