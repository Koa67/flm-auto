"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TCOCalculator } from "@/components/tco/tco-calculator";

interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start: number | null;
}

interface VehicleData {
  name: string;
  prixNeuf?: number;
  co2?: number;
  consoL100?: number;
  realConsoL100?: number;
  puissanceCv?: number;
  typeCarburant?: string;
  segment?: string;
}

function TCOPageInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const initRef = useRef(false);

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

  // Auto-select vehicle from URL param: /tco?vehicle={generation_id}
  useEffect(() => {
    if (initRef.current) return;
    const vehicleId = searchParams.get("vehicle");
    if (vehicleId && /^[0-9a-f-]{36}$/i.test(vehicleId)) {
      initRef.current = true;
      loadVehicleById(vehicleId);
    }
  }, [searchParams]);

  async function loadVehicleById(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${id}`);
      const json = await res.json();
      const d = json.data;
      if (!d) return;

      const label = `${d.brand?.name || ""} ${d.model?.name || ""} ${d.generation?.name || ""}`.trim();
      setSelected({ id, label, brand: d.brand?.name, model: d.model?.name, generation: d.generation?.name, slug: "", year_start: d.generation?.year_start });
      buildVehicleData(label, d);
    } catch {
      // Ignore — user can search manually
    } finally {
      setLoading(false);
    }
  }

  function buildVehicleData(name: string, d: any) {
    const topVariant = d?.variants?.[0];
    const fuelType = topVariant?.fuel_type?.toLowerCase();
    setVehicleData({
      name,
      prixNeuf: d?.pricing?.price_new_eur || undefined,
      co2: d?.pricing?.co2_gkm || undefined,
      consoL100: topVariant?.consumption_l100 || undefined,
      realConsoL100: d?.realConsumption || undefined,
      puissanceCv: topVariant?.power_hp || undefined,
      typeCarburant: fuelType?.includes("diesel")
        ? "diesel"
        : fuelType?.includes("electr")
          ? "electrique"
          : fuelType?.includes("hybride")
            ? "hybride"
            : "essence",
      segment: d?.model?.segment || "berline",
    });
  }

  async function selectVehicle(v: SearchResult) {
    setSelected(v);
    setQuery("");
    setResults([]);
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${v.id}`);
      const json = await res.json();
      buildVehicleData(v.label, json.data);
    } catch {
      setVehicleData({ name: v.label });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl">
          <Calculator className="h-8 w-8 text-primary" />
          Calculateur TCO
        </h1>
        <p className="mt-2 text-muted-foreground">
          Co&ucirc;t r&eacute;el de possession : d&eacute;pr&eacute;ciation, carburant, assurance, entretien, malus.
        </p>
      </div>

      {/* Vehicle search */}
      {!selected && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1); }}
            placeholder="Rechercher un v&eacute;hicule&hellip;"
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
            onClick={() => { setSelected(null); setVehicleData(null); }}
            className="text-sm text-primary hover:text-primary/80"
          >
            Changer
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* TCO Calculator */}
      {selected && vehicleData && !loading && (
        <TCOCalculator vehicle={vehicleData} />
      )}

      {/* Empty state */}
      {!selected && !loading && (
        <div className="mt-16 text-center">
          <Calculator className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            Combien co&ucirc;te vraiment cette voiture ?
          </h3>
          <p className="mt-2 max-w-md mx-auto text-muted-foreground">
            D&eacute;couvrez le co&ucirc;t r&eacute;el mensuel incluant d&eacute;pr&eacute;ciation, carburant, assurance, entretien et malus 2025.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TCOPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <TCOPageInner />
    </Suspense>
  );
}
