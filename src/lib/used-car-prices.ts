/**
 * Hardcoded used car pricing — fallback data covering ~75 popular models.
 * Source: industry depreciation curves (DAT/Schwacke), French market averages.
 * Keyed by "brand|model" (lowercase) for fast lookup.
 */

interface UsedPriceEntry {
  msrp: number;
  segment: string;
  /** avg_price by age in years (0–5) */
  byAge: [number, number, number, number, number, number];
}

// Depreciation helper: generate prices from MSRP
function dep(msrp: number, rates: number[]): [number, number, number, number, number, number] {
  return rates.map((r) => Math.round(msrp * r / 100) * 100) as [number, number, number, number, number, number];
}

// Standard depreciation curves by segment (% of MSRP retained)
const STD = [97, 76, 64, 55, 48, 42]; // standard
const PREM = [97, 78, 66, 57, 50, 44]; // premium
const SPORT = [97, 80, 70, 62, 55, 49]; // sports/collectible
const SUV = [97, 77, 65, 56, 49, 43]; // SUV
const ECO = [97, 74, 61, 52, 45, 39]; // economy
const EV = [97, 72, 58, 48, 40, 34]; // electric (faster depreciation)

const DATA: Record<string, UsedPriceEntry> = {
  // === BMW ===
  "bmw|1 series": { msrp: 35000, segment: "compact", byAge: dep(35000, STD) },
  "bmw|2 series": { msrp: 42000, segment: "compact", byAge: dep(42000, PREM) },
  "bmw|3 series": { msrp: 48000, segment: "sedan", byAge: dep(48000, PREM) },
  "bmw|4 series": { msrp: 52000, segment: "coupe", byAge: dep(52000, PREM) },
  "bmw|5 series": { msrp: 60000, segment: "sedan", byAge: dep(60000, PREM) },
  "bmw|7 series": { msrp: 105000, segment: "luxury", byAge: dep(105000, PREM) },
  "bmw|x1": { msrp: 42000, segment: "suv", byAge: dep(42000, SUV) },
  "bmw|x3": { msrp: 55000, segment: "suv", byAge: dep(55000, SUV) },
  "bmw|x5": { msrp: 78000, segment: "suv", byAge: dep(78000, SUV) },
  "bmw|ix": { msrp: 85000, segment: "ev_suv", byAge: dep(85000, EV) },
  // === Mercedes ===
  "mercedes-benz|a-class": { msrp: 36000, segment: "compact", byAge: dep(36000, PREM) },
  "mercedes-benz|c-class": { msrp: 50000, segment: "sedan", byAge: dep(50000, PREM) },
  "mercedes-benz|e-class": { msrp: 65000, segment: "sedan", byAge: dep(65000, PREM) },
  "mercedes-benz|s-class": { msrp: 115000, segment: "luxury", byAge: dep(115000, PREM) },
  "mercedes-benz|gla": { msrp: 42000, segment: "suv", byAge: dep(42000, SUV) },
  "mercedes-benz|glc": { msrp: 56000, segment: "suv", byAge: dep(56000, SUV) },
  "mercedes-benz|gle": { msrp: 78000, segment: "suv", byAge: dep(78000, SUV) },
  "mercedes-benz|eqc": { msrp: 72000, segment: "ev_suv", byAge: dep(72000, EV) },
  "mercedes-benz|eqa": { msrp: 52000, segment: "ev_suv", byAge: dep(52000, EV) },
  // === Audi ===
  "audi|a1": { msrp: 28000, segment: "compact", byAge: dep(28000, STD) },
  "audi|a3": { msrp: 38000, segment: "compact", byAge: dep(38000, PREM) },
  "audi|a4": { msrp: 46000, segment: "sedan", byAge: dep(46000, PREM) },
  "audi|a5": { msrp: 52000, segment: "coupe", byAge: dep(52000, PREM) },
  "audi|a6": { msrp: 62000, segment: "sedan", byAge: dep(62000, PREM) },
  "audi|q3": { msrp: 42000, segment: "suv", byAge: dep(42000, SUV) },
  "audi|q5": { msrp: 55000, segment: "suv", byAge: dep(55000, SUV) },
  "audi|q7": { msrp: 78000, segment: "suv", byAge: dep(78000, SUV) },
  "audi|e-tron": { msrp: 75000, segment: "ev_suv", byAge: dep(75000, EV) },
  // === Volkswagen ===
  "volkswagen|polo": { msrp: 24000, segment: "city", byAge: dep(24000, ECO) },
  "volkswagen|golf": { msrp: 32000, segment: "compact", byAge: dep(32000, STD) },
  "volkswagen|passat": { msrp: 42000, segment: "sedan", byAge: dep(42000, STD) },
  "volkswagen|tiguan": { msrp: 40000, segment: "suv", byAge: dep(40000, SUV) },
  "volkswagen|t-roc": { msrp: 32000, segment: "suv", byAge: dep(32000, SUV) },
  "volkswagen|id.3": { msrp: 42000, segment: "ev", byAge: dep(42000, EV) },
  "volkswagen|id.4": { msrp: 48000, segment: "ev_suv", byAge: dep(48000, EV) },
  // === Peugeot ===
  "peugeot|208": { msrp: 22000, segment: "city", byAge: dep(22000, ECO) },
  "peugeot|308": { msrp: 30000, segment: "compact", byAge: dep(30000, ECO) },
  "peugeot|508": { msrp: 42000, segment: "sedan", byAge: dep(42000, STD) },
  "peugeot|2008": { msrp: 28000, segment: "suv", byAge: dep(28000, SUV) },
  "peugeot|3008": { msrp: 38000, segment: "suv", byAge: dep(38000, SUV) },
  "peugeot|5008": { msrp: 42000, segment: "suv", byAge: dep(42000, SUV) },
  "peugeot|e-208": { msrp: 36000, segment: "ev", byAge: dep(36000, EV) },
  // === Renault ===
  "renault|clio": { msrp: 20000, segment: "city", byAge: dep(20000, ECO) },
  "renault|megane": { msrp: 30000, segment: "compact", byAge: dep(30000, ECO) },
  "renault|captur": { msrp: 26000, segment: "suv", byAge: dep(26000, SUV) },
  "renault|arkana": { msrp: 32000, segment: "suv", byAge: dep(32000, SUV) },
  "renault|megane e-tech": { msrp: 42000, segment: "ev", byAge: dep(42000, EV) },
  // === Citroën ===
  "citroën|c3": { msrp: 18000, segment: "city", byAge: dep(18000, ECO) },
  "citroën|c4": { msrp: 26000, segment: "compact", byAge: dep(26000, ECO) },
  "citroën|c5 aircross": { msrp: 32000, segment: "suv", byAge: dep(32000, SUV) },
  // === Toyota ===
  "toyota|yaris": { msrp: 22000, segment: "city", byAge: dep(22000, STD) },
  "toyota|corolla": { msrp: 30000, segment: "compact", byAge: dep(30000, STD) },
  "toyota|camry": { msrp: 40000, segment: "sedan", byAge: dep(40000, STD) },
  "toyota|rav4": { msrp: 42000, segment: "suv", byAge: dep(42000, SUV) },
  "toyota|c-hr": { msrp: 34000, segment: "suv", byAge: dep(34000, SUV) },
  // === Tesla ===
  "tesla|model 3": { msrp: 44000, segment: "ev", byAge: dep(44000, EV) },
  "tesla|model y": { msrp: 48000, segment: "ev_suv", byAge: dep(48000, EV) },
  "tesla|model s": { msrp: 100000, segment: "ev_luxury", byAge: dep(100000, EV) },
  "tesla|model x": { msrp: 110000, segment: "ev_suv", byAge: dep(110000, EV) },
  // === Porsche ===
  "porsche|911": { msrp: 125000, segment: "sports", byAge: dep(125000, SPORT) },
  "porsche|cayenne": { msrp: 95000, segment: "suv", byAge: dep(95000, SPORT) },
  "porsche|macan": { msrp: 68000, segment: "suv", byAge: dep(68000, SPORT) },
  "porsche|taycan": { msrp: 95000, segment: "ev", byAge: dep(95000, EV) },
  // === Volvo ===
  "volvo|xc40": { msrp: 40000, segment: "suv", byAge: dep(40000, SUV) },
  "volvo|xc60": { msrp: 55000, segment: "suv", byAge: dep(55000, SUV) },
  "volvo|xc90": { msrp: 75000, segment: "suv", byAge: dep(75000, SUV) },
  // === Ford ===
  "ford|fiesta": { msrp: 22000, segment: "city", byAge: dep(22000, ECO) },
  "ford|focus": { msrp: 30000, segment: "compact", byAge: dep(30000, ECO) },
  "ford|kuga": { msrp: 38000, segment: "suv", byAge: dep(38000, SUV) },
  "ford|mustang": { msrp: 55000, segment: "sports", byAge: dep(55000, SPORT) },
  // === Hyundai ===
  "hyundai|i20": { msrp: 20000, segment: "city", byAge: dep(20000, ECO) },
  "hyundai|i30": { msrp: 28000, segment: "compact", byAge: dep(28000, ECO) },
  "hyundai|tucson": { msrp: 38000, segment: "suv", byAge: dep(38000, SUV) },
  "hyundai|ioniq 5": { msrp: 48000, segment: "ev", byAge: dep(48000, EV) },
  // === Kia ===
  "kia|ceed": { msrp: 26000, segment: "compact", byAge: dep(26000, ECO) },
  "kia|sportage": { msrp: 36000, segment: "suv", byAge: dep(36000, SUV) },
  "kia|ev6": { msrp: 52000, segment: "ev", byAge: dep(52000, EV) },
  // === Others ===
  "fiat|500": { msrp: 18000, segment: "city", byAge: dep(18000, ECO) },
  "mini|cooper": { msrp: 28000, segment: "compact", byAge: dep(28000, PREM) },
  "mazda|3": { msrp: 28000, segment: "compact", byAge: dep(28000, STD) },
  "mazda|cx-5": { msrp: 36000, segment: "suv", byAge: dep(36000, SUV) },
  "nissan|qashqai": { msrp: 32000, segment: "suv", byAge: dep(32000, SUV) },
  "nissan|leaf": { msrp: 36000, segment: "ev", byAge: dep(36000, EV) },
  "seat|leon": { msrp: 28000, segment: "compact", byAge: dep(28000, ECO) },
  "seat|ateca": { msrp: 32000, segment: "suv", byAge: dep(32000, SUV) },
  "cupra|formentor": { msrp: 38000, segment: "suv", byAge: dep(38000, PREM) },
  "skoda|octavia": { msrp: 30000, segment: "sedan", byAge: dep(30000, ECO) },
  "skoda|kodiaq": { msrp: 38000, segment: "suv", byAge: dep(38000, SUV) },
  "dacia|duster": { msrp: 20000, segment: "suv", byAge: dep(20000, ECO) },
  "dacia|sandero": { msrp: 12000, segment: "city", byAge: dep(12000, ECO) },
  "opel|corsa": { msrp: 20000, segment: "city", byAge: dep(20000, ECO) },
  "opel|astra": { msrp: 28000, segment: "compact", byAge: dep(28000, ECO) },
};

// Total: ~90 model entries × 6 age brackets = ~540 price points

export interface UsedCarPrice {
  msrp: number;
  segment: string;
  prices: { age: number; price: number }[];
}

/**
 * Look up used car prices for a brand+model combination.
 * Returns null if no data found.
 */
export function getUsedCarPrices(brandName: string, modelName: string): UsedCarPrice | null {
  // Normalize and try exact match
  const key = `${brandName.toLowerCase()}|${modelName.toLowerCase()}`;
  const entry = DATA[key];
  if (entry) {
    return {
      msrp: entry.msrp,
      segment: entry.segment,
      prices: entry.byAge.map((price, age) => ({ age, price })),
    };
  }

  // Fuzzy match: try partial model name
  const brandLower = brandName.toLowerCase();
  const modelLower = modelName.toLowerCase();
  for (const [k, v] of Object.entries(DATA)) {
    const [b, m] = k.split("|");
    if (b === brandLower && (modelLower.includes(m) || m.includes(modelLower))) {
      return {
        msrp: v.msrp,
        segment: v.segment,
        prices: v.byAge.map((price, age) => ({ age, price })),
      };
    }
  }

  return null;
}
