"use client";

import { useCallback, useTransition, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FilterConfig {
  key: string;
  label: string;
  type: "range" | "multi" | "single";
  options?: { value: string; label: string; count?: number }[];
  min?: number;
  max?: number;
  unit?: string;
  step?: number;
}

const FILTERS: FilterConfig[] = [
  {
    key: "body_type",
    label: "Carrosserie",
    type: "multi",
    options: [
      { value: "SUV", label: "SUV" },
      { value: "Sedan", label: "Berline" },
      { value: "Hatchback", label: "Compacte" },
      { value: "Wagon", label: "Break" },
      { value: "Coupe", label: "Coupé" },
      { value: "Convertible", label: "Cabriolet" },
      { value: "Van", label: "Monospace" },
    ],
  },
  {
    key: "power",
    label: "Puissance",
    type: "range",
    min: 50,
    max: 800,
    unit: "ch",
    step: 10,
  },
  {
    key: "year",
    label: "Année",
    type: "range",
    min: 2000,
    max: 2025,
    step: 1,
  },
  {
    key: "fuel",
    label: "Énergie",
    type: "multi",
    options: [
      { value: "petrol", label: "Essence" },
      { value: "diesel", label: "Diesel" },
      { value: "electric", label: "Électrique" },
      { value: "hybrid", label: "Hybride" },
    ],
  },
  {
    key: "ncap",
    label: "Euro NCAP",
    type: "single",
    options: [
      { value: "5", label: "5 étoiles" },
      { value: "4", label: "4+ étoiles" },
      { value: "3", label: "3+ étoiles" },
    ],
  },
  {
    key: "family_fit",
    label: "Score Family Fit",
    type: "range",
    min: 0,
    max: 100,
    step: 5,
  },
];

export function SmartFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};
    searchParams.forEach((value, key) => {
      if (!filters[key]) filters[key] = [];
      filters[key].push(value);
    });
    return filters;
  }, [searchParams]);

  const activeCount = Object.values(activeFilters).flat().length;

  const updateFilter = useCallback(
    (key: string, value: string | string[] | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.delete(key);
        value.forEach((v) => params.append(key, v));
      } else {
        params.set(key, value);
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [router, pathname]);

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const current = activeFilters[key] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateFilter(key, next);
    },
    [activeFilters, updateFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtres</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount}
            </Badge>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Effacer tout
          </Button>
        )}
      </div>

      {isPending && (
        <div className="h-0.5 overflow-hidden rounded bg-primary/20">
          <motion.div
            className="h-full bg-primary"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        </div>
      )}

      <AnimatePresence>
        {activeCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2"
          >
            {Object.entries(activeFilters).map(([key, values]) =>
              values.map((value) => (
                <Badge
                  key={`${key}-${value}`}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => toggleMulti(key, value)}
                >
                  {getFilterLabel(key, value)}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1">
        {FILTERS.map((filter) => (
          <Collapsible
            key={filter.key}
            defaultOpen={
              (activeFilters[filter.key]?.length ?? 0) > 0
            }
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground">
              <span>{filter.label}</span>
              <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-4">
              {filter.type === "multi" && (
                <div className="flex flex-wrap gap-2">
                  {filter.options?.map((opt) => {
                    const isActive = activeFilters[filter.key]?.includes(
                      opt.value
                    );
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleMulti(filter.key, opt.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {filter.type === "range" && (
                <RangeFilter
                  config={filter}
                  value={activeFilters[filter.key]?.[0]}
                  onChange={(v) => updateFilter(filter.key, v)}
                />
              )}

              {filter.type === "single" && (
                <div className="flex flex-wrap gap-2">
                  {filter.options?.map((opt) => {
                    const isActive =
                      activeFilters[filter.key]?.[0] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() =>
                          updateFilter(
                            filter.key,
                            isActive ? null : opt.value
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function RangeFilter({
  config,
  value,
  onChange,
}: {
  config: FilterConfig;
  value?: string;
  onChange: (v: string | null) => void;
}) {
  const [min, max] = value?.split("-").map(Number) || [
    config.min,
    config.max,
  ];

  return (
    <div className="space-y-4 px-1">
      <Slider
        value={[min!, max!]}
        min={config.min}
        max={config.max}
        step={config.step}
        onValueChange={([newMin, newMax]) => {
          if (newMin === config.min && newMax === config.max) {
            onChange(null);
          } else {
            onChange(`${newMin}-${newMax}`);
          }
        }}
        className="py-4"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {min?.toLocaleString()} {config.unit}
        </span>
        <span>
          {max?.toLocaleString()} {config.unit}
        </span>
      </div>
    </div>
  );
}

function getFilterLabel(key: string, value: string): string {
  const filter = FILTERS.find((f) => f.key === key);
  if (!filter) return value;

  if (filter.type === "range") {
    const [min, max] = value.split("-");
    return `${filter.label}: ${min}–${max} ${filter.unit || ""}`;
  }

  const option = filter.options?.find((o) => o.value === value);
  return option?.label || value;
}
