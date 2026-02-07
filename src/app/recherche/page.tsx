"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight } from "lucide-react";

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

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=50`
      );
      const json = await res.json();
      setResults(json.data || []);
      setCount(json.count || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) doSearch(initial);
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
      <h1 className="text-3xl font-bold">Recherche</h1>
      <p className="mt-1 text-muted-foreground">
        Cherchez parmi 4 268 g&eacute;n&eacute;rations et 13 054 motorisations
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
          <p className="mb-3 text-sm text-muted-foreground">
            {count} r&eacute;sultat{count !== 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {results.map((r) => (
              <Link key={r.id} href={`/marques/${r.slug}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <span className="font-semibold">{r.brand}</span>{" "}
                      <span>{r.model}</span>{" "}
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
