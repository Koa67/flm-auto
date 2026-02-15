"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Loader2,
} from "lucide-react";
import { SearchFiltersPanel } from "@/components/search/search-filters-panel";
import { VehicleSearchCard } from "@/components/search/vehicle-search-card";
import { useGamificationStore } from "@/lib/gamification-store";

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

const DEFAULT_FILTERS: Filters = {
  brands: [],
  fuel_types: [],
  segments: [],
  power_min: 0,
  power_max: 3000,
  year_min: 1950,
  year_max: 2026,
  ncap_min: 0,
  trunk_min: 0,
};

const SORT_OPTIONS = [
  { value: "relevance", label: "Pertinence" },
  { value: "power_desc", label: "Plus puissants" },
  { value: "year_desc", label: "Plus récents" },
  { value: "year_asc", label: "Plus anciens" },
  { value: "trunk_desc", label: "Plus grand coffre" },
  { value: "safety_desc", label: "Meilleure sécurité" },
  { value: "name_asc", label: "Nom A→Z" },
];

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    brands: params.get("brands")?.split(",").filter(Boolean) || [],
    fuel_types: params.get("fuel")?.split(",").filter(Boolean) || [],
    segments: params.get("segments")?.split(",").filter(Boolean) || [],
    power_min: Number(params.get("power_min")) || DEFAULT_FILTERS.power_min,
    power_max: Number(params.get("power_max")) || DEFAULT_FILTERS.power_max,
    year_min: Number(params.get("year_min")) || DEFAULT_FILTERS.year_min,
    year_max: Number(params.get("year_max")) || DEFAULT_FILTERS.year_max,
    ncap_min: Number(params.get("ncap_min")) || 0,
    trunk_min: Number(params.get("trunk_min")) || 0,
  };
}

function filtersToParams(
  filters: Filters,
  q: string,
  sort: string,
  page: number
): URLSearchParams {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (filters.brands.length) p.set("brands", filters.brands.join(","));
  if (filters.fuel_types.length) p.set("fuel", filters.fuel_types.join(","));
  if (filters.segments.length) p.set("segments", filters.segments.join(","));
  if (filters.power_min > DEFAULT_FILTERS.power_min) p.set("power_min", String(filters.power_min));
  if (filters.power_max < DEFAULT_FILTERS.power_max) p.set("power_max", String(filters.power_max));
  if (filters.year_min > DEFAULT_FILTERS.year_min) p.set("year_min", String(filters.year_min));
  if (filters.year_max < DEFAULT_FILTERS.year_max) p.set("year_max", String(filters.year_max));
  if (filters.ncap_min > 0) p.set("ncap_min", String(filters.ncap_min));
  if (filters.trunk_min > 0) p.set("trunk_min", String(filters.trunk_min));
  if (sort !== "relevance") p.set("sort", sort);
  if (page > 1) p.set("page", String(page));
  return p;
}

function countActiveFilters(filters: Filters): number {
  let count = 0;
  if (filters.brands.length) count++;
  if (filters.fuel_types.length) count++;
  if (filters.segments.length) count++;
  if (filters.power_min > DEFAULT_FILTERS.power_min) count++;
  if (filters.power_max < DEFAULT_FILTERS.power_max) count++;
  if (filters.year_min > DEFAULT_FILTERS.year_min) count++;
  if (filters.year_max < DEFAULT_FILTERS.year_max) count++;
  if (filters.ncap_min > 0) count++;
  if (filters.trunk_min > 0) count++;
  return count;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeCount = countActiveFilters(filters);

  const doSearch = useCallback(
    async (q: string, f: Filters, s: string, p: number) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);

      try {
        const body: any = {
          sort: s,
          page: p,
          per_page: 24,
        };
        if (q.length >= 2) body.q = q;
        if (f.brands.length) body.brands = f.brands;
        if (f.fuel_types.length) body.fuel_types = f.fuel_types;
        if (f.segments.length) body.segments = f.segments;
        if (f.power_min > DEFAULT_FILTERS.power_min) body.power_min = f.power_min;
        if (f.power_max < DEFAULT_FILTERS.power_max) body.power_max = f.power_max;
        if (f.year_min > DEFAULT_FILTERS.year_min) body.year_min = f.year_min;
        if (f.year_max < DEFAULT_FILTERS.year_max) body.year_max = f.year_max;
        if (f.ncap_min > 0) body.ncap_min = f.ncap_min;
        if (f.trunk_min > 0) body.trunk_min = f.trunk_min;

        const res = await fetch("/api/vehicles/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        const json = await res.json();
        setResults(json.results || []);
        setTotal(json.total || 0);
        if (json.facets) setFacets(json.facets);

        if (q.length >= 2) {
          useGamificationStore
            .getState()
            .trackUnique("searchesPerformed", "searches", q.trim().toLowerCase());
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Sync URL → state on mount
  useEffect(() => {
    doSearch(query, filters, sort, page);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search + URL sync
  useEffect(() => {
    const t = setTimeout(() => {
      doSearch(query, filters, sort, page);
      const params = filtersToParams(filters, query, sort, page);
      router.replace(`/recherche?${params}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, sort, page]);

  const handleFilterChange = (partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 24);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Recherche avancée
        </h1>
        <p className="mt-1 text-muted-foreground">
          Filtrez parmi 4 268 générations par marque, segment, puissance,
          sécurité et plus.
        </p>
      </div>

      {/* Search bar + controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="BMW M3 E46, Porsche 911, Golf GTI..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="hidden items-center gap-0.5 rounded-md border border-border p-0.5 sm:flex">
            <button
              onClick={() => setView("grid")}
              className={`rounded p-1.5 ${
                view === "grid" ? "bg-accent text-white" : "text-muted-foreground"
              }`}
              aria-label="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded p-1.5 ${
                view === "list" ? "bg-accent text-white" : "text-muted-foreground"
              }`}
              aria-label="Vue liste"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile filter trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filtres
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtres</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <SearchFiltersPanel
                  filters={filters}
                  facets={facets}
                  onChange={handleFilterChange}
                  onReset={handleReset}
                  activeCount={activeCount}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <SearchFiltersPanel
            filters={filters}
            facets={facets}
            onChange={handleFilterChange}
            onReset={handleReset}
            activeCount={activeCount}
          />
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {/* Count + loading */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recherche...
                </span>
              ) : (
                <>
                  {total.toLocaleString("fr-FR")} résultat
                  {total !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          {/* Results grid/list */}
          {results.length > 0 && (
            <div
              className={
                view === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-2"
              }
            >
              {results.map((v: any) => (
                <VehicleSearchCard
                  key={v.generation_id}
                  vehicle={v}
                  view={view}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && (
            <div className="py-20 text-center">
              <Search className="mx-auto h-16 w-16 text-muted-foreground/20" />
              <h3 className="mt-4 font-semibold">Aucun résultat</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCount > 0
                  ? "Essayez d'élargir vos filtres ou de modifier votre recherche."
                  : "Tapez un nom de marque, modèle ou code génération."}
              </p>
              {activeCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="mt-4"
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecherchePage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
