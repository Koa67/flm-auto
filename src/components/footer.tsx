import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";

export function Footer() {
  return (
    <footer className="bg-[var(--bg-primary)]" role="contentinfo">
      <div className="gradient-divider" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/70">
              Explorer
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/marques" className="transition-colors hover:text-white">
                  Toutes les marques
                </Link>
              </li>
              <li>
                <Link href="/recherche" className="transition-colors hover:text-white">
                  Recherche
                </Link>
              </li>
              <li>
                <Link href="/meilleur" className="transition-colors hover:text-white">
                  Classements
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/70">
              Outils
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/comparer" className="transition-colors hover:text-white">
                  Comparateur
                </Link>
              </li>
              <li>
                <Link href="/family-fit" className="transition-colors hover:text-white">
                  Family Fit
                </Link>
              </li>
              <li>
                <Link href="/coffre" className="transition-colors hover:text-white">
                  Coffre
                </Link>
              </li>
              <li>
                <Link href="/tco" className="transition-colors hover:text-white">
                  TCO
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/70">
              Marques populaires
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/marques/bmw" className="transition-colors hover:text-white">
                  BMW
                </Link>
              </li>
              <li>
                <Link
                  href="/marques/mercedes-benz"
                  className="transition-colors hover:text-white"
                >
                  Mercedes-Benz
                </Link>
              </li>
              <li>
                <Link href="/marques/audi" className="transition-colors hover:text-white">
                  Audi
                </Link>
              </li>
              <li>
                <Link href="/marques/porsche" className="transition-colors hover:text-white">
                  Porsche
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/70">
              Newsletter
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Classements et analyses auto, chaque semaine.
            </p>
            <NewsletterForm source="footer" />
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-[var(--border-subtle)]" />

        {/* Bottom */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Logo */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              FLM
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Auto
            </span>
          </div>

          {/* Legal links */}
          <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
            <Link
              href="/mentions-legales"
              className="transition-colors hover:text-white"
            >
              Mentions l&eacute;gales
            </Link>
            <Link
              href="/confidentialite"
              className="transition-colors hover:text-white"
            >
              Confidentialit&eacute;
            </Link>
            <Link href="/cgu" className="transition-colors hover:text-white">
              CGU
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FLM Auto
          </p>
        </div>
      </div>
    </footer>
  );
}
