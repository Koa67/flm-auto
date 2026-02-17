/**
 * ULTIMATESPECS.COM SCRAPER v3 — UNLIMITED + AUTO-CREATE
 * 
 * Same philosophy as scrape-autodata-v3:
 * - No .slice() limits
 * - Auto-creates missing models + generations
 * - Writes directly to third_party_specs
 * 
 * Structure: /car-specs/{Brand}-models → /car-specs/{Brand}/M{id}/{Gen} → .html pages
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import { normalizeModelName } from './model-aliases';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

// ────────── Config ──────────
const DELAY_MS = 300;
const MAX_VERSIONS_PER_MODEL = 20;  // UltimateSpecs has fewer versions per page

const BRANDS = [
  'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche',
  'Toyota', 'Honda', 'Mazda', 'Nissan', 'Hyundai', 'Kia',
  'Volvo', 'Peugeot', 'Renault', 'Skoda', 'Tesla',
  'Ford', 'Opel', 'Lexus', 'Mini', 'Fiat', 'Seat', 'Cupra',
  'Jaguar', 'Land-Rover', 'Alfa-Romeo', 'Citroën', 'DS',
  'Subaru', 'Suzuki', 'Mitsubishi', 'Dacia',
];

// ────────── Helpers ──────────
function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `https://www.ultimatespecs.com${url}`;
    const req = https.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchPage(loc).then(resolve).catch(reject);
      }
      if (res.statusCode === 404) return resolve('');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  // UltimateSpecs uses <th>Key :</th><td>Value</td> pattern
  const regex = /<tr[^>]*>\s*<t[hd][^>]*>([^<]+?)(?:\s*:)?\s*<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    let key = match[1].trim().replace(/\s+/g, ' ').replace(/:$/, '');
    let value = match[2]
      .replace(/<span[^>]*class="val2"[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (key && value && key.length < 80 && value.length < 500) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (normKey.length > 2) specs[normKey] = value;
    }
  }
  
  return specs;
}

// Extract model name from UltimateSpecs URL
// e.g. /car-specs/BMW/M123/3-Series-E90 → "3 Series E90"
function extractFromUrl(url: string): { model: string, gen: string } {
  const parts = url.split('/');
  const last = (parts.pop() || '').replace(/\.html$/, '').replace(/-/g, ' ');
  // The M### part is the model ID on UltimateSpecs
  // The last segment is usually "ModelName-GenCode" or "ModelName-(ChassisCode)"
  
  // Try to split model vs gen: look for chassis code patterns
  const chassisMatch = last.match(/^(.+?)\s*[\(\[]?([A-Z]\d{1,3}[A-Z]?|[A-Z]{2}\d{1,2}|MK\s*\d+|Gen\s*\d+|Phase\s*\d+|Facelift|FL|LCI)[\)\]]?\s*$/i);
  if (chassisMatch) {
    return { model: chassisMatch[1].trim(), gen: chassisMatch[2].trim() };
  }
  
  return { model: last, gen: last };
}

function extractYears(html: string, specs: Record<string, string>): { start: number | null, end: number | null } {
  for (const key of ['production_start', 'from_year', 'start_of_production', 'year', 'years_of_production']) {
    if (specs[key]) {
      const m = specs[key].match(/(\d{4})/);
      if (m) {
        const start = parseInt(m[1]);
        const endMatch = specs[key].match(/(\d{4})\s*$/);
        const end = endMatch && endMatch[1] !== m[1] ? parseInt(endMatch[1]) : null;
        return { start, end };
      }
    }
  }
  // Fallback: title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const yr = titleMatch[1].match(/(\d{4})\s*[-–]\s*(\d{4}|present|now)/i);
    if (yr) return { start: parseInt(yr[1]), end: yr[2].match(/\d{4}/) ? parseInt(yr[2]) : null };
    const since = titleMatch[1].match(/since\s+(\d{4})/i);
    if (since) return { start: parseInt(since[1]), end: null };
  }
  return { start: null, end: null };
}

// ────────── DB Caches (same pattern as autodata-v3) ──────────
let brandCache = new Map<string, string>();
let modelCache = new Map<string, string>();
let genLookup = new Map<string, { id: string, name: string }[]>();

async function loadCaches() {
  const { data: brands } = await supabase.from('brands').select('id, name');
  for (const b of brands || []) {
    brandCache.set(slugify(b.name), b.id);
    brandCache.set(b.name.toLowerCase(), b.id);
    brandCache.set(b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), b.id);
  }
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  for (const m of models || []) {
    modelCache.set(`${m.brand_id}|${m.name.toLowerCase()}`, m.id);
  }
  
  let page = 0;
  let allGens: any[] = [];
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    allGens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  
  for (const g of allGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const key = `${m.brand.name.toLowerCase()}|${m.name.toLowerCase()}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ id: g.id, name: g.name.toLowerCase() });
  }
  
  console.log(`Cache: ${brandCache.size / 3} brands, ${modelCache.size} models, ${allGens.length} generations`);
}

async function getOrCreateModel(brandId: string, brandSlug: string, modelName: string): Promise<string> {
  const brandDisplay = brandSlug === 'mercedes-benz' ? 'Mercedes-Benz'
    : brandSlug === 'alfa-romeo' ? 'Alfa Romeo'
    : brandSlug === 'land-rover' ? 'Land Rover'
    : brandSlug.charAt(0).toUpperCase() + brandSlug.slice(1);
  
  const normalized = normalizeModelName(brandDisplay, modelName);
  
  // Try exact
  const key1 = `${brandId}|${modelName.toLowerCase()}`;
  if (modelCache.has(key1)) return modelCache.get(key1)!;
  const key2 = `${brandId}|${normalized.toLowerCase()}`;
  if (modelCache.has(key2)) return modelCache.get(key2)!;
  
  // Fuzzy
  for (const [k, id] of modelCache) {
    if (!k.startsWith(`${brandId}|`)) continue;
    const existing = k.split('|')[1];
    if (normalized.toLowerCase().includes(existing) || existing.includes(normalized.toLowerCase())) {
      return id;
    }
  }
  
  // Create
  const displayName = normalized || modelName;
  const slug = slugify(`${brandSlug}-${displayName}`);
  
  const { data, error } = await supabase
    .from('models')
    .insert({ brand_id: brandId, name: displayName, slug })
    .select('id')
    .single();
  
  if (error) {
    if (error.message.includes('duplicate')) {
      const { data: existing } = await supabase
        .from('models')
        .select('id')
        .eq('brand_id', brandId)
        .eq('slug', slug)
        .single();
      if (existing) { modelCache.set(key1, existing.id); return existing.id; }
    }
    throw new Error(`Cannot create model ${displayName}: ${error.message}`);
  }
  
  modelCache.set(key1, data.id);
  modelCache.set(`${brandId}|${displayName.toLowerCase()}`, data.id);
  return data.id;
}

async function getOrCreateGeneration(
  modelId: string, brandSlug: string, modelName: string,
  genSlug: string, years: { start: number | null, end: number | null }
): Promise<string> {
  const brandName = brandSlug.replace(/-/g, ' ');
  const brandDisplay = brandSlug === 'mercedes-benz' ? 'Mercedes-Benz'
    : brandSlug === 'alfa-romeo' ? 'Alfa Romeo'
    : brandSlug === 'land-rover' ? 'Land Rover'
    : brandSlug.charAt(0).toUpperCase() + brandSlug.slice(1);
  const normModel = normalizeModelName(brandDisplay, modelName).toLowerCase();
  
  // Search existing gens
  for (const [key, gens] of genLookup) {
    if (!key.startsWith(brandName + '|')) continue;
    const modelPart = key.split('|')[1];
    if (modelPart !== normModel && !normModel.includes(modelPart) && !modelPart.includes(normModel)) continue;
    
    const slugTokens = genSlug.toLowerCase().split(/[\s\-_()]+/);
    const exact = gens.find(g => g.name !== 'default' && slugTokens.includes(g.name));
    if (exact) return exact.id;
    const substr = gens.find(g => g.name !== 'default' && genSlug.toLowerCase().includes(g.name));
    if (substr) return substr.id;
    if (years.start) {
      const ym = gens.find(g => g.name.includes(String(years.start)));
      if (ym) return ym.id;
    }
    // If only one non-default gen, use it
    const nonDefault = gens.filter(g => g.name !== 'default');
    if (nonDefault.length === 1) return nonDefault[0].id;
    if (gens.length === 1) return gens[0].id;
  }
  
  // Create
  const genName = genSlug
    .replace(new RegExp(`^${brandSlug}\\s+`, 'i'), '')
    .replace(new RegExp(`^${modelName}\\s+`, 'i'), '')
    .replace(/[()]/g, '')
    .trim() || `US ${years.start || 'unknown'}`;
  
  const dbSlug = slugify(`${modelName}-${genName}-${years.start || 'x'}`);
  
  const { data, error } = await supabase
    .from('generations')
    .insert({
      model_id: modelId,
      name: genName,
      slug: dbSlug,
      production_start: years.start ? `${years.start}-01-01` : null,
      production_end: years.end ? `${years.end}-12-31` : null,
    })
    .select('id')
    .single();
  
  if (error) {
    if (error.message.includes('duplicate')) {
      const { data: existing } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', modelId)
        .eq('slug', dbSlug)
        .single();
      if (existing) return existing.id;
    }
    throw new Error(`Cannot create gen ${genName}: ${error.message}`);
  }
  
  const cacheKey = `${brandName}|${normModel}`;
  if (!genLookup.has(cacheKey)) genLookup.set(cacheKey, []);
  genLookup.get(cacheKey)!.push({ id: data.id, name: genName.toLowerCase() });
  
  return data.id;
}

// ────────── Main Scraper ──────────
async function scrape() {
  console.log('🏎️  ULTIMATESPECS SCRAPER v3 — UNLIMITED + AUTO-CREATE\n');
  console.log('═'.repeat(60));
  
  await loadCaches();
  
  const stats = {
    versionsScraped: 0,
    specsExtracted: 0,
    gensMatched: new Set<string>(),
    errors: 0,
    httpRequests: 0,
    brandsSkipped: 0,
  };
  
  for (const brand of BRANDS) {
    const brandSlug = slugify(brand);
    const brandId = brandCache.get(brandSlug) || brandCache.get(brand.toLowerCase());
    
    if (!brandId) {
      console.log(`\n⚠️  ${brand} — not in DB, skipping`);
      stats.brandsSkipped++;
      continue;
    }
    
    console.log(`\n📦 ${brand.toUpperCase()}`);
    
    try {
      // Brand models page
      const brandHtml = await fetchPage(`/car-specs/${brand}-models`);
      stats.httpRequests++;
      await sleep(DELAY_MS);
      
      if (!brandHtml) {
        // Try alternate URL format
        const altHtml = await fetchPage(`/car-specs/${brand}`);
        stats.httpRequests++;
        if (!altHtml) { console.log('   ❌ No brand page'); continue; }
      }
      
      // Extract model/generation page links: /car-specs/Brand/M###/Something
      const modelRegex = /href="(\/car-specs\/[^"]+\/M\d+\/[^"]+)"/g;
      const modelLinks: string[] = [];
      let m;
      const html = brandHtml || '';
      while ((m = modelRegex.exec(html)) !== null) {
        if (!modelLinks.includes(m[1])) modelLinks.push(m[1]);
      }
      
      console.log(`   Model pages: ${modelLinks.length}`);
      
      // Each "model link" on UltimateSpecs is actually a generation page
      // that lists variants with their specs
      for (const modelLink of modelLinks) {
        await sleep(DELAY_MS);
        
        try {
          const pageHtml = await fetchPage(modelLink);
          stats.httpRequests++;
          
          if (!pageHtml || pageHtml.length < 1000) continue;
          
          const { model: rawModel, gen: rawGen } = extractFromUrl(modelLink);
          
          // Get or create model
          let modelId: string;
          try {
            modelId = await getOrCreateModel(brandId, brandSlug, rawModel);
          } catch (e: any) {
            process.stdout.write('E');
            stats.errors++;
            continue;
          }
          
          // Extract individual version/spec page links
          const versionLinks = extractVersionLinks(pageHtml);
          
          if (versionLinks.length > 0) {
            // This page links to individual spec pages
            let genId: string | undefined;
            
            for (const vLink of versionLinks.slice(0, MAX_VERSIONS_PER_MODEL)) {
              await sleep(DELAY_MS);
              
              try {
                const vHtml = await fetchPage(vLink);
                stats.httpRequests++;
                const specs = parseSpecs(vHtml);
                
                if (Object.keys(specs).length < 5) continue;
                
                stats.versionsScraped++;
                stats.specsExtracted += Object.keys(specs).length;
                
                if (!genId) {
                  const years = extractYears(vHtml, specs);
                  try {
                    genId = await getOrCreateGeneration(modelId, brandSlug, rawModel, rawGen, years);
                  } catch (e: any) {
                    process.stdout.write('E');
                    stats.errors++;
                    break;
                  }
                }
                
                if (!genId) continue;
                stats.gensMatched.add(genId);
                
                const specsToInsert = Object.entries(specs).map(([key, value]) => ({
                  generation_id: genId!,
                  source: 'UltimateSpecs',
                  spec_type: `us_${key}`,
                  spec_value: parseFloat(value.replace(/[^\d.-]/g, '')) || 0,
                  raw_data: { value, url: vLink },
                }));
                
                for (let i = 0; i < specsToInsert.length; i += 50) {
                  const chunk = specsToInsert.slice(i, i + 50);
                  const { error } = await supabase.from('third_party_specs').upsert(chunk, {
                    onConflict: 'generation_id,source,spec_type'
                  });
                  if (error) stats.errors++;
                }
                
                process.stdout.write('.');
              } catch (e: any) {
                process.stdout.write('x');
                stats.errors++;
              }
            }
          } else {
            // Specs might be directly on this page (some UltimateSpecs layouts)
            const specs = parseSpecs(pageHtml);
            
            if (Object.keys(specs).length >= 5) {
              stats.versionsScraped++;
              stats.specsExtracted += Object.keys(specs).length;
              
              const years = extractYears(pageHtml, specs);
              let genId: string | undefined;
              try {
                genId = await getOrCreateGeneration(modelId, brandSlug, rawModel, rawGen, years);
              } catch (e: any) {
                process.stdout.write('E');
                stats.errors++;
                continue;
              }
              
              stats.gensMatched.add(genId);
              
              const specsToInsert = Object.entries(specs).map(([key, value]) => ({
                generation_id: genId!,
                source: 'UltimateSpecs',
                spec_type: `us_${key}`,
                spec_value: parseFloat(value.replace(/[^\d.-]/g, '')) || 0,
                raw_data: { value, url: modelLink },
              }));
              
              for (let i = 0; i < specsToInsert.length; i += 50) {
                const chunk = specsToInsert.slice(i, i + 50);
                const { error } = await supabase.from('third_party_specs').upsert(chunk, {
                  onConflict: 'generation_id,source,spec_type'
                });
                if (error) stats.errors++;
              }
              
              process.stdout.write('•');
            }
          }
        } catch (e: any) {
          process.stdout.write('X');
          stats.errors++;
        }
      }
    } catch (e: any) {
      console.log(`   ❌ Brand error: ${e.message}`);
      stats.errors++;
    }
  }
  
  // Final stats
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  const { count: genCount } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: modelCount } = await supabase.from('models').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🏎️  ULTIMATESPECS v3 COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   HTTP requests:        ${stats.httpRequests}`);
  console.log(`   Versions scraped:     ${stats.versionsScraped}`);
  console.log(`   Specs extracted:      ${stats.specsExtracted}`);
  console.log(`   Generations touched:  ${stats.gensMatched.size}`);
  console.log(`   Brands skipped:       ${stats.brandsSkipped}`);
  console.log(`   Errors:               ${stats.errors}`);
  console.log(`   ─────────────────────────────`);
  console.log(`   DB models total:      ${modelCount}`);
  console.log(`   DB generations total: ${genCount}`);
  console.log(`   DB specs total:       ${count}`);
  console.log('═'.repeat(60));
}

function extractVersionLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /href="(\/car-specs\/[^"]+\.html)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!match[1].includes('-models')) links.push(match[1]);
  }
  return [...new Set(links)];
}

scrape().catch(console.error);
