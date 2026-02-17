/**
 * 07-euroncap-safety.ts — Import + Scrape EuroNCAP Safety Ratings
 *
 * PHASE 1: Import existing scraped data (3 JSON sources, 0 HTTP)
 * PHASE 2: Scrape missing ratings from euroncap.com/en/ratings-rewards/
 *
 * EuroNCAP data structure:
 *   - Stars (1-5)
 *   - Adult occupant %
 *   - Child occupant %
 *   - Pedestrian/VRU %
 *   - Safety assist %
 *   - Test year + protocol
 *   - Source URL with euroncap_id
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/07-euroncap-safety.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/07-euroncap-safety.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/07-euroncap-safety.ts --import-only   (skip scraping)
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/07-euroncap-safety.ts --scrape-only   (skip import)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const IMPORT_ONLY = process.argv.includes('--import-only');
const SCRAPE_ONLY = process.argv.includes('--scrape-only');
const DELAY_MS = 500;
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

// ═══════════ Types ═══════════
interface EuroNCAPRating {
  brand: string;
  model: string;
  year_tested: number;
  stars: number;
  adult_pct: number | null;
  child_pct: number | null;
  pedestrian_pct: number | null;
  safety_assist_pct: number | null;
  source_url: string;
  euroncap_id?: string;
  generation?: string; // chassis code hint
}

// ═══════════ HTTP ═══════════
function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) {
          const fullLoc = loc.startsWith('http') ? loc : `https://www.euroncap.com${loc}`;
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

// ═══════════ DB ═══════════
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
    .replace(/[-–—_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══════════ Load all existing EuroNCAP data ═══════════
function loadAllExistingData(): EuroNCAPRating[] {
  const all: EuroNCAPRating[] = [];
  const seen = new Set<string>();

  function addRating(r: EuroNCAPRating) {
    const key = `${normalize(r.brand)}|${normalize(r.model)}|${r.year_tested}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push(r);
  }

  // Source 1: v3 all ratings (483 entries)
  const v3Path = path.join(DATA_DIR, 'raw/euroncap_v3_all_ratings.json');
  if (fs.existsSync(v3Path)) {
    try {
      const data = JSON.parse(fs.readFileSync(v3Path, 'utf-8'));
      const ratings = data.ratings || [];
      for (const r of ratings) {
        addRating({
          brand: r.brand,
          model: r.model,
          year_tested: r.year_tested,
          stars: r.stars,
          adult_pct: r.adult_pct ?? null,
          child_pct: r.child_pct ?? null,
          pedestrian_pct: r.pedestrian_pct ?? null,
          safety_assist_pct: r.safety_assist_pct ?? null,
          source_url: r.source_url || '',
          euroncap_id: r.source_url?.match(/\/(\d+)$/)?.[1],
        });
      }
      console.log(`  Source v3: ${ratings.length} ratings`);
    } catch (e) { console.error(`  v3 load error: ${e}`); }
  }

  // Source 2: Scrape checkpoint (more detailed, has euroncap_id)
  const cpPath = path.join(DATA_DIR, 'euroncap-scrape-checkpoint.json');
  if (fs.existsSync(cpPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      const scraped = data.scrapedUrls || {};
      let count = 0;
      for (const [url, r] of Object.entries(scraped) as [string, any][]) {
        addRating({
          brand: r.brand,
          model: r.model,
          year_tested: r.year_tested,
          stars: r.stars,
          adult_pct: r.adult_pct ?? null,
          child_pct: r.child_pct ?? null,
          pedestrian_pct: r.pedestrian_pct ?? null,
          safety_assist_pct: r.safety_assist_pct ?? null,
          source_url: url,
          euroncap_id: r.euroncap_id || url.match(/\/(\d+)$/)?.[1],
        });
        count++;
      }
      console.log(`  Source checkpoint: ${count} ratings`);
    } catch (e) { console.error(`  checkpoint load error: ${e}`); }
  }

  // Source 3: Extended database (structured with generation hints)
  const extPath = path.join(DATA_DIR, 'EURONCAP_EXTENDED_DATABASE.json');
  if (fs.existsSync(extPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(extPath, 'utf-8'));
      let count = 0;
      for (const [section, brands] of Object.entries(data)) {
        if (section === 'metadata') continue;
        for (const [brandKey, models] of Object.entries(brands as any)) {
          for (const [modelKey, r] of Object.entries(models as any)) {
            const rating = r as any;
            if (!rating.stars && !rating.year_tested) continue;
            addRating({
              brand: brandKey.replace(/_/g, ' '),
              model: rating.model || modelKey.replace(/_/g, ' '),
              year_tested: rating.year_tested,
              stars: rating.stars,
              adult_pct: rating.adult_occupant_pct ?? null,
              child_pct: rating.child_occupant_pct ?? null,
              pedestrian_pct: rating.pedestrian_pct ?? null,
              safety_assist_pct: rating.safety_assist_pct ?? null,
              source_url: rating.url || '',
              euroncap_id: rating.url?.match(/\/(\d+)$/)?.[1],
              generation: rating.generation,
            });
            count++;
          }
        }
      }
      console.log(`  Source extended DB: ${count} ratings`);
    } catch (e) { console.error(`  extended load error: ${e}`); }
  }

  // Source 4: Original ratings file
  const origPath = path.join(DATA_DIR, 'euroncap-ratings.json');
  if (fs.existsSync(origPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(origPath, 'utf-8'));
      let count = 0;
      for (const r of data) {
        addRating({
          brand: r.brand,
          model: r.model,
          year_tested: r.year || r.year_tested,
          stars: r.overall_rating || r.stars,
          adult_pct: r.adult_occupant ?? r.adult_pct ?? null,
          child_pct: r.child_occupant ?? r.child_pct ?? null,
          pedestrian_pct: r.vulnerable_road_users ?? r.pedestrian_pct ?? null,
          safety_assist_pct: r.safety_assist ?? r.safety_assist_pct ?? null,
          source_url: r.source_url || '',
        });
        count++;
      }
      console.log(`  Source original: ${count} ratings`);
    } catch (e) { console.error(`  original load error: ${e}`); }
  }

  console.log(`  Total unique ratings: ${all.length}`);
  return all;
}

// ═══════════ EuroNCAP model name → DB model matching ═══════════
const EURONCAP_MODEL_ALIASES: Record<string, Record<string, string>> = {
  'bmw': {
    '1 series': '1 series', '1-series': '1 series',
    '2 series active tourer': '2 series active tourer', '2-series-active-tourer': '2 series active tourer',
    '3 series': '3 series', '3-series': '3 series',
    '5 series': '5 series', '5-series': '5 series',
    '7 series': '7 series', '7-series': '7 series',
    'ix': 'ix', 'ix1': 'ix1', 'ix3': 'ix3',
    'i4': 'i4', 'i5': 'i5', 'i7': 'i7',
    'x1': 'x1', 'x3': 'x3', 'x5': 'x5', 'x6': 'x6', 'x7': 'x7',
  },
  'mercedes-benz': {
    'a-class': 'a-class', 'a class': 'a-class',
    'b-class': 'b-class', 'b class': 'b-class',
    'c-class': 'c-class', 'c class': 'c-class',
    'e-class': 'e-class', 'e class': 'e-class',
    's-class': 's-class', 's class': 's-class',
    'cla': 'cla', 'cla-class': 'cla',
    'gla': 'gla', 'glb': 'glb', 'glc': 'glc', 'gle': 'gle', 'gls': 'gls',
    'eqa': 'eqa', 'eqb': 'eqb', 'eqc': 'eqc', 'eqe': 'eqe', 'eqs': 'eqs',
    'eqe suv': 'eqe suv', 'eqs suv': 'eqs suv',
    't-class': 't-class',
  },
  'volkswagen': {
    'golf': 'golf', 'polo': 'polo', 'passat': 'passat',
    'tiguan': 'tiguan', 'touareg': 'touareg', 'touran': 'touran',
    't-roc': 't-roc', 't-cross': 't-cross', 'taigo': 'taigo',
    'id.3': 'id.3', 'id.4': 'id.4', 'id.5': 'id.5', 'id.7': 'id.7',
    'id.buzz': 'id. buzz', 'id. buzz': 'id. buzz',
    'arteon': 'arteon', 'up': 'up',
  },
  'audi': {
    'a1': 'a1', 'a3': 'a3', 'a4': 'a4', 'a6': 'a6', 'a7': 'a7', 'a8': 'a8',
    'q2': 'q2', 'q3': 'q3', 'q4 e-tron': 'q4 e-tron', 'q5': 'q5', 'q7': 'q7', 'q8': 'q8',
    'e-tron': 'e-tron', 'e-tron gt': 'e-tron gt',
    'q8 e-tron': 'q8 e-tron', 'q6 e-tron': 'q6 e-tron',
    'a6 e-tron': 'a6 e-tron',
  },
  'toyota': {
    'corolla': 'corolla', 'camry': 'camry', 'yaris': 'yaris', 'aygo': 'aygo', 'aygo x': 'aygo x',
    'rav4': 'rav4', 'c-hr': 'c-hr', 'chr': 'c-hr',
    'highlander': 'highlander', 'land cruiser': 'land cruiser',
    'yaris cross': 'yaris cross', 'bz4x': 'bz4x',
    'prius': 'prius', 'mirai': 'mirai', 'proace city verso': 'proace city verso',
    'supra': 'supra', 'gr86': 'gr86',
  },
  'hyundai': {
    'i10': 'i10', 'i20': 'i20', 'i30': 'i30',
    'tucson': 'tucson', 'santa fe': 'santa fe', 'kona': 'kona', 'bayon': 'bayon',
    'ioniq 5': 'ioniq 5', 'ioniq 6': 'ioniq 6',
    'nexo': 'nexo', 'staria': 'staria',
  },
  'kia': {
    'picanto': 'picanto', 'rio': 'rio', 'ceed': "ceed", "cee'd": "ceed",
    'sportage': 'sportage', 'sorento': 'sorento', 'niro': 'niro',
    'ev6': 'ev6', 'ev9': 'ev9', 'stonic': 'stonic',
    'xceed': 'xceed', 'proceed': 'proceed',
  },
  'renault': {
    'clio': 'clio', 'megane': 'megane', 'captur': 'captur', 'kadjar': 'kadjar',
    'scenic': 'scenic', 'austral': 'austral', 'espace': 'espace',
    'arkana': 'arkana', 'zoe': 'zoe', 'megane e-tech': 'megane e-tech',
    'rafale': 'rafale', 'symbioz': 'symbioz',
  },
  'peugeot': {
    '208': '208', '308': '308', '408': '408', '508': '508',
    '2008': '2008', '3008': '3008', '5008': '5008',
    'e-208': '208', 'e-308': '308', 'e-2008': '2008', 'e-3008': '3008',
    'rifter': 'rifter',
  },
  'nissan': {
    'micra': 'micra', 'juke': 'juke', 'qashqai': 'qashqai',
    'x-trail': 'x-trail', 'leaf': 'leaf', 'ariya': 'ariya',
    'navara': 'navara', 'note': 'note', 'townstar': 'townstar',
  },
  'honda': {
    'civic': 'civic', 'accord': 'accord', 'jazz': 'jazz', 'fit': 'jazz',
    'hr-v': 'hr-v', 'cr-v': 'cr-v', 'zr-v': 'zr-v',
    'e:ny1': 'e:ny1', 'honda e': 'honda e',
  },
  'volvo': {
    'xc40': 'xc40', 'xc60': 'xc60', 'xc90': 'xc90',
    's60': 's60', 's90': 's90', 'v60': 'v60', 'v90': 'v90',
    'c40': 'c40', 'ex30': 'ex30', 'ex90': 'ex90', 'ec40': 'ec40',
  },
  'skoda': {
    'fabia': 'fabia', 'octavia': 'octavia', 'superb': 'superb',
    'kamiq': 'kamiq', 'karoq': 'karoq', 'kodiaq': 'kodiaq',
    'enyaq': 'enyaq', 'enyaq coupe': 'enyaq coupe', 'scala': 'scala',
    'elroq': 'elroq',
  },
  'ford': {
    'fiesta': 'fiesta', 'focus': 'focus', 'mondeo': 'mondeo',
    'puma': 'puma', 'kuga': 'kuga', 'explorer': 'explorer',
    'mustang mach-e': 'mustang mach-e', 'tourneo courier': 'tourneo courier',
  },
  'tesla': {
    'model 3': 'model 3', 'model y': 'model y',
    'model s': 'model s', 'model x': 'model x',
  },
  'porsche': {
    'taycan': 'taycan', 'cayenne': 'cayenne', 'macan': 'macan',
    '911': '911', 'panamera': 'panamera',
  },
};

// Brand name normalization
const BRAND_NORM: Record<string, string> = {
  'mercedes benz': 'mercedes-benz',
  'mercedes': 'mercedes-benz',
  'vw': 'volkswagen',
  'alfa romeo': 'alfa romeo',
  'land rover': 'land rover',
  'rolls royce': 'rolls-royce',
  'aston martin': 'aston martin',
};

function normBrand(raw: string): string {
  const lower = raw.toLowerCase().replace(/[-_]/g, ' ').trim();
  return BRAND_NORM[lower] || lower;
}

function resolveModel(brand: string, model: string): string {
  const brandLower = brand.toLowerCase();
  const modelLower = model.toLowerCase()
    .replace(brand.toLowerCase(), '') // "BMW X1" → "X1"
    .replace(/^\s+/, '')
    .trim();
  
  const aliases = EURONCAP_MODEL_ALIASES[brandLower];
  if (aliases) {
    // Try exact
    if (aliases[modelLower]) return aliases[modelLower];
    // Try with brand prefix removed
    const noBrand = modelLower.replace(new RegExp(`^${brandLower}\\s+`), '');
    if (aliases[noBrand]) return aliases[noBrand];
    // Try hyphenated version
    const hyphenated = modelLower.replace(/\s+/g, '-');
    if (aliases[hyphenated]) return aliases[hyphenated];
  }
  return modelLower;
}

// ═══════════ Matching ═══════════
interface GenEntry {
  gen: any;
  brandName: string;
  modelName: string;
  startYear: number;
  endYear: number;
  chassisCode: string | null;
}

function buildGenIndex(gens: any[]): Map<string, GenEntry[]> {
  const index = new Map<string, GenEntry[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const brandName = model.brand.name.toLowerCase();
    const modelName = model.name.toLowerCase();
    const key = `${brandName}|${modelName}`;
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    const chassisCode = gen.chassis_code?.toUpperCase() || null;
    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push({ gen, brandName, modelName, startYear, endYear, chassisCode });
  }
  return index;
}

function matchRating(
  rating: EuroNCAPRating,
  genIndex: Map<string, GenEntry[]>
): any | null {
  const brand = normBrand(rating.brand);
  const model = resolveModel(brand, rating.model);
  const year = rating.year_tested;

  // Strategy 1: Direct brand|model + year
  const key = `${brand}|${model}`;
  let entries = genIndex.get(key);

  // Strategy 2: Fuzzy model search within brand
  if (!entries) {
    const modelNorm = normalize(model);
    for (const [k, v] of genIndex) {
      const [bk, mk] = k.split('|');
      if (bk !== brand) continue;
      const mkNorm = normalize(mk);
      if (mkNorm === modelNorm || mkNorm.includes(modelNorm) || modelNorm.includes(mkNorm)) {
        entries = v;
        break;
      }
    }
  }

  if (!entries || entries.length === 0) return null;

  // Match by chassis code if available
  if (rating.generation) {
    const chassisMatch = entries.find(e => e.chassisCode === rating.generation.toUpperCase());
    if (chassisMatch) return chassisMatch.gen;
  }

  // Match by year range
  const yearMatch = entries.find(e => year >= e.startYear && year <= e.endYear);
  if (yearMatch) return yearMatch.gen;

  // Closest generation
  const closest = entries.reduce((a, b) =>
    Math.abs(a.startYear - year) < Math.abs(b.startYear - year) ? a : b
  );
  if (Math.abs(closest.startYear - year) <= 5) return closest.gen;

  return entries[entries.length - 1].gen; // Latest as fallback
}

// ═══════════ EuroNCAP Website Scraping ═══════════
// The ratings list page: https://www.euroncap.com/en/ratings-rewards/
// Individual pages: https://www.euroncap.com/en/results/{brand}/{model}/{id}

function parseRatingsListPage(html: string): { brand: string; model: string; url: string }[] {
  const results: { brand: string; model: string; url: string }[] = [];
  
  // EuroNCAP uses links like: /en/results/brand-name/model-name/12345
  const linkRegex = /href="(\/en\/results\/([^/]+)\/([^/]+)\/(\d+))"/gi;
  let match;
  const seen = new Set<string>();
  
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const brand = match[2].replace(/-/g, ' ');
    const model = match[3].replace(/-/g, ' ');
    const id = match[4];
    
    if (seen.has(id)) continue;
    seen.add(id);
    
    results.push({
      brand,
      model,
      url: `https://www.euroncap.com${path}`,
    });
  }
  
  return results;
}

function parseRatingDetailPage(html: string, url: string): EuroNCAPRating | null {
  // Extract star rating
  const starsMatch = html.match(/(\d)\s*(?:star|★)/i) || html.match(/class="[^"]*stars?[^"]*"[^>]*>\s*(\d)/i);
  const stars = starsMatch ? parseInt(starsMatch[1]) : null;
  if (!stars) return null;

  // Extract percentages
  const extractPct = (pattern: RegExp): number | null => {
    const m = html.match(pattern);
    return m ? parseInt(m[1]) : null;
  };

  const adult = extractPct(/adult\s*(?:occupant)?[^%]*?(\d{1,2,3})%/i)
    || extractPct(/adult[^}]*?"percentage"[^}]*?(\d+)/i);
  const child = extractPct(/child\s*(?:occupant)?[^%]*?(\d{1,2,3})%/i)
    || extractPct(/child[^}]*?"percentage"[^}]*?(\d+)/i);
  const ped = extractPct(/(?:pedestrian|vulnerable|vru)[^%]*?(\d{1,2,3})%/i)
    || extractPct(/(?:pedestrian|vulnerable)[^}]*?"percentage"[^}]*?(\d+)/i);
  const assist = extractPct(/safety\s*assist[^%]*?(\d{1,2,3})%/i)
    || extractPct(/safety.assist[^}]*?"percentage"[^}]*?(\d+)/i);

  // Extract year
  const yearMatch = html.match(/test(?:ed)?\s*(?:in\s*)?(\d{4})/i) || html.match(/"year"\s*:\s*(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // Extract brand/model from URL
  const urlParts = url.match(/results\/([^/]+)\/([^/]+)\/(\d+)/);
  if (!urlParts) return null;

  return {
    brand: urlParts[1].replace(/-/g, ' '),
    model: urlParts[2].replace(/-/g, ' '),
    year_tested: year,
    stars,
    adult_pct: adult,
    child_pct: child,
    pedestrian_pct: ped,
    safety_assist_pct: assist,
    source_url: url,
    euroncap_id: urlParts[3],
  };
}

// ═══════════ Try EuroNCAP API (they have a hidden JSON endpoint) ═══════════
async function fetchEuroNCAPApi(): Promise<EuroNCAPRating[]> {
  const ratings: EuroNCAPRating[] = [];
  
  // EuroNCAP has a JSON API used by their website
  const apiUrls = [
    'https://www.euroncap.com/en/ratings-rewards/?ajax=true',
    'https://www.euroncap.com/umbraco/api/ratings/getratingsbyfilter?selectedMake=&selectedMakeName=&selectedModel=&selectedStar=&selectedClass=&selectedProtocols=&selectedProtocolsTexts=&all498Results=True&page=1&pageSize=500',
  ];

  for (const apiUrl of apiUrls) {
    try {
      console.log(`  Trying API: ${apiUrl.substring(0, 60)}...`);
      const raw = await fetchPage(apiUrl);
      
      // Try JSON parse
      let data: any;
      try { 
        data = JSON.parse(raw); 
      } catch {
        // Maybe it's HTML with embedded JSON
        const jsonMatch = raw.match(/var\s+ratingsData\s*=\s*(\[[\s\S]*?\]);/);
        if (jsonMatch) {
          try { data = JSON.parse(jsonMatch[1]); } catch {}
        }
        if (!data) {
          // Try extracting from HTML data attributes
          const dataMatch = raw.match(/data-ratings='([^']+)'/);
          if (dataMatch) {
            try { data = JSON.parse(dataMatch[1]); } catch {}
          }
        }
      }

      if (data && Array.isArray(data)) {
        for (const item of data) {
          ratings.push({
            brand: item.make || item.brand || '',
            model: item.model || item.modelName || '',
            year_tested: item.year || item.testYear || 2024,
            stars: item.stars || item.rating || 0,
            adult_pct: item.adult || item.adultOccupant || null,
            child_pct: item.child || item.childOccupant || null,
            pedestrian_pct: item.pedestrian || item.vulnerableRoadUsers || null,
            safety_assist_pct: item.safetyAssist || null,
            source_url: item.url ? `https://www.euroncap.com${item.url}` : '',
            euroncap_id: item.id?.toString(),
          });
        }
        console.log(`  API returned ${ratings.length} ratings`);
        return ratings;
      } else if (data && data.Ratings) {
        // Umbraco API format
        for (const item of data.Ratings) {
          ratings.push({
            brand: item.Make || '',
            model: item.Model || '',
            year_tested: parseInt(item.Year) || 2024,
            stars: parseInt(item.Stars) || 0,
            adult_pct: parseInt(item.AdultOccupant) || null,
            child_pct: parseInt(item.ChildOccupant) || null,
            pedestrian_pct: parseInt(item.PedestrianProtection) || null,
            safety_assist_pct: parseInt(item.SafetyAssist) || null,
            source_url: item.Url ? `https://www.euroncap.com${item.Url}` : '',
            euroncap_id: item.Id?.toString(),
          });
        }
        console.log(`  Umbraco API returned ${ratings.length} ratings`);
        return ratings;
      }
      
      console.log(`  API response not JSON array (${typeof data}), trying next...`);
    } catch (e: any) {
      console.log(`  API error: ${e.message}`);
    }
    await sleep(1000);
  }
  
  return ratings;
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  07-EURONCAP — Safety Ratings Import + Scrape');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, chassis_code, internal_code, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const genIndex = buildGenIndex(gens);

  // Load existing safety ratings
  const existing = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const existingGenIds = new Set(existing.map(r => r.generation_id));
  console.log(`  Existing safety ratings: ${existing.length}`);

  // ═══ PHASE 1: Import existing data ═══
  let allRatings: EuroNCAPRating[] = [];
  
  if (!SCRAPE_ONLY) {
    console.log('\n━━━ PHASE 1: Import existing scraped data ━━━');
    allRatings = loadAllExistingData();
  }

  // ═══ PHASE 2: Scrape new data from EuroNCAP ═══
  if (!IMPORT_ONLY) {
    console.log('\n━━━ PHASE 2: Fetch from EuroNCAP ━━━');
    
    const apiRatings = await fetchEuroNCAPApi();
    if (apiRatings.length > 0) {
      const existingUrls = new Set(allRatings.map(r => r.source_url));
      let added = 0;
      for (const r of apiRatings) {
        if (!existingUrls.has(r.source_url)) {
          allRatings.push(r);
          added++;
        }
      }
      console.log(`  New from API: ${added}`);
    } else {
      console.log('  API scraping failed or returned 0. Using existing data only.');
    }
  }

  // ═══ MATCH + INSERT ═══
  console.log('\n━━━ Matching & Inserting ━━━');
  
  const stats = {
    total: allRatings.length,
    matched: 0,
    alreadyExists: 0,
    toInsert: 0,
    inserted: 0,
    unmatched: 0,
    unmatchedExamples: [] as string[],
  };

  const toUpsert: any[] = [];

  for (const rating of allRatings) {
    if (!rating.stars || rating.stars < 1 || rating.stars > 5) continue;

    const gen = matchRating(rating, genIndex);
    if (!gen) {
      stats.unmatched++;
      if (stats.unmatchedExamples.length < 25) {
        stats.unmatchedExamples.push(`${rating.brand} ${rating.model} (${rating.year_tested})`);
      }
      continue;
    }

    stats.matched++;

    if (existingGenIds.has(gen.id)) {
      stats.alreadyExists++;
      continue;
    }

    // Determine test protocol
    let protocol = 'Unknown';
    if (rating.year_tested >= 2023) protocol = '2023+';
    else if (rating.year_tested >= 2020) protocol = '2020-2022';
    else if (rating.year_tested >= 2018) protocol = '2018-2019';
    else if (rating.year_tested >= 2015) protocol = '2015-2017';
    else protocol = 'Pre-2015';

    toUpsert.push({
      generation_id: gen.id,
      euroncap_id: rating.euroncap_id || null,
      source_url: rating.source_url,
      stars: rating.stars,
      adult_occupant_pct: rating.adult_pct,
      child_occupant_pct: rating.child_pct,
      pedestrian_pct: rating.pedestrian_pct,
      safety_assist_pct: rating.safety_assist_pct,
      test_year: rating.year_tested,
    });
    existingGenIds.add(gen.id); // Prevent duplicates within batch
    stats.toInsert++;
  }

  // Insert
  if (!DRY_RUN && toUpsert.length > 0) {
    console.log(`\n  Inserting ${toUpsert.length} safety ratings...`);
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        stats.inserted += batch.length;
      }
    }
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  EURONCAP IMPORT RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total ratings:      ${stats.total}`);
  console.log(`  Matched to DB:      ${stats.matched}`);
  console.log(`  Already in DB:      ${stats.alreadyExists}`);
  console.log(`  New to insert:      ${stats.toInsert}`);
  console.log(`  Inserted:           ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Unmatched:          ${stats.unmatched}`);

  const newCoverage = existingGenIds.size;
  const pct = (newCoverage / gens.length * 100).toFixed(1);
  console.log(`\n  Safety coverage:    ${existing.length} → ${newCoverage} / ${gens.length} (${pct}%)`);

  if (stats.unmatchedExamples.length > 0) {
    console.log('\n  Unmatched examples:');
    for (const ex of stats.unmatchedExamples.slice(0, 15)) {
      console.log(`    ${ex}`);
    }
  }

  console.log('='.repeat(60));

  // Save updated data
  const outputPath = path.join(DATA_DIR, 'euroncap-import-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    unmatched: stats.unmatchedExamples,
  }, null, 2));
  console.log(`  Results saved: ${outputPath}`);
}

main().catch(console.error);
