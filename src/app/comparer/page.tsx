"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { X, Plus, Search, GitCompareArrows, Trophy, Filter, Ruler, Download, Bookmark, Loader2, Share2 } from "lucide-react";
import { SizeOverlay } from "@/components/blueprints/size-overlay";
import dynamic from "next/dynamic";
const CompareRadar = dynamic(() => import("@/components/compare/compare-radar").then(m => m.CompareRadar), { ssr: false });
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { exportComparisonPDF } from "@/lib/export-pdf";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import confetti from "canvas-confetti";

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
  dimensions: {
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    wheelbase_mm: number | null;
    ground_clearance_mm?: number | null;
    trunk_liters: number | null;
    trunk_max_liters: number | null;
  };
  weight_kg: number | null;
  consumption_l_100: number | null;
  real_consumption_l_100: number | null;
  co2_g_km: number | null;
}

function getWinner(vehicles: CompareVehicle[]): number {
  const scores = vehicles.map(() => 0);

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.top_spec?.power_hp) {
      const max = Math.max(
        ...vehicles.map((x) => x.top_spec?.power_hp || 0)
      );
      if (v.top_spec.power_hp === max) scores[i]++;
    }
    if (v.top_spec?.torque_nm) {
      const max = Math.max(
        ...vehicles.map((x) => x.top_spec?.torque_nm || 0)
      );
      if (v.top_spec.torque_nm === max) scores[i]++;
    }
    if (v.top_spec?.acceleration_0_100) {
      const min = Math.min(
        ...vehicles.filter((x) => x.top_spec?.acceleration_0_100).map((x) => x.top_spec!.acceleration_0_100!)
      );
      if (v.top_spec.acceleration_0_100 === min) scores[i]++;
    }
    if (v.top_spec?.top_speed_kmh) {
      const max = Math.max(
        ...vehicles.map((x) => x.top_spec?.top_speed_kmh || 0)
      );
      if (v.top_spec.top_speed_kmh === max) scores[i]++;
    }
    if (v.safety?.rating) {
      const max = Math.max(
        ...vehicles.map((x) => x.safety?.rating || 0)
      );
      if (v.safety.rating === max) scores[i]++;
    }
  }

  const maxScore = Math.max(...scores);
  if (maxScore === 0) return -1;
  const winners = scores.filter((s) => s === maxScore);
  if (winners.length > 1) return -1; // tie
  return scores.indexOf(maxScore);
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
  const [diffOnly, setDiffOnly] = useState(false);
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const confettiFired = useRef(false);
  const searchAbort = useRef<AbortController | null>(null);
  const compareAbort = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    searchAbort.current?.abort();
    searchAbort.current = new AbortController();
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: searchAbort.current.signal,
      });
      const json = await res.json();
      setResults(json.data || []);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  // Fire confetti when results arrive with a clear winner
  useEffect(() => {
    if (compareData && !confettiFired.current) {
      const winnerIdx = getWinner(compareData.vehicles);
      if (winnerIdx >= 0) {
        confettiFired.current = true;
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#22c55e", "#3b82f6", "#eab308"],
        });
      }
    }
  }, [compareData]);

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
    confettiFired.current = false;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchAbort.current?.abort();
      compareAbort.current?.abort();
    };
  }, []);

  async function compare() {
    if (selected.length < 2) return;
    compareAbort.current?.abort();
    compareAbort.current = new AbortController();
    setLoading(true);
    confettiFired.current = false;
    try {
      const ids = selected.map((s) => s.id).join(",");
      const res = await fetch(`/api/compare?ids=${ids}`, {
        signal: compareAbort.current.signal,
      });
      const json = await res.json();
      setCompareData(json.data);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setCompareData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    if (!compareData) return;
    setExporting(true);
    try {
      await exportComparisonPDF(compareData.vehicles);
    } catch {
      toast.error("Erreur lors de l'export PDF");
    }
    setExporting(false);
  }

  async function handleSaveComparison() {
    if (!compareData || !saveName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/saved-comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          generation_ids: selected.map((s) => s.id),
        }),
      });
      if (res.ok) {
        toast.success("Comparaison sauvegard\u00e9e");
        setSaveDialogOpen(false);
        setSaveName("");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  }

  const winnerIdx = compareData ? getWinner(compareData.vehicles) : -1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Comparateur</h1>
      <p className="mt-2 text-muted-foreground">
        Comparez jusqu&apos;&agrave; 4 v&eacute;hicules c&ocirc;te &agrave; c&ocirc;te
      </p>

      {/* Selection area */}
      <div className="mt-6 flex flex-wrap gap-3">
        {selected.map((v) => (
          <Badge
            key={v.id}
            variant="secondary"
            className="surface-3 flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            {v.brand} {v.model} {v.generation}
            <button onClick={() => removeVehicle(v.id)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Search input */}
      {selected.length < 4 && (() => {
        const filteredResults = results
          .filter((r) => !selected.some((s) => s.id === r.id))
          .slice(0, 6);
        return (
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1); }}
            placeholder="Ajouter un v&eacute;hicule..."
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === "Enter" && highlightedIndex >= 0 && filteredResults[highlightedIndex]) {
                e.preventDefault();
                addVehicle(filteredResults[highlightedIndex]);
                setHighlightedIndex(-1);
              } else if (e.key === "Escape") {
                setResults([]);
                setHighlightedIndex(-1);
              }
            }}
          />
          {filteredResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg surface-2 border border-[var(--border-subtle)] shadow-lg">
              {filteredResults.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => addVehicle(r)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:surface-3 transition-colors ${i === highlightedIndex ? "bg-accent" : ""}`}
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
        );
      })()}

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
          {/* Winner banner */}
          {winnerIdx >= 0 && (
            <div className="podium-1 rounded-xl border border-yellow-500/30 surface-3 p-5">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="font-display font-bold text-white">
                    {compareData.vehicles[winnerIdx].brand}{" "}
                    {compareData.vehicles[winnerIdx].model} remporte le duel !
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Meilleur score global sur les performances et la s&eacute;curit&eacute;
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {/* Radar Chart */}
          <CompareRadar
            vehicles={compareData.vehicles.map((v) => ({
              id: v.id,
              label: `${v.brand} ${v.model}`,
              power_hp: v.top_spec?.power_hp || null,
              torque_nm: v.top_spec?.torque_nm || null,
              acceleration_0_100: v.top_spec?.acceleration_0_100 || null,
              top_speed_kmh: v.top_spec?.top_speed_kmh || null,
              trunk_liters: v.dimensions?.trunk_liters || null,
              safety_rating: v.safety?.rating || null,
            }))}
          />

          {/* Actions bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Switch checked={diffOnly} onCheckedChange={setDiffOnly} id="diff-toggle" />
              <label htmlFor="diff-toggle" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                <Filter className="h-3.5 w-3.5" />
                Diff\u00e9rences uniquement
              </label>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {selected.length === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const slugs = selected.map(s => s.slug.replace(/\//g, "-")).join("-vs-");
                    const url = `${window.location.origin}/comparatif/${slugs}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Lien copié");
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Exporter PDF
              </Button>
              {user ? (
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Bookmark className="mr-2 h-4 w-4" />
                      Sauvegarder
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sauvegarder cette comparaison</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveComparison(); }} className="space-y-4">
                      <Input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Nom de la comparaison..."
                        autoFocus
                      />
                      <Button type="submit" disabled={saving || !saveName.trim()} className="w-full">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bookmark className="mr-2 h-4 w-4" />}
                        Sauvegarder
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button variant="outline" size="sm" onClick={() => toast.info("Connectez-vous pour sauvegarder vos comparaisons")} title="Connectez-vous pour sauvegarder">
                  <Bookmark className="mr-2 h-4 w-4" />
                  Sauvegarder
                </Button>
              )}
            </div>
          </div>

          {/* Comparison table */}
          <CompareTable vehicles={compareData.vehicles} winnerIdx={winnerIdx} diffOnly={diffOnly} />

          {/* Size overlay */}
          {compareData.vehicles.some((v) => v.dimensions?.length_mm) && (
            <SizeOverlay
              vehicles={compareData.vehicles.map((v) => ({
                id: v.id,
                label: `${v.brand} ${v.model} ${v.generation}`,
                length_mm: v.dimensions?.length_mm || null,
                width_mm: v.dimensions?.width_mm || null,
                height_mm: v.dimensions?.height_mm || null,
                wheelbase_mm: v.dimensions?.wheelbase_mm || null,
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface RowDef {
  label: string;
  values: string[];
  highlight?: "max" | "min";
}

interface CategoryDef {
  title: string;
  rows: RowDef[];
}

function buildCategories(vehicles: CompareVehicle[]): CategoryDef[] {
  const fmt = (v: number | null | undefined, unit: string) =>
    v != null ? `${v} ${unit}` : "\u2014";

  return [
    {
      title: "G\u00e9n\u00e9ral",
      rows: [
        { label: "Ann\u00e9es", values: vehicles.map((v) => v.years) },
        { label: "Motorisations", values: vehicles.map((v) => String(v.variants_count)) },
      ],
    },
    {
      title: "Moteur",
      rows: [
        { label: "Puissance max", values: vehicles.map((v) => fmt(v.top_spec?.power_hp, "ch")), highlight: "max" },
        { label: "Couple max", values: vehicles.map((v) => fmt(v.top_spec?.torque_nm, "Nm")), highlight: "max" },
        { label: "Cylindr\u00e9e", values: vehicles.map((v) => fmt(v.top_spec?.displacement_cc, "cm\u00b3")) },
      ],
    },
    {
      title: "Performance",
      rows: [
        { label: "0-100 km/h", values: vehicles.map((v) => v.top_spec?.acceleration_0_100 ? `${v.top_spec.acceleration_0_100}s` : "\u2014"), highlight: "min" },
        { label: "V. max", values: vehicles.map((v) => fmt(v.top_spec?.top_speed_kmh, "km/h")), highlight: "max" },
      ],
    },
    {
      title: "Dimensions",
      rows: [
        { label: "Longueur", values: vehicles.map((v) => fmt(v.dimensions?.length_mm, "mm")), highlight: "max" },
        { label: "Largeur", values: vehicles.map((v) => fmt(v.dimensions?.width_mm, "mm")) },
        { label: "Hauteur", values: vehicles.map((v) => fmt(v.dimensions?.height_mm, "mm")) },
        { label: "Empattement", values: vehicles.map((v) => fmt(v.dimensions?.wheelbase_mm, "mm")), highlight: "max" },
        { label: "Coffre", values: vehicles.map((v) => fmt(v.dimensions?.trunk_liters, "L")), highlight: "max" },
        { label: "Coffre max", values: vehicles.map((v) => fmt(v.dimensions?.trunk_max_liters, "L")), highlight: "max" },
      ],
    },
    {
      title: "Consommation",
      rows: [
        { label: "Conso. réelle", values: vehicles.map((v) => v.real_consumption_l_100 ? `${v.real_consumption_l_100} L/100` : "\u2014"), highlight: "min" },
        { label: "Conso. officielle", values: vehicles.map((v) => v.consumption_l_100 ? `${v.consumption_l_100} L/100` : "\u2014"), highlight: "min" },
        { label: "CO\u2082", values: vehicles.map((v) => fmt(v.co2_g_km, "g/km")), highlight: "min" },
        { label: "Poids", values: vehicles.map((v) => fmt(v.weight_kg, "kg")), highlight: "min" },
      ],
    },
    {
      title: "S\u00e9curit\u00e9",
      rows: [
        {
          label: "Euro NCAP",
          values: vehicles.map((v) =>
            v.safety
              ? `${"★".repeat(v.safety.rating)}${"☆".repeat(5 - v.safety.rating)} (${v.safety.year})`
              : "\u2014"
          ),
        },
      ],
    },
  ];
}

function areAllSame(values: string[]): boolean {
  if (values.length < 2) return true;
  return values.every((v) => v === values[0]);
}

function CompareTable({
  vehicles,
  winnerIdx,
  diffOnly,
}: {
  vehicles: CompareVehicle[];
  winnerIdx: number;
  diffOnly: boolean;
}) {
  const categories = buildCategories(vehicles);

  return (
    <div className="overflow-x-auto rounded-lg surface-2 border border-[var(--border-subtle)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--border-subtle)]">
            <TableHead className="w-40 text-xs uppercase tracking-wider text-muted-foreground">Caract\u00e9ristique</TableHead>
            {vehicles.map((v, i) => (
              <TableHead key={v.id} className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="font-semibold text-white">{v.brand}</span>
                  {i === winnerIdx && (
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="text-xs font-normal text-muted-foreground">
                  {v.model} {v.generation}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => {
            const visibleRows = diffOnly
              ? cat.rows.filter((r) => !areAllSame(r.values))
              : cat.rows;
            if (visibleRows.length === 0) return null;
            return (
              <CategorySection key={cat.title} title={cat.title} rows={visibleRows} colSpan={vehicles.length + 1} />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CategorySection({
  title,
  rows,
  colSpan,
}: {
  title: string;
  rows: RowDef[];
  colSpan: number;
}) {
  return (
    <>
      <TableRow className="border-[var(--border-subtle)]">
        <TableCell colSpan={colSpan} className="surface-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary/70">
          {title}
        </TableCell>
      </TableRow>
      {rows.map((row) => (
        <CompareRow key={row.label} label={row.label} values={row.values} highlight={row.highlight} />
      ))}
    </>
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
    const nums = values.map((v) => parseFloat(v.replace(/[^\d.,]/g, "")));
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
    <TableRow className="border-[var(--border-subtle)]">
      <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
      {values.map((val, i) => (
        <TableCell
          key={i}
          className={`text-center text-mono ${
            i === bestIdx ? "font-bold text-primary" : "text-white"
          }`}
        >
          {val}
        </TableCell>
      ))}
    </TableRow>
  );
}
