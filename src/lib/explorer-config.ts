export interface BrowseCategory {
  slug: string;
  label: string;
  description: string;
}

export const SEGMENT_CATEGORIES: BrowseCategory[] = [
  { slug: "suv", label: "SUV", description: "SUV et crossovers" },
  { slug: "berline", label: "Berline", description: "Berlines et tricorps" },
  { slug: "citadine", label: "Citadine", description: "Citadines et compactes" },
  { slug: "break", label: "Break", description: "Breaks et familiales" },
  { slug: "coupe", label: "Coupé", description: "Coupés sport" },
  { slug: "cabriolet", label: "Cabriolet", description: "Cabriolets et roadsters" },
  { slug: "monospace", label: "Monospace", description: "Monospaces et vans" },
  { slug: "pickup", label: "Pick-up", description: "Pick-up et utilitaires" },
];

export const SEGMENT_SLUG_MAP: Record<string, string> = {
  suv: "SUV",
  berline: "sedan",
  citadine: "hatchback",
  break: "wagon",
  coupe: "coupe",
  cabriolet: "convertible",
  monospace: "van",
  pickup: "pickup",
};

export const FUEL_CATEGORIES: BrowseCategory[] = [
  { slug: "essence", label: "Essence", description: "Moteurs essence" },
  { slug: "diesel", label: "Diesel", description: "Moteurs diesel" },
  { slug: "electrique", label: "Électrique", description: "100% électrique" },
  { slug: "hybride", label: "Hybride", description: "Hybrides classiques" },
  { slug: "hybride-rechargeable", label: "Hybride rechargeable", description: "PHEV plug-in" },
];

export const FUEL_SLUG_MAP: Record<string, string> = {
  essence: "petrol",
  diesel: "diesel",
  electrique: "electric",
  hybride: "hybrid",
  "hybride-rechargeable": "plugin_hybrid",
};

export const BUDGET_CATEGORIES: BrowseCategory[] = [
  { slug: "petit-budget", label: "Petit budget", description: "Véhicules accessibles — jusqu'à 130 ch" },
  { slug: "budget-moyen", label: "Budget moyen", description: "Gamme intermédiaire — 130 à 250 ch" },
  { slug: "budget-confort", label: "Budget confort", description: "Gamme premium — 250 à 400 ch" },
  { slug: "premium-luxe", label: "Premium & Luxe", description: "Haut de gamme — plus de 400 ch" },
];

export const BUDGET_FILTERS: Record<string, { power_min?: number; power_max?: number }> = {
  "petit-budget": { power_max: 130 },
  "budget-moyen": { power_min: 130, power_max: 250 },
  "budget-confort": { power_min: 250, power_max: 400 },
  "premium-luxe": { power_min: 400 },
};

export const DECADE_CATEGORIES: BrowseCategory[] = [
  { slug: "2020", label: "Années 2020", description: "2020 à aujourd'hui" },
  { slug: "2010", label: "Années 2010", description: "2010 à 2019" },
  { slug: "2000", label: "Années 2000", description: "2000 à 2009" },
  { slug: "1990", label: "Années 1990", description: "1990 à 1999" },
  { slug: "1980", label: "Années 1980", description: "1980 à 1989" },
  { slug: "1970", label: "Années 1970", description: "1970 à 1979" },
];

export const DECADE_FILTERS: Record<string, { year_min: number; year_max: number }> = {
  "2020": { year_min: 2020, year_max: 2029 },
  "2010": { year_min: 2010, year_max: 2019 },
  "2000": { year_min: 2000, year_max: 2009 },
  "1990": { year_min: 1990, year_max: 1999 },
  "1980": { year_min: 1980, year_max: 1989 },
  "1970": { year_min: 1970, year_max: 1979 },
};
