"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Baby, Search, Star, ArrowRight } from "lucide-react";

interface FamilyFitResult {
  generation_id: string;
  brand: string;
  model: string;
  generation: string;
  isofix_points: number;
  center_isofix: boolean;
  three_across: boolean;
  three_across_score: number | null;
  fit_scores: {
    infant: string | null;
    toddler: string | null;
    booster: string | null;
  };
  rear_legroom_mm: number | null;
  rear_headroom_mm: number | null;
}

export default function FamilyFitPage() {
  const [seatsNeeded, setSeatsNeeded] = useState("2");
  const [threeAcross, setThreeAcross] = useState(false);
  const [brand, setBrand] = useState("");
  const [results, setResults] = useState<FamilyFitResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function handleSearch() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/family-fit/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seats_needed: parseInt(seatsNeeded),
          three_across: threeAcross,
          brands: brand ? [brand] : [],
          limit: 30,
        }),
        signal: abortRef.current.signal,
      });
      const json = await res.json();
      setResults(json.results || []);
      setRecommendations(json.recommendations || []);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl">
          <Baby className="h-8 w-8 text-primary" />
          Family Fit
        </h1>
        <p className="mt-2 text-muted-foreground">
          Trouvez la voiture id&eacute;ale pour votre famille. ISOFIX, si&egrave;ges enfants, 3-across.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Si&egrave;ges enfants
              </label>
              <Select value={seatsNeeded} onValueChange={setSeatsNeeded}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 si&egrave;ge</SelectItem>
                  <SelectItem value="2">2 si&egrave;ges</SelectItem>
                  <SelectItem value="3">3 si&egrave;ges</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Marque</label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Toutes les marques"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={threeAcross}
                  onChange={(e) => setThreeAcross(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm font-medium">3-across obligatoire</span>
              </label>
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Recherche..." : "Rechercher"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6 rounded-lg surface-3 border border-[var(--border-subtle)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-primary/70">Conseils</h3>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div>
          <h2 className="mb-4 font-display text-xl font-semibold">
            <span className="text-mono text-primary">{results.length}</span> v&eacute;hicule{results.length !== 1 ? "s" : ""} trouv&eacute;{results.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <FamilyFitCard key={v.generation_id} vehicle={v} />
            ))}
          </div>
          {results.length === 0 && (
            <p className="text-muted-foreground">
              Aucun v&eacute;hicule ne correspond &agrave; vos crit&egrave;res. Essayez d&apos;&eacute;largir la recherche.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && (
        <div className="mt-12 text-center">
          <Baby className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            Quelle voiture pour ma famille ?
          </h3>
          <p className="mt-2 max-w-md mx-auto text-muted-foreground">
            S&eacute;lectionnez le nombre de si&egrave;ges enfants et lancez la recherche pour d&eacute;couvrir les v&eacute;hicules les plus adapt&eacute;s.
          </p>
        </div>
      )}
    </div>
  );
}

function FamilyFitCard({ vehicle: v }: { vehicle: FamilyFitResult }) {
  const fitLabel: Record<string, string> = {
    excellent: "Excellent",
    good: "Bon",
    tight: "Juste",
    not_recommended: "D\u00e9conseill\u00e9",
    incompatible: "Incompatible",
  };

  const fitColor: Record<string, string> = {
    excellent: "bg-green-500/15 text-green-400 border border-green-500/20",
    good: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    tight: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
    not_recommended: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
    incompatible: "bg-red-500/15 text-red-400 border border-red-500/20",
  };

  return (
    <Card className="card-hover group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white">
              {v.brand} {v.model}
            </h3>
            <p className="text-sm text-muted-foreground">{v.generation}</p>
          </div>
          <Badge variant="outline" className="ml-2">
            {v.isofix_points} ISOFIX
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {v.three_across && (
            <Badge className="bg-green-500/15 text-green-400 border border-green-500/20">3-across</Badge>
          )}
          {v.center_isofix && (
            <Badge variant="secondary">ISOFIX central</Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {(["infant", "toddler", "booster"] as const).map((type) => {
            const val = v.fit_scores[type];
            const labels = { infant: "Coque", toddler: "Si\u00e8ge", booster: "R\u00e9hausseur" };
            return (
              <div key={type}>
                <div className="text-muted-foreground">{labels[type]}</div>
                {val ? (
                  <Badge
                    className={`mt-1 text-xs ${fitColor[val] || ""}`}
                    variant="secondary"
                  >
                    {fitLabel[val] || val}
                  </Badge>
                ) : (
                  <span className="mt-1 text-muted-foreground">&mdash;</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
