"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, ArrowRight, Bookmark, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGamificationStore } from "@/lib/gamification-store";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start: number | null;
  year_end: number | null;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = searchParams.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSaveSearch() {
    if (!saveName.trim() || !query) return;
    setSaving(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          query,
          filters: {},
          result_count: count,
        }),
      });
      if (res.ok) {
        toast.success("Recherche sauvegardée");
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

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setCount(0);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=50`,
        { signal: abortRef.current.signal }
      );
      const json = await res.json();
      setResults(json.data || []);
      setCount(json.count || 0);
      useGamificationStore.getState().incrementStat("searchesPerformed");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) doSearch(initial);
    return () => { abortRef.current?.abort(); };
  }, [initial, doSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      doSearch(query);
      if (query.length >= 2) {
        router.replace(`/recherche?q=${encodeURIComponent(query)}`, {
          scroll: false,
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, doSearch, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Recherche</h1>
      <p className="mt-2 text-muted-foreground">
        Cherchez parmi <span className="text-mono font-semibold text-white">4 268</span> g&eacute;n&eacute;rations et <span className="text-mono font-semibold text-white">13 054</span> motorisations
      </p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="BMW M3 E46, Porsche 911 997, Golf GTI..."
          className="pl-11 text-lg"
          autoFocus
        />
      </div>

      {loading && (
        <p className="mt-4 text-sm text-muted-foreground">Recherche...</p>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {count} r&eacute;sultat{count !== 1 ? "s" : ""}
            </p>
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
                    <DialogTitle>Sauvegarder cette recherche</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSearch(); }} className="space-y-4">
                    <Input
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Nom de la recherche..."
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Connectez-vous pour sauvegarder vos recherches")}
              >
                <Bookmark className="mr-2 h-4 w-4" />
                Sauvegarder
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <Link key={r.id} href={`/marques/${r.slug}`}>
                <Card className="card-hover group">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <span className="font-semibold text-white">{r.brand}</span>{" "}
                      <span className="text-white">{r.model}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.generation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.year_start && (
                        <Badge variant="secondary" className="text-xs">
                          {r.year_start}&ndash;{r.year_end || "..."}
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">
            Aucun r&eacute;sultat pour &laquo; {query} &raquo;
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Essayez avec un nom de marque, mod&egrave;le ou code g&eacute;n&eacute;ration (ex: E46, W204, 997)
          </p>
        </div>
      )}

      {!loading && query.length < 2 && (
        <div className="mt-12 text-center text-muted-foreground">
          <Search className="mx-auto h-16 w-16 opacity-20" />
          <p className="mt-4">Tapez au moins 2 caract&egrave;res pour rechercher</p>
        </div>
      )}
    </div>
  );
}

export default function RecherchePage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
