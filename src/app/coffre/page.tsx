"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CargoCalculator } from "@/components/cargo/cargo-calculator";
import { useGamificationStore } from "@/lib/gamification-store";

interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start: number | null;
}

interface CargoData {
  trunk_volume_liters: number | null;
  trunk_volume_max_liters: number | null;
  frunk_volume_liters: number | null;
  max_load_kg: number | null;
  vehicle_length_mm: number | null;
}

export default function CoffrePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [cargoData, setCargoData] = useState<CargoData | null>(null);
  const [loadingCargo, setLoadingCargo] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: abortRef.current.signal,
      });
      const json = await res.json();
      setResults(json.data || []);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function selectVehicle(v: SearchResult) {
    setSelected(v);
    setQuery("");
    setResults([]);
    setLoadingCargo(true);
    useGamificationStore.getState().incrementStat("coffreChecked");
    try {
      const res = await fetch(`/api/cargo?generation_id=${v.id}`);
      const json = await res.json();
      setCargoData(json.data || null);
    } catch {
      setCargoData(null);
    } finally {
      setLoadingCargo(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl">
          <Package className="h-8 w-8 text-primary" />
          Calculateur de coffre
        </h1>
        <p className="mt-2 text-muted-foreground">
          V\u00e9rifiez si vos affaires rentrent dans le coffre. Poussette, v\u00e9los, valises&hellip;
        </p>
      </div>

      {/* Vehicle search */}
      {!selected && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1); }}
            placeholder="Rechercher un v\u00e9hicule\u2026"
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === "Enter" && highlightedIndex >= 0 && results[highlightedIndex]) {
                e.preventDefault();
                selectVehicle(results[highlightedIndex]);
                setHighlightedIndex(-1);
              } else if (e.key === "Escape") {
                setResults([]);
                setHighlightedIndex(-1);
              }
            }}
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-lg">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => selectVehicle(r)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${i === highlightedIndex ? "bg-accent" : ""}`}
                >
                  {r.label}
                  {r.year_start && (
                    <span className="ml-auto text-xs text-muted-foreground">{r.year_start}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected vehicle */}
      {selected && (
        <div className="mb-6 flex items-center gap-3">
          <span className="font-display text-lg font-semibold text-white">{selected.label}</span>
          <button
            onClick={() => { setSelected(null); setCargoData(null); }}
            className="text-sm text-primary hover:text-primary/80"
          >
            Changer
          </button>
        </div>
      )}

      {/* Loading */}
      {loadingCargo && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Calculator */}
      {selected && cargoData && !loadingCargo && (
        <CargoCalculator vehicleName={selected.label} cargoData={cargoData} />
      )}

      {/* No trunk data */}
      {selected && cargoData && !cargoData.trunk_volume_liters && !loadingCargo && (
        <div className="mt-8 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Pas de donn\u00e9es coffre</h3>
          <p className="mt-2 text-muted-foreground">
            Les dimensions du coffre ne sont pas encore disponibles pour ce v\u00e9hicule.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!selected && !loadingCargo && (
        <div className="mt-16 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            Est-ce que \u00e7a rentre ?
          </h3>
          <p className="mt-2 max-w-md mx-auto text-muted-foreground">
            S\u00e9lectionnez un v\u00e9hicule pour simuler le chargement du coffre avec vos objets.
          </p>
        </div>
      )}
    </div>
  );
}
