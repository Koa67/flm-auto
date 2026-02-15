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
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Car,
  Search,
  GitCompareArrows,
  Baby,
  Home,
  Compass,
  Fuel,
  MessageCircle,
  Printer,
  Share2,
} from "lucide-react";
import {
  SEGMENT_CATEGORIES,
  FUEL_CATEGORIES,
} from "@/lib/explorer-config";

type SearchResult = {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
};

const TOP_BRANDS = [
  { name: "BMW", slug: "bmw" },
  { name: "Mercedes-Benz", slug: "mercedes-benz" },
  { name: "Audi", slug: "audi" },
  { name: "Porsche", slug: "porsche" },
  { name: "Toyota", slug: "toyota" },
  { name: "Volkswagen", slug: "volkswagen" },
  { name: "Tesla", slug: "tesla" },
  { name: "Peugeot", slug: "peugeot" },
];

const NAV_LINKS = [
  { label: "Accueil", href: "/", icon: Home, shortcut: "" },
  { label: "Toutes les marques", href: "/marques", icon: Car, shortcut: "" },
  { label: "Comparateur", href: "/comparer", icon: GitCompareArrows, shortcut: "" },
  { label: "Family Fit", href: "/family-fit", icon: Baby, shortcut: "" },
  { label: "Recherche avancée", href: "/recherche", icon: Search, shortcut: "" },
  { label: "Explorer", href: "/explorer", icon: Compass, shortcut: "" },
];

const ACTION_LINKS = [
  { label: "Ouvrir ALAIN (assistant)", href: "#alain", icon: MessageCircle, action: "alain" },
  { label: "Imprimer la page", href: "#print", icon: Printer, action: "print" },
  { label: "Partager la page", href: "#share", icon: Share2, action: "share" },
];

const SEGMENT_ICON = Car;
const FUEL_ICON = Fuel;

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
        // aborted or failed
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

  const executeAction = useCallback(
    (action: string) => {
      setOpen(false);
      setQuery("");
      if (action === "alain") {
        window.dispatchEvent(new CustomEvent("open-alain-chat"));
      } else if (action === "print") {
        window.print();
      } else if (action === "share") {
        if (navigator.share) {
          navigator.share({ url: window.location.href, title: document.title });
        } else {
          navigator.clipboard.writeText(window.location.href);
        }
      }
    },
    []
  );

  // Allow external open via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  // Filter nav/explorer items when query is present
  const queryLower = query.toLowerCase();
  const matchingNav = query
    ? NAV_LINKS.filter((l) => l.label.toLowerCase().includes(queryLower))
    : [];
  const matchingBrands = query
    ? TOP_BRANDS.filter((b) => b.name.toLowerCase().includes(queryLower))
    : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Recherche rapide"
      description="Cherchez un véhicule, une marque ou naviguez rapidement."
    >
      <CommandInput
        placeholder="Rechercher un véhicule, une marque, une page..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Recherche en cours..." : "Aucun résultat."}
        </CommandEmpty>

        {/* === WITH QUERY: search results + matching pages/brands === */}
        {results.length > 0 && (
          <CommandGroup heading="Véhicules">
            {results.map((r) => (
              <CommandItem
                key={r.id}
                value={`vehicle-${r.label}`}
                onSelect={() => navigate(`/marques/${r.slug}`)}
              >
                <Car className="mr-2 h-4 w-4 shrink-0 text-primary/60" />
                <span className="truncate">
                  <span className="font-medium">{r.brand}</span>{" "}
                  {r.model}{" "}
                  <span className="text-muted-foreground">
                    {r.generation}
                  </span>
                </span>
              </CommandItem>
            ))}
            <CommandItem
              value="recherche-avancée-voir-tout"
              onSelect={() => navigate(`/recherche?q=${encodeURIComponent(query)}`)}
              className="text-primary"
            >
              <Search className="mr-2 h-4 w-4 shrink-0" />
              Voir tous les résultats pour « {query} »
            </CommandItem>
          </CommandGroup>
        )}

        {query && matchingBrands.length > 0 && (
          <CommandGroup heading="Marques">
            {matchingBrands.map((b) => (
              <CommandItem
                key={b.slug}
                value={`brand-${b.name}`}
                onSelect={() => navigate(`/marques/${b.slug}`)}
              >
                <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                  {b.name.charAt(0)}
                </span>
                {b.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query && matchingNav.length > 0 && (
          <CommandGroup heading="Pages">
            {matchingNav.map((link) => (
              <CommandItem
                key={link.href}
                value={`page-${link.label}`}
                onSelect={() => navigate(link.href)}
              >
                <link.icon className="mr-2 h-4 w-4 shrink-0 text-primary/60" />
                {link.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* === NO QUERY: full sections === */}
        {!query && (
          <>
            <CommandGroup heading="Navigation">
              {NAV_LINKS.map((link) => (
                <CommandItem
                  key={link.href}
                  value={link.label}
                  onSelect={() => navigate(link.href)}
                >
                  <link.icon className="mr-2 h-4 w-4 shrink-0 text-primary/60" />
                  {link.label}
                  {link.shortcut && (
                    <CommandShortcut>{link.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Explorer par segment">
              {SEGMENT_CATEGORIES.slice(0, 6).map((seg) => (
                <CommandItem
                  key={seg.slug}
                  value={`segment-${seg.label}`}
                  onSelect={() => navigate(`/explorer/segment/${seg.slug}`)}
                >
                  <SEGMENT_ICON className="mr-2 h-4 w-4 shrink-0 text-blue-400/60" />
                  {seg.label}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {seg.description}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Explorer par carburant">
              {FUEL_CATEGORIES.map((fuel) => (
                <CommandItem
                  key={fuel.slug}
                  value={`fuel-${fuel.label}`}
                  onSelect={() => navigate(`/explorer/carburant/${fuel.slug}`)}
                >
                  <FUEL_ICON className="mr-2 h-4 w-4 shrink-0 text-emerald-400/60" />
                  {fuel.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Marques populaires">
              {TOP_BRANDS.map((b) => (
                <CommandItem
                  key={b.slug}
                  value={`brand-${b.name}`}
                  onSelect={() => navigate(`/marques/${b.slug}`)}
                >
                  <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {b.name.charAt(0)}
                  </span>
                  {b.name}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              {ACTION_LINKS.map((a) => (
                <CommandItem
                  key={a.action}
                  value={`action-${a.label}`}
                  onSelect={() => executeAction(a.action)}
                >
                  <a.icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2">
        <span className="text-[10px] text-muted-foreground">
          ↑↓ naviguer · ↵ sélectionner · esc fermer
        </span>
        <span className="text-[10px] text-muted-foreground">
          ⌘K
        </span>
      </div>
    </CommandDialog>
  );
}
