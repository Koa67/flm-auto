"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Baby, Check, X, AlertTriangle, Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// ─── Types ─────────────────────────────────────────────

interface ChildSeat {
  id: string;
  brand: string;
  model: string;
  seat_type: string | null;
  group_ece: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  weight_kg: number | null;
  isofix_compatible: boolean;
  belt_compatible: boolean;
  swivel: boolean;
  price_eur: number | null;
  adac_rating: number | null;
  positions: {
    rear_left: { compatible: boolean; fit_rating: string | null } | null;
    rear_center: { compatible: boolean; fit_rating: string | null } | null;
    rear_right: { compatible: boolean; fit_rating: string | null } | null;
  };
}

interface BenchData {
  width_usable_mm: number | null;
  width_total_mm: number | null;
  isofix_points: number;
  isofix_positions: string[];
  center_isofix: boolean;
  three_across_possible: boolean | null;
  three_across_fit_score: string | null;
}

type BenchPosition = "rear_left" | "rear_center" | "rear_right";

interface SeatPlacement {
  position: BenchPosition;
  seat: ChildSeat | null;
  isAdult: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

const POSITION_LABELS: Record<BenchPosition, string> = {
  rear_left: "Gauche",
  rear_center: "Centre",
  rear_right: "Droite",
};

const FIT_LABELS: Record<string, string> = {
  perfect: "Parfait",
  excellent: "Excellent",
  good: "Bon",
  tight: "Juste",
  not_recommended: "D\u00e9conseill\u00e9",
  incompatible: "Incompatible",
};

const FIT_COLORS: Record<string, string> = {
  perfect: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  excellent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  tight: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  not_recommended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  incompatible: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const SEAT_TYPE_LABELS: Record<string, string> = {
  infant: "Coque b\u00e9b\u00e9",
  toddler: "Si\u00e8ge enfant",
  booster: "R\u00e9hausseur",
  convertible: "Convertible",
};

const ADULT_WIDTH_MM = 450;

function hasIsofix(positions: string[], pos: BenchPosition): boolean {
  const map: Record<BenchPosition, string[]> = {
    rear_left: ["left"],
    rear_center: ["center"],
    rear_right: ["right"],
  };
  return map[pos].some((p) => positions.includes(p));
}

// ─── Component ──────────────────────────────────────────

interface SeatConfiguratorProps {
  generationId: string;
  vehicleName: string;
}

export function SeatConfigurator({ generationId, vehicleName }: SeatConfiguratorProps) {
  const [bench, setBench] = useState<BenchData | null>(null);
  const [allSeats, setAllSeats] = useState<ChildSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [activePosition, setActivePosition] = useState<BenchPosition | null>(null);
  const [placements, setPlacements] = useState<SeatPlacement[]>([
    { position: "rear_left", seat: null, isAdult: false },
    { position: "rear_center", seat: null, isAdult: false },
    { position: "rear_right", seat: null, isAdult: false },
  ]);

  // Fetch data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/seats/compatible?generation_id=${generationId}`);
        const json = await res.json();
        setBench(json.data?.bench || null);
        setAllSeats(json.data?.seats || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [generationId]);

  // Width calculations
  const totalUsed = useMemo(() => {
    return placements.reduce((sum, p) => {
      if (p.seat) return sum + (p.seat.width_mm || 440);
      if (p.isAdult) return sum + ADULT_WIDTH_MM;
      return sum;
    }, 0);
  }, [placements]);

  const availableWidth = bench?.width_usable_mm || 1400;
  const fits = totalUsed <= availableWidth;
  const remainingSpace = availableWidth - totalUsed;
  const fillPct = Math.min(100, (totalUsed / availableWidth) * 100);

  // Issues detection
  const issues = useMemo(() => {
    const problems: string[] = [];

    if (totalUsed > 0 && !fits) {
      problems.push(`Configuration trop large de ${Math.abs(remainingSpace)} mm`);
    }

    placements.forEach((p) => {
      if (!p.seat) return;
      const posCompat = p.seat.positions[p.position];
      if (posCompat && !posCompat.compatible) {
        problems.push(`${p.seat.brand} ${p.seat.model} incompatible en position ${POSITION_LABELS[p.position].toLowerCase()}`);
      }
      if (p.seat.isofix_compatible && bench && !hasIsofix(bench.isofix_positions, p.position)) {
        problems.push(`Pas d'ISOFIX en position ${POSITION_LABELS[p.position].toLowerCase()}`);
      }
    });

    return problems;
  }, [placements, totalUsed, fits, remainingSpace, bench]);

  // Actions
  function openSelector(pos: BenchPosition) {
    setActivePosition(pos);
    setSelectorOpen(true);
  }

  function placeSeat(seat: ChildSeat) {
    if (!activePosition) return;
    setPlacements((prev) =>
      prev.map((p) => (p.position === activePosition ? { ...p, seat, isAdult: false } : p))
    );
    setSelectorOpen(false);
    setActivePosition(null);
  }

  function placeAdult() {
    if (!activePosition) return;
    setPlacements((prev) =>
      prev.map((p) => (p.position === activePosition ? { ...p, seat: null, isAdult: true } : p))
    );
    setSelectorOpen(false);
    setActivePosition(null);
  }

  function clearPosition(pos: BenchPosition) {
    setPlacements((prev) =>
      prev.map((p) => (p.position === pos ? { ...p, seat: null, isAdult: false } : p))
    );
  }

  function resetAll() {
    setPlacements([
      { position: "rear_left", seat: null, isAdult: false },
      { position: "rear_center", seat: null, isAdult: false },
      { position: "rear_right", seat: null, isAdult: false },
    ]);
  }

  const hasAnyPlacement = placements.some((p) => p.seat || p.isAdult);
  const allOk = hasAnyPlacement && fits && issues.length === 0;
  const hasWarnings = hasAnyPlacement && fits && issues.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  // Filter seats relevant to activePosition for selector
  const seatsForPosition = activePosition
    ? allSeats.filter((s) => {
        const posCompat = s.positions[activePosition];
        return !posCompat || posCompat.compatible;
      })
    : allSeats;

  const incompatibleSeats = activePosition
    ? allSeats.filter((s) => {
        const posCompat = s.positions[activePosition];
        return posCompat && !posCompat.compatible;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Baby className="h-5 w-5" />
          Configurateur si\u00e8ges enfants
        </h3>
        <p className="text-sm text-muted-foreground">
          {vehicleName} &mdash; Largeur banquette : {bench?.width_usable_mm ? `${bench.width_usable_mm} mm` : "non mesur\u00e9e"}
        </p>
      </div>

      {/* Bench stats */}
      {bench && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{bench.isofix_points}</div>
            <div className="text-xs text-muted-foreground">ISOFIX</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{bench.center_isofix ? "Oui" : "Non"}</div>
            <div className="text-xs text-muted-foreground">ISOFIX central</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{bench.three_across_possible ? "Oui" : "Non"}</div>
            <div className="text-xs text-muted-foreground">3-across</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{bench.width_usable_mm || "\u2014"}</div>
            <div className="text-xs text-muted-foreground">Largeur mm</div>
          </div>
        </div>
      )}

      {/* Visual bench */}
      <Card>
        <CardContent className="p-6">
          <div className="mx-auto max-w-md">
            {/* 3-position grid */}
            <div className="grid grid-cols-3 gap-3">
              {placements.map((p) => {
                const isofixAvail = bench ? hasIsofix(bench.isofix_positions, p.position) : false;
                const posCompat = p.seat?.positions[p.position];
                const isOk = p.seat ? (!posCompat || posCompat.compatible) : true;

                return (
                  <motion.div
                    key={p.position}
                    className={`relative flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 transition-all ${
                      p.seat || p.isAdult
                        ? isOk
                          ? "border-green-500 bg-green-500/5 dark:bg-green-500/10"
                          : "border-amber-500 bg-amber-500/5 dark:bg-amber-500/10"
                        : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-accent/50"
                    }`}
                    onClick={() => !p.seat && !p.isAdult && openSelector(p.position)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* ISOFIX badge */}
                    {isofixAvail && (
                      <div className="absolute left-1.5 top-1.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          ISOFIX
                        </Badge>
                      </div>
                    )}

                    {/* Content */}
                    {p.seat ? (
                      <>
                        <Baby className="h-8 w-8 text-green-600 dark:text-green-400" />
                        <p className="mt-1 text-xs font-medium text-center leading-tight px-1">
                          {p.seat.brand}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.seat.width_mm} mm</p>
                        {posCompat?.fit_rating && (
                          <Badge className={`mt-1 text-[10px] ${FIT_COLORS[posCompat.fit_rating] || ""}`}>
                            {FIT_LABELS[posCompat.fit_rating] || posCompat.fit_rating}
                          </Badge>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); clearPosition(p.position); }}
                          className="absolute right-1.5 top-1.5 rounded p-0.5 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </>
                    ) : p.isAdult ? (
                      <>
                        <span className="text-3xl">🧑</span>
                        <p className="mt-1 text-xs font-medium">Adulte</p>
                        <p className="text-[10px] text-muted-foreground">~450 mm</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearPosition(p.position); }}
                          className="absolute right-1.5 top-1.5 rounded p-0.5 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Plus className="h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {POSITION_LABELS[p.position]}
                        </p>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Position labels */}
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
              <span>Gauche</span>
              <span>Centre</span>
              <span>Droite</span>
            </div>
          </div>

          {/* Width gauge */}
          {hasAnyPlacement && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Largeur utilis\u00e9e</span>
                <span className={fits ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {totalUsed} mm / {availableWidth} mm
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={`h-full rounded-full ${fits ? "bg-green-500" : "bg-red-500"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ type: "spring", damping: 15 }}
                />
              </div>
              <p className="text-xs text-right text-muted-foreground">
                {fits
                  ? `${remainingSpace} mm de marge`
                  : `${Math.abs(remainingSpace)} mm de trop`}
              </p>
            </div>
          )}

          {/* Result banner */}
          <AnimatePresence>
            {hasAnyPlacement && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-4 rounded-lg border p-4 ${
                  allOk
                    ? "border-green-500/30 bg-green-500/10"
                    : hasWarnings
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {allOk ? (
                    <>
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-600 dark:text-green-400">
                        Configuration compatible
                      </span>
                    </>
                  ) : hasWarnings ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Possible avec r\u00e9serves
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Configuration impossible
                      </span>
                    </>
                  )}
                </div>
                {issues.length > 0 && (
                  <ul className="mt-2 ml-7 space-y-1 text-sm text-muted-foreground">
                    {issues.map((issue, i) => (
                      <li key={i}>&bull; {issue}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset */}
          {hasAnyPlacement && (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={resetAll}>
                R\u00e9initialiser
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seat selector sheet */}
      <Sheet open={selectorOpen} onOpenChange={setSelectorOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Place {activePosition ? POSITION_LABELS[activePosition].toLowerCase() : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {/* Adult option */}
            <button
              onClick={placeAdult}
              className="flex w-full items-center gap-3 rounded-lg border p-3 transition hover:border-primary/50 hover:bg-accent/50"
            >
              <span className="text-2xl">🧑</span>
              <div className="text-left">
                <p className="font-medium">Adulte</p>
                <p className="text-xs text-muted-foreground">~450 mm de largeur</p>
              </div>
            </button>

            {/* Compatible seats */}
            {seatsForPosition.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Si\u00e8ges compatibles ({seatsForPosition.length})
                </p>
                {seatsForPosition.map((seat) => {
                  const posCompat = activePosition ? seat.positions[activePosition] : null;
                  return (
                    <button
                      key={seat.id}
                      onClick={() => placeSeat(seat)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 transition hover:border-primary/50 hover:bg-accent/50 mb-1.5"
                    >
                      <Baby className="h-10 w-10 shrink-0 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <p className="font-medium">
                          {seat.brand} {seat.model}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {SEAT_TYPE_LABELS[seat.seat_type || ""] || seat.seat_type}
                          {seat.width_mm && ` \u00b7 ${seat.width_mm} mm`}
                          {seat.isofix_compatible && " \u00b7 ISOFIX"}
                          {seat.swivel && " \u00b7 Pivotant"}
                        </p>
                      </div>
                      {posCompat?.fit_rating && (
                        <Badge className={`text-xs ${FIT_COLORS[posCompat.fit_rating] || ""}`}>
                          {FIT_LABELS[posCompat.fit_rating] || posCompat.fit_rating}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Incompatible seats */}
            {incompatibleSeats.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Non compatibles ({incompatibleSeats.length})
                </p>
                {incompatibleSeats.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 opacity-50 mb-1.5"
                  >
                    <Baby className="h-10 w-10 shrink-0 text-muted-foreground" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">
                        {seat.brand} {seat.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {SEAT_TYPE_LABELS[seat.seat_type || ""] || seat.seat_type}
                        {seat.width_mm && ` \u00b7 ${seat.width_mm} mm`}
                      </p>
                    </div>
                    <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Incompatible
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
