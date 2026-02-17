/**
 * FLM AUTO — Photo Gap Filler (Pexels Only)
 * Targets the ~655 remaining orphan generations using Pexels API
 * 200 req/hour limit — processes ~200 gens then waits
 *
 * Strategy: Use brand + model name as search query
 * For generic names, use brand + body_type as fallback
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-photo-gaps-pexels.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_pexels.json');
const PEXELS_API_KEY = 'H2AOu3UIjVVx2ASLCSV80nk1AgMMHA8jVp6o3bmGNiw9UmGf1vQbPokM';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CheckpointData {
  processedGenIds: string[];
  totalSaved: number;
  requests: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedGenIds: [], totalSaved: 0, requests: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

async function searchPexels(query: string): Promise<any[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });

    if (res.status === 429) {
      console.log('   Rate limited! Waiting 60s...');
      await delay(60000);
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    return (data.photos || []).map((p: any) => ({
      url: p.src.original,
      thumbUrl: p.src.large,
      width: p.width,
      height: p.height,
      title: p.alt || query,
      source: 'Pexels',
      sourceUrl: p.url,
    }));
  } catch {
    return [];
  }
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
  console.log('  FLM AUTO — Pexels Photo Gap Filler');
  console.log('  Target: 84.7% → 90%');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedGenIds);
  let { totalSaved, requests, errors } = checkpoint;

  // Get orphans
  console.log('Loading data...');
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, body_type, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id');

  const hasPhoto = new Set(existingPhotos.map(p => p.generation_id).filter(Boolean));
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  const orphans = gens.filter(g => {
    if (hasPhoto.has(g.id) || processedSet.has(g.id)) return false;
    const model = modelMap.get(g.model_id);
    if (!model) return false;
    const brand = brandMap.get(model.brand_id);
    return !!brand;
  });

  const totalGens = 4268;
  const covered = totalGens - orphans.length - processedSet.size;
  console.log(`Orphans: ${orphans.length}, Current coverage: ~${covered} covered\n`);

  const startTime = Date.now();
  let coveredThisRun = 0;

  for (let i = 0; i < orphans.length; i++) {
    const gen = orphans[i];
    const model = modelMap.get(gen.model_id)!;
    const brand = brandMap.get(model.brand_id)!;

    // Try multiple queries
    const queries = [
      `${brand.name} ${model.name} car`,
      `${brand.name} ${model.name}`,
    ];
    if (gen.body_type) {
      queries.push(`${brand.name} ${gen.body_type} car`);
    }

    let photos: any[] = [];
    for (const q of queries) {
      photos = await searchPexels(q);
      requests++;
      await delay(1000); // Simple 1s delay — well within 200 req/hour
      if (photos.length > 0) break;
    }

    if (photos.length > 0) {
      const rows = photos.slice(0, 2).map((p, idx) => ({
        generation_id: gen.id,
        image_type: 'exterior',
        url: p.url,
        thumbnail_url: p.thumbUrl,
        width: p.width,
        height: p.height,
        alt_text: `${brand.name} ${model.name} ${gen.name}`,
        source: 'Pexels',
        source_url: p.sourceUrl,
        is_primary: idx === 0,
        display_order: idx,
      }));

      const urls = rows.map(r => r.url);
      const { data: existing } = await supabase.from('vehicle_images').select('url').in('url', urls);
      const existingUrls = new Set((existing || []).map(e => e.url));
      const newRows = rows.filter(r => !existingUrls.has(r.url));

      if (newRows.length > 0) {
        const { error } = await supabase.from('vehicle_images').insert(newRows);
        if (!error) {
          totalSaved += newRows.length;
          coveredThisRun++;
        } else {
          errors++;
        }
      }
    }

    processedSet.add(gen.id);

    if ((i + 1) % 25 === 0 || i === orphans.length - 1) {
      const cov = covered + coveredThisRun;
      const pct = (cov / totalGens * 100).toFixed(1);
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${orphans.length} | ` +
        `Coverage: ~${cov}/${totalGens} (${pct}%) | ` +
        `+${totalSaved} imgs, +${coveredThisRun} gens | ` +
        `Requests: ${requests} | ` +
        `Errors: ${errors}`
      );

      if (cov >= Math.ceil(totalGens * 0.9)) {
        console.log('\n  TARGET 90% REACHED!');
        break;
      }
    }

    if ((i + 1) % 50 === 0) {
      saveCheckpoint({
        processedGenIds: [...processedSet],
        totalSaved, requests, errors,
        startedAt: checkpoint.startedAt,
      });
    }
  }

  saveCheckpoint({
    processedGenIds: [...processedSet],
    totalSaved, requests, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PEXELS GAP FILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:   ${processedSet.size} generations`);
  console.log(`  New gens:    +${coveredThisRun}`);
  console.log(`  Images:      ${totalSaved}`);
  console.log(`  API reqs:    ${requests}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Duration:    ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
