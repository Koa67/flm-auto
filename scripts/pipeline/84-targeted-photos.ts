/**
 * 84-targeted-photos.ts — Targeted Wikimedia photos for legit gens missing coverage
 *
 * Uses improved search queries with chassis codes and internal codes.
 * Focus on well-known models that should have Wikimedia coverage.
 *
 * Usage:
 *   --dry-run   Show what would be scraped
 *   --limit=N   Limit to N gens (default: all)
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
const LIMIT_ARG = process.argv.find(a => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1]) : Infinity;
const DELAY_MS = 200;
const MAX_IMAGES_PER_GEN = 8;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "FLM-Auto/1.0 (https://flm-auto.fr; encyclopedia)" },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = "";
      res.on("data", (c: string) => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function classifyImage(filename: string): string {
  const f = filename.toLowerCase();
  if (/interior|cockpit|dashboard|cabin|innen|interieur|inside/.test(f)) return "interior";
  if (/rear|heck|back|arriere|trasera/.test(f)) return "exterior_rear";
  if (/side|profil|lateral|seite/.test(f)) return "exterior_side";
  if (/engine|motor|moteur/.test(f)) return "engine";
  return "exterior_front";
}

async function searchWikimedia(query: string): Promise<any[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(query)}&srlimit=20&format=json`;
  try {
    const resp = await fetchJSON(url);
    return resp?.query?.search || [];
  } catch { return []; }
}

async function getImageInfo(titles: string[]): Promise<any[]> {
  if (titles.length === 0) return [];
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${titles.map(t => encodeURIComponent(t)).join("|")}&prop=imageinfo&iiprop=url|size|mime&format=json`;
  try {
    const resp = await fetchJSON(url);
    const pages = resp?.query?.pages || {};
    return Object.values(pages).filter((p: any) => p.imageinfo?.[0]);
  } catch { return []; }
}

function isValidImage(page: any): boolean {
  const info = page.imageinfo?.[0];
  if (!info) return false;
  const mime = info.mime || "";
  if (!mime.startsWith("image/") || mime === "image/svg+xml" || mime === "image/gif") return false;
  if (info.width < 400 || info.height < 300) return false;
  const title = (page.title || "").toLowerCase();
  if (/logo|badge|emblem|icon|flag|map|drawing|sketch|chart/.test(title)) return false;
  return true;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  84-TARGETED-PHOTOS — Wikimedia for legit no-photo gens");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(60));

  // Load gens with brand/model info
  console.log("\n  Loading DB...");
  const gens = await paginateAll("generations",
    "id, model_id, name, slug, chassis_code, internal_code, production_start, production_end"
  );
  const models = await paginateAll("models", "id, brand_id, name");
  const brands = await paginateAll("brands", "id, name");

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(models.map((m: any) => [m.id, m]));

  // Find gens with 0 A/B photos
  const photos = await paginateAll("vehicle_images", "generation_id, confidence");
  const genPhotoQuality = new Map<string, Set<string>>();
  for (const p of photos) {
    if (!genPhotoQuality.has(p.generation_id)) genPhotoQuality.set(p.generation_id, new Set());
    if (p.confidence) genPhotoQuality.get(p.generation_id)!.add(p.confidence);
  }

  // Gens with no A or B photos
  const targets: any[] = [];
  for (const gen of gens) {
    const quality = genPhotoQuality.get(gen.id);
    const hasAB = quality && (quality.has("A") || quality.has("B"));
    if (!hasAB) {
      const model = modelMap.get(gen.model_id);
      if (!model) continue;
      const brand = brandMap.get(model.brand_id);
      if (!brand) continue;
      targets.push({ ...gen, brandName: brand.name, modelName: model.name });
    }
  }

  // Sort by brand then model for readability
  targets.sort((a, b) => (a.brandName + a.modelName).localeCompare(b.brandName + b.modelName));

  const limited = targets.slice(0, LIMIT);
  console.log(`  Total gens without A/B photos: ${targets.length}`);
  console.log(`  Processing: ${limited.length}\n`);

  let found = 0;
  let notFound = 0;
  let totalImages = 0;
  const toInsert: any[] = [];

  for (let i = 0; i < limited.length; i++) {
    const gen = limited[i];
    const brand = gen.brandName;
    const model = gen.modelName;
    const year = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    const chassis = gen.chassis_code || gen.internal_code || "";

    // Build search queries (most specific to least)
    const queries: string[] = [];
    if (chassis) {
      queries.push(`${brand} ${chassis}`);
      queries.push(`${brand} ${model} ${chassis}`);
    }
    if (year) {
      queries.push(`${brand} ${model} ${year}`);
    }
    queries.push(`${brand} ${model}`);

    // Deduplicate
    const usedTitles = new Set<string>();
    const images: any[] = [];

    for (const q of queries) {
      if (images.length >= MAX_IMAGES_PER_GEN) break;
      const results = await searchWikimedia(q);
      await sleep(DELAY_MS);

      // Get image info
      const titles = results
        .map((r: any) => r.title)
        .filter((t: string) => !usedTitles.has(t));
      if (titles.length === 0) continue;

      const infos = await getImageInfo(titles.slice(0, 10));
      await sleep(DELAY_MS);

      for (const page of infos) {
        if (images.length >= MAX_IMAGES_PER_GEN) break;
        if (!isValidImage(page)) continue;
        if (usedTitles.has(page.title)) continue;
        usedTitles.add(page.title);

        const info = page.imageinfo[0];
        const subcat = classifyImage(page.title);
        const imageType = subcat === "interior" ? "interior"
          : subcat === "engine" ? "technical"
          : "exterior";
        images.push({
          generation_id: gen.id,
          url: info.url,
          source: "wikimedia",
          image_type: imageType,
          image_subcategory: subcat,
          confidence: "B",
          width: info.width,
          height: info.height,
        });
      }
    }

    if (images.length > 0) {
      found++;
      totalImages += images.length;
      toInsert.push(...images);
      process.stdout.write(`  [${i + 1}/${limited.length}] ${brand} ${model} "${gen.name}": ${images.length} images\n`);
    } else {
      notFound++;
      if (i < 20 || i % 50 === 0) {
        process.stdout.write(`  [${i + 1}/${limited.length}] ${brand} ${model} "${gen.name}": MISS\n`);
      }
    }
  }

  console.log(`\n  Found: ${found}/${limited.length} gens (${(found / limited.length * 100).toFixed(0)}%)`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Total images: ${totalImages}`);

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} images...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("vehicle_images").insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
        // Try one by one
        for (const item of batch) {
          const { error: e2 } = await supabase.from("vehicle_images").insert(item);
          if (!e2) inserted++;
        }
      } else {
        inserted += batch.length;
      }
    }
    console.log(`  Inserted: ${inserted}`);
  }

  console.log("=".repeat(60));
  const reportPath = path.resolve(__dirname, "../../data/targeted-photos-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total_targets: targets.length,
    processed: limited.length,
    found,
    notFound,
    totalImages,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
