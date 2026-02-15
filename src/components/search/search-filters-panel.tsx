"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Shield } from "lucide-react";

interface Facets {
  brands: { slug: string; name: string; count: number }[];
  fuel_types: { value: string; label: string; count: number }[];
  segments: { value: string; label: string; count: number }[];
  year_range: { min: number; max: number };
  power_range: { min: number; max: number };
  ncap_distribution: { stars: number; count: number }[];
}

interface Filters {
  brands: string[];
  fuel_types: string[];
  segments: string[];
  power_min: number;
  power_max: number;
  year_min: number;
  year_max: number;
  ncap_min: number;
  trunk_min: number;
}

interface SearchFiltersPanelProps {
  filters: Filters;
  facets: Facets | null;
  onChange: (partial: Partial<Filters>) => void;
  onReset: () => void;
  activeCount: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  SUV: "SUV",
  sedan: "Berline",
  hatchback: "Citadine",
  wagon: "Break",
  coupe: "Coupé",
  convertible: "Cabriolet",
  van: "Monospace",
  pickup: "Pick-up",
};

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckboxFilter({
  items,
  selected,
  onChange,
  maxVisible = 8,
}: {
  items: { value: string; label: string; count: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
  maxVisible?: number;
}) {
  const visible = items.slice(0, maxVisible);

  return (
    <div className="space-y-1.5">
      {visible.map((item) => {
        const isChecked = selected.includes(item.value);
        return (
          <label
            key={item.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent"
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => {
                if (isChecked) {
                  onChange(selected.filter((v) => v !== item.value));
                } else {
                  onChange([...selected, item.value]);
                }
              }}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            <span className="flex-1 truncate">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">{item.count}</span>
          </label>
        );
      })}
    </div>
  );
}

export function SearchFiltersPanel({
  filters,
  facets,
  onChange,
  onReset,
  activeCount,
}: SearchFiltersPanelProps) {
  const yearRange = facets?.year_range || { min: 1990, max: 2026 };
  const powerRange = facets?.power_range || { min: 50, max: 600 };

  return (
    <div className="space-y-4">
      {/* Reset */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Filtres
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCount}
            </Badge>
          )}
        </h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
            <RotateCcw className="mr-1 h-3 w-3" />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Brands */}
      {facets && facets.brands.length > 0 && (
        <FilterSection title="Marques">
          <CheckboxFilter
            items={facets.brands.map((b) => ({
              value: b.slug,
              label: b.name,
              count: b.count,
            }))}
            selected={filters.brands}
            onChange={(brands) => onChange({ brands })}
            maxVisible={10}
          />
        </FilterSection>
      )}

      {/* Segments */}
      {facets && facets.segments.length > 0 && (
        <FilterSection title="Segment">
          <CheckboxFilter
            items={facets.segments.map((s) => ({
              value: s.value,
              label: SEGMENT_LABELS[s.value] || s.value,
              count: s.count,
            }))}
            selected={filters.segments}
            onChange={(segments) => onChange({ segments })}
          />
        </FilterSection>
      )}

      {/* Fuel types */}
      {facets && facets.fuel_types.length > 0 && (
        <FilterSection title="Carburant">
          <CheckboxFilter
            items={facets.fuel_types}
            selected={filters.fuel_types}
            onChange={(fuel_types) => onChange({ fuel_types })}
          />
        </FilterSection>
      )}

      {/* Power range */}
      <FilterSection title="Puissance">
        <div className="px-1">
          <Slider
            value={[filters.power_min, filters.power_max]}
            onValueChange={([min, max]) =>
              onChange({ power_min: min, power_max: max })
            }
            min={powerRange.min}
            max={powerRange.max}
            step={10}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{filters.power_min} ch</span>
            <span>{filters.power_max} ch</span>
          </div>
        </div>
      </FilterSection>

      {/* Year range */}
      <FilterSection title="Années">
        <div className="px-1">
          <Slider
            value={[filters.year_min, filters.year_max]}
            onValueChange={([min, max]) =>
              onChange({ year_min: min, year_max: max })
            }
            min={yearRange.min}
            max={yearRange.max}
            step={1}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{filters.year_min}</span>
            <span>{filters.year_max}</span>
          </div>
        </div>
      </FilterSection>

      {/* NCAP */}
      <FilterSection title="Sécurité Euro NCAP">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              key={stars}
              onClick={() =>
                onChange({ ncap_min: filters.ncap_min === stars ? 0 : stars })
              }
              className={`flex h-8 flex-1 items-center justify-center rounded-md border text-xs transition-colors ${
                stars <= filters.ncap_min
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {stars}★
            </button>
          ))}
        </div>
        {filters.ncap_min > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Minimum {filters.ncap_min} étoile{filters.ncap_min > 1 ? "s" : ""}
          </p>
        )}
      </FilterSection>

      {/* Trunk */}
      <FilterSection title="Coffre minimum">
        <div className="px-1">
          <Slider
            value={[filters.trunk_min]}
            onValueChange={([val]) => onChange({ trunk_min: val })}
            min={0}
            max={1500}
            step={50}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {filters.trunk_min > 0 ? `${filters.trunk_min} L minimum` : "Tous"}
          </p>
        </div>
      </FilterSection>
    </div>
  );
}
