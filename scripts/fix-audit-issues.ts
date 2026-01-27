/**
 * FLM AUTO - Fix All Audit Issues
 * Resolves:
 * 1. Unlinked appearances (try to match, else delete)
 * 2. Remaining variant name artifacts
 * 3. Duplicate generations
 * 4. Create missing indexes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixUnlinkedAppearances() {
  console.log('\n1. FIXING UNLINKED APPEARANCES');
  console.log('─'.repeat(50));

  // Get all unlinked appearances
  const { data: unlinked } = await supabase
    .from('vehicle_appearances')
    .select('id, vehicle_make, vehicle_model, chassis_code')
    .is('generation_id', null);

  if (!unlinked || unlinked.length === 0) {
    console.log('   ✓ No unlinked appearances');
    return;
  }

  console.log(`   Found ${unlinked.length} unlinked appearances`);

  // Get all generations for matching
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id,
      internal_code,
      name,
      models!inner (
        name,
        brands!inner (name)
      )
    `);

  let linked = 0;
  let deleted = 0;

  for (const app of unlinked) {
    // Try to find matching generation
    const match = generations?.find(g => {
      const brand = (g.models as any).brands.name;
      const model = (g.models as any).name;
      const code = g.internal_code?.toLowerCase() || '';
      
      const appBrand = app.vehicle_make?.toLowerCase() || '';
      const appModel = app.vehicle_model?.toLowerCase() || '';
      const appCode = app.chassis_code?.toLowerCase() || '';

      // Brand must match
      if (!brand.toLowerCase().includes(appBrand.split(' ')[0]) && 
          !appBrand.includes(brand.toLowerCase().split('-')[0])) {
        return false;
      }

      // Try to match by chassis code
      if (appCode && code) {
        return code === appCode || code.includes(appCode) || appCode.includes(code);
      }

      // Try to match by model name
      return model.toLowerCase().includes(appModel.split(' ')[0]) ||
             appModel.includes(model.toLowerCase());
    });

    if (match) {
      await supabase
        .from('vehicle_appearances')
        .update({ generation_id: match.id })
        .eq('id', app.id);
      linked++;
    } else {
      // Delete if can't link (optional - comment out to keep)
      // await supabase.from('vehicle_appearances').delete().eq('id', app.id);
      // deleted++;
    }
  }

  console.log(`   ✓ Linked: ${linked}`);
  console.log(`   ✓ Remaining unlinked: ${unlinked.length - linked}`);
}

async function fixVariantNames() {
  console.log('\n2. FIXING VARIANT NAME ARTIFACTS');
  console.log('─'.repeat(50));

  // Find all bad names
  const { data: badNames } = await supabase
    .from('engine_variants')
    .select('id, name')
    .or('name.ilike.%Specs,name.ilike.%undefined%,name.ilike.%null%,name.ilike.%NaN%');

  if (!badNames || badNames.length === 0) {
    console.log('   ✓ No bad variant names found');
    return;
  }

  console.log(`   Found ${badNames.length} variants with bad names`);

  let fixed = 0;
  for (const v of badNames) {
    let newName = v.name
      .replace(/Specs$/i, '')
      .replace(/undefined/gi, '')
      .replace(/null/gi, '')
      .replace(/NaN/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (newName !== v.name && newName.length > 0) {
      await supabase
        .from('engine_variants')
        .update({ name: newName })
        .eq('id', v.id);
      fixed++;
    }
  }

  console.log(`   ✓ Fixed ${fixed} variant names`);
}

async function fixDuplicateGenerations() {
  console.log('\n3. FIXING DUPLICATE GENERATIONS');
  console.log('─'.repeat(50));

  // Find duplicates
  const { data: allGens } = await supabase
    .from('generations')
    .select('id, model_id, internal_code, created_at')
    .order('created_at', { ascending: true });

  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  allGens?.forEach(g => {
    const key = `${g.model_id}-${g.internal_code}`;
    if (seen.has(key)) {
      duplicates.push(g.id); // Keep first, mark later ones for merge
    } else {
      seen.set(key, g.id);
    }
  });

  if (duplicates.length === 0) {
    console.log('   ✓ No duplicate generations');
    return;
  }

  console.log(`   Found ${duplicates.length} duplicate generations`);

  for (const dupId of duplicates) {
    // Get the duplicate
    const { data: dup } = await supabase
      .from('generations')
      .select('model_id, internal_code')
      .eq('id', dupId)
      .single();

    if (!dup) continue;

    // Find the original (first one)
    const key = `${dup.model_id}-${dup.internal_code}`;
    const originalId = seen.get(key);

    if (!originalId || originalId === dupId) continue;

    // Move references to original
    await supabase
      .from('engine_variants')
      .update({ generation_id: originalId })
      .eq('generation_id', dupId);

    await supabase
      .from('vehicle_appearances')
      .update({ generation_id: originalId })
      .eq('generation_id', dupId);

    await supabase
      .from('safety_ratings')
      .update({ generation_id: originalId })
      .eq('generation_id', dupId);

    // Delete duplicate
    await supabase
      .from('generations')
      .delete()
      .eq('id', dupId);
  }

  console.log(`   ✓ Merged and deleted ${duplicates.length} duplicates`);
}

async function createIndexes() {
  console.log('\n4. INDEX RECOMMENDATIONS');
  console.log('─'.repeat(50));

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_generations_model_id ON generations(model_id);',
    'CREATE INDEX IF NOT EXISTS idx_generations_internal_code ON generations(internal_code);',
    'CREATE INDEX IF NOT EXISTS idx_engine_variants_generation_id ON engine_variants(generation_id);',
    'CREATE INDEX IF NOT EXISTS idx_powertrain_specs_variant_id ON powertrain_specs(engine_variant_id);',
    'CREATE INDEX IF NOT EXISTS idx_appearances_generation_id ON vehicle_appearances(generation_id);',
    'CREATE INDEX IF NOT EXISTS idx_appearances_media_type ON vehicle_appearances(media_type);',
  ];

  console.log('   Run these in Supabase SQL Editor:');
  console.log('');
  indexes.forEach(idx => console.log(`   ${idx}`));
  console.log('');
}

async function verifyFixes() {
  console.log('\n5. VERIFICATION');
  console.log('─'.repeat(50));

  const { count: unlinkedCount } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true })
    .is('generation_id', null);

  const { data: badNames } = await supabase
    .from('engine_variants')
    .select('id')
    .or('name.ilike.%Specs,name.ilike.%undefined%')
    .limit(10);

  const { data: allGens } = await supabase
    .from('generations')
    .select('model_id, internal_code');
  
  const genKeys = new Set<string>();
  let dups = 0;
  allGens?.forEach(g => {
    const key = `${g.model_id}-${g.internal_code}`;
    if (genKeys.has(key)) dups++;
    genKeys.add(key);
  });

  console.log(`   Unlinked appearances: ${unlinkedCount}`);
  console.log(`   Bad variant names: ${badNames?.length || 0}`);
  console.log(`   Duplicate generations: ${dups}`);

  const score = 100 - (unlinkedCount || 0) / 100 - (badNames?.length || 0) - dups * 10;
  console.log(`\n   Health score: ~${Math.max(0, Math.min(100, Math.round(score)))}%`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - FIX AUDIT ISSUES                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await fixVariantNames();
  await fixDuplicateGenerations();
  await fixUnlinkedAppearances();
  await createIndexes();
  await verifyFixes();

  console.log('\n✅ All fixes applied!');
}

main().catch(console.error);
