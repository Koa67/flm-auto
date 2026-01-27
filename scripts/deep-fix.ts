/**
 * FLM AUTO - Deep Fix All Issues
 * Processes ALL records, not just samples
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAllVariantNames() {
  console.log('\n1. FIXING ALL VARIANT NAME ARTIFACTS');
  console.log('─'.repeat(50));

  let totalFixed = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data: badNames } = await supabase
      .from('engine_variants')
      .select('id, name')
      .or('name.ilike.%Specs,name.ilike.%undefined%,name.ilike.%null%,name.ilike.%NaN%')
      .limit(500);

    if (!badNames || badNames.length === 0) {
      hasMore = false;
      break;
    }

    for (const v of badNames) {
      let newName = v.name
        .replace(/Specs$/gi, '')
        .replace(/undefined/gi, '')
        .replace(/null/gi, '')
        .replace(/NaN/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (newName.length > 0) {
        await supabase
          .from('engine_variants')
          .update({ name: newName })
          .eq('id', v.id);
        totalFixed++;
      }
    }
    
    console.log(`   ... fixed ${totalFixed} so far`);
  }

  console.log(`   ✓ Total fixed: ${totalFixed}`);
}

async function linkAllAppearances() {
  console.log('\n2. LINKING ALL APPEARANCES');
  console.log('─'.repeat(50));

  // Get all generations for matching (with brand info)
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id,
      internal_code,
      chassis_code,
      name,
      models!inner (
        name,
        brands!inner (name)
      )
    `);

  if (!generations) {
    console.log('   ❌ Could not load generations');
    return;
  }

  console.log(`   Loaded ${generations.length} generations for matching`);

  // Build lookup maps for faster matching
  const byChassisCode = new Map<string, typeof generations[0][]>();
  const byBrandModel = new Map<string, typeof generations[0][]>();

  generations.forEach(g => {
    const brand = (g.models as any).brands.name.toLowerCase();
    const model = (g.models as any).name.toLowerCase();
    const code = (g.internal_code || g.chassis_code || '').toLowerCase();

    if (code) {
      const key = `${brand}-${code}`;
      if (!byChassisCode.has(key)) byChassisCode.set(key, []);
      byChassisCode.get(key)!.push(g);
    }

    const bmKey = `${brand}-${model}`;
    if (!byBrandModel.has(bmKey)) byBrandModel.set(bmKey, []);
    byBrandModel.get(bmKey)!.push(g);
  });

  // Process unlinked appearances in batches
  let totalLinked = 0;
  let totalProcessed = 0;
  let offset = 0;
  const batchSize = 500;

  while (true) {
    const { data: unlinked } = await supabase
      .from('vehicle_appearances')
      .select('id, vehicle_make, vehicle_model, chassis_code')
      .is('generation_id', null)
      .range(offset, offset + batchSize - 1);

    if (!unlinked || unlinked.length === 0) break;

    for (const app of unlinked) {
      totalProcessed++;
      
      const appBrand = (app.vehicle_make || '').toLowerCase().replace('-', '');
      const appModel = (app.vehicle_model || '').toLowerCase();
      const appCode = (app.chassis_code || '').toLowerCase();

      let match: typeof generations[0] | undefined;

      // Strategy 1: Exact chassis code match
      if (appCode) {
        const brandVariants = [appBrand, appBrand.replace('benz', '').trim()];
        for (const b of brandVariants) {
          const key = `${b}-${appCode}`;
          const candidates = byChassisCode.get(key);
          if (candidates?.length) {
            match = candidates[0];
            break;
          }
        }
      }

      // Strategy 2: Brand + model match (take first generation)
      if (!match && appModel) {
        const brandVariants = [
          appBrand,
          appBrand.replace('mercedes-benz', 'mercedes-benz'),
          appBrand.replace('mercedes', 'mercedes-benz'),
        ];
        
        for (const b of brandVariants) {
          // Try exact model
          let key = `${b}-${appModel}`;
          let candidates = byBrandModel.get(key);
          
          // Try model variations
          if (!candidates?.length) {
            const modelBase = appModel.split(' ')[0];
            key = `${b}-${modelBase}`;
            candidates = byBrandModel.get(key);
          }

          if (candidates?.length) {
            match = candidates[0];
            break;
          }
        }
      }

      // Strategy 3: Fuzzy match
      if (!match) {
        match = generations.find(g => {
          const gBrand = (g.models as any).brands.name.toLowerCase();
          const gModel = (g.models as any).name.toLowerCase();
          const gCode = (g.internal_code || '').toLowerCase();

          // Brand must have some overlap
          if (!gBrand.includes(appBrand.substring(0, 3)) && 
              !appBrand.includes(gBrand.substring(0, 3))) {
            return false;
          }

          // Code match is best
          if (appCode && gCode && (gCode.includes(appCode) || appCode.includes(gCode))) {
            return true;
          }

          // Model match
          if (appModel && gModel && (gModel.includes(appModel) || appModel.includes(gModel))) {
            return true;
          }

          return false;
        });
      }

      if (match) {
        await supabase
          .from('vehicle_appearances')
          .update({ generation_id: match.id })
          .eq('id', app.id);
        totalLinked++;
      }
    }

    console.log(`   ... processed ${totalProcessed}, linked ${totalLinked}`);
    
    // Don't increment offset since we're always fetching unlinked ones
    // and they disappear as we link them
    if (unlinked.length < batchSize) break;
  }

  console.log(`   ✓ Total linked: ${totalLinked}/${totalProcessed}`);

  // Check remaining
  const { count: remaining } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true })
    .is('generation_id', null);

  console.log(`   Remaining unlinked: ${remaining}`);
}

async function showUnlinkedSample() {
  console.log('\n3. SAMPLE OF REMAINING UNLINKED');
  console.log('─'.repeat(50));

  const { data: sample } = await supabase
    .from('vehicle_appearances')
    .select('vehicle_make, vehicle_model, chassis_code, movie_title')
    .is('generation_id', null)
    .limit(20);

  if (!sample || sample.length === 0) {
    console.log('   ✓ All appearances linked!');
    return;
  }

  // Group by make/model
  const grouped = new Map<string, number>();
  sample.forEach(s => {
    const key = `${s.vehicle_make} ${s.vehicle_model} (${s.chassis_code || 'no code'})`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  console.log('   Unlinked vehicles (sample):');
  Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([key, count]) => {
      console.log(`   - ${key}: ${count}`);
    });
}

async function finalStats() {
  console.log('\n4. FINAL STATISTICS');
  console.log('─'.repeat(50));

  const { count: totalAppearances } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true });

  const { count: linkedAppearances } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true })
    .not('generation_id', 'is', null);

  const { count: generations } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });

  const { count: variants } = await supabase
    .from('engine_variants')
    .select('*', { count: 'exact', head: true });

  const { count: withSpecs } = await supabase
    .from('powertrain_specs')
    .select('*', { count: 'exact', head: true })
    .not('power_hp', 'is', null);

  console.log(`   Total appearances: ${totalAppearances}`);
  console.log(`   Linked appearances: ${linkedAppearances} (${Math.round((linkedAppearances || 0) / (totalAppearances || 1) * 100)}%)`);
  console.log(`   Generations: ${generations}`);
  console.log(`   Engine variants: ${variants}`);
  console.log(`   Variants with specs: ${withSpecs}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - DEEP FIX                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await fixAllVariantNames();
  await linkAllAppearances();
  await showUnlinkedSample();
  await finalStats();

  console.log('\n✅ Deep fix complete!');
}

main().catch(console.error);
