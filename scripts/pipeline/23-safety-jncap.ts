/**
 * 23-safety-jncap.ts — Import JNCAP safety ratings from NASVA
 *
 * Iterates through JNCAP detail pages (IDs 95-270+) and extracts star ratings.
 * Matches to our DB by brand + model name fuzzy matching.
 * Never overwrites existing safety ratings.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/23-safety-jncap.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/23-safety-jncap.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'jncap-checkpoint.json');
const MIN_ID = 95;
const MAX_ID = 280;
const DELAY_MS = 1500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) FLM-Auto-Research/1.0',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}`)));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

interface JNCAPResult {
  id: number;
  brand: string;
  model: string;
  year: string;
  stars: number;
  overallPct: number;
  url: string;
}

function parseJNCAPPage(html: string, id: number): JNCAPResult | null {
  // Check if it's a valid assessment page (not a redirect/renewal notice)
  if (html.includes('リニューアルしました') || html.includes('Not Found') || !html.includes('assessment')) {
    return null;
  }

  // Extract car name from title or heading
  // Pattern: <h1> or <title> containing the car name
  let carName = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)/i);
  if (titleMatch) {
    carName = titleMatch[1].replace(/\s*[-|]\s*JNCAP.*$/i, '').replace(/\s*[-|]\s*NASVA.*$/i, '').trim();
  }

  // Try h1/h2 heading
  if (!carName || carName.length < 2) {
    const h1Match = html.match(/<h[12][^>]*>([^<]+)</i);
    if (h1Match) carName = h1Match[1].trim();
  }

  if (!carName || carName.length < 2) return null;

  // Extract star rating
  let stars = 0;
  // Look for star pattern: ★★★★★ or star count
  const starTextMatch = html.match(/★+/);
  if (starTextMatch) {
    stars = starTextMatch[0].length;
  }
  // Also try "X star" pattern
  if (stars === 0) {
    const starNumMatch = html.match(/(\d)\s*(?:star|★)/i);
    if (starNumMatch) stars = parseInt(starNumMatch[1]);
  }
  // Try "Five Star" etc.
  const wordStarMap: Record<string, number> = { 'five': 5, 'four': 4, 'three': 3, 'two': 2, 'one': 1 };
  if (stars === 0) {
    for (const [word, val] of Object.entries(wordStarMap)) {
      if (html.toLowerCase().includes(`${word} star`)) { stars = val; break; }
    }
  }

  // Extract year (FY XXXX)
  let year = '';
  const yearMatch = html.match(/FY\s*(\d{4})/i);
  if (yearMatch) year = yearMatch[1];

  // Extract overall percentage
  let overallPct = 0;
  const pctMatch = html.match(/(\d{2,3}(?:\.\d+)?)\s*%/);
  if (pctMatch) overallPct = parseFloat(pctMatch[1]);

  // Known JNCAP brand → our DB brand mapping
  const BRAND_MAP: Record<string, string> = {
    'TOYOTA': 'Toyota', 'HONDA': 'Honda', 'NISSAN': 'Nissan', 'MAZDA': 'Mazda',
    'SUBARU': 'Subaru', 'SUZUKI': 'Suzuki', 'MITSUBISHI': 'Mitsubishi',
    'DAIHATSU': 'Daihatsu', 'LEXUS': 'Lexus', 'INFINITI': 'Infiniti',
    'ISUZU': 'Isuzu', 'VOLKSWAGEN': 'Volkswagen',
  };

  // Extract brand from structured content — look for manufacturer/brand labels
  let brand = '';
  let model = '';

  // Method 1: Look for brand name in a label-value pattern near "Manufacturer" or "Brand"
  const mfgMatch = html.match(/(?:manufacturer|brand|maker|メーカー)[^<]*?<[^>]*>([^<]+)/i);
  if (mfgMatch) {
    const mfgText = mfgMatch[1].trim().toUpperCase();
    for (const [key, val] of Object.entries(BRAND_MAP)) {
      if (mfgText.includes(key)) { brand = val; break; }
    }
  }

  // Method 2: Look for brand name right before the model in the car name
  if (!brand) {
    const upperName = carName.toUpperCase();
    // Sort by longest match first to avoid partial matches (e.g., "SUZUKI" before "ISUZU")
    const sortedBrands = Object.keys(BRAND_MAP).sort((a, b) => b.length - a.length);
    for (const b of sortedBrands) {
      if (upperName.startsWith(b) || upperName.includes(b + ' ')) {
        brand = BRAND_MAP[b];
        break;
      }
    }
  }

  // Method 3: Look for structured data / JSON-LD or specific class patterns
  if (!brand) {
    // Check for brand in alt text of logo images
    const altMatch = html.match(/alt="([^"]*(?:TOYOTA|HONDA|NISSAN|MAZDA|SUBARU|SUZUKI|MITSUBISHI|DAIHATSU|LEXUS|VOLKSWAGEN)[^"]*)"/i);
    if (altMatch) {
      const altText = altMatch[1].toUpperCase();
      for (const [key, val] of Object.entries(BRAND_MAP)) {
        if (altText.includes(key)) { brand = val; break; }
      }
    }
  }

  // Known model-to-brand mapping for JNCAP models
  const MODEL_BRAND_MAP: Record<string, string> = {
    'LEAF': 'Nissan', 'NOTE': 'Nissan', 'SERENA': 'Nissan', 'X-TRAIL': 'Nissan', 'KICKS': 'Nissan',
    'DAYZ': 'Nissan', 'ROOX': 'Nissan', 'SAKURA': 'Nissan', 'ELGRAND': 'Nissan',
    'FIT': 'Honda', 'FREED': 'Honda', 'VEZEL': 'Honda', 'CIVIC': 'Honda', 'ODYSSEY': 'Honda',
    'N-ONE': 'Honda', 'STEP WGN': 'Honda', 'ZR-V': 'Honda', 'WR-V': 'Honda', 'N-BOX': 'Honda',
    'AQUA': 'Toyota', 'YARIS': 'Toyota', 'YARIS CROSS': 'Toyota', 'COROLLA': 'Toyota',
    'COROLLA CROSS': 'Toyota', 'COROLLA SPORT': 'Toyota', 'COROLLA FIELDER': 'Toyota',
    'RAV4': 'Toyota', 'HARRIER': 'Toyota', 'PRIUS': 'Toyota', 'CROWN': 'Toyota',
    'SIENTA': 'Toyota', 'VOXY': 'Toyota', 'ALPHARD': 'Toyota', 'PROBOX VAN': 'Toyota',
    'CX-30': 'Mazda', 'CX-60': 'Mazda', 'CX-80': 'Mazda', 'DEMIO': 'Mazda',
    'LEGACY OUTBACK': 'Subaru', 'LEVORG': 'Subaru', 'FORESTAR': 'Subaru',
    'CROSSTREK': 'Subaru', 'BRZ': 'Subaru', 'SOLTERRA': 'Subaru',
    'SWIFT': 'Suzuki', 'HUSTLER': 'Suzuki', 'WAGON R': 'Suzuki', 'SPACIA': 'Suzuki',
    'ALTO': 'Suzuki', 'FRONX': 'Suzuki', 'X BEE': 'Suzuki', 'SOLIO': 'Suzuki',
    'JIMNY': 'Suzuki', 'EVERY': 'Suzuki',
    'OUTLANDER': 'Mitsubishi', 'ECLIPSE CROSS': 'Mitsubishi', 'DELICA D:5': 'Mitsubishi',
    'eK': 'Mitsubishi',
    'TAFT': 'Daihatsu', 'MOVE': 'Daihatsu', 'TANTO': 'Daihatsu', 'ROCKY': 'Daihatsu',
    'ROOMY': 'Toyota', 'HIJET CARGO': 'Daihatsu',
    'NX': 'Lexus', 'RX': 'Lexus', 'LBX': 'Lexus',
    'GOLF': 'Volkswagen', 'POLO': 'Volkswagen',
  };

  // If still no brand, match from model name
  if (!brand) {
    const upperName = carName.toUpperCase().replace(/\s+/g, ' ').trim();
    // Try longest model names first
    const sortedModels = Object.keys(MODEL_BRAND_MAP).sort((a, b) => b.length - a.length);
    for (const m of sortedModels) {
      if (upperName.includes(m)) {
        brand = MODEL_BRAND_MAP[m];
        break;
      }
    }
  }

  if (!brand || stars === 0) return null;

  // Extract model name from carName
  model = carName
    .replace(new RegExp(`^${brand}\\s*`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle slash-separated names (e.g., "WAGON R/WAGON R STINGRAY FLAIR")
  // Take the first variant
  if (model.includes('/')) {
    model = model.split('/')[0].trim();
  }

  return {
    id,
    brand: brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase(),
    model,
    year,
    stars,
    overallPct,
    url: `https://www.nasva.go.jp/mamoru/en/assessment_car/detail/${id}`,
  };
}

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[-_\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatch(jncapModel: string, dbModel: string): boolean {
  const a = normalize(jncapModel);
  const b = normalize(dbModel);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Try without spaces
  if (a.replace(/\s/g, '') === b.replace(/\s/g, '')) return true;
  return false;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  23-SAFETY-JNCAP — Import JNCAP safety ratings');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  ID range: ${MIN_ID}-${MAX_ID}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, production_start, model:models(id, name, brand:brands(id, name))');
  console.log(`  Generations: ${gens.length}`);

  const existingSafety = await paginateAll('safety_ratings', 'generation_id, source_url');
  const safetyByGenId = new Set(existingSafety.map((s: any) => s.generation_id));
  console.log(`  Existing safety ratings: ${existingSafety.length}`);

  // Build brand → model → [gen] lookup
  const brandModelGens = new Map<string, Map<string, any[]>>();
  for (const g of gens) {
    const model = g.model as any;
    if (!model?.brand) continue;
    const brandName = normalize(model.brand.name);
    const modelName = normalize(model.name);
    if (!brandModelGens.has(brandName)) brandModelGens.set(brandName, new Map());
    const modelMap = brandModelGens.get(brandName)!;
    if (!modelMap.has(modelName)) modelMap.set(modelName, []);
    modelMap.get(modelName)!.push(g);
  }

  // Load checkpoint
  let processedIds = new Set<number>();
  if (fs.existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    processedIds = new Set(cp.processed || []);
    console.log(`  Checkpoint: ${processedIds.size} IDs already checked`);
  }

  // Scrape JNCAP pages
  const results: JNCAPResult[] = [];
  const stats = {
    pagesChecked: 0,
    pagesFound: 0,
    pagesNotFound: 0,
    pagesError: 0,
    matched: 0,
    alreadyHasSafety: 0,
    noMatch: 0,
    inserted: 0,
  };

  console.log('\n  Scraping JNCAP pages...');
  for (let id = MIN_ID; id <= MAX_ID; id++) {
    if (processedIds.has(id)) continue;

    try {
      const html = await fetchHTML(`https://www.nasva.go.jp/mamoru/en/assessment_car/detail/${id}`);
      stats.pagesChecked++;

      const result = parseJNCAPPage(html, id);
      if (result) {
        results.push(result);
        stats.pagesFound++;
        console.log(`    [${id}] ${result.brand} ${result.model} (${result.year}) — ${result.stars}★`);
      } else {
        stats.pagesNotFound++;
      }

      processedIds.add(id);
      await sleep(DELAY_MS);

      // Checkpoint every 20
      if (id % 20 === 0) {
        fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
          processed: Array.from(processedIds),
          results: results,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (e: any) {
      stats.pagesError++;
      processedIds.add(id);
      await sleep(DELAY_MS);
    }
  }

  // Save final checkpoint
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
    processed: Array.from(processedIds),
    results: results,
    timestamp: new Date().toISOString(),
  }));

  console.log(`\n  Found ${results.length} JNCAP assessments`);

  // Match to DB
  const toInsert: any[] = [];
  for (const r of results) {
    const brandName = normalize(r.brand);
    const modelMap = brandModelGens.get(brandName);
    if (!modelMap) {
      stats.noMatch++;
      continue;
    }

    // Find matching model
    let matchedGens: any[] = [];
    for (const [dbModelName, modelGens] of Array.from(modelMap.entries())) {
      if (fuzzyMatch(r.model, dbModelName)) {
        matchedGens = modelGens;
        break;
      }
    }

    if (matchedGens.length === 0) {
      stats.noMatch++;
      continue;
    }

    // Find best generation match by year
    const jncapYear = parseInt(r.year);
    let bestGen: any = null;
    let bestDist = Infinity;

    for (const g of matchedGens) {
      const start = g.production_start ? new Date(g.production_start).getFullYear() : null;
      if (!start) continue;
      const dist = Math.abs(start - jncapYear);
      if (dist < bestDist) { bestDist = dist; bestGen = g; }
    }

    // Fallback: pick first gen if no production dates
    if (!bestGen && matchedGens.length > 0) {
      bestGen = matchedGens[0];
    }

    if (!bestGen) { stats.noMatch++; continue; }

    // Check if already has safety
    if (safetyByGenId.has(bestGen.id)) {
      stats.alreadyHasSafety++;
      continue;
    }

    stats.matched++;
    const clampedStars = Math.min(Math.max(r.stars, 1), 5);
    toInsert.push({
      generation_id: bestGen.id,
      stars: clampedStars,
      source_url: r.url,
      test_year: parseInt(r.year) || null,
    });
    safetyByGenId.add(bestGen.id); // Prevent duplicates within batch
  }

  console.log(`  Matched: ${stats.matched}`);
  console.log(`  Already has safety: ${stats.alreadyHasSafety}`);
  console.log(`  No match: ${stats.noMatch}`);

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  const newTotal = existingSafety.length + stats.inserted;
  console.log('\n' + '='.repeat(60));
  console.log('  JNCAP SAFETY RESULTS');
  console.log('='.repeat(60));
  console.log(`  Pages checked:     ${stats.pagesChecked}`);
  console.log(`  Assessments found: ${stats.pagesFound}`);
  console.log(`  Not found / 404:   ${stats.pagesNotFound}`);
  console.log(`  Errors:            ${stats.pagesError}`);
  console.log(`  Matched to DB:     ${stats.matched}`);
  console.log(`  Already rated:     ${stats.alreadyHasSafety}`);
  console.log(`  No DB match:       ${stats.noMatch}`);
  console.log(`  Inserted:          ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Safety coverage:   ${existingSafety.length} → ${DRY_RUN ? '?' : newTotal} / ${gens.length}`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'jncap-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    results: results.map(r => ({ brand: r.brand, model: r.model, year: r.year, stars: r.stars })),
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
