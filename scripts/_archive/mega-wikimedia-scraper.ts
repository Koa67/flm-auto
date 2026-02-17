/**
 * FLM AUTO — Mega Wikimedia Commons Scraper
 * Targets all 2743 generations without photos
 * Uses category-based approach with multiple fallback patterns
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_wikimedia.json');
const BATCH_SIZE = 50; // Checkpoint every N generations
const DELAY_MS = 250; // Polite delay between API calls
const MAX_IMAGES_PER_GEN = 5;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CheckpointData {
  processedGenIds: string[];
  totalSaved: number;
  totalProcessed: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedGenIds: [], totalSaved: 0, totalProcessed: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// Fetch images from a Wikimedia category with pagination
async function getCategoryImages(category: string, maxImages = 20): Promise<any[]> {
  const allImages: any[] = [];
  let cmcontinue: string | undefined;

  while (allImages.length < maxImages) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${category}`,
      gcmtype: 'file',
      gcmlimit: String(Math.min(50, maxImages - allImages.length)),
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });
    if (cmcontinue) params.set('gcmcontinue', cmcontinue);

    try {
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!res.ok) break;
      const data = await res.json();

      for (const page of Object.values(data.query?.pages || {}) as any[]) {
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        if (ii.width < 600 || ii.height < 400) continue;
        if (!ii.mime?.startsWith('image/')) continue;
        const ext = ii.url?.split('.').pop()?.toLowerCase();
        if (['svg', 'pdf', 'tiff', 'tif', 'gif'].includes(ext)) continue;

        allImages.push({
          url: ii.url,
          thumbUrl: ii.thumburl || ii.url,
          width: ii.width,
          height: ii.height,
          title: page.title?.replace('File:', ''),
        });
      }

      cmcontinue = data.continue?.gcmcontinue;
      if (!cmcontinue) break;
    } catch {
      break;
    }
  }
  return allImages;
}

// Try subcategories if direct category has few results
async function getSubcategories(category: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'subcat',
      cmlimit: '20',
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.categorymembers || []).map((c: any) => c.title?.replace('Category:', ''));
  } catch {
    return [];
  }
}

// Build category patterns to try for a given generation
function buildCategoryPatterns(brand: string, model: string, genName: string, chassis: string | null, slug: string): string[] {
  const patterns: string[] = [];

  // Normalize brand for Wikimedia
  const wmBrand = brand === 'Mercedes-Benz' ? 'Mercedes-Benz' : brand;

  // Direct brand + model patterns
  patterns.push(`${wmBrand} ${model}`);
  patterns.push(`${wmBrand}_${model}`.replace(/ /g, '_'));

  // With chassis code (very specific)
  if (chassis) {
    patterns.push(`${wmBrand} ${chassis}`);
    patterns.push(`${wmBrand}_${chassis}`);
    // BMW-specific: E30, E46, F10 etc
    if (brand === 'BMW') {
      patterns.push(`BMW ${chassis}`);
    }
    // Mercedes: W124, W140 etc
    if (brand === 'Mercedes-Benz') {
      patterns.push(`Mercedes-Benz ${chassis}`);
      patterns.push(`Mercedes-Benz_${chassis}`);
    }
  }

  // Model-only patterns (some categories are just "Countach" or "M3")
  if (!model.includes('Class') && !model.includes('Classe') && !model.includes('Serie')) {
    patterns.push(`${model} (automobile)`);
    patterns.push(`${model}_cars`);
  }

  // Lamborghini-specific: often just model name
  if (brand === 'Lamborghini') {
    patterns.push(`Lamborghini ${model}`);
    patterns.push(`Lamborghini_${model}`);
  }

  // Generation/slug-based (e.g. "BMW E30", "Mercedes-Benz W124")
  const genParts = genName.match(/[A-Z]\d{2,3}/);
  if (genParts) {
    patterns.push(`${wmBrand} ${genParts[0]}`);
  }

  return [...new Set(patterns)];
}

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

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega Wikimedia Commons Scraper');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedGenIds);
  let totalSaved = checkpoint.totalSaved;
  let totalProcessed = checkpoint.totalProcessed;
  let errors = checkpoint.errors;

  if (processedSet.size > 0) {
    console.log(`Resuming from checkpoint: ${processedSet.size} already processed, ${totalSaved} saved\n`);
  }

  // Get all generations with brand/model info
  console.log('Loading generations...');
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, body_type, model_id');
  const models = await paginateAll('models', 'id, name, slug, brand_id');
  const brands = await paginateAll('brands', 'id, name, slug');
  console.log(`Loaded: ${gens.length} generations, ${models.length} models, ${brands.length} brands`);

  // Get existing photos
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id');
  const hasPhoto = new Set(existingPhotos.map(p => p.generation_id).filter(Boolean));
  console.log(`Existing photos cover ${hasPhoto.size} generations`);

  // Build lookup maps
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  // Filter to generations that need photos and haven't been processed
  const gensToProcess = gens.filter(g => !hasPhoto.has(g.id) && !processedSet.has(g.id));
  console.log(`\nGenerations to process: ${gensToProcess.length}\n`);

  const startTime = Date.now();
  let batchSaved = 0;
  let matchedCount = 0;
  let noMatchCount = 0;

  for (let i = 0; i < gensToProcess.length; i++) {
    const gen = gensToProcess[i];
    const model = modelMap.get(gen.model_id);
    if (!model) { totalProcessed++; continue; }
    const brand = brandMap.get(model.brand_id);
    if (!brand) { totalProcessed++; continue; }

    const categories = buildCategoryPatterns(brand.name, model.name, gen.name, gen.chassis_code, gen.slug);

    let photos: any[] = [];

    // Try each category pattern
    for (const cat of categories) {
      photos = await getCategoryImages(cat, MAX_IMAGES_PER_GEN);
      if (photos.length > 0) break;
      await delay(DELAY_MS);
    }

    // If no direct results, try subcategories of the first pattern
    if (photos.length === 0 && categories.length > 0) {
      const subs = await getSubcategories(categories[0]);
      await delay(DELAY_MS);
      for (const sub of subs.slice(0, 3)) {
        photos = await getCategoryImages(sub, MAX_IMAGES_PER_GEN);
        if (photos.length > 0) break;
        await delay(DELAY_MS);
      }
    }

    if (photos.length > 0) {
      matchedCount++;
      const rows = photos.slice(0, MAX_IMAGES_PER_GEN).map((photo, idx) => ({
        generation_id: gen.id,
        image_type: 'exterior',
        url: photo.url,
        thumbnail_url: photo.thumbUrl,
        width: photo.width,
        height: photo.height,
        alt_text: `${brand.name} ${model.name} ${gen.name}`,
        source: 'Wikimedia Commons',
        is_primary: idx === 0,
        display_order: idx,
      }));

      // Check for existing URLs to avoid duplicates
      const urls = rows.map(r => r.url);
      const { data: existing } = await supabase.from('vehicle_images').select('url').in('url', urls);
      const existingUrls = new Set((existing || []).map(e => e.url));
      const newRows = rows.filter(r => !existingUrls.has(r.url));

      if (newRows.length > 0) {
        const { error } = await supabase.from('vehicle_images').insert(newRows);
        if (error) {
          errors++;
        } else {
          totalSaved += newRows.length;
          batchSaved += newRows.length;
        }
      }
    } else {
      noMatchCount++;
    }

    totalProcessed++;
    processedSet.add(gen.id);

    // Progress logging every 25 generations
    if ((i + 1) % 25 === 0 || i === gensToProcess.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalProcessed / elapsed;
      const remaining = gensToProcess.length - i - 1;
      const eta = remaining / Math.max(rate, 0.1);
      const etaMin = Math.floor(eta / 60);
      const etaSec = Math.floor(eta % 60);

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${gensToProcess.length} | ` +
        `Saved: ${batchSaved} (total: ${totalSaved}) | ` +
        `Matched: ${matchedCount} No-match: ${noMatchCount} | ` +
        `Errors: ${errors} | ` +
        `ETA: ${etaMin}m${etaSec}s`
      );
    }

    // Checkpoint every BATCH_SIZE
    if ((i + 1) % BATCH_SIZE === 0) {
      saveCheckpoint({
        processedGenIds: [...processedSet],
        totalSaved,
        totalProcessed,
        errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(DELAY_MS);
  }

  // Final checkpoint
  saveCheckpoint({
    processedGenIds: [...processedSet],
    totalSaved,
    totalProcessed,
    errors,
    startedAt: checkpoint.startedAt,
  });

  // Final report
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:   ${totalProcessed} generations`);
  console.log(`  Matched:     ${matchedCount} (${(matchedCount / Math.max(totalProcessed, 1) * 100).toFixed(1)}%)`);
  console.log(`  Images saved: ${totalSaved}`);
  console.log(`  No match:    ${noMatchCount}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Duration:    ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
