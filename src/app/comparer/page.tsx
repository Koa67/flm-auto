"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus, Search, GitCompareArrows } from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start: number | null;
}

interface CompareVehicle {
  id: string;
  brand: string;
  model: string;
  generation: string;
  years: string;
  top_spec: {
    name: string;
    power_hp: number | null;
    torque_nm: number | null;
    displacement_cc: number | null;
    acceleration_0_100: number | null;
    top_speed_kmh: number | null;
  } | null;
  power_range: { min: number | null; max: number | null } | null;
  variants_count: number;
  safety: { rating: number; year: number } | null;
}

export default function ComparerPage() {
  const [selected, setSelected] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [compareData, setCompareData] = useState<{
    vehicles: CompareVehicle[];
    insights: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json();
      setResults(json.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  function addVehicle(v: SearchResult) {
    if (selected.length >= 4) return;
    if (selected.some((s) => s.id === v.id)) return;
    setSelected([...selected, v]);
    setQuery("");
    setResults([]);
  }

  function removeVehicle(id: string) {
    setSelected(selected.filter((s) => s.id !== id));
    setCompareData(null);
  }

  async function compare() {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const ids = selected.map((s) => s.id).join(",");
      const res = await fetch(`/api/compare?ids=${ids}`);
      const json = await res.json();
      setCompareData(json.data);
    } catch {
      setCompareData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Comparateur</h1>
      <p className="mt-1 text-muted-foreground">
        Comparez jusqu&apos;&agrave; 4 v&eacute;hicules c&ocirc;te &agrave; c&ocirc;te
      </p>

      {/* Selection area */}
      <div className="mt-6 flex flex-wrap gap-3">
        {selected.map((v) => (
          <Badge
            key={v.id}
            variant="secondary"
            className="flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            {v.brand} {v.model} {v.generation}
            <button onClick={() => removeVehicle(v.id)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Search input */}
      {selected.length < 4 && (
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ajouter un v\u00e9hicule..."
            className="pl-9"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-lg">
              {results
                .filter((r) => !selected.some((s) => s.id === r.id))
                .slice(0, 6)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addVehicle(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    {r.label}
                    {r.year_start && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.year_start}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Compare button */}
      <Button
        onClick={compare}
        disabled={selected.length < 2 || loading}
        className="mt-4"
      >
        <GitCompareArrows className="mr-2 h-4 w-4" />
        {loading ? "Comparaison..." : "Comparer"}
      </Button>

      {/* Results */}
      {compareData && (
        <div className="mt-8 space-y-6">
          {/* Insights */}
          {compareData.insights.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <ul className="space-y-1">
                  {compareData.insights.map((insight, i) => (
                    <li key={i} className="text-sm">
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Caract&eacute;ristique</TableHead>
                  {compareData.vehicles.map((v) => (
                    <TableHead key={v.id} className="text-center">
                      <div className="font-semibold">{v.brand}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {v.model} {v.generation}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <CompareRow
                  label="Ann&eacute;es"
                  values={compareData.vehicles.map((v) => v.years)}
                />
                <CompareRow
                  label="Puissance max"
                  values={compareData.vehicles.map((v) =>
                    v.top_spec?.power_hp ? `${v.top_spec.power_hp} ch` : "\u2014"
                  )}
                  highlight="max"
                />
                <CompareRow
                  label="Couple max"
                  values={compareData.vehicles.map((v) =>
                    v.top_spec?.torque_nm ? `${v.top_spec.torque_nm} Nm` : "\u2014"
                  )}
                  highlight="max"
                />
                <CompareRow
                  label="0-100 km/h"
                  values={compareData.vehicles.map((v) =>
                    v.top_spec?.acceleration_0_100
                      ? `${v.top_spec.acceleration_0_100}s`
                      : "\u2014"
                  )}
                  highlight="min"
                />
                <CompareRow
                  label="V. max"
                  values={compareData.vehicles.map((v) =>
                    v.top_spec?.top_speed_kmh
                      ? `${v.top_spec.top_speed_kmh} km/h`
                      : "\u2014"
                  )}
                  highlight="max"
                />
                <CompareRow
                  label="Motorisations"
                  values={compareData.vehicles.map((v) =>
                    String(v.variants_count)
                  )}
                />
                <CompareRow
                  label="Euro NCAP"
                  values={compareData.vehicles.map((v) =>
                    v.safety
                      ? `${"★".repeat(v.safety.rating)}${"☆".repeat(5 - v.safety.rating)} (${v.safety.year})`
                      : "\u2014"
                  )}
                />
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  values,
  highlight,
}: {
  label: string;
  values: string[];
  highlight?: "max" | "min";
}) {
  let bestIdx = -1;
  if (highlight) {
    const nums = values.map((v) => parseFloat(v.replace(/[^\d.]/g, "")));
    const validNums = nums.filter((n) => !isNaN(n));
    if (validNums.length >= 2) {
      const best =
        highlight === "max"
          ? Math.max(...validNums)
          : Math.min(...validNums);
      bestIdx = nums.indexOf(best);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: label }} />
      {values.map((val, i) => (
        <TableCell
          key={i}
          className={`text-center font-mono ${
            i === bestIdx ? "font-bold text-primary" : ""
          }`}
        >
          {val}
        </TableCell>
      ))}
    </TableRow>
  );
}
