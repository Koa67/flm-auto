import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { NewsletterForm } from "@/components/newsletter-form";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Explorer</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/marques" className="hover:text-foreground">Toutes les marques</Link></li>
              <li><Link href="/recherche" className="hover:text-foreground">Recherche</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Outils</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/comparer" className="hover:text-foreground">Comparateur</Link></li>
              <li><Link href="/family-fit" className="hover:text-foreground">Family Fit</Link></li>
              <li><Link href="/meilleur/suv-familial-2024" className="hover:text-foreground">Classements</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Marques populaires</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/marques/bmw" className="hover:text-foreground">BMW</Link></li>
              <li><Link href="/marques/mercedes-benz" className="hover:text-foreground">Mercedes-Benz</Link></li>
              <li><Link href="/marques/audi" className="hover:text-foreground">Audi</Link></li>
              <li><Link href="/marques/porsche" className="hover:text-foreground">Porsche</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Newsletter</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Classements et analyses auto, chaque semaine.
            </p>
            <NewsletterForm source="footer" />
          </div>
        </div>
        <Separator className="my-6" />
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} FLM Auto. Donn&eacute;es &agrave; titre informatif.
        </p>
      </div>
    </footer>
  );
}
