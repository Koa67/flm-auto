"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start?: number | null;
}

export function InstantSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(
      `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((data) => {
        setResults(data.data || []);
        setSelectedIndex(0);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  const navigateTo = useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setQuery("");
      router.push(`/marques/${result.slug}`);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateTo(results[selectedIndex]);
          } else if (query) {
            router.push(`/recherche?q=${encodeURIComponent(query)}`);
            setIsOpen(false);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [results, selectedIndex, query, router, navigateTo]
  );

  return (
    <div className="relative w-full max-w-xl">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="BMW M3, Audi A4, Tesla Model 3..."
          className="w-full rounded-xl border bg-card py-3.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-card shadow-2xl"
          >
            {results.length > 0 ? (
              <ul>
                {results.map((result, i) => (
                  <li key={result.id}>
                    <button
                      onClick={() => navigateTo(result)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        i === selectedIndex
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {result.brand} {result.model}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {result.generation}
                          {result.year_start && ` · ${result.year_start}`}
                        </p>
                      </div>
                      <ArrowRight
                        className={`h-4 w-4 transition ${
                          i === selectedIndex
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : !isLoading ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Aucun résultat pour &ldquo;{query}&rdquo;
              </div>
            ) : null}

            {query.length >= 2 && (
              <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
                <span>↑↓ naviguer · ↵ sélectionner · esc fermer</span>
                <button
                  onClick={() => {
                    router.push(
                      `/recherche?q=${encodeURIComponent(query)}`
                    );
                    setIsOpen(false);
                  }}
                  className="text-primary hover:underline"
                >
                  Tous les résultats →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
