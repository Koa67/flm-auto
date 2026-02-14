/**
 * 82-ancap-v2.ts — ANCAP Safety Ratings via public API
 *
 * API: https://www.ancap.com.au/api/search?perPage=100&page=N
 * Total: ~1137 rated vehicles
 * Data: stars, adult/child/pedestrian/assist percentages, year range
 *
 * Strategy: fetch all pages, match to DB generations, insert missing.
 * Never overwrites existing ratings. Source = "ancap", confidence = "A".
 */
import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = "";
      res.on("data", (chunk: string) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e}`)); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function paginateAll(table: string, select: string) {
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Map ANCAP brand names to our DB brand names
const BRAND_MAP: Record<string, string> = {
  "alfa romeo": "alfa romeo",
  "aston martin": "aston martin",
  "audi": "audi",
  "bentley": "bentley",
  "bmw": "bmw",
  "citroen": "citroen",
  "citroën": "citroen",
  "cupra": "seat",
  "ds": "citroen",
  "ferrari": "ferrari",
  "fiat": "fiat",
  "ford": "ford",
  "genesis": "hyundai",
  "honda": "honda",
  "hyundai": "hyundai",
  "isuzu": "isuzu",
  "jaguar": "jaguar",
  "jeep": "jeep",
  "kia": "kia",
  "lamborghini": "lamborghini",
  "land rover": "land rover",
  "lexus": "lexus",
  "maserati": "maserati",
  "mazda": "mazda",
  "mercedes-benz": "mercedes-benz",
  "mg": "mg",
  "mini": "mini",
  "mitsubishi": "mitsubishi",
  "nissan": "nissan",
  "opel": "opel",
  "peugeot": "peugeot",
  "porsche": "porsche",
  "renault": "renault",
  "rolls-royce": "rolls-royce",
  "seat": "seat",
  "skoda": "skoda",
  "škoda": "skoda",
  "subaru": "subaru",
  "suzuki": "suzuki",
  "tesla": "tesla",
  "toyota": "toyota",
  "volkswagen": "volkswagen",
  "volvo": "volvo",
};

async function main() {
  console.log("=".repeat(60));
  console.log("  82-ANCAP-V2 — ANCAP Safety Ratings via API");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(60));

  // 1. Fetch all ANCAP ratings
  console.log("\n  Fetching ANCAP API...");
  const allRatings: any[] = [];
  let page = 1;
  let totalCount = 0;
  while (true) {
    const url = `https://www.ancap.com.au/api/search?perPage=100&page=${page}`;
    const resp = await fetchJSON(url);
    if (page === 1) {
      totalCount = resp.meta?.count || 0;
      console.log(`  Total ANCAP ratings: ${totalCount}`);
    }
    if (!resp.results || resp.results.length === 0) break;
    allRatings.push(...resp.results);
    process.stdout.write(`  Page ${page}: ${resp.results.length} results (total: ${allRatings.length})\n`);
    if (allRatings.length >= totalCount) break;
    page++;
    await sleep(DELAY_MS);
  }
  console.log(`  Fetched ${allRatings.length} ANCAP ratings\n`);

  // 2. Load DB
  console.log("  Loading DB...");
  const gens = await paginateAll(
    "generations",
    "id, name, slug, production_start, production_end, model_id"
  );
  const models = await paginateAll("models", "id, name, slug, brand_id");
  const brands = await paginateAll("brands", "id, name, slug");
  const existingRatings = await paginateAll("safety_ratings", "generation_id");
  const ratedGens = new Set(existingRatings.map((r: any) => r.generation_id));

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Existing safety ratings: ${existingRatings.length}`);

  // Build lookup: brand_slug -> { model_name_lower -> [{ gen, startYear, endYear }] }
  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const brandByName = new Map(brands.map((b: any) => [b.name.toLowerCase(), b]));

  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // 3. Match and insert
  const stats = {
    total: allRatings.length,
    matched: 0,
    alreadyRated: 0,
    noBrand: 0,
    noModel: 0,
    noGen: 0,
    inserted: 0,
  };

  const toInsert: any[] = [];
  const newRatedGens = new Set<string>();

  for (const rating of allRatings) {
    const fullName = rating.manufacturerAndModel || "";
    const stars = rating.safetyRating;
    if (!fullName || !stars) continue;

    // Extract brand (first word or multi-word brand)
    let brandName = "";
    let modelName = "";

    // Try known multi-word brands first
    const nameLower = fullName.toLowerCase();
    const multiWordBrands = ["alfa romeo", "aston martin", "land rover", "mercedes-benz", "rolls-royce"];
    let found = false;
    for (const mwb of multiWordBrands) {
      if (nameLower.startsWith(mwb)) {
        brandName = mwb;
        modelName = fullName.substring(mwb.length).trim();
        found = true;
        break;
      }
    }

    if (!found) {
      const parts = fullName.split(" ");
      brandName = parts[0].toLowerCase();
      modelName = parts.slice(1).join(" ");
    }

    const ourBrandName = BRAND_MAP[brandName];
    if (!ourBrandName) { stats.noBrand++; continue; }

    const brand = brandByName.get(ourBrandName);
    if (!brand) { stats.noBrand++; continue; }

    const brandModels = modelsByBrand.get(brand.id) || [];
    const modelNorm = normalize(modelName);

    // Find best model match
    let bestModel: any = null;
    let bestScore = 0;

    for (const m of brandModels) {
      const mNorm = normalize(m.name);
      if (mNorm === modelNorm) { bestModel = m; bestScore = 100; break; }
      if (modelNorm.startsWith(mNorm) || mNorm.startsWith(modelNorm)) {
        const score = Math.min(mNorm.length, modelNorm.length) / Math.max(mNorm.length, modelNorm.length) * 80;
        if (score > bestScore) { bestScore = score; bestModel = m; }
      }
      if (modelNorm.includes(mNorm) || mNorm.includes(modelNorm)) {
        const score = Math.min(mNorm.length, modelNorm.length) / Math.max(mNorm.length, modelNorm.length) * 60;
        if (score > bestScore) { bestScore = score; bestModel = m; }
      }
    }

    if (!bestModel || bestScore < 30) { stats.noModel++; continue; }

    // Find best generation by year
    const modelGens = gensByModel.get(bestModel.id) || [];
    if (modelGens.length === 0) { stats.noGen++; continue; }

    // Parse ANCAP year range
    const fromYear = rating.manufacturedFrom ? parseInt(rating.manufacturedFrom.split(" ").pop() || "0") : 0;
    const ratingYear = parseInt(rating.ratingYear || "0");
    const targetYear = fromYear || ratingYear;

    let bestGen: any = null;
    let bestDist = Infinity;

    for (const g of modelGens) {
      const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
      const gEnd = g.production_end ? new Date(g.production_end).getFullYear() : null;
      if (!gStart) continue;

      // Check if target year falls within production range
      if (targetYear >= gStart - 1 && targetYear <= (gEnd || gStart + 10)) {
        const dist = Math.abs(targetYear - gStart);
        if (dist < bestDist) { bestDist = dist; bestGen = g; }
      }
    }

    // Fallback: closest gen within 3 years
    if (!bestGen) {
      for (const g of modelGens) {
        const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
        if (!gStart) continue;
        const dist = Math.abs(targetYear - gStart);
        if (dist <= 3 && dist < bestDist) { bestDist = dist; bestGen = g; }
      }
    }

    if (!bestGen) { stats.noGen++; continue; }

    if (ratedGens.has(bestGen.id) || newRatedGens.has(bestGen.id)) {
      stats.alreadyRated++;
      continue;
    }

    // Parse percentage values
    const parsePct = (s: string | undefined) => {
      if (!s) return null;
      const n = parseInt(s.replace("%", ""));
      return isNaN(n) ? null : n;
    };

    toInsert.push({
      generation_id: bestGen.id,
      stars,
      adult_occupant_pct: parsePct(rating.adultOccupantProtection),
      child_occupant_pct: parsePct(rating.childOccupantProtection),
      pedestrian_pct: parsePct(rating.pedestrianProtection),
      safety_assist_pct: parsePct(rating.safetyAssist),
      source_url: `https://www.ancap.com.au/safety-ratings/${rating.id}`,
      confidence: "A",
    });
    newRatedGens.add(bestGen.id);
    stats.matched++;
  }

  console.log(`\n  Matched: ${stats.matched} new ratings`);
  console.log(`  Already rated: ${stats.alreadyRated}`);
  console.log(`  No brand match: ${stats.noBrand}`);
  console.log(`  No model match: ${stats.noModel}`);
  console.log(`  No gen match: ${stats.noGen}`);

  // 4. Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} ANCAP ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await supabase.from("safety_ratings").insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
        // Try one by one for this batch
        for (const item of batch) {
          const { error: e2 } = await supabase.from("safety_ratings").insert(item);
          if (!e2) inserted++;
        }
      } else {
        inserted += batch.length;
      }
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  const newTotal = ratedGens.size + stats.matched;
  console.log("\n" + "=".repeat(60));
  console.log("  ANCAP V2 RESULTS");
  console.log("=".repeat(60));
  console.log(`  ANCAP vehicles: ${stats.total}`);
  console.log(`  New ratings: ${stats.matched}`);
  console.log(`  Inserted: ${DRY_RUN ? "(dry run)" : stats.inserted}`);
  console.log(`  Coverage: ${ratedGens.size} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log("=".repeat(60));

  const reportPath = path.resolve(__dirname, "../../data/ancap-v2-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    before: ratedGens.size,
    after: newTotal,
    total_gens: gens.length,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
