"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "flm-onboarding-done";

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const steps: TourStep[] = [
  {
    target: "[data-tour='search']",
    title: "Recherche instantan\u00e9e",
    description:
      "Tapez un nom de marque, mod\u00e8le ou code ch\u00e2ssis pour trouver un v\u00e9hicule en un clin d\u2019\u0153il.",
    position: "bottom",
  },
  {
    target: "[data-tour='brands']",
    title: "32 marques",
    description:
      "Explorez chaque marque et d\u00e9couvrez tous les mod\u00e8les, g\u00e9n\u00e9rations et motorisations.",
    position: "bottom",
  },
  {
    target: "[data-tour='compare']",
    title: "Comparateur",
    description:
      "Comparez jusqu\u2019\u00e0 4 v\u00e9hicules c\u00f4te \u00e0 c\u00f4te : performances, s\u00e9curit\u00e9, consommation.",
    position: "bottom",
  },
  {
    target: "[data-tour='theme']",
    title: "Mode sombre",
    description:
      "Basculez entre le mode clair et sombre pour un confort de lecture optimal.",
    position: "left",
  },
];

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const updatePosition = useCallback(() => {
    if (!active) return;
    const currentStep = steps[step];
    const el = document.querySelector(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [active, step]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  function dismiss() {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!active) return null;

  const currentStep = steps[step];
  const tooltipStyle = getTooltipPosition(currentStep.position, position);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        onClick={dismiss}
      />

      {/* Spotlight */}
      <div
        className="fixed z-[101] rounded-lg ring-4 ring-primary/50"
        style={{
          top: position.top - 4,
          left: position.left - 4,
          width: position.width + 8,
          height: position.height + 8,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[102] w-80 rounded-xl border bg-card p-4 shadow-2xl"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between">
            <h3 className="font-semibold">{currentStep.title}</h3>
            <button
              onClick={dismiss}
              className="ml-2 rounded p-1 hover:bg-accent"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentStep.description}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {step + 1}/{steps.length}
            </span>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={prev}>
                  <ChevronLeft className="mr-1 h-3 w-3" />
                  Pr&eacute;c.
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {step < steps.length - 1 ? (
                  <>
                    Suivant
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </>
                ) : (
                  "Terminer"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function getTooltipPosition(
  pos: string,
  rect: { top: number; left: number; width: number; height: number }
): React.CSSProperties {
  const gap = 12;
  switch (pos) {
    case "bottom":
      return {
        top: rect.top + rect.height + gap,
        left: Math.max(16, rect.left + rect.width / 2 - 160),
      };
    case "top":
      return {
        top: rect.top - gap - 140,
        left: Math.max(16, rect.left + rect.width / 2 - 160),
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 - 60,
        left: Math.max(16, rect.left - 320 - gap),
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 - 60,
        left: rect.left + rect.width + gap,
      };
    default:
      return { top: rect.top + rect.height + gap, left: rect.left };
  }
}
