/**
 * tag-interior-photos.ts
 *
 * Re-classifies existing vehicle_images by analyzing image_url strings
 * for keywords to set the `image_subcategory` column.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/tag-interior-photos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// paginateAll helper — fetches all rows 1000 at a time
// ---------------------------------------------------------------------------
async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error(`  Error fetching ${table} page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
    if (page % 50 === 0) console.log(`  ... loaded ${all.length} rows from ${table}`);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Keyword classification rules
// ---------------------------------------------------------------------------

interface TagResult {
  image_subcategory: string;
  image_type?: string; // only set when we want to override
}

function classify(url: string): TagResult | null {
  const lc = url.toLowerCase();

  // --- Interior: dashboard / cockpit ---
  if (
    lc.includes('interior') ||
    lc.includes('cockpit') ||
    lc.includes('dashboard') ||
    lc.includes('interieur') ||
    lc.includes('innen') ||
    lc.includes('habitacle')
  ) {
    return { image_subcategory: 'dashboard', image_type: 'interior' };
  }

  // --- Interior: rear seats ---
  if (
    lc.includes('rear_seat') ||
    lc.includes('back_seat') ||
    lc.includes('rear seat') ||
    lc.includes('banquette') ||
    lc.includes('rücksitz') ||
    lc.includes('rucksitz') ||
    lc.includes('fond')
  ) {
    return { image_subcategory: 'rear_seats', image_type: 'interior' };
  }

  // --- Interior: front seats ---
  if (
    lc.includes('front_seat') ||
    lc.includes('front seat') ||
    lc.includes('vordersitz') ||
    lc.includes('siege_avant')
  ) {
    return { image_subcategory: 'front_seats', image_type: 'interior' };
  }

  // --- Interior: trunk ---
  if (
    lc.includes('trunk') ||
    lc.includes('boot') ||
    lc.includes('coffre') ||
    lc.includes('kofferraum') ||
    lc.includes('luggage') ||
    lc.includes('cargo')
  ) {
    return { image_subcategory: 'trunk', image_type: 'interior' };
  }

  // --- Interior: screen / infotainment ---
  if (
    lc.includes('screen') ||
    lc.includes('display') ||
    lc.includes('infotainment') ||
    lc.includes('ecran')
  ) {
    return { image_subcategory: 'screen', image_type: 'interior' };
  }

  // --- Engine / mechanical ---
  if (
    lc.includes('engine') ||
    lc.includes('motor') ||
    lc.includes('moteur')
  ) {
    return { image_subcategory: 'engine' };
  }

  // --- Exterior sub-types (order matters: check seat-containing keywords first) ---

  // Front exterior (but NOT front_seat / front seat, already matched above)
  if (lc.includes('front') && !lc.includes('front_seat') && !lc.includes('front seat')) {
    return { image_subcategory: 'front' };
  }

  // Rear exterior (but NOT rear_seat / rear seat / back_seat, already matched above)
  if (
    lc.includes('rear') &&
    !lc.includes('rear_seat') &&
    !lc.includes('rear seat') &&
    !lc.includes('back_seat')
  ) {
    return { image_subcategory: 'rear' };
  }

  // Side
  if (lc.includes('side') || lc.includes('profil') || lc.includes('lateral')) {
    return { image_subcategory: 'side' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Loading all vehicle_images...');
  const images = await paginateAll('vehicle_images', 'id,url,image_type,source');
  console.log(`Loaded ${images.length} images. Classifying...`);

  // Counters per subcategory
  const counters: Record<string, number> = {};
  let totalTagged = 0;

  // Collect updates: { id, patch }
  const updates: { id: string; patch: { image_subcategory: string; image_type?: string } }[] = [];

  for (const img of images) {
    const result = classify(img.url || '');
    if (!result) continue;

    const patch: { image_subcategory: string; image_type?: string } = {
      image_subcategory: result.image_subcategory,
    };
    // Only override image_type when the classifier says so
    if (result.image_type) {
      patch.image_type = result.image_type;
    }

    updates.push({ id: img.id, patch });
    counters[result.image_subcategory] = (counters[result.image_subcategory] || 0) + 1;
    totalTagged++;
  }

  console.log(`\nClassification complete. ${totalTagged} images to tag out of ${images.length}.`);
  console.log('Subcategory breakdown:', counters);
  console.log('\nStarting batch updates (500 per batch)...');

  const BATCH_SIZE = 500;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(({ id, patch }) =>
        supabase
          .from('vehicle_images')
          .update(patch)
          .eq('id', id)
      )
    );

    for (const r of results) {
      if (r.error) {
        errors++;
        if (errors <= 5) {
          console.error('Update error:', r.error.message);
        }
      }
    }

    processed += batch.length;

    // Progress every 10K or at the end
    if (processed % 10000 < BATCH_SIZE || processed === updates.length) {
      const parts = Object.entries(counters)
        .map(([k, v]) => {
          // Show running count up to current progress ratio
          const ratio = Math.min(processed / updates.length, 1);
          return `${Math.round(v * ratio)} ${k}`;
        })
        .join(', ');
      console.log(`[${processed}/${updates.length}] Tagged: ${parts}`);
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Total images processed: ${images.length}`);
  console.log(`Total images tagged: ${totalTagged}`);
  console.log(`Errors: ${errors}`);
  console.log('\nFinal subcategory counts:');
  for (const [sub, count] of Object.entries(counters).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sub}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
