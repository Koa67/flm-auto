/**
 * FLM AUTO — Spritmonitor Real Consumption Scraper v3 (Expanded)
 *
 * Enhanced scraper that fetches per-model AND per-generation consumption data,
 * extracts min/max/avg breakdown, and stores richer raw_data JSONB.
 *
 * IMPORTANT: Spritmonitor blocks Node.js fetch via TLS fingerprinting.
 *            All HTTP requests MUST go through curl via child_process.execSync.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-spritmonitor-v3.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_spritmonitor_v3.json');
const BASE = 'https://www.spritmonitor.de';
const DELAY_MS = 800;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Spritmonitor manufacturer IDs ──────────────────────────────

const MANUF_IDS: Record<string, number> = {
  'Alfa Romeo': 1,
  'Audi': 3,
  'BMW': 6,
  'Citro\u00ebn': 12,
  'Dacia': 113,
  'Fiat': 16,
  'Ford': 17,
  'Honda': 18,
  'Hyundai': 19,
  'Kia': 23,
  'Mazda': 27,
  'Mercedes-Benz': 28,
  'Nissan': 33,
  'Opel': 35,
  'Peugeot': 36,
  'Porsche': 39,
  'Renault': 41,
  'Seat': 44,
  'Skoda': 45,
  'Tesla': 198,
  'Toyota': 49,
  'Volkswagen': 50,
  'Volvo': 51,
};

// ─── Checkpoint ─────────────────────────────────────────────────

interface Checkpoint {
  completedBrands: string[];
  totalSaved: number;
  totalSkipped: number;
  totalModels: number;
  totalGenerationHits: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    completedBrands: [],
    totalSaved: 0,
    totalSkipped: 0,
    totalModels: 0,
    totalGenerationHits: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── HTTP via curl (bypasses TLS fingerprinting) ────────────────

function fetchUrl(url: string, retries = MAX_RETRIES): string | null {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = execSync(
        `curl -s -L --connect-timeout 10 --max-time 20 "${url}" ` +
        `-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
        `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" ` +
        `-H "Accept-Language: en-US,en;q=0.9" ` +
        `-H "Accept-Encoding: identity" ` +
        `-w "\\n__HTTP_CODE__%{http_code}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );

      // Extract HTTP status code from the appended line
      const codeMatch = result.match(/__HTTP_CODE__(\d+)$/);
      const httpCode = codeMatch ? parseInt(codeMatch[1]) : 200;
      const body = result.replace(/__HTTP_CODE__\d+$/, '');

      if (httpCode === 503 || httpCode === 429) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`      [${httpCode}] Rate limited, backing off ${backoffMs}ms (attempt ${attempt}/${retries})`);
        execSync(`sleep ${backoffMs / 1000}`);
        continue;
      }

      if (httpCode >= 400) {
        return null;
      }

      if (!body || body.includes('<title>Fehler') || body.includes('<title>Error')) {
        return null;
      }

      return body;
    } catch (err: any) {
      if (attempt < retries) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`      curl error, backing off ${backoffMs}ms (attempt ${attempt}/${retries})`);
        execSync(`sleep ${backoffMs / 1000}`);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── Fetch model list via AJAX endpoint ─────────────────────────

interface SpritModel {
  id: number;
  name: string;
}

function fetchModelList(manufId: number): SpritModel[] {
  const url = `${BASE}/en/ajaxModel.action?manuf=${manufId}`;
  const body = fetchUrl(url);
  if (!body) return [];

  // Format: "36,1er;1323,2er;37,3er;..." (semi-CSV: id,name pairs separated by semicolons)
  const models: SpritModel[] = [];
  const parts = body.split(';').filter(p => p.trim());
  for (const part of parts) {
    const commaIdx = part.indexOf(',');
    if (commaIdx === -1) continue;
    const idStr = part.substring(0, commaIdx).trim();
    const name = part.substring(commaIdx + 1).trim();
    const id = parseInt(idStr);
    if (!isNaN(id) && name) {
      models.push({ id, name });
    }
  }
  return models;
}

// ─── Extract consumption data from overview page ────────────────

interface ConsumptionEntry {
  fuelType: string;
  avgConsumption: number;
  minConsumption: number | null;
  maxConsumption: number | null;
  sampleSize: number;
}

function extractConsumption(html: string): ConsumptionEntry[] {
  const entries: ConsumptionEntry[] = [];

  // --- Strategy 1: Parse structured table rows ---
  // Spritmonitor overview pages have table rows with class="name", "consumption", "count"
  const names: string[] = [];
  const nameRegex = /class="name"[^>]*>(.*?)<\/td>/gs;
  let m;
  while ((m = nameRegex.exec(html)) !== null) {
    names.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  const consumptions: string[] = [];
  const consRegex = /class="consumption"[^>]*>(.*?)<\/td>/gs;
  while ((m = consRegex.exec(html)) !== null) {
    consumptions.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  const counts: string[] = [];
  const countRegex = /class="count"[^>]*>(.*?)<\/td>/gs;
  while ((m = countRegex.exec(html)) !== null) {
    counts.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < names.length; i++) {
    const fuelType = names[i];
    const consText = consumptions[i] || '';
    const countText = counts[i] || '0';

    // Parse average consumption: "6,54" or "9.27"
    const consMatch = consText.match(/(\d+[.,]\d+)/);
    if (!consMatch) continue;

    const avg = parseFloat(consMatch[1].replace(',', '.'));
    const count = parseInt(countText.replace(/[.,\s]/g, '')) || 0;

    if (avg > 0 && avg < 50 && count >= 3) {
      entries.push({ fuelType, avgConsumption: avg, minConsumption: null, maxConsumption: null, sampleSize: count });
    }
  }

  // --- Strategy 2: Try to extract min/max from detail areas ---
  // Some pages show "lowest: 4.5 L/100km" / "highest: 12.3 L/100km" patterns
  const minMatch = html.match(/(?:lowest|minimum|min)[^<]*?(\d+[.,]\d+)\s*(?:l|L)/i);
  const maxMatch = html.match(/(?:highest|maximum|max)[^<]*?(\d+[.,]\d+)\s*(?:l|L)/i);

  if (entries.length > 0 && (minMatch || maxMatch)) {
    const minVal = minMatch ? parseFloat(minMatch[1].replace(',', '.')) : null;
    const maxVal = maxMatch ? parseFloat(maxMatch[1].replace(',', '.')) : null;

    // Apply min/max to the primary (largest sample) entry
    const primary = entries.reduce((a, b) => a.sampleSize > b.sampleSize ? a : b);
    if (minVal && minVal > 0 && minVal < primary.avgConsumption) primary.minConsumption = minVal;
    if (maxVal && maxVal > primary.avgConsumption && maxVal < 50) primary.maxConsumption = maxVal;
  }

  // --- Strategy 3: Parse from broader patterns if table parsing yielded nothing ---
  if (entries.length === 0) {
    // Try "X.XX l/100km" pattern with surrounding context
    const broadRegex = /(\d+[.,]\d+)\s*(?:l|L)\/100\s*km/g;
    const allValues: number[] = [];
    while ((m = broadRegex.exec(html)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > 0 && val < 50) allValues.push(val);
    }

    if (allValues.length >= 1) {
      // Use median as average, first as min, last as max
      allValues.sort((a, b) => a - b);
      const median = allValues[Math.floor(allValues.length / 2)];
      entries.push({
        fuelType: 'unknown',
        avgConsumption: median,
        minConsumption: allValues.length > 1 ? allValues[0] : null,
        maxConsumption: allValues.length > 1 ? allValues[allValues.length - 1] : null,
        sampleSize: 0, // unknown from broad parsing
      });
    }
  }

  return entries;
}

// ─── Extract per-generation links from model page ───────────────

interface GenerationLink {
  url: string;
  yearRange: string; // e.g. "2015-2020"
  genName: string;   // e.g. "F30" or "W213"
}

function extractGenerationLinks(html: string, manufId: number, brandName: string): GenerationLink[] {
  const links: GenerationLink[] = [];

  // Look for links to sub-pages with year ranges, e.g.:
  //   href="/en/overview/6-BMW/37-3er/3er_2012.html"
  //   or model detail pages with generation identifiers
  const linkRegex = /href="(\/en\/overview\/[^"]*?)"[^>]*>(.*?)<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();

    // Check if this looks like a generation/year sub-link
    const yearMatch = text.match(/(\d{4})\s*[-–]\s*(\d{4})?/) || href.match(/_(\d{4})(?:[-_](\d{4}))?\.html/);
    if (yearMatch) {
      links.push({
        url: `${BASE}${href}`,
        yearRange: yearMatch[0],
        genName: text,
      });
    }
  }

  // Also look for distinct generation pages (e.g. "3er F30", "A4 B9")
  const genRegex = /href="(\/en\/(?:overview|detail)\/[^"]*?)"[^>]*>[^<]*?([A-Z]\d{1,3}|[A-Z]{1,2}\d{2,3})[^<]*?<\/a>/gi;
  while ((m = genRegex.exec(html)) !== null) {
    const href = m[1];
    const genCode = m[2];
    // Avoid duplicates
    if (!links.some(l => l.url === `${BASE}${href}`)) {
      links.push({
        url: `${BASE}${href}`,
        yearRange: '',
        genName: genCode,
      });
    }
  }

  return links;
}

// ─── Generation matching ────────────────────────────────────────

interface GenInfo {
  id: string;
  brandName: string;
  modelName: string;
  generationName: string;
  prodStart: number | null;
  prodEnd: number | null;
}

function normalizeModel(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/er$/, '')        // BMW: "3er" -> "3"
    .replace(/classe /i, '')   // French: "Classe C" -> "C"
    .replace(/class /i, '')    // English: "C-Class" -> "C-"
    .replace(/serie /i, 'series ')
    .replace(/s\u00e9rie /i, 'series ')
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeModel(a);
  const nb = normalizeModel(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  // Handle cases like "A4" matching "A4 Avant", "Golf" matching "Golf Plus"
  const tokensA = na.split(/\s+/);
  const tokensB = nb.split(/\s+/);
  if (tokensA.length > 0 && tokensB.length > 0) {
    if (tokensA[0] === tokensB[0] && tokensA[0].length >= 2) return true;
  }

  return false;
}

function matchModels(spritModelName: string, brandName: string, gens: GenInfo[]): GenInfo[] {
  const brandGens = gens.filter(g => g.brandName === brandName);
  const matched: GenInfo[] = [];

  for (const gen of brandGens) {
    if (fuzzyMatch(spritModelName, gen.modelName)) {
      matched.push(gen);
    }
  }

  return matched;
}

function matchGenerationByYear(
  matchedGens: GenInfo[],
  yearStart: number | null,
  yearEnd: number | null
): GenInfo | null {
  if (!yearStart && !yearEnd) return null;

  for (const gen of matchedGens) {
    if (!gen.prodStart) continue;

    // Match if production years overlap
    const genStart = gen.prodStart;
    const genEnd = gen.prodEnd || 2026;
    const targetStart = yearStart || genStart;
    const targetEnd = yearEnd || targetStart + 10;

    if (genStart <= targetEnd && genEnd >= targetStart) {
      // Prefer exact start year matches
      if (genStart === targetStart) return gen;
    }
  }

  // Fallback: find closest by year
  if (yearStart) {
    let closest: GenInfo | null = null;
    let minDiff = Infinity;
    for (const gen of matchedGens) {
      if (!gen.prodStart) continue;
      const diff = Math.abs(gen.prodStart - yearStart);
      if (diff < minDiff) {
        minDiff = diff;
        closest = gen;
      }
    }
    if (closest && minDiff <= 3) return closest;
  }

  return null;
}

// ─── DB helpers ─────────────────────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function upsertConsumption(
  generationId: string,
  sourceUrl: string,
  entry: ConsumptionEntry,
  allEntries: ConsumptionEntry[]
): Promise<boolean> {
  const { error } = await supabase.from('third_party_specs').upsert(
    {
      generation_id: generationId,
      source: 'spritmonitor',
      source_url: sourceUrl,
      spec_type: 'real_consumption_l100km',
      spec_value: entry.avgConsumption,
      raw_data: {
        avg: entry.avgConsumption,
        min: entry.minConsumption,
        max: entry.maxConsumption,
        sample_count: entry.sampleSize,
        fuel_type: entry.fuelType,
        all_fuel_types: allEntries.map(e => ({
          fuel_type: e.fuelType,
          avg_l100km: e.avgConsumption,
          min_l100km: e.minConsumption,
          max_l100km: e.maxConsumption,
          sample_size: e.sampleSize,
        })),
      },
    },
    { onConflict: 'generation_id,source,spec_type' }
  );

  if (error && error.code !== '23505') {
    console.log(`      DB error: ${error.message}`);
    return false;
  }
  return !error;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('================================================================');
  console.log('  FLM AUTO -- Spritmonitor Real Consumption Scraper v3');
  console.log('  Enhanced: per-generation data, min/max, multi-fuel');
  console.log('================================================================');
  console.log('');

  const cp = loadCheckpoint();
  const completedBrands = new Set(cp.completedBrands);

  if (completedBrands.size > 0) {
    console.log(`  Resuming: ${completedBrands.size}/${Object.keys(MANUF_IDS).length} brands done, ${cp.totalSaved} saved`);
    console.log('');
  }

  // ─── Load database ──────────────────────────────────────────

  console.log('  Loading database...');
  const [gens, dbModels, brands] = await Promise.all([
    paginateAll('generations', 'id, name, model_id, production_start, production_end'),
    paginateAll('models', 'id, name, brand_id'),
    paginateAll('brands', 'id, name'),
  ]);

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(dbModels.map((m: any) => [m.id, m]));

  const genInfos: GenInfo[] = gens
    .map((g: any) => {
      const model = modelMap.get(g.model_id);
      const brand = model ? brandMap.get(model.brand_id) : null;
      return {
        id: g.id,
        brandName: brand?.name || '',
        modelName: model?.name || '',
        generationName: g.name || '',
        prodStart: g.production_start,
        prodEnd: g.production_end,
      };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  console.log(`  ${genInfos.length} generations loaded from DB`);
  console.log(`  ${Object.keys(MANUF_IDS).length} brands to scrape`);
  console.log('');

  const startTime = Date.now();
  const brandEntries = Object.entries(MANUF_IDS).filter(([name]) => !completedBrands.has(name));
  console.log(`  Brands remaining: ${brandEntries.length}`);
  console.log('');

  // ─── Process each brand ─────────────────────────────────────

  for (let bi = 0; bi < brandEntries.length; bi++) {
    const [brandName, manufId] = brandEntries[bi];
    console.log(`  ----------------------------------------------------------------`);
    console.log(`  [${bi + 1}/${brandEntries.length}] ${brandName} (Spritmonitor ID: ${manufId})`);
    console.log(`  ----------------------------------------------------------------`);

    // Step 1: Fetch the model list via AJAX endpoint
    const spritModels = fetchModelList(manufId);
    console.log(`    Found ${spritModels.length} models on Spritmonitor`);
    if (spritModels.length === 0) {
      console.log(`    WARNING: No models returned -- may be rate limited`);
      completedBrands.add(brandName);
      cp.completedBrands = [...completedBrands];
      saveCheckpoint(cp);
      await delay(DELAY_MS * 3);
      continue;
    }
    await delay(DELAY_MS);

    let brandSaved = 0;
    let brandGenHits = 0;

    // Step 2: Process each model
    for (let mi = 0; mi < spritModels.length; mi++) {
      const spritModel = spritModels[mi];
      const encodedBrand = encodeURIComponent(brandName);
      const encodedModel = encodeURIComponent(spritModel.name);
      const overviewUrl = `${BASE}/en/overview/${manufId}-${encodedBrand}/${spritModel.id}-${encodedModel}.html`;

      // Fetch overview page
      const overviewHtml = fetchUrl(overviewUrl);
      if (!overviewHtml) {
        cp.totalSkipped++;
        await delay(DELAY_MS);
        continue;
      }

      // Extract consumption data from overview
      const consumptionEntries = extractConsumption(overviewHtml);

      // Match to DB generations
      const matchedGens = matchModels(spritModel.name, brandName, genInfos);

      if (matchedGens.length === 0 || consumptionEntries.length === 0) {
        if (consumptionEntries.length > 0) {
          // Data exists but no DB match -- log for debugging
          console.log(`    [${mi + 1}/${spritModels.length}] ${spritModel.name} -- ${consumptionEntries.length} fuel types, 0 DB matches`);
        }
        cp.totalSkipped++;
        await delay(DELAY_MS);
        continue;
      }

      // Pick the best entry (largest sample size)
      const bestEntry = consumptionEntries.reduce((a, b) => a.sampleSize > b.sampleSize ? a : b);

      console.log(
        `    [${mi + 1}/${spritModels.length}] ${spritModel.name} -- ` +
        `${bestEntry.avgConsumption} L/100km (${bestEntry.fuelType}, n=${bestEntry.sampleSize}) ` +
        `-> ${matchedGens.length} gen(s)`
      );

      // Step 2a: Save overview-level data for ALL matched generations
      for (const gen of matchedGens) {
        const ok = await upsertConsumption(gen.id, overviewUrl, bestEntry, consumptionEntries);
        if (ok) { cp.totalSaved++; brandSaved++; }
        else { cp.errors++; }
      }
      cp.totalModels++;

      // Step 2b: Try to get per-generation data from sub-pages
      const genLinks = extractGenerationLinks(overviewHtml, manufId, brandName);
      if (genLinks.length > 0 && matchedGens.length > 1) {
        for (const genLink of genLinks) {
          await delay(DELAY_MS);

          const genHtml = fetchUrl(genLink.url);
          if (!genHtml) continue;

          const genConsumption = extractConsumption(genHtml);
          if (genConsumption.length === 0) continue;

          // Extract year from the generation link to narrow matching
          const yearMatch = genLink.yearRange.match(/(\d{4})/);
          const yearStart = yearMatch ? parseInt(yearMatch[1]) : null;
          const yearEndMatch = genLink.yearRange.match(/(\d{4})\s*[-\u2013]\s*(\d{4})/);
          const yearEnd = yearEndMatch ? parseInt(yearEndMatch[2]) : null;

          // Try to match to a specific generation by year
          const specificGen = matchGenerationByYear(matchedGens, yearStart, yearEnd);
          if (specificGen) {
            const genBest = genConsumption.reduce((a, b) => a.sampleSize > b.sampleSize ? a : b);
            // Only overwrite if this has a meaningful sample size or more specific data
            if (genBest.sampleSize >= 3 || genBest.minConsumption !== null) {
              const ok = await upsertConsumption(specificGen.id, genLink.url, genBest, genConsumption);
              if (ok) {
                brandGenHits++;
                cp.totalGenerationHits++;
              }
            }
          }
        }
      }

      await delay(DELAY_MS);
    }

    // Brand complete
    const elapsed = (Date.now() - startTime) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    console.log(`    => Saved: ${brandSaved} | Gen-specific: ${brandGenHits} | Total: ${cp.totalSaved} | ${minutes}m${seconds}s elapsed`);

    completedBrands.add(brandName);
    cp.completedBrands = [...completedBrands];
    saveCheckpoint(cp);
  }

  // ─── Summary ────────────────────────────────────────────────

  const elapsed = (Date.now() - startTime) / 1000;
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);

  console.log('');
  console.log('================================================================');
  console.log('  SPRITMONITOR v3 -- COMPLETE');
  console.log('================================================================');
  console.log(`  Models processed:       ${cp.totalModels}`);
  console.log(`  Records saved:          ${cp.totalSaved}`);
  console.log(`  Generation-specific:    ${cp.totalGenerationHits}`);
  console.log(`  Skipped (no match):     ${cp.totalSkipped}`);
  console.log(`  Errors:                 ${cp.errors}`);
  console.log(`  Duration:               ${hours}h ${mins}m`);
  console.log('================================================================');
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
