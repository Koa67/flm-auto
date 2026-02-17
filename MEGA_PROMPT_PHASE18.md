# MEGA PROMPT — Phase 18 : Red Team Fixes + Polish Intégral

> **MODE : EXÉCUTION AUTONOME. Ne demande JAMAIS de confirmation. Fais tout. Commit après chaque bloc.**
> **Si un step échoue, log l'erreur, passe au suivant.**

---

## RED TEAM FINDINGS — LISTE EXHAUSTIVE

Voir le tableau complet dans le chat. Ce prompt traite tous les issues identifiés par ordre de sévérité.

---

## BLOC 1 — P0 CRITIQUES (le site est cassé)

### Step 1.1 — Fix Search API (ne cherche que 500/4238 gens)

Fichier : `src/app/api/search/route.ts`

**PROBLÈME** : Le code fait `.limit(500)` puis filtre en JavaScript côté serveur. Résultat : 88% de la base de données est invisible à la recherche. Un utilisateur cherchant "Fiat Punto" ne trouvera rien si le Punto n'est pas dans les 500 premiers résultats.

**FIX** : Utiliser le full-text search de Supabase OU un ilike avec les bons filtres côté DB.

Réécrire la route comme suit :

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const query = sanitizeQuery(rawQuery, 200);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20") || 20, 50);

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    // Split query into words for multi-term search
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    
    // Build the query using Supabase's textSearch or ilike
    // Strategy: search across brand name, model name, gen internal_code, gen name
    // Use a Supabase RPC function if available, otherwise use ilike chains
    
    let dbQuery = supabase
      .from("generations")
      .select(`
        id, name, slug, internal_code, production_start, production_end,
        models!inner (
          id, name, slug,
          brands!inner (id, name, slug)
        )
      `);

    // Apply ilike filters for each search word
    // Use .or() to match any of: brand name, model name, gen code, gen name
    for (const word of words.slice(0, 3)) {  // Max 3 words to prevent abuse
      const pattern = `%${word}%`;
      dbQuery = dbQuery.or(
        `name.ilike.${pattern},internal_code.ilike.${pattern},models.name.ilike.${pattern},models.brands.name.ilike.${pattern}`
      );
    }

    const { data, error } = await dbQuery.limit(limit);

    if (error) {
      // Fallback: if the .or() with nested tables fails (Supabase limitation),
      // use a simpler approach with RPC or a view
      console.error("Search query error:", error);
      
      // FALLBACK: fetch matching generations by simple text match
      // This is still better than the .limit(500) approach
      const { data: fallbackData } = await supabase
        .from("generations")
        .select(`
          id, name, slug, internal_code, production_start, production_end,
          models!inner (id, name, slug, brands!inner (id, name, slug))
        `)
        .or(`name.ilike.%${words[0]}%,internal_code.ilike.%${words[0]}%`)
        .limit(limit * 3);  // Get more to filter further

      const filtered = (fallbackData || []).filter(gen => {
        const brand = (gen.models as any).brands.name.toLowerCase();
        const model = (gen.models as any).name.toLowerCase();
        const genCode = (gen.internal_code || "").toLowerCase();
        const genName = (gen.name || "").toLowerCase();
        const combined = `${brand} ${model} ${genCode} ${genName}`;
        return words.every(w => combined.includes(w));
      }).slice(0, limit);

      return NextResponse.json({
        data: filtered.map(gen => formatResult(gen, query)),
        query,
        count: filtered.length,
      });
    }

    // Format results
    const results = (data || [])
      .map(gen => formatResult(gen, query))
      .sort((a, b) => {
        const queryLower = query.toLowerCase();
        const aExact = a.label.toLowerCase().startsWith(queryLower) ? 0 
          : a.model.toLowerCase().startsWith(queryLower) ? 1 : 2;
        const bExact = b.label.toLowerCase().startsWith(queryLower) ? 0 
          : b.model.toLowerCase().startsWith(queryLower) ? 1 : 2;
        return aExact - bExact;
      });

    return NextResponse.json({ data: results, query, count: results.length });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

function formatResult(gen: any, query: string) {
  const brand = (gen.models as any).brands.name;
  const model = (gen.models as any).name;
  const genCode = gen.internal_code || gen.name;
  return {
    id: gen.id,
    label: `${brand} ${model} ${genCode}`,
    brand,
    model,
    generation: genCode,
    slug: `${(gen.models as any).brands.slug}/${(gen.models as any).slug}/${gen.slug}`,
    year_start: gen.production_start ? new Date(gen.production_start).getFullYear() : null,
    year_end: gen.production_end ? new Date(gen.production_end).getFullYear() : null,
  };
}
```

**MEILLEURE APPROCHE** : Créer une vue PostgreSQL ou un RPC Supabase `search_vehicles(query text)` qui fait le full-text search côté DB. Vérifier si un tel RPC existe déjà :

```bash
grep -rn "rpc.*search" src/ --include="*.ts" --include="*.tsx" | head -20
grep -rn "get_popular\|search_vehicles\|rpc" src/lib/ --include="*.ts" | head -20
```

Si un RPC `search_vehicles` existe, l'utiliser. Sinon, l'approche ilike ci-dessus est la solution pragmatique.

**IMPORTANT** : L'ancienne approche `.limit(500)` doit être totalement supprimée. C'est un P0 absolu.

### Step 1.2 — Fix FamilyFit badges (light mode sur dark theme)

Fichier : `src/app/family-fit/page.tsx` — composant `FamilyFitCard`

**PROBLÈME** : Les badges utilisent `bg-green-100 text-green-800`, `bg-blue-100 text-blue-800`, etc. Sur le thème dark cockpit (#08080c), ces couleurs claires sont un désastre visuel.

**FIX** : Remplacer par des couleurs dark-mode cohérentes avec le design system.

```typescript
const fitColor: Record<string, string> = {
  excellent: "bg-green-500/15 text-green-400 border border-green-500/20",
  good: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  tight: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  not_recommended: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
  incompatible: "bg-red-500/15 text-red-400 border border-red-500/20",
};
```

Aussi dans le même fichier, le badge `3-across` utilise `bg-green-100 text-green-800` — même fix :
```typescript
{v.three_across && (
  <Badge className="bg-green-500/15 text-green-400 border border-green-500/20">3-across</Badge>
)}
```

### Step 1.3 — Fix canonical URL contradictoire

**PROBLÈME** : 
- `src/app/layout.tsx` metadata dit `canonical: "https://flm-auto.fr"` 
- `src/app/robots.ts` dit `sitemap: "https://flm-auto.vercel.app/sitemap.xml"`
- `src/app/sitemap.ts` utilise `process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.vercel.app"`
- `src/app/api/og/route.tsx` utilise `process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.vercel.app"`

**FIX** : Unifier tout sur la même variable d'environnement.

1. Dans `robots.ts` :
```typescript
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
```

2. Dans `layout.tsx`, le canonical doit aussi utiliser la variable :
```typescript
alternates: {
  canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr",
},
```

Note : `canonical` dans le layout racine sans path est bizarre. Il devrait soit être absent, soit être dynamique par page. Pour le MVP, le garder mais s'assurer que les pages individuelles (véhicules, marques) ont leur propre canonical.

### Step 1.4 — Fix sitemap sous-pages manquantes

Fichier : `src/app/sitemap.ts`

**PROBLÈME** : `SUB_PAGES` ne contient que `["securite", "photos", "videos"]` mais il existe aussi `fiche-technique`, `dimensions`, `alternatives`.

**FIX** :
```typescript
const SUB_PAGES = [
  "fiche-technique",
  "securite",
  "photos",
  "videos",
  "dimensions",
  "alternatives",
];
```

---

## BLOC 2 — P1 GRAVES (UX cassée)

### Step 2.1 — Galerie avec lightbox

Fichier : `src/app/marques/[brand]/[model]/[generation]/page.tsx` — composant `ImageGrid`

**PROBLÈME** : Les images sont dans une grille mais cliquer ne fait rien. C'est une galerie photo sans possibilité de voir en grand.

**FIX** : Ajouter un lightbox simple avec un Dialog shadcn. Ne PAS ajouter de dépendance externe.

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

function ImageGrid({
  images,
  alt,
}: {
  images: { id: string; url: string; source: string }[];
  alt: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg surface-2 cursor-pointer"
          >
            <Image
              src={img.url}
              alt={`${alt} - photo ${i + 1}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-5xl border-none bg-black/95 p-0">
          {lightboxIndex !== null && (
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <Image
                src={images[lightboxIndex].url}
                alt={`${alt} - photo ${lightboxIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[80vh] w-auto object-contain"
              />
              {/* Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
                    }}
                    className="absolute left-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    aria-label="Photo précédente"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((lightboxIndex + 1) % images.length);
                    }}
                    className="absolute right-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    aria-label="Photo suivante"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              {/* Counter */}
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                {lightboxIndex + 1} / {images.length}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**ATTENTION** : `ImageGrid` est actuellement défini dans le fichier server component `page.tsx`. Il faut soit :
- L'extraire dans un fichier séparé `src/components/vehicle/image-grid.tsx` avec `"use client"` 
- Soit le rendre client-side dans le page.tsx existant

La meilleure approche : créer `src/components/vehicle/image-grid.tsx` et l'importer dans la page véhicule.

### Step 2.2 — Breadcrumb toujours visible sur page véhicule

Fichier : `src/app/marques/[brand]/[model]/[generation]/page.tsx`

**PROBLÈME** : Quand le HeroSection est affiché (images présentes), il n'y a pas de breadcrumb. L'utilisateur perd la navigation contextuelle.

**FIX** : Vérifier si `HeroSection` inclut déjà un breadcrumb. Si non, ajouter un breadcrumb AVANT le hero :

```tsx
{/* Breadcrumb — toujours visible */}
<div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
  <nav className="flex flex-wrap gap-2 text-sm text-muted-foreground" aria-label="Fil d'Ariane">
    <Link href="/marques" className="hover:text-primary">Marques</Link>
    <span>/</span>
    <Link href={`/marques/${bs}`} className="hover:text-primary">{brand.name}</Link>
    <span>/</span>
    <Link href={`/marques/${bs}/${ms}`} className="hover:text-primary">{model.name}</Link>
    <span>/</span>
    <span className="text-white">{genLbl}</span>
  </nav>
</div>

{/* Hero Section */}
{images.exteriors.length > 0 ? (
  <HeroSection ... />
) : (
  /* Fallback header — supprimer le breadcrumb dupliqué ici */
  <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
    <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">
      {brand.name} <span className="text-primary">{model.name}</span> {genLbl}
    </h1>
    ...
  </div>
)}
```

Vérifier d'abord le contenu de `hero-section.tsx` pour voir s'il a déjà un breadcrumb.

### Step 2.3 — Loading.tsx pour pages manquantes

Créer des loading states pour les pages qui n'en ont pas. Utiliser le même pattern que les loading.tsx existants.

Fichier type : `src/app/coffre/loading.tsx` (identique pour `/tco`, `/family-fit`, `/favoris`, `/configurateur`, `/profil`)

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64 mb-2" />
      <Skeleton className="h-5 w-96 mb-8" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
```

Adapter le contenu du skeleton à chaque page (ex: pour `/favoris` → grille de cards skeleton).

Pages à créer :
- `src/app/coffre/loading.tsx`
- `src/app/tco/loading.tsx`
- `src/app/family-fit/loading.tsx`
- `src/app/favoris/loading.tsx`
- `src/app/configurateur/loading.tsx`
- `src/app/profil/loading.tsx`
- `src/app/dashboard/settings/loading.tsx`

### Step 2.4 — Keyboard navigation sur search dropdowns

Les dropdowns de recherche dans `/coffre`, `/tco` et `/comparer` n'ont pas de navigation clavier.

Pattern à appliquer sur chaque dropdown :

```tsx
const [highlightedIndex, setHighlightedIndex] = useState(-1);

// On the input:
onKeyDown={(e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setHighlightedIndex(prev => Math.max(prev - 1, 0));
  } else if (e.key === "Enter" && highlightedIndex >= 0) {
    e.preventDefault();
    selectVehicle(results[highlightedIndex]);
  } else if (e.key === "Escape") {
    setResults([]);
  }
}}

// On each dropdown item:
className={cn(
  "...",
  i === highlightedIndex && "bg-accent"
)}
```

Appliquer ce pattern dans :
- `src/app/coffre/page.tsx`
- `src/app/tco/page.tsx`
- `src/app/comparer/page.tsx` (vérifier si déjà implémenté)

### Step 2.5 — Connecter /comparer et /comparatif/[slugs]

Vérifier si `/comparatif/[slugs]` est une page de comparaison server-rendered avec URL partageable.

Si oui : quand l'utilisateur ajoute des véhicules dans `/comparer` (client-side), ajouter un bouton "Partager cette comparaison" qui redirige vers `/comparatif/{slug1}-vs-{slug2}-vs-...`.

Si `/comparatif/[slugs]` est mort ou incomplet, soit le compléter soit le supprimer.

```bash
cat src/app/comparatif/[slugs]/page.tsx | head -50
```

---

## BLOC 3 — P2 POLISH (finition professionnelle)

### Step 3.1 — Homepage : image hero

Le hero est actuellement text-only. Ajouter une image de fond ou un visuel automobile.

Option A (simple) : Ajouter un gradient + SVG silhouette de voiture en fond.
Option B (mieux) : Utiliser une des images populaires de la DB comme background avec overlay gradient.

Implémenter l'option qui ne nécessite PAS d'image externe hardcodée (utiliser les données DB).

Le hero actuel fonctionne bien. Si l'ajout d'image complique le code ou ralentit le LCP, ne PAS l'ajouter.

### Step 3.2 — Dead features : cleanup ou connexion

Pour chaque feature morte, décider : **connecter** ou **supprimer le bouton**.

**Newsletter** : Le form insert en DB. C'est suffisant pour le MVP — on enverra les emails plus tard. GARDER.

**Price Alerts** : Le bouton `PriceAlertButton` et l'API `/api/price-alerts` existent. Vérifier si le bouton est visible sur les pages véhicules. Si oui et qu'il ne fait rien d'utile (pas d'email), soit le masquer soit afficher "Bientôt disponible".

**Saved Searches** : L'API existe, vérifier si l'UI dans `/recherche` l'utilise. Si le bouton "Sauvegarder" est visible et fonctionne (insert en DB), GARDER.

**Profile Wizard** : Vérifier si utilisé. Si non, ne PAS le supprimer mais ne pas le rendre accessible.

Priorité : ne rien casser, juste s'assurer que les features visibles fonctionnent ou sont masquées proprement.

### Step 3.3 — Cookie banner : vérifier le blocage GA

Lire `src/components/cookie-banner.tsx` et `src/components/analytics-wrapper.tsx`.

Vérifier que :
1. Le banner stocke le choix dans un cookie/localStorage
2. `ConditionalAnalytics` vérifie ce choix avant d'injecter le script GA
3. Si l'utilisateur refuse, GA n'est PAS chargé

Si le blocage n'est pas implémenté, l'implémenter. C'est une obligation RGPD.

### Step 3.4 — Dead code cleanup

Vérifier si ces composants sont importés quelque part :

```bash
grep -rn "page-transition" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -rn "responsive-sidebar" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -rn "animated-grid" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -rn "animated-counter" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
grep -rn "animated-number" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Si un composant n'est importé nulle part, le supprimer.

### Step 3.5 — Vérifier OG images

Tester la route OG :
```bash
curl -s "http://localhost:3000/api/og?title=BMW%20Serie%203&subtitle=Fiche%20technique&stats=5★%20NCAP|340%20ch|4.4s" -o /tmp/og-test.png
file /tmp/og-test.png
```

Si ça fonctionne, c'est bon. Si ça crashe, identifier pourquoi.

---

## BLOC 4 — SAFETY DATA PUSH (le 55.2% est le vrai problème)

### Step 4.1 — Diagnostic des 1930 gens sans safety A/B

Le problème : ANCAP et IIHS retournent 0 nouveau car la couverture A/B existante est déjà max pour les sources automatisées.

Les 1900 gens sans safety verified sont probablement :
- Des gens anciennes (pré-2000) jamais testées par Euro NCAP
- Des gens de niche (concepts, marché domestique) 
- Des gens avec safety D (heuristique) qu'on pourrait upgrader

**Analyse** :
```sql
-- Compter les gens sans safety par période
SELECT 
  CASE 
    WHEN EXTRACT(YEAR FROM g.production_start) >= 2015 THEN '2015+'
    WHEN EXTRACT(YEAR FROM g.production_start) >= 2010 THEN '2010-2014'
    WHEN EXTRACT(YEAR FROM g.production_start) >= 2000 THEN '2000-2009'
    WHEN g.production_start IS NOT NULL THEN 'pré-2000'
    ELSE 'date inconnue'
  END as period,
  COUNT(*) as missing_count
FROM generations g
LEFT JOIN safety_ratings sr ON sr.generation_id = g.id AND sr.confidence IN ('A','B')
WHERE sr.id IS NULL
GROUP BY 1
ORDER BY 1;
```

Créer un script `scripts/pipeline/85-safety-gap-analysis.ts` qui exécute cette analyse et produit un rapport.

**Stratégie** : Les gens pré-2000 n'ont probablement jamais été testées. On ne peut pas inventer de données. Les taguer comme "non testé" est honnête.

Pour les gens 2010+ sans safety A/B mais avec safety D (heuristique) :
- Si la note D est basée sur le même modèle testé dans une autre génération → upgrader en B
- Si la note D est purement heuristique (segment/marque) → garder en D

La propagation v5 a dit "0 opportunités" mais peut-être qu'après le cleanup de Phase 17 (30 gens supprimées), de nouvelles propagations sont possibles. Re-vérifier.

### Step 4.2 — EuroNCAP scraping direct (dernière tentative)

Les scripts existants ont essayé l'API JSON de euroncap.com. Essayer une approche différente :

1. Lire le contenu de `data/raw/euroncap_v3_all_ratings.json` — il contient 483 ratings dont 319 matched.
2. Les 164 ratings non-matched (483-319) sont de la donnée gaspillée. Améliorer le matching.

Créer : `scripts/pipeline/86-euroncap-rematch.ts`

Ce script doit :
1. Charger les 483 ratings du fichier JSON
2. Re-matcher avec une logique plus souple (fuzzy matching sur le nom du modèle)
3. Les 164 non-matched contiennent probablement des noms légèrement différents (ex: "3 Series" vs "Serie 3", "C-Class" vs "Classe C")
4. Insérer les nouveaux matches en confidence A

---

## BLOC 5 — VALIDATION FINALE

### Step 5.1 — Build

```bash
npm run build
```

0 TypeScript errors.

### Step 5.2 — E2E tests

```bash
npx playwright test --project=chromium --project=mobile
```

0 failures. Si des tests cassent à cause des changements (ex: search behavior change), adapter les tests.

### Step 5.3 — Test manuel search

Après le fix du Step 1.1, vérifier que la recherche fonctionne pour :
- "Fiat" → doit retourner des résultats (avant: probablement non)
- "BMW Serie 3" → résultats pertinents
- "Golf" → Volkswagen Golf
- "Kona" → Hyundai Kona
- "W210" → Mercedes W210

### Step 5.4 — Scorecard

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/43-honest-scorecard.ts
```

### Step 5.5 — Commit

```bash
git add -A
git commit -m "Phase 18 — Red team fixes: search P0, lightbox, badges, sitemap, loading states, breadcrumbs"
```

---

## PRIORITÉ

1. **Bloc 1** (P0 critiques) — OBLIGATOIRE. La search est le cœur du site.
2. **Bloc 2** (P1 graves) — OBLIGATOIRE. Lightbox, loading, breadcrumbs.
3. **Bloc 5** (Validation) — OBLIGATOIRE pour fermer.
4. **Bloc 3** (P2 polish) — Si temps disponible.
5. **Bloc 4** (Safety data) — Si temps disponible.

Si le temps est limité : Blocs 1, 2.1-2.3, 5.

---

## CONTRAINTES

- **NE PAS ajouter de dépendances externes** pour le lightbox — utiliser Dialog shadcn
- **NE PAS réécrire des pages entières** — fixes chirurgicaux
- **NE PAS casser les E2E** — chaque fix doit être validé
- **Tester la search manuellement** après le fix — c'est le fix le plus critique
- **Dry-run** tout script de données avant exécution
- Les changements CSS doivent rester dans le design system cockpit
- Pas de reformatting inutile des fichiers non touchés
