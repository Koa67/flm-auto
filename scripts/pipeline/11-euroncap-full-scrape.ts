/**
 * 11-euroncap-full-scrape.ts — Full EuroNCAP scrape from website
 *
 * Tries multiple approaches to get all EuroNCAP ratings:
 *   1. Umbraco API (JSON, fast)
 *   2. Ratings page HTML parse
 *   3. Individual result pages
 *
 * Only inserts ratings for generations that DON'T already have one.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/11-euroncap-full-scrape.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/11-euroncap-full-scrape.ts
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
const DELAY_MS = 500;
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'euroncap-full-scrape-checkpoint.json');

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.get({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) {
          const fullLoc = loc.startsWith('http') ? loc : `https://${parsedUrl.hostname}${loc}`;
          return fetchPage(fullLoc).then(resolve).catch(reject);
        }
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
  return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

interface ENCAPRating {
  brand: string;
  model: string;
  year: number;
  stars: number;
  adult_pct: number | null;
  child_pct: number | null;
  pedestrian_pct: number | null;
  safety_assist_pct: number | null;
  source_url: string;
  euroncap_id: string | null;
}

// Brand normalization
const BRAND_NORM: Record<string, string> = {
  'mercedes-benz': 'mercedes-benz', 'mercedes benz': 'mercedes-benz', 'mercedes': 'mercedes-benz',
  'volkswagen': 'volkswagen', 'vw': 'volkswagen',
  'alfa romeo': 'alfa romeo', 'land rover': 'land rover',
  'rolls-royce': 'rolls-royce', 'rolls royce': 'rolls-royce',
  'aston martin': 'aston martin', 'bmw': 'bmw', 'audi': 'audi',
  'porsche': 'porsche', 'volvo': 'volvo', 'tesla': 'tesla',
  'toyota': 'toyota', 'honda': 'honda', 'mazda': 'mazda',
  'hyundai': 'hyundai', 'kia': 'kia', 'nissan': 'nissan',
  'ford': 'ford', 'fiat': 'fiat', 'opel': 'opel',
  'renault': 'renault', 'peugeot': 'peugeot', 'citroen': 'citroen', 'citroën': 'citroen',
  'skoda': 'skoda', 'škoda': 'skoda', 'seat': 'seat', 'mini': 'mini',
  'jaguar': 'jaguar', 'lexus': 'lexus', 'ferrari': 'ferrari',
  'lamborghini': 'lamborghini', 'maserati': 'maserati', 'bentley': 'bentley',
};

function normBrand(raw: string): string {
  const lower = raw.toLowerCase().replace(/-/g, ' ').trim();
  return BRAND_NORM[lower] || lower;
}

// Checkpoint
interface Checkpoint { visitedUrls: string[]; ratings: ENCAPRating[]; }
function loadCheckpoint(): Checkpoint {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')); }
  catch { return { visitedUrls: [], ratings: [] }; }
}
function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

// ═══════════ Parse ratings from HTML ═══════════
function extractRatingsFromHTML(html: string): ENCAPRating[] {
  const ratings: ENCAPRating[] = [];

  // Look for result links: /en/results/{brand}/{model}/{id}
  const linkRegex = /\/en\/results\/([^\/]+)\/([^\/]+)\/(\d+)/g;
  const seen = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const id = match[3];
    if (seen.has(id)) continue;
    seen.add(id);

    const brand = match[1].replace(/-/g, ' ').replace(/\+/g, ' ');
    const model = match[2].replace(/-/g, ' ').replace(/\+/g, ' ');

    ratings.push({
      brand: normBrand(brand),
      model,
      year: 0, // Will be filled from detail page
      stars: 0,
      adult_pct: null,
      child_pct: null,
      pedestrian_pct: null,
      safety_assist_pct: null,
      source_url: `https://www.euroncap.com/en/results/${match[1]}/${match[2]}/${id}`,
      euroncap_id: id,
    });
  }

  return ratings;
}

function parseDetailPage(html: string, url: string): Partial<ENCAPRating> | null {
  // Extract star rating
  const starsPatterns = [
    /class="[^"]*overall[^"]*"[^>]*data-rating="(\d)"/i,
    /(\d)\s*star/i,
    /"overallRating"\s*:\s*(\d)/i,
    /class="[^"]*stars?-(\d)[^"]*"/i,
  ];
  let stars = 0;
  for (const pat of starsPatterns) {
    const m = html.match(pat);
    if (m) { stars = parseInt(m[1]); break; }
  }
  if (!stars) return null;

  // Extract percentages
  function findPct(label: string): number | null {
    const patterns = [
      new RegExp(`${label}[^\\d]*?(\\d{1,3})\\s*%`, 'i'),
      new RegExp(`"${label}"[^}]*?"percentage"\\s*:\\s*(\\d+)`, 'i'),
      new RegExp(`${label}[\\s\\S]{0,100}?(\\d{2,3})%`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) {
        const v = parseInt(m[1]);
        if (v >= 0 && v <= 100) return v;
      }
    }
    return null;
  }

  const adult = findPct('adult\\s*occupant') ?? findPct('adult');
  const child = findPct('child\\s*occupant') ?? findPct('child');
  const ped = findPct('vulnerable\\s*road') ?? findPct('pedestrian') ?? findPct('vru');
  const assist = findPct('safety\\s*assist');

  // Year
  const yearMatch = html.match(/tested\s*(?:in\s*)?(\d{4})/i) || html.match(/"year"\s*:\s*(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  return { stars, adult_pct: adult, child_pct: child, pedestrian_pct: ped, safety_assist_pct: assist, year };
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  11-EURONCAP-FULL-SCRAPE — Complete EuroNCAP Scrape');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  const genLookup = new Map<string, { gen: any; startYear: number; endYear: number }[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ gen, startYear, endYear });
  }
  console.log(`  Generations: ${gens.length}`);

  const existing = await paginateAll('safety_ratings', 'generation_id');
  const existingGenIds = new Set(existing.map(r => r.generation_id));
  console.log(`  Existing safety_ratings: ${existing.length}`);

  const cp = loadCheckpoint();
  const visitedSet = new Set(cp.visitedUrls);
  console.log(`  Checkpoint: ${visitedSet.size} URLs visited, ${cp.ratings.length} cached ratings`);

  // ═══ STEP 1: Try Umbraco API ═══
  console.log('\n━━━ STEP 1: Try EuroNCAP API ━━━');
  let apiRatings: ENCAPRating[] = [];

  const apiUrls = [
    'https://www.euroncap.com/en/ratings-rewards/',
  ];

  for (const apiUrl of apiUrls) {
    try {
      console.log(`  Fetching: ${apiUrl}`);
      const html = await fetchPage(apiUrl);
      const found = extractRatingsFromHTML(html);
      console.log(`  Found ${found.length} result links`);
      if (found.length > apiRatings.length) apiRatings = found;
      await sleep(DELAY_MS);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Add cached ratings from checkpoint
  for (const cached of cp.ratings) {
    if (!apiRatings.find(r => r.euroncap_id === cached.euroncap_id)) {
      apiRatings.push(cached);
    }
  }

  console.log(`  Total unique ratings to process: ${apiRatings.length}`);

  // ═══ STEP 2: Fetch detail pages for ratings with missing data ═══
  console.log('\n━━━ STEP 2: Fetch detail pages ━━━');
  let detailsFetched = 0;

  for (let i = 0; i < apiRatings.length; i++) {
    const rating = apiRatings[i];
    if (!rating.source_url || visitedSet.has(rating.source_url)) continue;
    if (rating.stars > 0 && rating.adult_pct !== null) continue; // Already have full data

    try {
      const html = await fetchPage(rating.source_url);
      const detail = parseDetailPage(html, rating.source_url);
      if (detail) {
        if (detail.stars) rating.stars = detail.stars;
        if (detail.adult_pct !== null && detail.adult_pct !== undefined) rating.adult_pct = detail.adult_pct;
        if (detail.child_pct !== null && detail.child_pct !== undefined) rating.child_pct = detail.child_pct;
        if (detail.pedestrian_pct !== null && detail.pedestrian_pct !== undefined) rating.pedestrian_pct = detail.pedestrian_pct;
        if (detail.safety_assist_pct !== null && detail.safety_assist_pct !== undefined) rating.safety_assist_pct = detail.safety_assist_pct;
        if (detail.year) rating.year = detail.year;
      }
      visitedSet.add(rating.source_url);
      cp.visitedUrls.push(rating.source_url);
      detailsFetched++;
      process.stdout.write(detail?.stars ? '.' : '-');
      if (detailsFetched % 50 === 0) { saveCheckpoint(cp); process.stdout.write(`[${detailsFetched}]`); }
      await sleep(DELAY_MS);
    } catch (e: any) {
      process.stdout.write('x');
      await sleep(DELAY_MS * 2);
    }
  }

  // Update checkpoint with enriched ratings
  cp.ratings = apiRatings.filter(r => r.stars > 0);
  saveCheckpoint(cp);
  console.log(`\n  Details fetched: ${detailsFetched}`);

  // ═══ STEP 3: Match and insert ═══
  console.log('\n━━━ STEP 3: Match and insert ━━━');
  const stats = {
    total: apiRatings.length,
    withStars: 0,
    matched: 0,
    alreadyExists: 0,
    toInsert: 0,
    inserted: 0,
    unmatched: 0,
  };

  const toUpsert: any[] = [];
  const insertedGenIds = new Set<string>();

  for (const rating of apiRatings) {
    if (!rating.stars || rating.stars < 1) continue;
    stats.withStars++;

    // Match to generation
    const brand = normBrand(rating.brand);
    const modelLower = rating.model.toLowerCase()
      .replace(/\s*\(\d{4}\)/, '')
      .replace(/-class$/i, ' class')
      .trim();

    let matchedGen: any = null;
    const key = `${brand}|${modelLower}`;
    let entries = genLookup.get(key);

    // Fuzzy
    if (!entries) {
      const mn = normalize(modelLower);
      for (const [k, v] of genLookup) {
        const [bk, mk] = k.split('|');
        if (bk !== brand) continue;
        const mkn = normalize(mk);
        if (mkn === mn || mkn.includes(mn) || mn.includes(mkn)) {
          entries = v; break;
        }
      }
    }

    if (!entries) { stats.unmatched++; continue; }

    if (rating.year > 0) {
      const ym = entries.find(e => rating.year >= e.startYear && rating.year <= e.endYear);
      matchedGen = ym?.gen || entries[entries.length - 1]?.gen;
    } else {
      matchedGen = entries[entries.length - 1]?.gen;
    }

    if (!matchedGen) { stats.unmatched++; continue; }
    stats.matched++;

    if (existingGenIds.has(matchedGen.id) || insertedGenIds.has(matchedGen.id)) {
      stats.alreadyExists++;
      continue;
    }

    toUpsert.push({
      generation_id: matchedGen.id,
      euroncap_id: rating.euroncap_id,
      source_url: rating.source_url,
      stars: rating.stars,
      adult_occupant_pct: rating.adult_pct,
      child_occupant_pct: rating.child_pct,
      pedestrian_pct: rating.pedestrian_pct,
      safety_assist_pct: rating.safety_assist_pct,
      test_year: rating.year || null,
    });
    insertedGenIds.add(matchedGen.id);
    stats.toInsert++;
  }

  // Insert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`  Inserting ${toUpsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Batch error: ${error.message}`);
      else inserted += batch.length;
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  EURONCAP FULL SCRAPE RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total ratings found:  ${stats.total}`);
  console.log(`  With stars:           ${stats.withStars}`);
  console.log(`  Matched to gen:       ${stats.matched}`);
  console.log(`  Already has rating:   ${stats.alreadyExists}`);
  console.log(`  New to insert:        ${stats.toInsert}`);
  console.log(`  Inserted:             ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Unmatched:            ${stats.unmatched}`);
  const newTotal = existingGenIds.size + insertedGenIds.size;
  console.log(`\n  Safety coverage: ${existing.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'euroncap-full-scrape-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
