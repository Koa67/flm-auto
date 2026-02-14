/**
 * 86-euroncap-rematch.ts — Re-match EuroNCAP ratings to DB generations
 *
 * Loads the existing 483 EuroNCAP ratings from data/raw/euroncap_v3_all_ratings.json,
 * applies fuzzy matching to find DB generations, and inserts NEW matches
 * with confidence "A".
 *
 * Fuzzy matching strategy:
 *   1. Strip brand prefix from EuroNCAP model name ("BMW 3 Series" -> "3 Series")
 *   2. Normalize: lowercase, remove accents/dashes, collapse spaces
 *   3. Try exact model name match
 *   4. Try alias map (e.g., "3 Series" <-> "Serie 3", "C-Class" <-> "Classe C")
 *   5. Try substring containment
 *   6. Match generation by year overlap (production_start/production_end vs year_tested)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/86-euroncap-rematch.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/86-euroncap-rematch.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes("--dry-run");
const DATA_DIR = path.resolve(__dirname, "../../data");
const BATCH_SIZE = 50;

async function paginateAll(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// ---- Normalization ----

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[-\u2013\u2014_]/g, " ") // dashes to spaces
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Brand name mapping: EuroNCAP brand -> our DB brand slug ----

const BRAND_MAP: Record<string, string> = {
  "bmw": "bmw",
  "mercedes-benz": "mercedes-benz",
  "mercedes benz": "mercedes-benz",
  "audi": "audi",
  "volkswagen": "volkswagen",
  "porsche": "porsche",
  "skoda": "skoda",
  "tesla": "tesla",
  "hyundai": "hyundai",
  "kia": "kia",
  "volvo": "volvo",
  "toyota": "toyota",
  "lexus": "lexus",
  "nissan": "nissan",
  "honda": "honda",
  "mazda": "mazda",
  "subaru": "subaru",
  "ford": "ford",
  "peugeot": "peugeot",
  "renault": "renault",
  "seat": "seat",
  "genesis": "genesis",
  "jaguar": "jaguar",
  "land rover": "land rover",
  "alfa romeo": "alfa romeo",
  "mg": "mg",
  "jeep": "jeep",
  "opel": "opel",
  "ds automobiles": "ds",
  "mitsubishi": "mitsubishi",
  "dacia": "dacia",
  "mini": "mini",
  "suzuki": "suzuki",
  "fiat": "fiat",
  "smart": "smart",
  "alpine": "alpine",
  "isuzu": "isuzu",
  "polestar": "polestar",
  "byd": "byd",
  "nio": "nio",
  "lucid": "lucid",
  "ssangyong": "ssangyong",
  "cupra": "cupra",
  "lynk & co": "lynk & co",
  "cadillac": "cadillac",
  "vinfast": "vinfast",
  "xpeng": "xpeng",
  "geely": "geely",
  "gwm": "gwm",
  "ora": "ora",
  "wey": "wey",
  "zeekr": "zeekr",
  "hongqi": "hongqi",
  "maxus": "maxus",
  "leapmotor": "leapmotor",
  "chery": "chery",
  "omoda": "omoda",
  "jaecoo": "jaecoo",
  "dongfeng": "dongfeng",
  "voyah": "voyah",
  "togg": "togg",
  "aion": "aion",
  "mobilize": "mobilize",
  "rolls-royce": "rolls-royce",
  "aston martin": "aston martin",
  "bentley": "bentley",
  "maserati": "maserati",
  "ferrari": "ferrari",
  "lamborghini": "lamborghini",
};

// ---- Model alias map for French/English naming differences ----
// EuroNCAP uses English-style names; our DB may use French-style or vice versa.

const MODEL_ALIASES: Record<string, Record<string, string[]>> = {
  "bmw": {
    "1 series": ["serie 1", "1 series", "1er"],
    "2 series": ["serie 2", "2 series", "2er"],
    "2 series active tourer": ["serie 2 active tourer", "2 series active tourer"],
    "2 series gran coupe": ["serie 2 gran coupe", "2 series gran coupe"],
    "3 series": ["serie 3", "3 series", "3er"],
    "4 series": ["serie 4", "4 series", "4er"],
    "5 series": ["serie 5", "5 series", "5er"],
    "6 series": ["serie 6", "6 series", "6er"],
    "7 series": ["serie 7", "7 series", "7er"],
    "8 series": ["serie 8", "8 series", "8er"],
  },
  "mercedes-benz": {
    "a class": ["classe a", "a class", "a klasse"],
    "b class": ["classe b", "b class", "b klasse"],
    "c class": ["classe c", "c class", "c klasse"],
    "e class": ["classe e", "e class", "e klasse"],
    "s class": ["classe s", "s class", "s klasse"],
    "g class": ["classe g", "g class", "g klasse"],
    "v class": ["classe v", "v class", "v klasse"],
    "t class": ["classe t", "t class", "t klasse"],
    "cla class": ["cla"],
    "gla class": ["gla"],
    "glb class": ["glb"],
    "glc class": ["glc"],
    "gle class": ["gle"],
    "gls class": ["gls"],
  },
  "peugeot": {
    "e 3008": ["3008", "e 3008", "e3008"],
    "3008/5008": ["3008", "5008"],
  },
  "renault": {
    "scenic e tech": ["scenic", "scenic e tech"],
    "megane e tech": ["megane", "megane e tech"],
    "4 e tech electric": ["4", "r4", "4 e tech"],
  },
  "fiat": {
    "500e": ["500", "500e", "500 electric"],
  },
  "seat": {
    // CUPRA/SEAT model aliases
    "formentor": ["formentor"],
    "born": ["born"],
    "tavascan": ["tavascan"],
    "terramar": ["terramar"],
  },
  "smart": {
    "#1": ["1", "hashtag 1"],
    "#3": ["3", "hashtag 3"],
    "#5": ["5", "hashtag 5"],
  },
};

function stripBrandPrefix(brand: string, model: string): string {
  // "BMW 3 Series" -> "3 Series", "Mercedes-Benz C-Class" -> "C-Class"
  const brandLower = brand.toLowerCase();
  let modelClean = model;

  // Multi-word brands
  const multiWord = [
    "mercedes-benz",
    "mercedes benz",
    "alfa romeo",
    "land rover",
    "aston martin",
    "rolls-royce",
    "ds automobiles",
    "lynk & co",
  ];
  for (const mw of multiWord) {
    if (modelClean.toLowerCase().startsWith(mw)) {
      modelClean = modelClean.substring(mw.length).trim();
      return modelClean;
    }
  }

  // Single-word brand prefix
  if (modelClean.toLowerCase().startsWith(brandLower + " ")) {
    modelClean = modelClean.substring(brandLower.length).trim();
  }

  return modelClean;
}

function getYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  return isNaN(y) ? null : y;
}

function yearOverlaps(
  testYear: number,
  prodStart: number | null,
  prodEnd: number | null
): boolean {
  // Allow 1 year tolerance on start (EuroNCAP sometimes tests pre-production)
  const start = prodStart !== null ? prodStart - 1 : -Infinity;
  const end = prodEnd !== null ? prodEnd + 1 : Infinity;
  return testYear >= start && testYear <= end;
}

// ---- Matching engine ----

interface GenEntry {
  id: string;
  name: string;
  slug: string;
  startYear: number | null;
  endYear: number | null;
  modelId: string;
  modelName: string;
  brandName: string;
}

function findModelMatch(
  brandName: string,
  euroncapModelName: string,
  modelsByBrand: Map<string, { id: string; name: string; nameNorm: string }[]>
): { id: string; name: string } | null {
  const brandModels = modelsByBrand.get(brandName);
  if (!brandModels || brandModels.length === 0) return null;

  const modelStripped = stripBrandPrefix(brandName, euroncapModelName);
  const modelNorm = normalize(modelStripped);

  // Strategy 1: exact normalized match
  for (const m of brandModels) {
    if (m.nameNorm === modelNorm) return m;
  }

  // Strategy 2: alias lookup
  const brandAliases = MODEL_ALIASES[brandName];
  if (brandAliases) {
    for (const [aliasKey, aliasList] of Object.entries(brandAliases)) {
      const aliasKeyNorm = normalize(aliasKey);
      if (aliasKeyNorm === modelNorm) {
        // Found the EuroNCAP name in our alias keys; look for any alias in DB models
        for (const alias of aliasList) {
          const aliasNorm = normalize(alias);
          for (const m of brandModels) {
            if (m.nameNorm === aliasNorm) return m;
          }
        }
      }
      // Also check if modelNorm is in the alias list
      for (const alias of aliasList) {
        if (normalize(alias) === modelNorm) {
          // Try to find any of the other aliases (or the key) in DB
          const keyNorm = normalize(aliasKey);
          for (const m of brandModels) {
            if (m.nameNorm === keyNorm) return m;
          }
          for (const otherAlias of aliasList) {
            const oaNorm = normalize(otherAlias);
            for (const m of brandModels) {
              if (m.nameNorm === oaNorm) return m;
            }
          }
        }
      }
    }
  }

  // Strategy 3: substring containment (prefer longer model name matches)
  let bestSubMatch: { id: string; name: string } | null = null;
  let bestSubLen = 0;

  for (const m of brandModels) {
    // DB model name contained in EuroNCAP name, or vice versa
    if (modelNorm.includes(m.nameNorm) && m.nameNorm.length >= 2) {
      if (m.nameNorm.length > bestSubLen) {
        bestSubLen = m.nameNorm.length;
        bestSubMatch = m;
      }
    }
    if (m.nameNorm.includes(modelNorm) && modelNorm.length >= 2) {
      if (modelNorm.length > bestSubLen) {
        bestSubLen = modelNorm.length;
        bestSubMatch = m;
      }
    }
  }

  // Only accept substring match if the overlap is substantial (>50% of the shorter string)
  if (bestSubMatch && bestSubLen >= 2) {
    const shorter = Math.min(modelNorm.length, normalize(bestSubMatch.name).length);
    if (bestSubLen / shorter >= 0.5) {
      return bestSubMatch;
    }
  }

  // Strategy 4: token-based fuzzy (check if all tokens of the shorter appear in the longer)
  const modelTokens = modelNorm.split(" ").filter((t) => t.length > 0);
  for (const m of brandModels) {
    const dbTokens = m.nameNorm.split(" ").filter((t) => t.length > 0);
    // All DB model tokens in EuroNCAP model?
    if (
      dbTokens.length >= 1 &&
      dbTokens.every((t) => modelTokens.includes(t))
    ) {
      return m;
    }
    // All EuroNCAP tokens in DB model?
    if (
      modelTokens.length >= 1 &&
      modelTokens.every((t) => dbTokens.includes(t))
    ) {
      return m;
    }
  }

  return null;
}

function findGenMatch(
  testYear: number,
  modelGens: GenEntry[]
): GenEntry | null {
  if (modelGens.length === 0) return null;

  // Strategy 1: year falls within production range
  const yearMatches = modelGens.filter((g) =>
    yearOverlaps(testYear, g.startYear, g.endYear)
  );
  if (yearMatches.length === 1) return yearMatches[0];

  // If multiple year matches, pick the one whose start is closest to testYear
  if (yearMatches.length > 1) {
    yearMatches.sort((a, b) => {
      const distA = a.startYear !== null ? Math.abs(testYear - a.startYear) : 999;
      const distB = b.startYear !== null ? Math.abs(testYear - b.startYear) : 999;
      return distA - distB;
    });
    return yearMatches[0];
  }

  // Strategy 2: closest gen within 3 years
  let bestGen: GenEntry | null = null;
  let bestDist = Infinity;
  for (const g of modelGens) {
    if (g.startYear === null) continue;
    const dist = Math.abs(testYear - g.startYear);
    if (dist <= 3 && dist < bestDist) {
      bestDist = dist;
      bestGen = g;
    }
  }
  if (bestGen) return bestGen;

  // Strategy 3: closest gen within 5 years (looser fallback)
  for (const g of modelGens) {
    if (g.startYear === null) continue;
    const dist = Math.abs(testYear - g.startYear);
    if (dist <= 5 && dist < bestDist) {
      bestDist = dist;
      bestGen = g;
    }
  }

  return bestGen;
}

// ---- Main ----

async function main() {
  console.log("");
  console.log("=".repeat(60));
  console.log("  86-EURONCAP-REMATCH -- Fuzzy re-match EuroNCAP ratings");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(60));

  // 1. Load EuroNCAP JSON
  const euroncapPath = path.join(DATA_DIR, "raw/euroncap_v3_all_ratings.json");
  if (!fs.existsSync(euroncapPath)) {
    console.error(`  File not found: ${euroncapPath}`);
    process.exit(1);
  }
  const euroncapData = JSON.parse(fs.readFileSync(euroncapPath, "utf-8"));
  const euroncapRatings: any[] = euroncapData.ratings || [];
  console.log(`\n  EuroNCAP ratings loaded: ${euroncapRatings.length}`);

  // 2. Load DB
  console.log("  Loading DB...");
  const gens = await paginateAll(
    "generations",
    "id, name, slug, internal_code, production_start, production_end, model_id"
  );
  const models = await paginateAll("models", "id, name, slug, brand_id");
  const brands = await paginateAll("brands", "id, name, slug");
  const existingRatings = await paginateAll(
    "safety_ratings",
    "generation_id, source_url"
  );

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Models: ${models.length}`);
  console.log(`  Brands: ${brands.length}`);
  console.log(`  Existing safety ratings: ${existingRatings.length}`);

  // Build lookup structures
  const brandById = new Map(brands.map((b: any) => [b.id, b]));
  const brandByName = new Map<string, any>();
  for (const b of brands) {
    brandByName.set(b.name.toLowerCase(), b);
    brandByName.set(normalize(b.name), b);
    brandByName.set(b.slug, b);
  }

  // models by brand name (lowercased)
  const modelsByBrand = new Map<
    string,
    { id: string; name: string; nameNorm: string }[]
  >();
  for (const m of models) {
    const brand = brandById.get(m.brand_id);
    if (!brand) continue;
    const brandName = brand.name.toLowerCase();
    if (!modelsByBrand.has(brandName)) modelsByBrand.set(brandName, []);
    modelsByBrand.get(brandName)!.push({
      id: m.id,
      name: m.name,
      nameNorm: normalize(m.name),
    });
  }

  // gens by model_id
  const gensByModelId = new Map<string, GenEntry[]>();
  for (const g of gens) {
    if (!gensByModelId.has(g.model_id)) gensByModelId.set(g.model_id, []);
    const model = models.find((m: any) => m.id === g.model_id);
    const brand = model ? brandById.get(model.brand_id) : null;
    gensByModelId.get(g.model_id)!.push({
      id: g.id,
      name: g.name || g.slug || "",
      slug: g.slug || "",
      startYear: getYear(g.production_start),
      endYear: getYear(g.production_end),
      modelId: g.model_id,
      modelName: model?.name || "",
      brandName: brand?.name || "",
    });
  }

  const ratedGenIds = new Set(
    existingRatings.map((r: any) => r.generation_id)
  );

  // 3. Match ratings
  console.log("\n  Matching EuroNCAP ratings to DB generations...");

  const stats = {
    total: euroncapRatings.length,
    brandFound: 0,
    brandNotFound: 0,
    modelFound: 0,
    modelNotFound: 0,
    genFound: 0,
    genNotFound: 0,
    alreadyRated: 0,
    newMatches: 0,
    inserted: 0,
  };

  const toInsert: any[] = [];
  const newRatedGenIds = new Set<string>();
  const unmatchedBrands: string[] = [];
  const unmatchedModels: string[] = [];
  const unmatchedGens: string[] = [];
  const matchDetails: any[] = [];

  for (const rating of euroncapRatings) {
    const euroBrand = (rating.brand || "").toLowerCase().trim();
    const euroModel = rating.model || "";
    const testYear = rating.year_tested;
    const stars = rating.stars;

    if (!euroBrand || !euroModel || !testYear || !stars) continue;

    // Resolve brand
    const ourBrandName = BRAND_MAP[euroBrand];
    if (!ourBrandName) {
      stats.brandNotFound++;
      if (!unmatchedBrands.includes(euroBrand)) unmatchedBrands.push(euroBrand);
      continue;
    }

    // Try to find brand in DB (by name or slug)
    const dbBrand =
      brandByName.get(ourBrandName) ||
      brandByName.get(normalize(ourBrandName));
    if (!dbBrand) {
      stats.brandNotFound++;
      if (!unmatchedBrands.includes(euroBrand + " -> " + ourBrandName))
        unmatchedBrands.push(euroBrand + " -> " + ourBrandName);
      continue;
    }
    stats.brandFound++;

    // Resolve model
    const dbBrandName = dbBrand.name.toLowerCase();
    const modelMatch = findModelMatch(
      dbBrandName,
      euroModel,
      modelsByBrand
    );
    if (!modelMatch) {
      stats.modelNotFound++;
      if (unmatchedModels.length < 50) {
        unmatchedModels.push(`${euroBrand}: ${euroModel}`);
      }
      continue;
    }
    stats.modelFound++;

    // Resolve generation by year
    const modelGens = gensByModelId.get(modelMatch.id) || [];
    const genMatch = findGenMatch(testYear, modelGens);
    if (!genMatch) {
      stats.genNotFound++;
      if (unmatchedGens.length < 50) {
        unmatchedGens.push(
          `${euroBrand} ${euroModel} (${testYear}) -> model: ${modelMatch.name} (${modelGens.length} gens)`
        );
      }
      continue;
    }
    stats.genFound++;

    // Check if already rated
    if (ratedGenIds.has(genMatch.id) || newRatedGenIds.has(genMatch.id)) {
      stats.alreadyRated++;
      continue;
    }

    // New match!
    stats.newMatches++;
    newRatedGenIds.add(genMatch.id);

    const row = {
      generation_id: genMatch.id,
      stars,
      adult_occupant_pct: rating.adult_pct ?? null,
      child_occupant_pct: rating.child_pct ?? null,
      pedestrian_pct: rating.pedestrian_pct ?? null,
      safety_assist_pct: rating.safety_assist_pct ?? null,
      source_url: rating.source_url || null,
      confidence: "A",
      test_year: testYear,
    };
    toInsert.push(row);

    matchDetails.push({
      euroncap: `${euroBrand} ${euroModel} (${testYear})`,
      matched_to: `${genMatch.brandName} ${genMatch.modelName} - ${genMatch.name} (${genMatch.startYear || "?"}-${genMatch.endYear || "?"})`,
      stars,
      generation_id: genMatch.id,
    });
  }

  // 4. Console output
  console.log("\n  MATCHING RESULTS:");
  console.log(`    Total EuroNCAP ratings:   ${stats.total}`);
  console.log(`    Brand found:              ${stats.brandFound}`);
  console.log(`    Brand not found:          ${stats.brandNotFound}`);
  console.log(`    Model found:              ${stats.modelFound}`);
  console.log(`    Model not found:          ${stats.modelNotFound}`);
  console.log(`    Generation found:         ${stats.genFound}`);
  console.log(`    Generation not found:     ${stats.genNotFound}`);
  console.log(`    Already rated:            ${stats.alreadyRated}`);
  console.log(`    NEW matches to insert:    ${stats.newMatches}`);

  if (unmatchedBrands.length > 0) {
    console.log(`\n  Unmatched brands (${unmatchedBrands.length}):`);
    for (const b of unmatchedBrands.slice(0, 15)) {
      console.log(`    - ${b}`);
    }
  }

  if (unmatchedModels.length > 0) {
    console.log(`\n  Unmatched models (${unmatchedModels.length}):`);
    for (const m of unmatchedModels.slice(0, 15)) {
      console.log(`    - ${m}`);
    }
  }

  if (unmatchedGens.length > 0) {
    console.log(`\n  Unmatched generations (${unmatchedGens.length}):`);
    for (const g of unmatchedGens.slice(0, 10)) {
      console.log(`    - ${g}`);
    }
  }

  // 5. Insert into DB
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} new safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("safety_ratings").insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
        // Fallback: insert one by one
        for (const item of batch) {
          const { error: e2 } = await supabase
            .from("safety_ratings")
            .insert(item);
          if (!e2) {
            inserted++;
          } else {
            console.error(`    Row error (gen ${item.generation_id}): ${e2.message}`);
          }
        }
      } else {
        inserted += batch.length;
      }
      process.stdout.write(
        `  Progress: ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}\r`
      );
    }
    stats.inserted = inserted;
    console.log(`\n  Inserted: ${inserted}`);
  } else if (DRY_RUN) {
    console.log(`\n  DRY RUN: would insert ${toInsert.length} ratings`);
  }

  // 6. Coverage summary
  const newTotal = ratedGenIds.size + stats.newMatches;
  const pct = ((newTotal / gens.length) * 100).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("  EURONCAP REMATCH RESULTS");
  console.log("=".repeat(60));
  console.log(`  Before:  ${ratedGenIds.size} / ${gens.length} gens rated`);
  console.log(`  After:   ${newTotal} / ${gens.length} gens rated (${pct}%)`);
  console.log(`  New:     +${stats.newMatches}`);
  console.log(
    `  Inserted: ${DRY_RUN ? "(dry run)" : stats.inserted}`
  );
  console.log("=".repeat(60));

  // 7. Save report
  const report = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    stats,
    coverage: {
      before: ratedGenIds.size,
      after: newTotal,
      total_gens: gens.length,
      pct: parseFloat(pct),
    },
    match_details: matchDetails,
    unmatched_brands: unmatchedBrands,
    unmatched_models: unmatchedModels.slice(0, 50),
    unmatched_gens: unmatchedGens.slice(0, 50),
  };

  const reportPath = path.join(DATA_DIR, "euroncap-rematch-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report saved: ${reportPath}`);
}

main().catch(console.error);
