"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, Trophy, ChevronDown, Car, Fuel, Wallet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { useGamificationStore } from "@/lib/gamification-store";
import {
  SEGMENT_CATEGORIES,
  FUEL_CATEGORIES,
  BUDGET_CATEGORIES,
  DECADE_CATEGORIES,
} from "@/lib/explorer-config";

const links = [
  { href: "/marques", label: "Marques" },
  { href: "/meilleur", label: "Classements" },
  { href: "/comparer", label: "Comparer" },
  { href: "/family-fit", label: "Family Fit" },
  { href: "/coffre", label: "Coffre" },
  { href: "/tco", label: "TCO" },
  { href: "/recherche", label: "Recherche" },
];

const MEGA_MENU_COLUMNS = [
  {
    title: "Segment",
    icon: Car,
    base: "/explorer/segment",
    items: SEGMENT_CATEGORIES.slice(0, 6),
  },
  {
    title: "Carburant",
    icon: Fuel,
    base: "/explorer/carburant",
    items: FUEL_CATEGORIES,
  },
  {
    title: "Budget",
    icon: Wallet,
    base: "/explorer/budget",
    items: BUDGET_CATEGORIES,
  },
  {
    title: "Décennie",
    icon: Calendar,
    base: "/explorer/decennie",
    items: DECADE_CATEGORIES.slice(0, 4),
  },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { favorites } = useFavorites();
  const [mounted, setMounted] = useState(false);
  const badgeCount = useGamificationStore((s) => s.unlockedBadges.length);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setMounted(true), []);

  const isExplorerActive = pathname.startsWith("/explorer");

  const openMega = () => {
    clearTimeout(megaTimeout.current);
    setMegaOpen(true);
  };

  const closeMega = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 150);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] bg-glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="mr-8 flex items-baseline gap-1.5">
          <span className="font-display text-xl font-bold tracking-tight text-white">
            FLM
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Auto
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-0.5 md:flex">
          {/* Explorer dropdown */}
          <div
            className="relative"
            onMouseEnter={openMega}
            onMouseLeave={closeMega}
          >
            <Link
              href="/explorer"
              aria-current={isExplorerActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors",
                isExplorerActive
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              Explorer
              <ChevronDown className={cn("h-3 w-3 transition-transform", megaOpen && "rotate-180")} />
              {isExplorerActive && (
                <span className="absolute inset-x-3 -bottom-[calc(0.5rem+1px)] h-[2px] rounded-full bg-primary" />
              )}
            </Link>

            {/* Mega menu panel */}
            {megaOpen && (
              <div
                className="absolute left-0 top-full z-50 mt-[9px] w-[560px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 shadow-2xl"
                onMouseEnter={openMega}
                onMouseLeave={closeMega}
              >
                <div className="grid grid-cols-4 gap-4">
                  {MEGA_MENU_COLUMNS.map((col) => {
                    const Icon = col.icon;
                    return (
                      <div key={col.title}>
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <Icon className="h-3 w-3" />
                          {col.title}
                        </p>
                        <div className="space-y-0.5">
                          {col.items.map((item) => (
                            <Link
                              key={item.slug}
                              href={`${col.base}/${item.slug}`}
                              onClick={() => setMegaOpen(false)}
                              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
                  <Link
                    href="/explorer"
                    onClick={() => setMegaOpen(false)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Voir tout l'explorateur
                  </Link>
                  <span className="text-xs text-muted-foreground">·</span>
                  <Link
                    href="/recherche"
                    onClick={() => setMegaOpen(false)}
                    className="text-xs font-medium text-muted-foreground hover:text-white hover:underline"
                  >
                    Recherche avancée
                  </Link>
                </div>
              </div>
            )}
          </div>

          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                data-tour={
                  link.href === "/marques"
                    ? "brands"
                    : link.href === "/comparer"
                      ? "compare"
                      : undefined
                }
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground/70"
                )}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[calc(0.5rem+1px)] h-[2px] rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search trigger */}
          <button
            data-tour="search"
            aria-label="Ouvrir la recherche"
            onClick={() =>
              window.dispatchEvent(new Event("open-command-palette"))
            }
            className="hidden items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-muted-foreground transition-all hover:border-[var(--border-default)] hover:text-foreground/70 md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Rechercher…</span>
            <kbd className="pointer-events-none ml-2 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-mono text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rechercher"
            className="text-muted-foreground hover:text-white md:hidden"
            onClick={() =>
              window.dispatchEvent(new Event("open-command-palette"))
            }
          >
            <Search className="h-4 w-4" />
          </Button>

          <UserMenu />

          {/* Badges */}
          <Link
            href="/coffre/badges"
            aria-label="Mes badges"
            className={cn(
              "relative hidden items-center justify-center rounded-md p-2 transition-colors hover:bg-[var(--bg-hover)] md:inline-flex",
              pathname.startsWith("/coffre/badges")
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Trophy className="h-4 w-4" />
            {mounted && badgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {badgeCount > 99 ? "99" : badgeCount}
              </span>
            )}
          </Link>

          {/* Favorites */}
          <Link
            href="/favoris"
            aria-label="Mes favoris"
            className={cn(
              "relative inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-[var(--bg-hover)]",
              pathname === "/favoris"
                ? "text-red-500"
                : "text-muted-foreground"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                favorites.length > 0 && "fill-red-500 text-red-500"
              )}
            />
            {favorites.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {favorites.length > 99 ? "99" : favorites.length}
              </span>
            )}
          </Link>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu de navigation"
                className="text-muted-foreground hover:text-white md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              aria-label="Menu de navigation"
            >
              <nav className="mt-8 flex flex-col gap-1">
                <Link
                  href="/explorer"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname.startsWith("/explorer")
                      ? "bg-[var(--bg-tertiary)] text-white"
                      : "text-muted-foreground hover:bg-[var(--bg-tertiary)] hover:text-white"
                  )}
                >
                  Explorer
                </Link>
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      pathname.startsWith(link.href)
                        ? "bg-[var(--bg-tertiary)] text-white"
                        : "text-muted-foreground hover:bg-[var(--bg-tertiary)] hover:text-white"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/coffre/badges"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname.startsWith("/coffre/badges")
                      ? "bg-[var(--bg-tertiary)] text-white"
                      : "text-muted-foreground hover:bg-[var(--bg-tertiary)] hover:text-white"
                  )}
                >
                  <Trophy className="h-4 w-4" />
                  Badges
                  {mounted && badgeCount > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {badgeCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/favoris"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === "/favoris"
                      ? "bg-[var(--bg-tertiary)] text-white"
                      : "text-muted-foreground hover:bg-[var(--bg-tertiary)] hover:text-white"
                  )}
                >
                  <Heart
                    className={cn(
                      "h-4 w-4",
                      favorites.length > 0 && "fill-red-500 text-red-500"
                    )}
                  />
                  Favoris
                  {favorites.length > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {favorites.length}
                    </span>
                  )}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
