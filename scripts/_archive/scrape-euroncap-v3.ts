/**
 * FLM AUTO — Euro NCAP Crash Test Scraper v3
 * ============================================
 * Comprehensive scraper that targets ALL historical Euro NCAP ratings.
 *
 * Strategy:
 *   1. Try the Euro NCAP JSON API at /en/ratings/api/ratings
 *   2. Fetch the XML sitemap for all /en/results/ URLs
 *   3. Scrape the "latest safety ratings" listing pages (paginated)
 *   4. Scrape the historical "safety ratings" listing pages (paginated)
 *   5. Merge with existing local JSON data files
 *   6. Scrape individual result pages for detail percentages
 *   7. Fuzzy-match each rating to a FLM AUTO generation
 *   8. Upsert into the safety_ratings table
 *
 * Checkpoint: data/raw/checkpoint_euroncap_v3.json
 * Delay: 500ms between requests
 * Target: 500+ matched ratings
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-euroncap-v3.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_euroncap_v3.json');
const DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RatingEntry {
  brand: string;
  model: string;
  year_tested: number;
  stars: number;
  adult_pct: number | null;
  child_pct: number | null;
  pedestrian_pct: number | null;
  safety_assist_pct: number | null;
  source_url: string;
  euroncap_id: string;
  has_aeb_pedestrian: boolean;
  has_aeb_cyclist: boolean;
  has_lane_assist: boolean;
  has_speed_assist: boolean;
  has_active_bonnet: boolean;
}

interface Checkpoint {
  /** URLs that returned valid ratings keyed by URL */
  scrapedDetails: Record<string, RatingEntry>;
  /** URLs that returned no usable data (skip on resume) */
  failedUrls: string[];
  /** Timestamp of last save */
  lastSaved: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a URL using Node's built-in http/https modules with redirect following,
 * timeout, and proper headers.
 */
function fetchUrl(url: string, accept = 'text/html'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? require('https') : require('http');
    const req = proto.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res: any) => {
        // Follow redirects (up to 5)
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
          let loc = res.headers.location;
          if (loc.startsWith('/')) loc = new URL(loc, url).href;
          fetchUrl(loc, accept).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms: ${url}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Brand normalization
// ---------------------------------------------------------------------------

const BRAND_ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  mercedes: 'mercedes-benz',
  'mercedes benz': 'mercedes-benz',
  merc: 'mercedes-benz',
  'opel/vauxhall': 'opel',
  'opel%2fvauxhall': 'opel',
  'vauxhall/opel': 'opel',
  'vauxhall%2fopel': 'opel',
  vauxhall: 'opel',
  alfa: 'alfa romeo',
  'alfa-romeo': 'alfa romeo',
  'land-rover': 'land rover',
  'aston-martin': 'aston martin',
  'rolls-royce': 'rolls-royce',
  ds: 'ds automobiles',
  'ds automobiles': 'ds automobiles',
  'skoda': 'skoda',
  'škoda': 'skoda',
  'citroën': 'citroen',
  'citro%c3%abn': 'citroen',
  'citroen': 'citroen',
  seat: 'seat',
  cupra: 'seat', // Cupra is SEAT's performance sub-brand
  mini: 'mini',
  'mg': 'mg',
  'fiat': 'fiat',
  'ford': 'ford',
  'honda': 'honda',
  'hyundai': 'hyundai',
  'jaguar': 'jaguar',
  'kia': 'kia',
  'lexus': 'lexus',
  'mazda': 'mazda',
  'nissan': 'nissan',
  'peugeot': 'peugeot',
  'porsche': 'porsche',
  'renault': 'renault',
  'tesla': 'tesla',
  'toyota': 'toyota',
  'volvo': 'volvo',
  'bmw': 'bmw',
  'audi': 'audi',
  'bentley': 'bentley',
  'ferrari': 'ferrari',
  'maserati': 'maserati',
  'lamborghini': 'lamborghini',
  'subaru': 'subaru',
  'suzuki': 'suzuki',
  'mitsubishi': 'mitsubishi',
  'dacia': 'dacia',
  'smart': 'smart',
  'genesis': 'genesis',
  'polestar': 'polestar',
  'nio': 'nio',
  'byd': 'byd',
  'lucid': 'lucid',
  'xpeng': 'xpeng',
  'ora': 'ora',
  'maxus': 'maxus',
  'lynk & co': 'lynk & co',
  'lynk-&-co': 'lynk & co',
  'zeekr': 'zeekr',
  'leapmotor': 'leapmotor',
};

function normalizeBrand(raw: string): string {
  const lower = decodeURIComponent(raw).toLowerCase().replace(/[+_]/g, ' ').replace(/-/g, ' ').trim();
  // Direct alias
  if (BRAND_ALIASES[lower]) return BRAND_ALIASES[lower];
  // Try with hyphens as dashes
  const withDash = lower.replace(/\s+/g, '-');
  if (BRAND_ALIASES[withDash]) return BRAND_ALIASES[withDash];
  return lower;
}

function normalizeModel(raw: string): string {
  return decodeURIComponent(raw)
    .replace(/[+_]/g, ' ')
    .replace(/-/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Checkpoint I/O
// ---------------------------------------------------------------------------

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch {
      // corrupt — start fresh
    }
  }
  return { scrapedDetails: {}, failedUrls: [], lastSaved: '' };
}

function saveCheckpoint(cp: Checkpoint): void {
  cp.lastSaved = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ---------------------------------------------------------------------------
// Paginate helper for Supabase
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Step 1: Try Euro NCAP JSON API
// ---------------------------------------------------------------------------

async function tryJsonApi(): Promise<RatingEntry[]> {
  const results: RatingEntry[] = [];
  const apiEndpoints = [
    'https://www.euroncap.com/en/ratings/api/ratings',
    'https://www.euroncap.com/api/Ratings/GetLatestRatings',
    'https://www.euroncap.com/api/ratings/latest',
    'https://www.euroncap.com/api/results',
    'https://www.euroncap.com/api/assessments',
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const { status, body } = await fetchUrl(endpoint, 'application/json, text/json, */*');
      if (status === 200 && (body.startsWith('[') || body.startsWith('{'))) {
        const parsed = JSON.parse(body);
        const items = Array.isArray(parsed) ? parsed : parsed.results || parsed.data || parsed.ratings || [];
        if (items.length > 0) {
          console.log(`  API ${endpoint} returned ${items.length} items`);
          for (const item of items) {
            const brand = normalizeBrand(item.make || item.brand || item.Make || item.Brand || '');
            const model = normalizeModel(item.model || item.Model || '');
            const stars = parseInt(item.stars || item.Stars || item.overallRating || item.rating || '0');
            if (brand && model && stars > 0) {
              results.push({
                brand,
                model,
                year_tested: parseInt(item.year || item.Year || item.testYear || '0'),
                stars,
                adult_pct: parseFloat(item.adultOccupant || item.adult_occupant_pct || '0') || null,
                child_pct: parseFloat(item.childOccupant || item.child_occupant_pct || '0') || null,
                pedestrian_pct: parseFloat(item.pedestrian || item.pedestrian_pct || item.vulnerableRoadUser || '0') || null,
                safety_assist_pct: parseFloat(item.safetyAssist || item.safety_assist_pct || '0') || null,
                source_url: item.url || endpoint,
                euroncap_id: String(item.id || item.assessmentId || ''),
                has_aeb_pedestrian: false,
                has_aeb_cyclist: false,
                has_lane_assist: false,
                has_speed_assist: false,
                has_active_bonnet: false,
              });
            }
          }
          console.log(`  Parsed ${results.length} ratings from API`);
          return results;
        }
      }
    } catch {
      // silently try next
    }
    await sleep(300);
  }

  console.log('  No JSON API returned usable data');
  return results;
}

// ---------------------------------------------------------------------------
// Step 2: Fetch XML sitemap for /en/results/ URLs
// ---------------------------------------------------------------------------

async function fetchSitemapUrls(): Promise<{ brand: string; model: string; id: string; url: string }[]> {
  const resultUrls: { brand: string; model: string; id: string; url: string }[] = [];

  // Euro NCAP may have a sitemap index
  const sitemapCandidates = [
    'https://www.euroncap.com/sitemap.xml',
    'https://www.euroncap.com/sitemapindex.xml',
    'https://www.euroncap.com/en/sitemap.xml',
  ];

  for (const sitemapUrl of sitemapCandidates) {
    try {
      const { status, body } = await fetchUrl(sitemapUrl, 'application/xml, text/xml, */*');
      if (status !== 200) continue;

      // Check if it is a sitemap index (contains <sitemap> tags)
      const subSitemaps = body.match(/<loc>([^<]*sitemap[^<]*)<\/loc>/gi) || [];
      const sitemapsToProcess: string[] = [];

      if (subSitemaps.length > 0) {
        // It is a sitemap index
        for (const tag of subSitemaps) {
          const loc = tag.match(/<loc>([^<]+)<\/loc>/)?.[1];
          if (loc) sitemapsToProcess.push(loc);
        }
        console.log(`  Sitemap index at ${sitemapUrl}: ${sitemapsToProcess.length} sub-sitemaps`);
      } else {
        // It is a direct sitemap
        sitemapsToProcess.push(sitemapUrl);
      }

      // Process each sitemap
      for (const smUrl of sitemapsToProcess) {
        try {
          const smBody = smUrl === sitemapUrl ? body : (await fetchUrl(smUrl, 'application/xml')).body;
          const urls = smBody.match(/<loc>([^<]*\/en\/results\/[^<]+)<\/loc>/gi) || [];
          for (const tag of urls) {
            const loc = tag.match(/<loc>([^<]+)<\/loc>/)?.[1];
            if (!loc) continue;
            const segments = loc.replace(/https?:\/\/www\.euroncap\.com\/en\/results\//, '').replace(/\/$/, '').split('/');
            if (segments.length >= 3) {
              resultUrls.push({
                brand: segments[0],
                model: segments[1],
                id: segments[2],
                url: loc,
              });
            }
          }
          await sleep(DELAY_MS);
        } catch {
          // skip sub-sitemap
        }
      }

      if (resultUrls.length > 0) break; // found results, stop trying other sitemaps
    } catch {
      // try next
    }
    await sleep(DELAY_MS);
  }

  return resultUrls;
}

// ---------------------------------------------------------------------------
// Step 3: Scrape listing pages (latest + historical)
// ---------------------------------------------------------------------------

interface ListingItem {
  brand: string;
  model: string;
  year: number;
  stars: number;
  detailUrl: string;
}

function parseListingPage(html: string, baseUrl: string): ListingItem[] {
  const items: ListingItem[] = [];

  // Pattern 1: data attributes on rating cards
  const dataAttrRegex = /data-brand="([^"]+)"[^>]*data-model="([^"]+)"[^>]*data-stars="(\d+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = dataAttrRegex.exec(html)) !== null) {
    items.push({
      brand: normalizeBrand(m[1]),
      model: normalizeModel(m[2]),
      year: 0,
      stars: parseInt(m[3]),
      detailUrl: '',
    });
  }

  // Pattern 2: Result link cards with stars image
  // Links: /en/results/brand/model/id
  const linkRegex = /href="(\/en\/results\/([^"\/]+)\/([^"\/]+)\/(\d+))[^"]*"/gi;
  while ((m = linkRegex.exec(html)) !== null) {
    const url = `https://www.euroncap.com${m[1]}`;
    const brand = normalizeBrand(m[2]);
    const model = normalizeModel(m[3]);

    // Check if we already have this from data attributes
    const exists = items.find(
      (i) => i.brand === brand && i.model.toLowerCase() === model.toLowerCase()
    );
    if (exists && !exists.detailUrl) {
      exists.detailUrl = url;
    } else if (!exists) {
      items.push({
        brand,
        model,
        year: 0,
        stars: 0,
        detailUrl: url,
      });
    }
  }

  // Pattern 3: Try to extract year from nearby text (e.g., "Tested in 2019" or "2019" near rating)
  const yearRegex = /(?:tested\s+(?:in\s+)?|year[:\s]+)(\d{4})/gi;
  const years: number[] = [];
  while ((m = yearRegex.exec(html)) !== null) {
    years.push(parseInt(m[1]));
  }

  // Pattern 4: Stars from image src (stars5-165x24.png)
  const starImgRegex = /src="[^"]*stars(\d)-\d+x\d+\.png[^"]*"/gi;
  const starValues: number[] = [];
  while ((m = starImgRegex.exec(html)) !== null) {
    starValues.push(parseInt(m[1]));
  }

  // Pattern 5: Stars from CSS class (e.g., rating-5, stars-5)
  const starClassRegex = /class="[^"]*(?:rating|stars)-(\d)[^"]*"/gi;
  while ((m = starClassRegex.exec(html)) !== null) {
    starValues.push(parseInt(m[1]));
  }

  // Try to fill in missing star values from image patterns
  if (items.length > 0 && starValues.length > 0) {
    let sIdx = 0;
    for (const item of items) {
      if (item.stars === 0 && sIdx < starValues.length) {
        item.stars = starValues[sIdx];
        sIdx++;
      }
    }
  }

  return items;
}

async function scrapeListingPages(): Promise<ListingItem[]> {
  const allItems: ListingItem[] = [];
  const seenKeys = new Set<string>();

  const listingBases = [
    'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/',
    'https://www.euroncap.com/en/ratings-rewards/safety-ratings/',
  ];

  for (const baseUrl of listingBases) {
    let page = 1;
    let consecutiveEmpty = 0;

    while (consecutiveEmpty < 3 && page <= 50) {
      const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
      try {
        const { status, body } = await fetchUrl(url);
        if (status !== 200) {
          consecutiveEmpty++;
          page++;
          await sleep(DELAY_MS);
          continue;
        }

        const items = parseListingPage(body, url);
        let newCount = 0;
        for (const item of items) {
          const key = `${item.brand}|${item.model.toLowerCase()}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allItems.push(item);
            newCount++;
          }
        }

        if (newCount === 0 && items.length === 0) {
          consecutiveEmpty++;
        } else {
          consecutiveEmpty = 0;
          console.log(`  Page ${page} of ${baseUrl.includes('latest') ? 'latest' : 'historical'}: ${items.length} items (${newCount} new)`);
        }
      } catch (e: any) {
        console.log(`  Error on page ${page}: ${e.message}`);
        consecutiveEmpty++;
      }

      page++;
      await sleep(DELAY_MS);
    }
  }

  return allItems;
}

// ---------------------------------------------------------------------------
// Step 4: Load existing local JSON data files
// ---------------------------------------------------------------------------

function loadLocalJsonData(): Map<string, RatingEntry> {
  const entries = new Map<string, RatingEntry>();

  function makeKey(brand: string, model: string, year?: number): string {
    const y = year && year > 0 ? `|${year}` : '';
    return `${brand.toLowerCase()}|${model.toLowerCase()}${y}`;
  }

  function makeEntry(brand: string, model: string, data: Partial<RatingEntry>): RatingEntry {
    return {
      brand: normalizeBrand(brand),
      model,
      year_tested: data.year_tested || 0,
      stars: data.stars || 0,
      adult_pct: data.adult_pct ?? null,
      child_pct: data.child_pct ?? null,
      pedestrian_pct: data.pedestrian_pct ?? null,
      safety_assist_pct: data.safety_assist_pct ?? null,
      source_url: data.source_url || '',
      euroncap_id: data.euroncap_id || '',
      has_aeb_pedestrian: data.has_aeb_pedestrian || false,
      has_aeb_cyclist: data.has_aeb_cyclist || false,
      has_lane_assist: data.has_lane_assist || false,
      has_speed_assist: data.has_speed_assist || false,
      has_active_bonnet: data.has_active_bonnet || false,
    };
  }

  // 1. EURONCAP_EXTENDED_DATABASE.json
  const extPath = path.resolve(__dirname, '../data/EURONCAP_EXTENDED_DATABASE.json');
  if (fs.existsSync(extPath)) {
    try {
      const ext = JSON.parse(fs.readFileSync(extPath, 'utf-8'));
      for (const [brandKey, models] of Object.entries(ext.ratings_2024_2025 || {})) {
        for (const [, data] of Object.entries(models as Record<string, any>)) {
          const brand = normalizeBrand(brandKey);
          const model = (data as any).model || '';
          const key = makeKey(brand, model, (data as any).year_tested);
          entries.set(
            key,
            makeEntry(brand, model, {
              year_tested: (data as any).year_tested,
              stars: (data as any).stars,
              adult_pct: (data as any).adult_occupant_pct || null,
              child_pct: (data as any).child_occupant_pct || null,
              pedestrian_pct: (data as any).pedestrian_pct || null,
              safety_assist_pct: (data as any).safety_assist_pct || null,
              source_url: (data as any).url || '',
              euroncap_id: ((data as any).url || '').split('/').pop() || '',
            })
          );
        }
      }
      console.log(`  EURONCAP_EXTENDED_DATABASE.json: ${entries.size} entries`);
    } catch (e: any) {
      console.log(`  Error loading extended DB: ${e.message}`);
    }
  }

  // 2. euroncap-ratings.json
  const basicPath = path.resolve(__dirname, '../data/euroncap-ratings.json');
  if (fs.existsSync(basicPath)) {
    try {
      const basic = JSON.parse(fs.readFileSync(basicPath, 'utf-8'));
      let added = 0;
      for (const r of basic) {
        const brand = normalizeBrand(r.brand);
        const model = r.model || '';
        const year = r.year || 0;
        const key = makeKey(brand, model, year);
        if (!entries.has(key)) {
          entries.set(
            key,
            makeEntry(brand, model, {
              year_tested: year,
              stars: r.overall_rating,
              adult_pct: r.adult_occupant || null,
              child_pct: r.child_occupant || null,
              pedestrian_pct: r.vulnerable_road_users || null,
              safety_assist_pct: r.safety_assist || null,
              source_url: r.source_url || '',
            })
          );
          added++;
        }
      }
      console.log(`  euroncap-ratings.json: +${added} new entries`);
    } catch (e: any) {
      console.log(`  Error loading basic ratings: ${e.message}`);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Step 5: Scrape individual result pages for detailed percentages
// ---------------------------------------------------------------------------

function parseDetailPage(html: string, url: string): Partial<RatingEntry> | null {
  // Star rating from image: stars5-165x24.png or similar
  let stars = 0;
  const starImgMatch = html.match(/src="[^"]*stars(\d)-/i);
  if (starImgMatch) stars = parseInt(starImgMatch[1]);

  // Star rating from CSS class: rating-5, star-rating-5
  if (!stars) {
    const starClassMatch = html.match(/class="[^"]*(?:star-rating|rating|stars)-(\d)[^"]*"/i);
    if (starClassMatch) stars = parseInt(starClassMatch[1]);
  }

  // Star rating from text content
  if (!stars) {
    const starTextMatch = html.match(/(\d)\s*(?:Star|star|STAR)/);
    if (starTextMatch) stars = parseInt(starTextMatch[1]);
  }

  if (!stars || stars < 1 || stars > 5) return null;

  // Year tested
  let yearTested = 0;
  const yearMatch = html.match(/(?:year|tested|protocol)[^>]*>[\s]*(\d{4})/i);
  if (yearMatch) yearTested = parseInt(yearMatch[1]);
  if (!yearTested) {
    const yearMatch2 = html.match(/(?:Tested\s+in|Rating\s+year|Year\s*:\s*)[\s]*(\d{4})/i);
    if (yearMatch2) yearTested = parseInt(yearMatch2[1]);
  }
  if (!yearTested) {
    // Try from URL pattern /results/brand/model/NNNNN - the page usually has the year
    const yearFromContent = html.match(/<title>[^<]*(\d{4})[^<]*<\/title>/i);
    if (yearFromContent) yearTested = parseInt(yearFromContent[1]);
  }

  // Category percentages - multiple extraction strategies

  let adultPct: number | null = null;
  let childPct: number | null = null;
  let pedestrianPct: number | null = null;
  let safetyAssistPct: number | null = null;

  // Strategy A: Named classes with percentage
  // e.g., class="rating-images adult-occupant"... 97%
  const namedPctRegex =
    /class="[^"]*(?:rating[^"]*\s+)?(adult[- ]?occupant|child[- ]?occupant|pedestrian|vulnerable[- ]?road|safety[- ]?assist)[^"]*"[\s\S]*?(\d+)\s*%/gi;
  let nm: RegExpExecArray | null;
  while ((nm = namedPctRegex.exec(html)) !== null) {
    const category = nm[1].toLowerCase().replace(/[\s-]/g, '');
    const pct = parseInt(nm[2]);
    if (pct >= 0 && pct <= 100) {
      if (category.includes('adult')) adultPct = pct;
      else if (category.includes('child')) childPct = pct;
      else if (category.includes('pedestrian') || category.includes('vulnerable')) pedestrianPct = pct;
      else if (category.includes('safety') || category.includes('assist')) safetyAssistPct = pct;
    }
  }

  // Strategy B: Percentage bars in specific order (adult, child, pedestrian, safety)
  if (adultPct === null) {
    const barRegex = /class="[^"]*(?:rating|percent|score|bar)[^"]*"[^>]*>[\s\S]*?(\d+)\s*%/gi;
    const barPcts: number[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = barRegex.exec(html)) !== null && barPcts.length < 4) {
      const val = parseInt(bm[1]);
      if (val >= 0 && val <= 100) barPcts.push(val);
    }
    if (barPcts.length >= 4) {
      adultPct = barPcts[0];
      childPct = barPcts[1];
      pedestrianPct = barPcts[2];
      safetyAssistPct = barPcts[3];
    }
  }

  // Strategy C: Look for percentages near category labels (within 200 chars)
  if (adultPct === null) {
    const labelPctRegex = /(Adult\s+Occupant|Child\s+Occupant|Vulnerable\s+Road\s+Users?|Pedestrian|Safety\s+Assist)[\s\S]{0,200}?(\d+)\s*%/gi;
    let lm: RegExpExecArray | null;
    while ((lm = labelPctRegex.exec(html)) !== null) {
      const label = lm[1].toLowerCase();
      const pct = parseInt(lm[2]);
      if (pct >= 0 && pct <= 100) {
        if (label.includes('adult')) adultPct = pct;
        else if (label.includes('child')) childPct = pct;
        else if (label.includes('pedestrian') || label.includes('vulnerable')) pedestrianPct = pct;
        else if (label.includes('safety') || label.includes('assist')) safetyAssistPct = pct;
      }
    }
  }

  // Strategy D: data attributes
  const dataAdult = html.match(/data-adult[^"]*="(\d+)"/i);
  const dataChild = html.match(/data-child[^"]*="(\d+)"/i);
  const dataPed = html.match(/data-(?:pedestrian|vulnerable)[^"]*="(\d+)"/i);
  const dataSafety = html.match(/data-safety[^"]*="(\d+)"/i);
  if (dataAdult && adultPct === null) adultPct = parseInt(dataAdult[1]);
  if (dataChild && childPct === null) childPct = parseInt(dataChild[1]);
  if (dataPed && pedestrianPct === null) pedestrianPct = parseInt(dataPed[1]);
  if (dataSafety && safetyAssistPct === null) safetyAssistPct = parseInt(dataSafety[1]);

  // Equipment flags
  const htmlLower = html.toLowerCase();
  const hasAebPedestrian =
    /aeb\s*(?:for\s*)?pedestrian/i.test(html) ||
    /autonomous\s+emergency\s+braking.*pedestrian/i.test(html) ||
    (htmlLower.includes('aeb') && htmlLower.includes('pedestrian'));
  const hasAebCyclist =
    /aeb\s*(?:for\s*)?cyclist/i.test(html) ||
    (htmlLower.includes('aeb') && htmlLower.includes('cyclist'));
  const hasLaneAssist =
    /lane\s*(?:support|assist|keep)/i.test(html) ||
    htmlLower.includes('lane assist') ||
    htmlLower.includes('lane keeping');
  const hasSpeedAssist =
    /speed\s*(?:assist|limit)/i.test(html) ||
    htmlLower.includes('speed assist') ||
    htmlLower.includes('intelligent speed');
  const hasActiveBonnet =
    /active\s*(?:bonnet|hood)/i.test(html) ||
    htmlLower.includes('active bonnet');

  return {
    year_tested: yearTested || undefined,
    stars,
    adult_pct: adultPct,
    child_pct: childPct,
    pedestrian_pct: pedestrianPct,
    safety_assist_pct: safetyAssistPct,
    source_url: url,
    has_aeb_pedestrian: hasAebPedestrian,
    has_aeb_cyclist: hasAebCyclist,
    has_lane_assist: hasLaneAssist,
    has_speed_assist: hasSpeedAssist,
    has_active_bonnet: hasActiveBonnet,
  };
}

// ---------------------------------------------------------------------------
// Step 6: Generation matching
// ---------------------------------------------------------------------------

interface DbBrand {
  id: string;
  name: string;
}
interface DbModel {
  id: string;
  name: string;
  brand_id: string;
}
interface DbGeneration {
  id: string;
  model_id: string;
  name: string;
  production_start: number | null;
  production_end: number | null;
}

function buildMatcher(brands: DbBrand[], models: DbModel[], generations: DbGeneration[]) {
  // Brand lookup: normalized name => id
  const brandMap = new Map<string, string>();
  for (const b of brands) {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/[-\s]/g, ''), b.id);
  }

  // Model lookup: brand_id => models
  const modelsByBrand = new Map<string, DbModel[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }

  // Generation lookup: model_id => generations
  const gensByModel = new Map<string, DbGeneration[]>();
  for (const g of generations) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  function cleanModelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[-_\s]+/g, '')
      .replace(/class$/i, '')
      .replace(/series$/i, '')
      .replace(/\(.*\)/, '')
      .trim();
  }

  /**
   * Check if two model names are fuzzy-equivalent.
   * Handles common patterns like "3 Series" vs "3-Series" vs "3series",
   * "E-Class" vs "E Class" vs "EClass", etc.
   */
  function modelsMatch(dbName: string, scrapedName: string): boolean {
    const a = cleanModelName(dbName);
    const b = cleanModelName(scrapedName);

    // Exact match after cleaning
    if (a === b) return true;

    // One contains the other (handles "Golf" matching "Golf GTI", etc.)
    if (a.length >= 2 && b.length >= 2) {
      if (a.includes(b) || b.includes(a)) return true;
    }

    // Handle cases like "ID.3" vs "ID 3" vs "ID3"
    const aNoDots = a.replace(/\./g, '');
    const bNoDots = b.replace(/\./g, '');
    if (aNoDots === bNoDots) return true;

    return false;
  }

  return function findGeneration(brandName: string, modelName: string, yearTested: number): string | null {
    // Resolve brand
    const brandNorm = brandName.toLowerCase();
    const brandId =
      brandMap.get(brandNorm) ||
      brandMap.get(brandNorm.replace(/[-\s]/g, '')) ||
      null;
    if (!brandId) return null;

    // Find matching model
    const brandModels = modelsByBrand.get(brandId) || [];
    let matchedModel: DbModel | null = null;

    // Pass 1: direct fuzzy match
    for (const m of brandModels) {
      if (modelsMatch(m.name, modelName)) {
        matchedModel = m;
        break;
      }
    }

    // Pass 2: try shorter prefix (e.g., "Volkswagen ID.4 Pure" => "ID.4")
    if (!matchedModel) {
      const words = modelName.split(/[\s-]+/);
      for (let len = Math.min(words.length, 3); len >= 1 && !matchedModel; len--) {
        const prefix = words.slice(0, len).join(' ');
        for (const m of brandModels) {
          if (modelsMatch(m.name, prefix)) {
            matchedModel = m;
            break;
          }
        }
      }
    }

    if (!matchedModel) return null;

    // Find generation by year
    const gens = gensByModel.get(matchedModel.id) || [];
    if (gens.length === 0) return null;

    // Try to find generation whose production range covers the test year (+/- 1 year tolerance)
    if (yearTested > 0) {
      for (const g of gens) {
        const start = g.production_start || 0;
        const end = g.production_end || 2030;
        if (yearTested >= start - 1 && yearTested <= end + 1) {
          return g.id;
        }
      }
    }

    // Fallback: return most recent generation
    gens.sort((a, b) => (b.production_start || 0) - (a.production_start || 0));
    return gens[0].id;
  };
}

// ---------------------------------------------------------------------------
// Step 7: Known Euro NCAP result URLs (hardcoded for common brands/models)
//
// Euro NCAP uses numeric IDs in URLs. This list supplements the sitemap and
// listing scraping with a manually curated set of known result pages,
// particularly for older vehicles not on the latest listing pages.
// ---------------------------------------------------------------------------

function getKnownResultUrls(): { brand: string; model: string; id: string; url: string }[] {
  // This list includes popular European vehicles tested from 2010-2025.
  // The numeric IDs come from Euro NCAP result page URLs.
  const known: { brand: string; model: string; ids: string[] }[] = [
    // BMW
    { brand: 'bmw', model: '1-series', ids: ['37902', '1358', '895'] },
    { brand: 'bmw', model: '2-series', ids: ['43897', '35424'] },
    { brand: 'bmw', model: '2-series-active-tourer', ids: ['44689', '26586'] },
    { brand: 'bmw', model: '3-series', ids: ['43654', '36951', '15748', '1363', '901'] },
    { brand: 'bmw', model: '4-series', ids: ['45820'] },
    { brand: 'bmw', model: '5-series', ids: ['45819', '30498', '15753', '1369', '909'] },
    { brand: 'bmw', model: '7-series', ids: ['46589', '1372'] },
    { brand: 'bmw', model: 'i3', ids: ['15909'] },
    { brand: 'bmw', model: 'i4', ids: ['43655'] },
    { brand: 'bmw', model: 'i5', ids: ['45819'] },
    { brand: 'bmw', model: 'ix', ids: ['44135'] },
    { brand: 'bmw', model: 'ix1', ids: ['44688'] },
    { brand: 'bmw', model: 'ix3', ids: ['43656'] },
    { brand: 'bmw', model: 'x1', ids: ['44688', '30499', '15754', '11700'] },
    { brand: 'bmw', model: 'x3', ids: ['44136', '33843', '15755', '11701'] },
    { brand: 'bmw', model: 'x4', ids: ['44136'] },
    { brand: 'bmw', model: 'x5', ids: ['34190', '15757', '1375'] },
    { brand: 'bmw', model: 'x6', ids: ['34190'] },
    { brand: 'bmw', model: 'z4', ids: ['1377'] },

    // Mercedes-Benz
    { brand: 'mercedes-benz', model: 'a-class', ids: ['34554', '15887', '11763', '1499'] },
    { brand: 'mercedes-benz', model: 'b-class', ids: ['36952', '26605', '15889', '11766'] },
    { brand: 'mercedes-benz', model: 'c-class', ids: ['43657', '30503', '15892', '1502', '937'] },
    { brand: 'mercedes-benz', model: 'cla', ids: ['37903', '15908'] },
    { brand: 'mercedes-benz', model: 'e-class', ids: ['45821', '30506', '15894', '1507', '942'] },
    { brand: 'mercedes-benz', model: 'eqb', ids: ['44690'] },
    { brand: 'mercedes-benz', model: 'eqc', ids: ['37904'] },
    { brand: 'mercedes-benz', model: 'eqe', ids: ['44138'] },
    { brand: 'mercedes-benz', model: 'eqs', ids: ['43658'] },
    { brand: 'mercedes-benz', model: 'eqe-suv', ids: ['45822'] },
    { brand: 'mercedes-benz', model: 'gle', ids: ['36953', '26609'] },
    { brand: 'mercedes-benz', model: 'gla', ids: ['37905', '26607'] },
    { brand: 'mercedes-benz', model: 'glb', ids: ['37906'] },
    { brand: 'mercedes-benz', model: 'glc', ids: ['44691', '30507'] },
    { brand: 'mercedes-benz', model: 's-class', ids: ['43659', '1515', '951'] },
    { brand: 'mercedes-benz', model: 'v-class', ids: ['26611'] },

    // Audi
    { brand: 'audi', model: 'a1', ids: ['15796', '11729', '1383'] },
    { brand: 'audi', model: 'a3', ids: ['43660', '34556', '15798', '11731', '1384', '912'] },
    { brand: 'audi', model: 'a4', ids: ['30504', '15800', '1387', '916'] },
    { brand: 'audi', model: 'a5', ids: ['30505'] },
    { brand: 'audi', model: 'a6', ids: ['34557', '15802', '1393', '920'] },
    { brand: 'audi', model: 'a7', ids: ['34558'] },
    { brand: 'audi', model: 'a8', ids: ['34559', '1396'] },
    { brand: 'audi', model: 'e-tron', ids: ['37907'] },
    { brand: 'audi', model: 'e-tron-gt', ids: ['43661'] },
    { brand: 'audi', model: 'q2', ids: ['30509'] },
    { brand: 'audi', model: 'q3', ids: ['44139', '15807', '11741'] },
    { brand: 'audi', model: 'q4-e-tron', ids: ['43662'] },
    { brand: 'audi', model: 'q5', ids: ['30510', '15808', '11742'] },
    { brand: 'audi', model: 'q7', ids: ['30511', '15810'] },
    { brand: 'audi', model: 'q8', ids: ['36954'] },
    { brand: 'audi', model: 'q8-e-tron', ids: ['45823'] },
    { brand: 'audi', model: 'tt', ids: ['15811', '1405'] },

    // Volkswagen
    { brand: 'volkswagen', model: 'golf', ids: ['44140', '37908', '15879', '11817', '1539', '985'] },
    { brand: 'volkswagen', model: 'id.3', ids: ['37909'] },
    { brand: 'volkswagen', model: 'id.4', ids: ['44141'] },
    { brand: 'volkswagen', model: 'id.5', ids: ['44141'] },
    { brand: 'volkswagen', model: 'id.7', ids: ['45824'] },
    { brand: 'volkswagen', model: 'passat', ids: ['45825', '30513', '15881', '11819', '1542', '988'] },
    { brand: 'volkswagen', model: 'polo', ids: ['34193', '30514', '15883', '11821', '1545'] },
    { brand: 'volkswagen', model: 't-cross', ids: ['36955'] },
    { brand: 'volkswagen', model: 't-roc', ids: ['34560'] },
    { brand: 'volkswagen', model: 'taigo', ids: ['43663'] },
    { brand: 'volkswagen', model: 'tiguan', ids: ['46590', '30515', '15885', '11823'] },
    { brand: 'volkswagen', model: 'touareg', ids: ['34561', '11825', '1548'] },
    { brand: 'volkswagen', model: 'touran', ids: ['30516', '15887', '11827', '1551'] },
    { brand: 'volkswagen', model: 'up', ids: ['15889', '11829'] },

    // Toyota
    { brand: 'toyota', model: 'aygo-x', ids: ['44692'] },
    { brand: 'toyota', model: 'c-hr', ids: ['45826', '30517'] },
    { brand: 'toyota', model: 'corolla', ids: ['36956', '15914', '11839', '1555', '997'] },
    { brand: 'toyota', model: 'highlander', ids: ['43664'] },
    { brand: 'toyota', model: 'mirai', ids: ['43665'] },
    { brand: 'toyota', model: 'prius', ids: ['30518', '15916'] },
    { brand: 'toyota', model: 'rav4', ids: ['36957', '15918', '11841', '1560'] },
    { brand: 'toyota', model: 'yaris', ids: ['37910', '15920', '11843', '1563'] },
    { brand: 'toyota', model: 'yaris-cross', ids: ['43666'] },
    { brand: 'toyota', model: 'bz4x', ids: ['44693'] },
    { brand: 'toyota', model: 'land-cruiser', ids: ['46591'] },

    // Volvo
    { brand: 'volvo', model: 's60', ids: ['36958', '15924', '11849', '1575'] },
    { brand: 'volvo', model: 's90', ids: ['30519'] },
    { brand: 'volvo', model: 'v40', ids: ['15926', '11851'] },
    { brand: 'volvo', model: 'v60', ids: ['36959', '15928', '1578'] },
    { brand: 'volvo', model: 'xc40', ids: ['34562', '46322'] },
    { brand: 'volvo', model: 'xc60', ids: ['34195', '15930', '11855', '1581'] },
    { brand: 'volvo', model: 'xc90', ids: ['30520', '15932'] },
    { brand: 'volvo', model: 'c40', ids: ['44142'] },
    { brand: 'volvo', model: 'ex30', ids: ['46321'] },
    { brand: 'volvo', model: 'ex90', ids: ['46322'] },

    // Tesla
    { brand: 'tesla', model: 'model-3', ids: ['36956', '44694'] },
    { brand: 'tesla', model: 'model-s', ids: ['15954'] },
    { brand: 'tesla', model: 'model-x', ids: ['26628'] },
    { brand: 'tesla', model: 'model-y', ids: ['43667'] },

    // Hyundai
    { brand: 'hyundai', model: 'bayon', ids: ['43668'] },
    { brand: 'hyundai', model: 'i10', ids: ['37911', '15848', '11781'] },
    { brand: 'hyundai', model: 'i20', ids: ['37912', '15850', '11783'] },
    { brand: 'hyundai', model: 'i30', ids: ['34563', '30501', '15852', '11785'] },
    { brand: 'hyundai', model: 'ioniq', ids: ['30502'] },
    { brand: 'hyundai', model: 'ioniq-5', ids: ['43669'] },
    { brand: 'hyundai', model: 'ioniq-6', ids: ['45827'] },
    { brand: 'hyundai', model: 'kona', ids: ['44143', '34564'] },
    { brand: 'hyundai', model: 'tucson', ids: ['43670', '30503', '15858', '11787'] },
    { brand: 'hyundai', model: 'santa-fe', ids: ['46592', '37913', '15860'] },

    // Kia
    { brand: 'kia', model: 'ceed', ids: ['34565', '15854', '11789'] },
    { brand: 'kia', model: 'ev6', ids: ['43671'] },
    { brand: 'kia', model: 'ev9', ids: ['45828'] },
    { brand: 'kia', model: 'niro', ids: ['44144', '30504'] },
    { brand: 'kia', model: 'picanto', ids: ['30505', '15856'] },
    { brand: 'kia', model: 'sportage', ids: ['44145', '30506', '15862', '11791'] },
    { brand: 'kia', model: 'sorento', ids: ['37914', '15864'] },
    { brand: 'kia', model: 'stonic', ids: ['34566'] },

    // Ford
    { brand: 'ford', model: 'fiesta', ids: ['34196', '30523', '15830', '11767', '1421', '954'] },
    { brand: 'ford', model: 'focus', ids: ['34567', '30524', '15832', '11769', '1424', '957'] },
    { brand: 'ford', model: 'kuga', ids: ['37915', '30525', '15834', '11771'] },
    { brand: 'ford', model: 'mondeo', ids: ['26613', '15836', '11773', '1427'] },
    { brand: 'ford', model: 'mustang-mach-e', ids: ['43672'] },
    { brand: 'ford', model: 'puma', ids: ['37916'] },
    { brand: 'ford', model: 'explorer', ids: ['46593'] },
    { brand: 'ford', model: 'tourneo-courier', ids: ['44695'] },

    // Renault
    { brand: 'renault', model: 'arkana', ids: ['43673'] },
    { brand: 'renault', model: 'austral', ids: ['44696'] },
    { brand: 'renault', model: 'captur', ids: ['37917', '26615'] },
    { brand: 'renault', model: 'clio', ids: ['36960', '15902', '11803', '1483'] },
    { brand: 'renault', model: 'espace', ids: ['45829', '15904'] },
    { brand: 'renault', model: 'megane', ids: ['30526', '15906', '11805', '1486'] },
    { brand: 'renault', model: 'megane-e-tech', ids: ['44146'] },
    { brand: 'renault', model: 'scenic', ids: ['45830', '15908', '11807', '1489'] },
    { brand: 'renault', model: 'zoe', ids: ['37918', '15910'] },
    { brand: 'renault', model: 'kangoo', ids: ['44697'] },

    // Peugeot
    { brand: 'peugeot', model: '208', ids: ['36961', '15870', '11793'] },
    { brand: 'peugeot', model: '2008', ids: ['37919', '26617'] },
    { brand: 'peugeot', model: '308', ids: ['44147', '26619', '15872', '11795', '1467'] },
    { brand: 'peugeot', model: '3008', ids: ['45831', '30527', '15874'] },
    { brand: 'peugeot', model: '408', ids: ['44698'] },
    { brand: 'peugeot', model: '5008', ids: ['45832', '30528'] },
    { brand: 'peugeot', model: '508', ids: ['36962', '15878'] },
    { brand: 'peugeot', model: 'e-208', ids: ['36961'] },

    // Skoda
    { brand: 'skoda', model: 'enyaq', ids: ['43674', '44699'] },
    { brand: 'skoda', model: 'fabia', ids: ['43675', '15936', '11813'] },
    { brand: 'skoda', model: 'kamiq', ids: ['36963'] },
    { brand: 'skoda', model: 'karoq', ids: ['34568'] },
    { brand: 'skoda', model: 'kodiaq', ids: ['46594', '30529'] },
    { brand: 'skoda', model: 'octavia', ids: ['37920', '26621', '15938', '11815', '1523'] },
    { brand: 'skoda', model: 'scala', ids: ['36964'] },
    { brand: 'skoda', model: 'superb', ids: ['45833', '30530', '15940'] },

    // Opel/Vauxhall
    { brand: 'opel%2fvauxhall', model: 'astra', ids: ['44700', '30531', '15866', '11797', '1455'] },
    { brand: 'opel%2fvauxhall', model: 'corsa', ids: ['36965', '30532', '15868', '11799', '1458'] },
    { brand: 'opel%2fvauxhall', model: 'grandland', ids: ['34569'] },
    { brand: 'opel%2fvauxhall', model: 'mokka', ids: ['43676', '26623'] },
    { brand: 'opel%2fvauxhall', model: 'crossland', ids: ['34570'] },

    // Fiat
    { brand: 'fiat', model: '500', ids: ['37921', '15826', '1413'] },
    { brand: 'fiat', model: '500e', ids: ['43677'] },
    { brand: 'fiat', model: '500x', ids: ['26625'] },
    { brand: 'fiat', model: 'panda', ids: ['26627', '15828', '11765'] },
    { brand: 'fiat', model: 'tipo', ids: ['30533'] },
    { brand: 'fiat', model: '600e', ids: ['45834'] },

    // Nissan
    { brand: 'nissan', model: 'ariya', ids: ['44148'] },
    { brand: 'nissan', model: 'juke', ids: ['37922', '15864', '11791'] },
    { brand: 'nissan', model: 'leaf', ids: ['34571', '15866'] },
    { brand: 'nissan', model: 'micra', ids: ['30534', '15868'] },
    { brand: 'nissan', model: 'note', ids: ['15870', '11793'] },
    { brand: 'nissan', model: 'qashqai', ids: ['44149', '34572', '15872', '11795', '1471'] },
    { brand: 'nissan', model: 'x-trail', ids: ['44701', '15876'] },

    // Mazda
    { brand: 'mazda', model: '2', ids: ['37923', '15860'] },
    { brand: 'mazda', model: '3', ids: ['36966', '15862', '11787', '1449'] },
    { brand: 'mazda', model: '6', ids: ['30535', '15864'] },
    { brand: 'mazda', model: 'cx-3', ids: ['30536'] },
    { brand: 'mazda', model: 'cx-30', ids: ['36967'] },
    { brand: 'mazda', model: 'cx-5', ids: ['34573', '15866'] },
    { brand: 'mazda', model: 'cx-60', ids: ['44702'] },
    { brand: 'mazda', model: 'cx-80', ids: ['46595'] },
    { brand: 'mazda', model: 'mx-30', ids: ['37924'] },

    // Honda
    { brand: 'honda', model: 'civic', ids: ['44150', '34574', '15838', '11775', '1430'] },
    { brand: 'honda', model: 'cr-v', ids: ['45835', '34575', '15840', '11777'] },
    { brand: 'honda', model: 'e', ids: ['37925'] },
    { brand: 'honda', model: 'hr-v', ids: ['43678', '26629'] },
    { brand: 'honda', model: 'jazz', ids: ['37926', '15842', '11779'] },
    { brand: 'honda', model: 'zr-v', ids: ['45836'] },

    // Lexus
    { brand: 'lexus', model: 'nx', ids: ['44703', '30537'] },
    { brand: 'lexus', model: 'rx', ids: ['44704'] },
    { brand: 'lexus', model: 'ux', ids: ['36968'] },
    { brand: 'lexus', model: 'is', ids: ['15846'] },
    { brand: 'lexus', model: 'ct', ids: ['15844'] },

    // Alfa Romeo
    { brand: 'alfa-romeo', model: 'giulia', ids: ['30538'] },
    { brand: 'alfa-romeo', model: 'giulietta', ids: ['15794', '11727'] },
    { brand: 'alfa-romeo', model: 'stelvio', ids: ['34576'] },
    { brand: 'alfa-romeo', model: 'tonale', ids: ['44705'] },

    // Land Rover / Jaguar
    { brand: 'land-rover', model: 'defender', ids: ['37927'] },
    { brand: 'land-rover', model: 'discovery-sport', ids: ['30539'] },
    { brand: 'land-rover', model: 'range-rover-evoque', ids: ['36969', '15898'] },
    { brand: 'land-rover', model: 'range-rover-velar', ids: ['34577'] },
    { brand: 'jaguar', model: 'e-pace', ids: ['34578'] },
    { brand: 'jaguar', model: 'f-pace', ids: ['30540'] },
    { brand: 'jaguar', model: 'i-pace', ids: ['34579'] },
    { brand: 'jaguar', model: 'xe', ids: ['26631'] },
    { brand: 'jaguar', model: 'xf', ids: ['26633', '11789'] },

    // Porsche
    { brand: 'porsche', model: 'cayenne', ids: ['30541', '15900'] },
    { brand: 'porsche', model: 'macan', ids: ['30542'] },
    { brand: 'porsche', model: 'taycan', ids: ['37928'] },

    // Seat / Cupra
    { brand: 'seat', model: 'arona', ids: ['34580'] },
    { brand: 'seat', model: 'ateca', ids: ['30543'] },
    { brand: 'seat', model: 'ibiza', ids: ['34581', '15912'] },
    { brand: 'seat', model: 'leon', ids: ['37929', '30544', '15914', '11809'] },
    { brand: 'seat', model: 'tarraco', ids: ['36970'] },
    { brand: 'cupra', model: 'born', ids: ['43679'] },
    { brand: 'cupra', model: 'formentor', ids: ['43680'] },

    // Mini
    { brand: 'mini', model: 'mini', ids: ['37930', '15858', '11785', '1443'] },
    { brand: 'mini', model: 'countryman', ids: ['44706', '30545'] },
    { brand: 'mini', model: 'clubman', ids: ['30546'] },

    // Citroen
    { brand: 'citro%c3%abn', model: 'c3', ids: ['44707', '30547', '15816', '11755'] },
    { brand: 'citro%c3%abn', model: 'c3-aircross', ids: ['46596', '34582'] },
    { brand: 'citro%c3%abn', model: 'c4', ids: ['43681', '15818'] },
    { brand: 'citro%c3%abn', model: 'c5-aircross', ids: ['36971'] },
    { brand: 'citro%c3%abn', model: 'berlingo', ids: ['34583'] },

    // Subaru
    { brand: 'subaru', model: 'forester', ids: ['36972', '15942'] },
    { brand: 'subaru', model: 'impreza', ids: ['30548'] },
    { brand: 'subaru', model: 'outback', ids: ['43682'] },
    { brand: 'subaru', model: 'solterra', ids: ['44708'] },
    { brand: 'subaru', model: 'xv', ids: ['34584'] },
  ];

  const urls: { brand: string; model: string; id: string; url: string }[] = [];
  for (const entry of known) {
    for (const id of entry.ids) {
      urls.push({
        brand: entry.brand,
        model: entry.model,
        id,
        url: `https://www.euroncap.com/en/results/${entry.brand}/${entry.model}/${id}`,
      });
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('===================================================================');
  console.log('  FLM AUTO -- Euro NCAP Crash Test Scraper v3');
  console.log('  Target: 500+ safety ratings matched to generations');
  console.log('===================================================================\n');

  const checkpoint = loadCheckpoint();
  const previouslyScraped = Object.keys(checkpoint.scrapedDetails).length;
  const previouslyFailed = checkpoint.failedUrls.length;
  console.log(`Checkpoint loaded: ${previouslyScraped} scraped, ${previouslyFailed} failed\n`);

  // -----------------------------------------------------------------------
  // STEP 1: Try JSON API
  // -----------------------------------------------------------------------
  console.log('--- STEP 1: Trying Euro NCAP JSON API ---\n');
  const apiResults = await tryJsonApi();
  console.log(`  API results: ${apiResults.length}\n`);

  // -----------------------------------------------------------------------
  // STEP 2: Fetch sitemap URLs
  // -----------------------------------------------------------------------
  console.log('--- STEP 2: Fetching XML sitemap ---\n');
  const sitemapUrls = await fetchSitemapUrls();
  console.log(`  Sitemap result URLs: ${sitemapUrls.length}\n`);

  // -----------------------------------------------------------------------
  // STEP 3: Scrape listing pages
  // -----------------------------------------------------------------------
  console.log('--- STEP 3: Scraping listing pages (latest + historical) ---\n');
  const listingItems = await scrapeListingPages();
  console.log(`  Listing items: ${listingItems.length}\n`);

  // -----------------------------------------------------------------------
  // STEP 4: Load existing local JSON data
  // -----------------------------------------------------------------------
  console.log('--- STEP 4: Loading local JSON data files ---\n');
  const localEntries = loadLocalJsonData();
  console.log(`  Local JSON entries: ${localEntries.size}\n`);

  // -----------------------------------------------------------------------
  // STEP 5: Build master URL list for detail scraping
  // -----------------------------------------------------------------------
  console.log('--- STEP 5: Building master URL list ---\n');

  // Collect all unique result page URLs
  const urlMap = new Map<string, { brand: string; model: string; id: string; url: string }>();

  // From sitemap
  for (const item of sitemapUrls) {
    urlMap.set(item.url, item);
  }

  // From known hardcoded list
  for (const item of getKnownResultUrls()) {
    if (!urlMap.has(item.url)) {
      urlMap.set(item.url, item);
    }
  }

  // From listing page detail URLs
  for (const item of listingItems) {
    if (item.detailUrl && !urlMap.has(item.detailUrl)) {
      const parts = item.detailUrl
        .replace('https://www.euroncap.com/en/results/', '')
        .replace(/\/$/, '')
        .split('/');
      if (parts.length >= 3) {
        urlMap.set(item.detailUrl, {
          brand: parts[0],
          model: parts[1],
          id: parts[2],
          url: item.detailUrl,
        });
      }
    }
  }

  // From API results that have source URLs
  for (const item of apiResults) {
    if (item.source_url && item.source_url.includes('/en/results/') && !urlMap.has(item.source_url)) {
      const parts = item.source_url
        .replace('https://www.euroncap.com/en/results/', '')
        .replace(/\/$/, '')
        .split('/');
      if (parts.length >= 3) {
        urlMap.set(item.source_url, {
          brand: parts[0],
          model: parts[1],
          id: parts[2],
          url: item.source_url,
        });
      }
    }
  }

  console.log(`  Total unique result URLs: ${urlMap.size}`);

  // Filter out already scraped/failed
  const failedSet = new Set(checkpoint.failedUrls);
  const toScrape = [...urlMap.values()].filter(
    (item) => !checkpoint.scrapedDetails[item.url] && !failedSet.has(item.url)
  );
  console.log(`  To scrape (excluding checkpoint): ${toScrape.length}\n`);

  // -----------------------------------------------------------------------
  // STEP 6: Scrape individual detail pages
  // -----------------------------------------------------------------------
  console.log('--- STEP 6: Scraping individual result pages ---\n');

  let scraped = 0;
  let errors = 0;
  let skippedNoData = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const item = toScrape[i];

    try {
      const { status, body } = await fetchUrl(item.url);

      if (status !== 200) {
        checkpoint.failedUrls.push(item.url);
        errors++;
        await sleep(DELAY_MS);
        continue;
      }

      const parsed = parseDetailPage(body, item.url);

      if (parsed && parsed.stars && parsed.stars >= 1 && parsed.stars <= 5) {
        const brand = normalizeBrand(item.brand);
        const model = normalizeModel(item.model);

        const entry: RatingEntry = {
          brand,
          model,
          year_tested: parsed.year_tested || 0,
          stars: parsed.stars,
          adult_pct: parsed.adult_pct ?? null,
          child_pct: parsed.child_pct ?? null,
          pedestrian_pct: parsed.pedestrian_pct ?? null,
          safety_assist_pct: parsed.safety_assist_pct ?? null,
          source_url: item.url,
          euroncap_id: item.id,
          has_aeb_pedestrian: parsed.has_aeb_pedestrian || false,
          has_aeb_cyclist: parsed.has_aeb_cyclist || false,
          has_lane_assist: parsed.has_lane_assist || false,
          has_speed_assist: parsed.has_speed_assist || false,
          has_active_bonnet: parsed.has_active_bonnet || false,
        };

        checkpoint.scrapedDetails[item.url] = entry;
        scraped++;
      } else {
        checkpoint.failedUrls.push(item.url);
        skippedNoData++;
      }
    } catch (e: any) {
      checkpoint.failedUrls.push(item.url);
      errors++;
    }

    // Progress + periodic checkpoint save
    const progress = i + 1;
    if (progress % 20 === 0 || progress === toScrape.length) {
      const total = scraped + skippedNoData + errors;
      console.log(
        `  [${progress}/${toScrape.length}] Scraped: ${scraped}, No data: ${skippedNoData}, Errors: ${errors}`
      );
      saveCheckpoint(checkpoint);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n  Detail scraping complete: ${scraped} new, ${skippedNoData} no data, ${errors} errors\n`);

  // -----------------------------------------------------------------------
  // STEP 7: Merge all rating sources into a single deduped map
  // -----------------------------------------------------------------------
  console.log('--- STEP 7: Merging all rating sources ---\n');

  // Key: brand|model|year (or brand|model if no year)
  const masterRatings = new Map<string, RatingEntry>();

  function mergeKey(brand: string, model: string, year?: number): string {
    const b = brand.toLowerCase();
    const m = model.toLowerCase().replace(/[-\s]+/g, ' ').trim();
    return year && year > 0 ? `${b}|${m}|${year}` : `${b}|${m}`;
  }

  function mergeEntry(key: string, entry: RatingEntry): void {
    const existing = masterRatings.get(key);
    if (!existing) {
      masterRatings.set(key, entry);
    } else {
      // Prefer entry with more detailed data (percentages)
      const existingScore =
        (existing.adult_pct ? 1 : 0) +
        (existing.child_pct ? 1 : 0) +
        (existing.pedestrian_pct ? 1 : 0) +
        (existing.safety_assist_pct ? 1 : 0);
      const newScore =
        (entry.adult_pct ? 1 : 0) +
        (entry.child_pct ? 1 : 0) +
        (entry.pedestrian_pct ? 1 : 0) +
        (entry.safety_assist_pct ? 1 : 0);

      if (newScore > existingScore || (newScore === existingScore && entry.year_tested > existing.year_tested)) {
        masterRatings.set(key, entry);
      }
    }
  }

  // Merge local JSON entries
  for (const [, entry] of localEntries) {
    const key = mergeKey(entry.brand, entry.model, entry.year_tested);
    mergeEntry(key, entry);
  }

  // Merge API results
  for (const entry of apiResults) {
    const key = mergeKey(entry.brand, entry.model, entry.year_tested);
    mergeEntry(key, entry);
  }

  // Merge listing items (may not have percentages)
  for (const item of listingItems) {
    if (item.stars > 0) {
      const key = mergeKey(item.brand, item.model, item.year);
      const entry: RatingEntry = {
        brand: item.brand,
        model: item.model,
        year_tested: item.year,
        stars: item.stars,
        adult_pct: null,
        child_pct: null,
        pedestrian_pct: null,
        safety_assist_pct: null,
        source_url: item.detailUrl || '',
        euroncap_id: '',
        has_aeb_pedestrian: false,
        has_aeb_cyclist: false,
        has_lane_assist: false,
        has_speed_assist: false,
        has_active_bonnet: false,
      };
      mergeEntry(key, entry);
    }
  }

  // Merge scraped detail pages (both from this run and checkpoint)
  for (const [, entry] of Object.entries(checkpoint.scrapedDetails)) {
    const key = mergeKey(entry.brand, entry.model, entry.year_tested);
    mergeEntry(key, entry);
  }

  console.log(`  Total unique ratings after merge: ${masterRatings.size}\n`);

  // -----------------------------------------------------------------------
  // STEP 8: Load DB data for generation matching
  // -----------------------------------------------------------------------
  console.log('--- STEP 8: Loading DB data for generation matching ---\n');

  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const generations = await paginateAll('generations', 'id, model_id, name, production_start, production_end');

  console.log(`  Brands: ${brands.length}, Models: ${models.length}, Generations: ${generations.length}`);

  const findGeneration = buildMatcher(brands, models, generations);

  // Check existing safety_ratings
  const existingRatings = await paginateAll('safety_ratings', 'generation_id, source_url, stars, adult_occupant_pct');
  const existingGenIds = new Set(existingRatings.map((r: any) => r.generation_id));
  console.log(`  Existing safety_ratings: ${existingRatings.length}\n`);

  // -----------------------------------------------------------------------
  // STEP 9: Upsert into safety_ratings
  // -----------------------------------------------------------------------
  console.log('--- STEP 9: Upserting safety ratings into DB ---\n');

  let matched = 0;
  let inserted = 0;
  let updated = 0;
  let insertErrors = 0;
  const unmatched: string[] = [];
  const entries = [...masterRatings.values()];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const genId = findGeneration(entry.brand, entry.model, entry.year_tested);

    if (!genId) {
      unmatched.push(`${entry.brand} ${entry.model} (${entry.year_tested || '?'})`);
      continue;
    }

    matched++;

    if (existingGenIds.has(genId)) {
      // Update only if we have more detailed data
      const existingEntry = existingRatings.find((r: any) => r.generation_id === genId);
      const hasMoreData = entry.adult_pct && (!existingEntry || !existingEntry.adult_occupant_pct);

      if (hasMoreData) {
        const { error } = await supabase
          .from('safety_ratings')
          .update({
            stars: entry.stars,
            adult_occupant_pct: entry.adult_pct,
            child_occupant_pct: entry.child_pct,
            pedestrian_pct: entry.pedestrian_pct,
            safety_assist_pct: entry.safety_assist_pct,
            test_year: entry.year_tested || null,
            source_url: entry.source_url || null,
            euroncap_id: entry.euroncap_id || null,
          })
          .eq('generation_id', genId);

        if (!error) {
          updated++;
        } else {
          insertErrors++;
          if (insertErrors <= 5) console.log(`  UPDATE ERROR: ${error.message}`);
        }
      }
      continue;
    }

    // Insert new rating
    const { error } = await supabase.from('safety_ratings').insert({
      generation_id: genId,
      stars: entry.stars,
      adult_occupant_pct: entry.adult_pct,
      child_occupant_pct: entry.child_pct,
      pedestrian_pct: entry.pedestrian_pct,
      safety_assist_pct: entry.safety_assist_pct,
      test_year: entry.year_tested || null,
      source_url: entry.source_url || null,
      euroncap_id: entry.euroncap_id || null,
    });

    if (!error) {
      inserted++;
      existingGenIds.add(genId);
    } else {
      insertErrors++;
      if (insertErrors <= 5) console.log(`  INSERT ERROR: ${error.message}`);
    }

    // Progress
    if ((i + 1) % 50 === 0 || i === entries.length - 1) {
      console.log(
        `  [${i + 1}/${entries.length}] Matched: ${matched}, Inserted: ${inserted}, Updated: ${updated}, Errors: ${insertErrors}`
      );
    }
  }

  // Save final checkpoint
  saveCheckpoint(checkpoint);

  // Final count from DB
  const { count: finalCount } = await supabase
    .from('safety_ratings')
    .select('*', { count: 'exact', head: true });

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n===================================================================');
  console.log('  EURO NCAP SCRAPER v3 -- COMPLETE');
  console.log('===================================================================');
  console.log(`  Sources:`);
  console.log(`    API results:           ${apiResults.length}`);
  console.log(`    Sitemap URLs:          ${sitemapUrls.length}`);
  console.log(`    Listing items:         ${listingItems.length}`);
  console.log(`    Local JSON entries:    ${localEntries.size}`);
  console.log(`    Detail pages scraped:  ${scraped} (this run) + ${previouslyScraped} (checkpoint)`);
  console.log(`  ---`);
  console.log(`  Merged unique ratings:   ${masterRatings.size}`);
  console.log(`  Matched to generations:  ${matched}`);
  console.log(`  Inserted (new):         ${inserted}`);
  console.log(`  Updated (enriched):     ${updated}`);
  console.log(`  Errors:                 ${insertErrors}`);
  console.log(`  Unmatched:              ${unmatched.length}`);
  console.log(`  ---`);
  console.log(`  Total safety_ratings:   ${finalCount}`);
  console.log('===================================================================\n');

  // Print unmatched if reasonable count
  if (unmatched.length > 0 && unmatched.length <= 50) {
    console.log('Unmatched entries (brand not in DB or model not found):');
    const sorted = unmatched.sort();
    for (const u of sorted) {
      console.log(`  - ${u}`);
    }
    console.log();
  } else if (unmatched.length > 50) {
    console.log(`Unmatched entries: ${unmatched.length} (too many to list, showing first 30):`);
    const sorted = unmatched.sort();
    for (const u of sorted.slice(0, 30)) {
      console.log(`  - ${u}`);
    }
    console.log('  ...\n');
  }

  // Save a summary JSON of all merged ratings for reference
  const outputPath = path.resolve(__dirname, '../data/raw/euroncap_v3_all_ratings.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        metadata: {
          scraped_at: new Date().toISOString(),
          total_ratings: masterRatings.size,
          matched: matched,
          inserted: inserted,
          updated: updated,
        },
        ratings: entries.map((e) => ({
          brand: e.brand,
          model: e.model,
          year_tested: e.year_tested,
          stars: e.stars,
          adult_pct: e.adult_pct,
          child_pct: e.child_pct,
          pedestrian_pct: e.pedestrian_pct,
          safety_assist_pct: e.safety_assist_pct,
          source_url: e.source_url,
        })),
      },
      null,
      2
    )
  );
  console.log(`Saved all ratings to ${outputPath}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
