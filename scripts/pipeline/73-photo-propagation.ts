/**
 * 73-photo-propagation.ts — Photo propagation (B-tier) for remaining gaps
 *
 * For gens that STILL have no A/B photos after Wikimedia v2:
 *   P1: Facelift shares photos with pre-facelift
 *   P2: Body variant shares with base model (exterior only)
 *   P3: Same model adjacent generation (gap < 3 years)
 *
 * Protection: NEVER overwrite existing A/B photos.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/73-photo-propagation.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/73-photo-propagation.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;
const MAX_PROPAGATE = 5; // Max photos to propagate per gen
const DATA_DIR = path.resolve(__dirname, '../../data');

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

// Facelift detection patterns
const FACELIFT_PATTERNS = [
  /facelift/i, /phase\s*2/i, /phase\s*ii/i, /restyl/i,
  /fl$/i, /lci$/i, /lci\s*2/i, /mca$/i,
];

function isFacelift(name: string): boolean {
  return FACELIFT_PATTERNS.some(p => p.test(name));
}

function getBaseName(name: string): string {
  let base = name;
  for (const p of FACELIFT_PATTERNS) {
    base = base.replace(p, '');
  }
  return base.trim().replace(/\s+/g, ' ');
}

// Body variant patterns (SW, Touring, Avant, Break, Estate, Combi, etc.)
const BODY_VARIANT_SUFFIXES = [
  /\s+(sw|break|estate|touring|avant|combi|sportback|alltrack|cross\s?country|scout|allroad|variant|wagon|st|shooting\s?brake)$/i,
  /\s+(coupé|coupe|cabriolet|cabrio|convertible|roadster|spider|spyder|targa|berline|sedan|limousine|gran\s?coupé|gran\s?coupe|gran\s?turismo|gt)$/i,
  /\s+(cross|suv|4x4|awd|4motion|quattro|xdrive|4matic)$/i,
];

function isBodyVariant(name: string): { isVariant: boolean; baseName: string } {
  for (const p of BODY_VARIANT_SUFFIXES) {
    if (p.test(name)) {
      return { isVariant: true, baseName: name.replace(p, '').trim() };
    }
  }
  return { isVariant: false, baseName: name };
}

function extractStartYear(gen: any): number | null {
  if (gen.production_start) {
    const y = parseInt(gen.production_start.substring(0, 4));
    if (y >= 1950 && y <= 2030) return y;
  }
  if (gen.slug) {
    const match = gen.slug.match(/(\d{4})$/);
    if (match) {
      const y = parseInt(match[1]);
      if (y >= 1950 && y <= 2030) return y;
    }
  }
  return null;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  73-PHOTO-PROPAGATION — B-tier photo fill');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading data...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model_id, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Load images with confidence
  const images = await paginateAll('vehicle_images', 'id, generation_id, url, image_type, confidence, source, alt_text, width, height');
  console.log(`  Images: ${images.length}`);

  // Build per-gen photo map
  const genPhotos = new Map<string, { count: number; hasAB: boolean; photos: any[] }>();
  for (const img of images) {
    if (!img.generation_id) continue;
    if (!genPhotos.has(img.generation_id)) {
      genPhotos.set(img.generation_id, { count: 0, hasAB: false, photos: [] });
    }
    const stat = genPhotos.get(img.generation_id)!;
    stat.count++;
    if (img.confidence === 'A' || img.confidence === 'B') stat.hasAB = true;
    // Keep A/B photos for propagation source
    if (img.confidence === 'A' || img.confidence === 'B') {
      stat.photos.push(img);
    }
  }

  // Identify targets: gens with no A/B photos
  const targets = new Set<string>();
  for (const gen of gens) {
    const stat = genPhotos.get(gen.id);
    if (!stat || !stat.hasAB) {
      targets.add(gen.id);
    }
  }
  console.log(`  Target gens (no A/B photos): ${targets.size}`);

  // Build gen lookup maps
  const genById = new Map<string, any>();
  for (const gen of gens) genById.set(gen.id, gen);

  // Group gens by model_id
  const gensByModel = new Map<string, any[]>();
  for (const gen of gens) {
    if (!gen.model_id) continue;
    if (!gensByModel.has(gen.model_id)) gensByModel.set(gen.model_id, []);
    gensByModel.get(gen.model_id)!.push(gen);
  }

  const toInsert: any[] = [];
  const stats = { p1: 0, p2: 0, p3: 0, totalImages: 0 };
  const propagated = new Set<string>(); // Track already-propagated gens

  // ---- RULE P1: Facelift shares photos with pre-facelift ----
  console.log('\n  Rule P1: Facelift → pre-facelift...');
  for (const gen of gens) {
    if (!targets.has(gen.id) || propagated.has(gen.id)) continue;
    if (!gen.name || !gen.model_id) continue;

    const isFL = isFacelift(gen.name);
    if (!isFL) continue;

    // Find the base (non-facelift) gen in same model
    const baseName = getBaseName(gen.name);
    const siblings = gensByModel.get(gen.model_id) || [];
    const source = siblings.find(s =>
      s.id !== gen.id &&
      !isFacelift(s.name || '') &&
      genPhotos.get(s.id)?.hasAB &&
      (s.name || '').toLowerCase().includes(baseName.toLowerCase())
    );

    if (source) {
      const sourcePhotos = genPhotos.get(source.id)!.photos.slice(0, MAX_PROPAGATE);
      for (const photo of sourcePhotos) {
        toInsert.push({
          generation_id: gen.id,
          url: photo.url,
          image_type: photo.image_type || 'exterior',
          confidence: 'B',
          source: photo.source || 'Wikimedia Commons',
          alt_text: `${gen.model?.brand?.name || ''} ${gen.model?.name || ''} ${gen.name || ''}`.trim(),
          width: photo.width,
          height: photo.height,
          display_order: 99,
          is_primary: false,
        });
        stats.totalImages++;
      }
      propagated.add(gen.id);
      stats.p1++;
    }
  }
  console.log(`    P1 matched: ${stats.p1} gens, ${stats.totalImages} images`);

  // Also check reverse: base gen has no photos but facelift does
  for (const gen of gens) {
    if (!targets.has(gen.id) || propagated.has(gen.id)) continue;
    if (!gen.name || !gen.model_id) continue;
    if (isFacelift(gen.name)) continue; // Already handled above

    const siblings = gensByModel.get(gen.model_id) || [];
    const flSource = siblings.find(s =>
      s.id !== gen.id &&
      isFacelift(s.name || '') &&
      genPhotos.get(s.id)?.hasAB &&
      getBaseName(s.name || '').toLowerCase().includes(gen.name.toLowerCase())
    );

    if (flSource) {
      const sourcePhotos = genPhotos.get(flSource.id)!.photos.slice(0, MAX_PROPAGATE);
      for (const photo of sourcePhotos) {
        toInsert.push({
          generation_id: gen.id,
          url: photo.url,
          image_type: photo.image_type || 'exterior',
          confidence: 'B',
          source: photo.source || 'Wikimedia Commons',
          alt_text: `${gen.model?.brand?.name || ''} ${gen.model?.name || ''} ${gen.name || ''}`.trim(),
          width: photo.width,
          height: photo.height,
          display_order: 99,
          is_primary: false,
        });
        stats.totalImages++;
      }
      propagated.add(gen.id);
      stats.p1++;
    }
  }
  console.log(`    P1 total: ${stats.p1} gens`);

  // ---- RULE P2: Body variant shares with base model ----
  console.log('\n  Rule P2: Body variant → base...');
  const p2start = stats.totalImages;
  for (const gen of gens) {
    if (!targets.has(gen.id) || propagated.has(gen.id)) continue;
    if (!gen.name || !gen.model_id) continue;

    const { isVariant, baseName } = isBodyVariant(gen.name);
    if (!isVariant) continue;

    // Find the base gen in same model
    const siblings = gensByModel.get(gen.model_id) || [];
    const source = siblings.find(s =>
      s.id !== gen.id &&
      genPhotos.get(s.id)?.hasAB &&
      (s.name || '').toLowerCase() === baseName.toLowerCase()
    );

    if (source) {
      // Only propagate exterior photos for body variants
      const sourcePhotos = genPhotos.get(source.id)!.photos
        .filter(p => p.image_type === 'exterior' || !p.image_type)
        .slice(0, MAX_PROPAGATE);
      for (const photo of sourcePhotos) {
        toInsert.push({
          generation_id: gen.id,
          url: photo.url,
          image_type: 'exterior',
          confidence: 'B',
          source: photo.source || 'Wikimedia Commons',
          alt_text: `${gen.model?.brand?.name || ''} ${gen.model?.name || ''} ${gen.name || ''}`.trim(),
          width: photo.width,
          height: photo.height,
          display_order: 99,
          is_primary: false,
        });
        stats.totalImages++;
      }
      propagated.add(gen.id);
      stats.p2++;
    }
  }
  console.log(`    P2 matched: ${stats.p2} gens, ${stats.totalImages - p2start} images`);

  // ---- RULE P3: Same model adjacent generation (gap < 3 years) ----
  console.log('\n  Rule P3: Adjacent generation...');
  const p3start = stats.totalImages;
  for (const gen of gens) {
    if (!targets.has(gen.id) || propagated.has(gen.id)) continue;
    if (!gen.model_id) continue;

    const targetYear = extractStartYear(gen);
    if (!targetYear) continue;

    // Find closest gen in same model with A/B photos
    const siblings = gensByModel.get(gen.model_id) || [];
    let bestSource: any = null;
    let bestDist = Infinity;

    for (const s of siblings) {
      if (s.id === gen.id) continue;
      if (!genPhotos.get(s.id)?.hasAB) continue;

      const sourceYear = extractStartYear(s);
      if (!sourceYear) continue;

      const dist = Math.abs(targetYear - sourceYear);
      if (dist <= 3 && dist < bestDist) {
        bestDist = dist;
        bestSource = s;
      }
    }

    if (bestSource) {
      const sourcePhotos = genPhotos.get(bestSource.id)!.photos.slice(0, MAX_PROPAGATE);
      for (const photo of sourcePhotos) {
        toInsert.push({
          generation_id: gen.id,
          url: photo.url,
          image_type: photo.image_type || 'exterior',
          confidence: 'B',
          source: photo.source || 'Wikimedia Commons',
          alt_text: `${gen.model?.brand?.name || ''} ${gen.model?.name || ''} ${gen.name || ''}`.trim(),
          width: photo.width,
          height: photo.height,
          display_order: 99,
          is_primary: false,
        });
        stats.totalImages++;
      }
      propagated.add(gen.id);
      stats.p3++;
    }
  }
  console.log(`    P3 matched: ${stats.p3} gens, ${stats.totalImages - p3start} images`);

  // ---- RULE P4: Same model, unlimited year range (most aggressive) ----
  console.log('\n  Rule P4: Same model (any year)...');
  const p4start = stats.totalImages;
  for (const gen of gens) {
    if (!targets.has(gen.id) || propagated.has(gen.id)) continue;
    if (!gen.model_id) continue;

    const siblings = gensByModel.get(gen.model_id) || [];
    const targetYear = extractStartYear(gen);

    // Find any sibling gen with A/B photos, prefer closest by year
    let bestSource: any = null;
    let bestDist = Infinity;

    for (const s of siblings) {
      if (s.id === gen.id) continue;
      if (!genPhotos.get(s.id)?.hasAB) continue;

      if (targetYear) {
        const sourceYear = extractStartYear(s);
        const dist = sourceYear ? Math.abs(targetYear - sourceYear) : 999;
        if (dist < bestDist) {
          bestDist = dist;
          bestSource = s;
        }
      } else {
        bestSource = s;
        break;
      }
    }

    if (bestSource) {
      const sourcePhotos = genPhotos.get(bestSource.id)!.photos.slice(0, MAX_PROPAGATE);
      for (const photo of sourcePhotos) {
        toInsert.push({
          generation_id: gen.id,
          url: photo.url,
          image_type: photo.image_type || 'exterior',
          confidence: 'B',
          source: photo.source || 'Wikimedia Commons',
          alt_text: `${gen.model?.brand?.name || ''} ${gen.model?.name || ''} ${gen.name || ''}`.trim(),
          width: photo.width,
          height: photo.height,
          display_order: 99,
          is_primary: false,
        });
        stats.totalImages++;
      }
      propagated.add(gen.id);
      (stats as any).p4 = ((stats as any).p4 || 0) + 1;
    }
  }
  console.log(`    P4 matched: ${(stats as any).p4 || 0} gens, ${stats.totalImages - p4start} images`);

  // Summary
  console.log('\n  SUMMARY:');
  console.log(`    P1 (facelift): ${stats.p1} gens`);
  console.log(`    P2 (body variant): ${stats.p2} gens`);
  console.log(`    P3 (adjacent gen ≤3y): ${stats.p3} gens`);
  console.log(`    P4 (same model any year): ${(stats as any).p4 || 0} gens`);
  console.log(`    Total propagated: ${propagated.size} gens`);
  console.log(`    Total images: ${stats.totalImages}`);
  console.log(`    Remaining gaps: ${targets.size - propagated.size} gens`);

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} images...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_images').insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    console.log(`  Inserted: ${inserted}`);
  }

  // Report
  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    targets: targets.size,
    propagated: propagated.size,
    remaining: targets.size - propagated.size,
    p1_facelift: stats.p1,
    p2_body_variant: stats.p2,
    p3_adjacent_gen: stats.p3,
    p4_same_model_any: (stats as any).p4 || 0,
    total_images: stats.totalImages,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'photo-propagation-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n  Report saved to data/photo-propagation-report.json`);
}

main().catch(console.error);
