"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Car,
  Search,
  GitCompare,
  Baby,
  Home,
} from "lucide-react";

type SearchResult = {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
};

const quickLinks = [
  { label: "Accueil", href: "/", icon: Home },
  { label: "Toutes les marques", href: "/marques", icon: Car },
  { label: "Comparateur", href: "/comparer", icon: GitCompare },
  { label: "Family Fit", href: "/family-fit", icon: Baby },
  { label: "Recherche", href: "/recherche", icon: Search },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=8`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || []);
        }
      } catch {
        // aborted or failed — ignore
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  // Allow external open via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Recherche rapide"
        description="Cherchez un véhicule, une marque ou naviguez rapidement."
      >
        <CommandInput
          placeholder="Rechercher un véhicule, une marque..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Recherche en cours..." : "Aucun résultat."}
          </CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Véhicules">
              {results.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.label}
                  onSelect={() => navigate(`/marques/${r.slug}`)}
                >
                  <Car className="mr-2 h-4 w-4" />
                  <span>
                    {r.brand} {r.model}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    {r.generation}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!query && (
            <>
              <CommandGroup heading="Navigation rapide">
                {quickLinks.map((link) => (
                  <CommandItem
                    key={link.href}
                    value={link.label}
                    onSelect={() => navigate(link.href)}
                  >
                    <link.icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
