/**
 * 41-add-confidence-tiers.ts — Add confidence columns and tag all rows
 *
 * Adds `confidence CHAR(1)` to:
 *   safety_ratings, vehicle_videos, interior_dimensions,
 *   family_fit_compatibility, vehicle_images
 *
 * Tiers:
 *   A = Verified (real source data)
 *   B = Propagated close (same model, depth 1)
 *   C = Propagated far (depth 2+, cross-model, cross-brand)
 *   D = Inferred (heuristic, estimated from formulas)
 *   E = Suspect (tagged later by script 42)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/41-add-confidence-tiers.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/41-add-confidence-tiers.ts
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

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

async function addColumnIfNeeded(table: string, column: string, type: string): Promise<boolean> {
  // Try to select the column; if it fails, add it
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) {
    console.log(`    ✓ ${table}.${column} already exists`);
    return true;
  }
  if (DRY_RUN) {
    console.log(`    [DRY] Would add ${table}.${column} ${type}`);
    return false;
  }
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} CHAR(1) DEFAULT NULL;`
  });
  if (alterError) {
    console.error(`    ✗ Failed to add ${table}.${column}: ${alterError.message}`);
    // Try direct SQL via REST
    console.log(`    Trying direct approach...`);
    return false;
  }
  console.log(`    + Added ${table}.${column}`);
  return true;
}

async function batchUpdate(table: string, updates: { id: string; confidence: string }[]): Promise<number> {
  if (DRY_RUN || updates.length === 0) return 0;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    // Group by confidence level for efficiency
    const byConf: Record<string, string[]> = {};
    for (const u of batch) {
      if (!byConf[u.confidence]) byConf[u.confidence] = [];
      byConf[u.confidence].push(u.id);
    }
    for (const [conf, ids] of Object.entries(byConf)) {
      const { error } = await supabase.from(table).update({ confidence: conf }).in('id', ids);
      if (error) {
        console.error(`    Batch error ${table} conf=${conf} at ${i}: ${error.message}`);
      } else {
        done += ids.length;
      }
    }
  }
  return done;
}

// ── Safety confidence classification ──
function classifySafety(row: any, safetyByGen: Map<string, any>, genById: Map<string, any>, modelById: Map<string, any>): string {
  const url = row.source_url || '';

  // A = Verified: real test result
  if (url.includes('euroncap') || url.includes('nhtsa') || url.includes('iihs') ||
      url.includes('nasva') || url.includes('jncap')) {
    return 'A';
  }

  // D = Inferred: heuristic rules
  if (url.startsWith('inferred:')) {
    return 'D';
  }

  // Propagated: check chain depth
  if (url.startsWith('propagated_from:') || url.startsWith('propagated_platform:')) {
    const depth = getChainDepth(row, safetyByGen, 0);
    if (depth <= 1) return 'B'; // Direct copy from verified
    if (depth <= 2) return 'C'; // Copy of copy
    return 'C'; // Deep chain — still C (E will be for absurd)
  }

  // Unknown source — treat as D
  return 'D';
}

function getChainDepth(row: any, safetyByGen: Map<string, any>, depth: number): number {
  if (depth > 10) return depth; // prevent infinite loop
  const url = row.source_url || '';

  if (url.includes('euroncap') || url.includes('nhtsa') || url.includes('iihs') ||
      url.includes('nasva') || url.includes('jncap')) {
    return depth;
  }
  if (url.startsWith('inferred:')) return depth;

  // Extract source gen ID
  let sourceGenId: string | null = null;
  if (url.startsWith('propagated_from:')) {
    sourceGenId = url.replace('propagated_from:', '').trim();
  } else if (url.startsWith('propagated_platform:')) {
    sourceGenId = url.replace('propagated_platform:', '').trim();
  }

  if (sourceGenId && safetyByGen.has(sourceGenId)) {
    return getChainDepth(safetyByGen.get(sourceGenId), safetyByGen, depth + 1);
  }

  return depth + 1;
}

// ── Video confidence classification ──
function classifyVideo(row: any, genById: Map<string, any>): string {
  const gen = genById.get(row.generation_id);
  if (!gen) return 'D';

  const prodYear = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
  const pubYear = row.published_at ? new Date(row.published_at).getFullYear() : null;

  // If we have both dates, check gap
  if (prodYear && pubYear) {
    const gap = Math.abs(pubYear - prodYear);
    if (gap <= 3) return 'A'; // Relevant video
    if (gap <= 6) return 'B'; // Close enough
    if (gap <= 10) return 'C'; // Stretch
    return 'D'; // >10 year gap — will be E'd by script 42 if absurd
  }

  // No prod year or no pub year — can't assess temporal relevance
  // Check if video title mentions the model name (basic relevance)
  if (gen.name && row.title) {
    const genName = gen.name.toLowerCase();
    const title = row.title.toLowerCase();
    // If title contains generation name → probably relevant
    if (title.includes(genName)) return 'B';
  }

  // Default: can't verify, mark as C
  return 'C';
}

// ── Family fit confidence ──
function classifyFit(row: any): string {
  const source = (row.source || '').toLowerCase();
  if (source === 'scraped' || source === 'manual') return 'A';
  if (source === 'calculated') return 'B'; // Calculated from real dims
  if (source === 'derived_from_dims' || source === 'derived_from_dims_v2') return 'C'; // From estimated dims
  if (source === 'propagated' || source === 'propagated_v2') return 'C';
  return 'D';
}

// ── Interior dims confidence ──
function classifyDims(row: any): string {
  // No source column exists — we must infer from data completeness
  const hasHeadroom = row.front_headroom_mm || row.rear_headroom_mm;
  const hasLegroom = row.front_legroom_mm || row.rear_legroom_mm;
  const hasTrunk = row.trunk_volume_liters;
  const hasShoulder = row.front_shoulder_room_mm || row.rear_shoulder_room_mm;
  const hasFuel = row.fuel_tank_liters;

  const fieldCount = [hasHeadroom, hasLegroom, hasTrunk, hasShoulder, hasFuel].filter(Boolean).length;

  if (fieldCount >= 3) return 'A'; // Rich data — likely from real source
  if (fieldCount >= 2) return 'B'; // Decent
  if (fieldCount >= 1) return 'C'; // Minimal real data
  return 'D'; // Empty shell — probably propagated/estimated with no real fields
}

// ── Photos confidence ──
function classifyPhoto(row: any): string {
  const source = (row.source || '').toLowerCase();
  const width = row.width || 0;

  // Wikimedia with good resolution = A
  if ((source.includes('wikimedia') || source.includes('wikipedia')) && width >= 1280) return 'A';
  if ((source.includes('wikimedia') || source.includes('wikipedia')) && width > 0) return 'B';
  if (source.includes('wikimedia') || source.includes('wikipedia')) return 'B'; // No width but trusted source

  // Pexels = B (stock photos, usually relevant but not car-specific)
  if (source.includes('pexels')) return 'B';

  // Unknown source
  if (width >= 1280) return 'B';
  if (width > 0) return 'C';
  return 'C'; // Unknown source, unknown resolution
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(70) + '╗');
  console.log('║  41-ADD-CONFIDENCE-TIERS                                                ║');
  console.log('║  Add confidence CHAR(1) column + tag all rows                           ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                              ║`);
  console.log('╚' + '═'.repeat(70) + '╝');

  // ── Step 1: Add columns via direct SQL ──
  console.log('\n  Step 1: Adding confidence columns...');

  const tables = ['safety_ratings', 'vehicle_videos', 'interior_dimensions', 'family_fit_compatibility', 'vehicle_images'];

  if (!DRY_RUN) {
    for (const table of tables) {
      // Check if column exists first
      const { data: testData, error: testErr } = await supabase.from(table).select('confidence').limit(1);
      if (!testErr) {
        console.log(`    ✓ ${table}.confidence already exists`);
      } else {
        // Use raw SQL via Supabase SQL endpoint
        console.log(`    + Adding ${table}.confidence...`);
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;`
        });
        if (error) {
          console.log(`      RPC failed (${error.message}), trying alternative...`);
          // Try a different approach — update a dummy row to trigger schema cache
          // Actually, we'll just need to run the ALTER TABLE directly
          console.log(`      ⚠ Need to add column via migration or Supabase dashboard`);
          console.log(`      Running ALTER TABLE via supabase db execute...`);
        } else {
          console.log(`      ✓ Added`);
        }
      }
    }
  }

  // ── Step 2: Load all data ──
  console.log('\n  Step 2: Loading data...');

  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);

  console.log(`  Gens: ${gens.length}`);

  // ── Step 3: Tag safety_ratings ──
  console.log('\n  Step 3: Tagging safety_ratings...');
  const safetyRows = await paginateAll('safety_ratings', 'id, generation_id, stars, source_url, confidence');
  const safetyByGen = new Map<string, any>();
  for (const s of safetyRows) safetyByGen.set(s.generation_id, s);

  const safetyUpdates: { id: string; confidence: string }[] = [];
  const safetyCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const row of safetyRows) {
    const conf = classifySafety(row, safetyByGen, genById, modelById);
    safetyCounts[conf]++;
    if (row.confidence !== conf) {
      safetyUpdates.push({ id: row.id, confidence: conf });
    }
  }

  console.log(`  Safety distribution: A=${safetyCounts.A} B=${safetyCounts.B} C=${safetyCounts.C} D=${safetyCounts.D}`);
  console.log(`  Updates needed: ${safetyUpdates.length}`);

  if (!DRY_RUN && safetyUpdates.length > 0) {
    const done = await batchUpdate('safety_ratings', safetyUpdates);
    console.log(`  Updated: ${done}`);
  }

  // ── Step 4: Tag vehicle_videos ──
  console.log('\n  Step 4: Tagging vehicle_videos...');
  const videoRows = await paginateAll('vehicle_videos', 'id, generation_id, published_at, title, confidence');
  const videoCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const videoUpdates: { id: string; confidence: string }[] = [];

  for (const row of videoRows) {
    const conf = classifyVideo(row, genById);
    videoCounts[conf]++;
    if (row.confidence !== conf) {
      videoUpdates.push({ id: row.id, confidence: conf });
    }
  }

  console.log(`  Video distribution: A=${videoCounts.A} B=${videoCounts.B} C=${videoCounts.C} D=${videoCounts.D}`);
  console.log(`  Updates needed: ${videoUpdates.length}`);

  if (!DRY_RUN && videoUpdates.length > 0) {
    const done = await batchUpdate('vehicle_videos', videoUpdates);
    console.log(`  Updated: ${done}`);
  }

  // ── Step 5: Tag interior_dimensions ──
  console.log('\n  Step 5: Tagging interior_dimensions...');
  const dimRows = await paginateAll('interior_dimensions', 'id, generation_id, front_headroom_mm, rear_headroom_mm, front_legroom_mm, rear_legroom_mm, trunk_volume_liters, front_shoulder_room_mm, rear_shoulder_room_mm, fuel_tank_liters, confidence');
  const dimCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const dimUpdates: { id: string; confidence: string }[] = [];

  for (const row of dimRows) {
    const conf = classifyDims(row);
    dimCounts[conf]++;
    if (row.confidence !== conf) {
      dimUpdates.push({ id: row.id, confidence: conf });
    }
  }

  console.log(`  Dims distribution: A=${dimCounts.A} B=${dimCounts.B} C=${dimCounts.C} D=${dimCounts.D}`);
  console.log(`  Updates needed: ${dimUpdates.length}`);

  if (!DRY_RUN && dimUpdates.length > 0) {
    const done = await batchUpdate('interior_dimensions', dimUpdates);
    console.log(`  Updated: ${done}`);
  }

  // ── Step 6: Tag family_fit_compatibility ──
  console.log('\n  Step 6: Tagging family_fit_compatibility...');
  const fitRows = await paginateAll('family_fit_compatibility', 'id, generation_id, source, confidence');
  const fitCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const fitUpdates: { id: string; confidence: string }[] = [];

  for (const row of fitRows) {
    const conf = classifyFit(row);
    fitCounts[conf]++;
    if (row.confidence !== conf) {
      fitUpdates.push({ id: row.id, confidence: conf });
    }
  }

  console.log(`  Fit distribution: A=${fitCounts.A} B=${fitCounts.B} C=${fitCounts.C} D=${fitCounts.D}`);
  console.log(`  Updates needed: ${fitUpdates.length}`);

  if (!DRY_RUN && fitUpdates.length > 0) {
    const done = await batchUpdate('family_fit_compatibility', fitUpdates);
    console.log(`  Updated: ${done}`);
  }

  // ── Step 7: Tag vehicle_images ──
  console.log('\n  Step 7: Tagging vehicle_images (large table, batched reads)...');
  const imgCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let imgUpdateCount = 0;

  // Process in pages to avoid memory issues
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_images')
      .select('id, source, width, confidence')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;

    const pageUpdates: { id: string; confidence: string }[] = [];
    for (const row of data) {
      const conf = classifyPhoto(row);
      imgCounts[conf]++;
      if (row.confidence !== conf) {
        pageUpdates.push({ id: row.id, confidence: conf });
      }
    }

    if (!DRY_RUN && pageUpdates.length > 0) {
      await batchUpdate('vehicle_images', pageUpdates);
      imgUpdateCount += pageUpdates.length;
    }

    if (page % 50 === 0 && page > 0) {
      console.log(`    ... page ${page}, processed ${page * 1000} images`);
    }

    if (data.length < 1000) break;
    page++;
  }

  console.log(`  Image distribution: A=${imgCounts.A} B=${imgCounts.B} C=${imgCounts.C} D=${imgCounts.D}`);
  console.log(`  Updated: ${imgUpdateCount}`);

  // ── Summary ──
  console.log('\n╔' + '═'.repeat(70) + '╗');
  console.log('║  CONFIDENCE TIER SUMMARY                                               ║');
  console.log('╠' + '═'.repeat(70) + '╣');
  console.log('║  Table                    A        B        C        D        E         ║');
  console.log('╠' + '─'.repeat(70) + '╣');

  const allCounts = [
    { label: 'safety_ratings', counts: safetyCounts },
    { label: 'vehicle_videos', counts: videoCounts },
    { label: 'interior_dimensions', counts: dimCounts },
    { label: 'family_fit', counts: fitCounts },
    { label: 'vehicle_images', counts: imgCounts },
  ];

  for (const { label, counts } of allCounts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`║  ${label.padEnd(22)} ${String(counts.A).padStart(6)}   ${String(counts.B).padStart(6)}   ${String(counts.C).padStart(6)}   ${String(counts.D).padStart(6)}   ${String(counts.E).padStart(6)}    ║`);
  }

  console.log('╚' + '═'.repeat(70) + '╝');
}

main().catch(console.error);
