/**
 * FLM AUTO — Mega Recursive Wikimedia Scraper
 * Phase 1: Crawl category tree from Category:Automobiles_by_brand (depth 3)
 * Phase 2: Fetch all images from discovered categories
 * Phase 3: Match to DB generations via brand/model name fuzzy matching
 *
 * Target: 10,000+ images
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_mega_images.json');
const CATEGORIES_CACHE = path.resolve(__dirname, '../data/raw/wikimedia_categories.json');
const DELAY_MS = 200;
const MAX_IMAGES_PER_CATEGORY = 30;
const MAX_DEPTH = 3;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Types ───────────────────────────────────────────────

interface CheckpointData {
  processedCategories: string[];
  totalSaved: number;
  totalMatched: number;
  totalImages: number;
  errors: number;
  startedAt: string;
}

interface CategoryInfo {
  name: string;       // "Mercedes-Benz W124"
  fullTitle: string;  // "Category:Mercedes-Benz_W124"
  depth: number;
  parent: string;
}

// ─── Checkpoint ──────────────────────────────────────────

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedCategories: [], totalSaved: 0, totalMatched: 0, totalImages: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data));
}

// ─── Wikimedia API ───────────────────────────────────────

async function getSubcategories(category: string): Promise<string[]> {
  const subs: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'subcat',
      cmlimit: '500',
      format: 'json',
      origin: '*',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      const data = await res.json();
      for (const member of data.query?.categorymembers || []) {
        subs.push(member.title);
      }
      cmcontinue = data.continue?.cmcontinue;
    } catch {
      break;
    }
    await delay(DELAY_MS);
  } while (cmcontinue);

  return subs;
}

async function getCategoryImages(category: string): Promise<any[]> {
  const images: any[] = [];
  let gcmcontinue: string | undefined;

  while (images.length < MAX_IMAGES_PER_CATEGORY) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: category,
      gcmtype: 'file',
      gcmlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });
    if (gcmcontinue) params.set('gcmcontinue', gcmcontinue);

    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      const data = await res.json();
      for (const page of Object.values(data.query?.pages || {}) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 600 || ii.height < 400) continue;
        if (!ii.mime?.startsWith('image/')) continue;
        const ext = (ii.url || '').split('.').pop()?.toLowerCase();
        if (['svg', 'pdf', 'tiff', 'tif', 'gif'].includes(ext || '')) continue;

        images.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', '') || '',
        });
      }
      gcmcontinue = data.continue?.gcmcontinue;
      if (!gcmcontinue) break;
    } catch {
      break;
    }
    await delay(DELAY_MS);
  }

  return images;
}

// ─── Phase 1: Discover categories recursively ────────────

async function discoverCategories(): Promise<CategoryInfo[]> {
  // Check cache first
  if (fs.existsSync(CATEGORIES_CACHE)) {
    console.log('Loading cached categories...');
    return JSON.parse(fs.readFileSync(CATEGORIES_CACHE, 'utf-8'));
  }

  console.log('Phase 1: Discovering Wikimedia categories (depth 3)...\n');
  const allCategories: CategoryInfo[] = [];
  const visited = new Set<string>();

  async function crawl(category: string, depth: number, parent: string) {
    if (depth > MAX_DEPTH || visited.has(category)) return;
    visited.add(category);

    const subs = await getSubcategories(category);

    for (const sub of subs) {
      const name = sub.replace('Category:', '').replace(/_/g, ' ');
      allCategories.push({ name, fullTitle: sub, depth, parent });

      if (depth < MAX_DEPTH) {
        await crawl(sub, depth + 1, name);
      }
    }

    if (allCategories.length % 100 === 0 && allCategories.length > 0) {
      console.log(`  Discovered: ${allCategories.length} categories (depth ${depth}, visited ${visited.size})`);
    }
  }

  // Start from multiple root categories
  const roots = [
    'Category:Automobiles_by_brand',
    'Category:Cars_by_brand',
    'Category:Automobiles_by_model',
  ];

  for (const root of roots) {
    console.log(`Crawling ${root}...`);
    await crawl(root, 0, root);
  }

  console.log(`\nTotal categories discovered: ${allCategories.length}`);

  // Save cache
  const dir = path.dirname(CATEGORIES_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CATEGORIES_CACHE, JSON.stringify(allCategories, null, 2));

  return allCategories;
}

// ─── Phase 2: Match categories to DB ─────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function matchCategoryToGeneration(
  catName: string,
  brands: any[],
  models: any[],
  gens: any[],
  modelMap: Map<string, any>,
  brandMap: Map<string, any>,
  modelsByBrand: Map<string, any[]>,
  gensByModel: Map<string, any[]>,
): { genIds: string[]; brandName: string; modelName: string } | null {
  const lower = catName.toLowerCase().replace(/[_-]/g, ' ');

  // Find brand
  let matchedBrand: any = null;
  for (const b of brands) {
    const bLower = b.name.toLowerCase();
    if (lower.includes(bLower) || lower.startsWith(bLower.split('-')[0])) {
      matchedBrand = b;
      break;
    }
  }
  // Also try common aliases
  if (!matchedBrand) {
    const aliases: Record<string, string> = {
      'mercedes': 'Mercedes-Benz', 'merc': 'Mercedes-Benz',
      'vw': 'Volkswagen', 'benz': 'Mercedes-Benz',
      'alfa': 'Alfa Romeo', 'landrover': 'Land Rover',
    };
    for (const [alias, brandName] of Object.entries(aliases)) {
      if (lower.includes(alias)) {
        matchedBrand = brands.find(b => b.name === brandName);
        if (matchedBrand) break;
      }
    }
  }
  if (!matchedBrand) return null;

  // Find model
  const brandModels = modelsByBrand.get(matchedBrand.id) || [];
  let matchedModel: any = null;
  let bestMatchLen = 0;

  for (const m of brandModels) {
    const mLower = m.name.toLowerCase();
    if (lower.includes(mLower) && mLower.length > bestMatchLen) {
      matchedModel = m;
      bestMatchLen = mLower.length;
    }
  }

  // Try chassis code matching from category name
  const chassisMatch = lower.match(/\b([a-z]\d{2,3})\b/i) || lower.match(/\b(w\d{3}|e\d{2}|f\d{2}|g\d{2}|r\d{3}|c\d{3})\b/i);

  if (matchedModel) {
    const modelGens = gensByModel.get(matchedModel.id) || [];

    // If we have a chassis code from the category, try to narrow down
    if (chassisMatch) {
      const code = chassisMatch[1].toUpperCase();
      const specific = modelGens.filter(g =>
        g.chassis_code?.toUpperCase() === code ||
        g.name?.toUpperCase().includes(code) ||
        g.slug?.toUpperCase().includes(code)
      );
      if (specific.length > 0) {
        return { genIds: specific.map(g => g.id), brandName: matchedBrand.name, modelName: matchedModel.name };
      }
    }

    return { genIds: modelGens.map(g => g.id), brandName: matchedBrand.name, modelName: matchedModel.name };
  }

  // No model found — try matching generation directly via chassis code
  if (chassisMatch) {
    const code = chassisMatch[1].toUpperCase();
    const brandModelsAll = modelsByBrand.get(matchedBrand.id) || [];
    for (const m of brandModelsAll) {
      const mGens = gensByModel.get(m.id) || [];
      const matched = mGens.filter(g =>
        g.chassis_code?.toUpperCase() === code ||
        g.name?.toUpperCase() === code
      );
      if (matched.length > 0) {
        return { genIds: matched.map(g => g.id), brandName: matchedBrand.name, modelName: m.name };
      }
    }
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega Recursive Wikimedia Scraper');
  console.log('═══════════════════════════════════════════════════════\n');

  // Phase 1: Discover categories
  const categories = await discoverCategories();

  // Load DB data
  console.log('\nLoading DB data...');
  const brands = await paginateAll('brands', 'id, name, slug');
  const models = await paginateAll('models', 'id, name, slug, brand_id');
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, model_id');
  console.log(`DB: ${brands.length} brands, ${models.length} models, ${gens.length} generations`);

  // Build lookup maps
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));
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

  // Get existing image URLs for dedup
  console.log('Loading existing images for dedup...');
  const existingImgs = await paginateAll('vehicle_images', 'url');
  const existingUrls = new Set(existingImgs.map(i => i.url));
  console.log(`Existing images: ${existingUrls.size}`);

  // Existing generation coverage
  const existingGenImgs = await paginateAll('vehicle_images', 'generation_id');
  const hasPhoto = new Set(existingGenImgs.map(i => i.generation_id).filter(Boolean));
  console.log(`Generations with photos: ${hasPhoto.size}/${gens.length}`);

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedCategories);
  let totalSaved = checkpoint.totalSaved;
  let totalMatched = checkpoint.totalMatched;
  let totalImages = checkpoint.totalImages;
  let errors = checkpoint.errors;

  if (processedSet.size > 0) {
    console.log(`\nResuming: ${processedSet.size} categories already processed, ${totalSaved} saved`);
  }

  // Filter categories: match to our brands, skip already processed
  const relevantCategories = categories.filter(c => {
    if (processedSet.has(c.fullTitle)) return false;
    const match = matchCategoryToGeneration(c.name, brands, models, gens, modelMap, brandMap, modelsByBrand, gensByModel);
    return match !== null;
  });

  console.log(`\nPhase 2: Processing ${relevantCategories.length} relevant categories (${categories.length} total discovered)\n`);

  const startTime = Date.now();
  let batchSaved = 0;

  for (let i = 0; i < relevantCategories.length; i++) {
    const cat = relevantCategories[i];
    const match = matchCategoryToGeneration(cat.name, brands, models, gens, modelMap, brandMap, modelsByBrand, gensByModel);
    if (!match) { processedSet.add(cat.fullTitle); continue; }

    // Prioritize generations without photos
    const gensNeedingPhotos = match.genIds.filter(id => !hasPhoto.has(id));
    const targetGenIds = gensNeedingPhotos.length > 0 ? gensNeedingPhotos : match.genIds.slice(0, 1);

    // Fetch images from this category
    const images = await getCategoryImages(cat.fullTitle);
    totalImages += images.length;

    if (images.length > 0) {
      // Distribute images across target generations
      const rows: any[] = [];
      for (let j = 0; j < images.length; j++) {
        const img = images[j];
        if (existingUrls.has(img.url)) continue;

        const genId = targetGenIds[j % targetGenIds.length];
        rows.push({
          generation_id: genId,
          image_type: img.title.toLowerCase().includes('interior') ? 'interior' : 'exterior',
          url: img.url,
          thumbnail_url: img.thumbUrl,
          width: img.width,
          height: img.height,
          alt_text: `${match.brandName} ${match.modelName}`,
          source: 'Wikimedia Commons',
          is_primary: !hasPhoto.has(genId),
          display_order: 0,
        });
        existingUrls.add(img.url);
      }

      if (rows.length > 0) {
        // Insert in batches of 50
        for (let batch = 0; batch < rows.length; batch += 50) {
          const chunk = rows.slice(batch, batch + 50);
          const { error } = await supabase.from('vehicle_images').insert(chunk);
          if (error) {
            errors++;
            // Try one by one
            for (const row of chunk) {
              const { error: e2 } = await supabase.from('vehicle_images').insert(row);
              if (!e2) { totalSaved++; batchSaved++; hasPhoto.add(row.generation_id); }
            }
          } else {
            totalSaved += chunk.length;
            batchSaved += chunk.length;
            for (const row of chunk) hasPhoto.add(row.generation_id);
          }
        }
        totalMatched++;
      }
    }

    processedSet.add(cat.fullTitle);

    // Progress every 25 categories
    if ((i + 1) % 25 === 0 || i === relevantCategories.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = relevantCategories.length - i - 1;
      const eta = remaining / Math.max(rate, 0.01);
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${relevantCategories.length} cats | ` +
        `+${batchSaved} saved (total: ${totalSaved}) | ` +
        `Gens w/ photos: ${hasPhoto.size}/${gens.length} | ` +
        `Errors: ${errors} | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );
    }

    // Checkpoint every 50
    if ((i + 1) % 50 === 0) {
      saveCheckpoint({
        processedCategories: [...processedSet],
        totalSaved, totalMatched, totalImages, errors,
        startedAt: checkpoint.startedAt,
      });
    }
  }

  // Final checkpoint
  saveCheckpoint({
    processedCategories: [...processedSet],
    totalSaved, totalMatched, totalImages, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Categories processed: ${processedSet.size}`);
  console.log(`  Images found:    ${totalImages}`);
  console.log(`  Images saved:    ${totalSaved}`);
  console.log(`  Categories matched: ${totalMatched}`);
  console.log(`  Gens with photos: ${hasPhoto.size}/${gens.length} (${(hasPhoto.size / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Errors:          ${errors}`);
  console.log(`  Duration:        ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
