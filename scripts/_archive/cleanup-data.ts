/**
 * FLM AUTO - Data Cleanup Script
 * Fixes:
 * 1. Remove "Specs" suffix from variant names
 * 2. Fix incorrect drivetrain values (E46/E30/E36 should be RWD)
 * 3. Remove duplicate game appearances
 * 4. Fix model names (LCI → 3 Series)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupData() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Data Cleanup                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Remove "Specs" suffix from variant names
  console.log('1. Fixing variant names (removing "Specs" suffix)...');
  const { data: variantsWithSpecs } = await supabase
    .from('engine_variants')
    .select('id, name')
    .like('name', '%Specs');

  if (variantsWithSpecs && variantsWithSpecs.length > 0) {
    let fixed = 0;
    for (const v of variantsWithSpecs) {
      const newName = v.name.replace(/Specs$/, '').trim();
      await supabase
        .from('engine_variants')
        .update({ name: newName })
        .eq('id', v.id);
      fixed++;
    }
    console.log(`   ✓ Fixed ${fixed} variant names`);
  } else {
    console.log('   ✓ No variants with "Specs" suffix found');
  }

  // 2. Fix drivetrain values for BMW rear-wheel drive cars
  console.log('\n2. Fixing drivetrain values (BMW RWD models)...');
  
  // Get BMW generations that should be RWD
  const rwdCodes = ['E30', 'E36', 'E46', 'E90', 'E92', 'E93', 'F30', 'F32', 'F80', 'F82', 'G80', 'G82'];
  
  const { data: bmwGens } = await supabase
    .from('generations')
    .select('id, internal_code, models!inner(brands!inner(name))')
    .in('internal_code', rwdCodes);

  const bmwOnlyGens = bmwGens?.filter(g => (g.models as any).brands.name === 'BMW') || [];
  
  if (bmwOnlyGens.length > 0) {
    const genIds = bmwOnlyGens.map(g => g.id);
    
    // Get variants for these generations
    const { data: rwdVariants } = await supabase
      .from('engine_variants')
      .select('id')
      .in('generation_id', genIds);

    if (rwdVariants && rwdVariants.length > 0) {
      const variantIds = rwdVariants.map(v => v.id);
      
      // Update powertrain_specs to RWD (excluding xDrive variants)
      const { data: specsToFix } = await supabase
        .from('powertrain_specs')
        .select('id, engine_variant_id, drivetrain')
        .in('engine_variant_id', variantIds)
        .eq('drivetrain', 'AWD');

      // Check if variant name contains 'xi' or 'xDrive' - those stay AWD
      let fixedDrivetrain = 0;
      for (const spec of specsToFix || []) {
        const { data: variant } = await supabase
          .from('engine_variants')
          .select('name')
          .eq('id', spec.engine_variant_id)
          .single();
        
        const name = variant?.name?.toLowerCase() || '';
        if (!name.includes('xi') && !name.includes('xdrive') && !name.includes('x drive')) {
          await supabase
            .from('powertrain_specs')
            .update({ drivetrain: 'RWD' })
            .eq('id', spec.id);
          fixedDrivetrain++;
        }
      }
      console.log(`   ✓ Fixed ${fixedDrivetrain} drivetrain values to RWD`);
    }
  } else {
    console.log('   ✓ No BMW RWD generations found to fix');
  }

  // 3. Remove duplicate game appearances
  console.log('\n3. Removing duplicate appearances...');
  
  const { data: allAppearances } = await supabase
    .from('vehicle_appearances')
    .select('*')
    .order('created_at', { ascending: true });

  if (allAppearances) {
    const seen = new Map<string, string>();
    const toDelete: string[] = [];

    for (const app of allAppearances) {
      const key = `${app.generation_id}-${app.movie_title}-${app.media_type}`;
      if (seen.has(key)) {
        toDelete.push(app.id);
      } else {
        seen.set(key, app.id);
      }
    }

    if (toDelete.length > 0) {
      // Delete in batches
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        await supabase
          .from('vehicle_appearances')
          .delete()
          .in('id', batch);
      }
      console.log(`   ✓ Removed ${toDelete.length} duplicate appearances`);
    } else {
      console.log('   ✓ No duplicate appearances found');
    }
  }

  // 4. Fix model names
  console.log('\n4. Fixing model names...');
  
  const modelFixes: Record<string, string> = {
    'LCI': '3 Series',
    'M3Specs': 'M3',
  };

  for (const [oldName, newName] of Object.entries(modelFixes)) {
    const { data: models } = await supabase
      .from('models')
      .select('id')
      .eq('name', oldName);

    if (models && models.length > 0) {
      // Check if target model already exists
      const { data: existing } = await supabase
        .from('models')
        .select('id')
        .eq('name', newName)
        .single();

      if (existing) {
        // Merge: update generations to point to existing model, then delete old
        for (const m of models) {
          await supabase
            .from('generations')
            .update({ model_id: existing.id })
            .eq('model_id', m.id);
          
          await supabase
            .from('models')
            .delete()
            .eq('id', m.id);
        }
        console.log(`   ✓ Merged "${oldName}" into "${newName}"`);
      } else {
        // Just rename
        await supabase
          .from('models')
          .update({ name: newName, slug: newName.toLowerCase().replace(/\s+/g, '-') })
          .eq('name', oldName);
        console.log(`   ✓ Renamed "${oldName}" to "${newName}"`);
      }
    }
  }

  // Summary
  console.log('\n============================================================');
  console.log('Data cleanup complete!');
  
  // Get final counts
  const { count: variantsCount } = await supabase.from('engine_variants').select('*', { count: 'exact', head: true });
  const { count: appearancesCount } = await supabase.from('vehicle_appearances').select('*', { count: 'exact', head: true });
  const { count: modelsCount } = await supabase.from('models').select('*', { count: 'exact', head: true });
  
  console.log(`\nFinal counts:`);
  console.log(`  - Engine variants: ${variantsCount}`);
  console.log(`  - Appearances: ${appearancesCount}`);
  console.log(`  - Models: ${modelsCount}`);
}

cleanupData().catch(console.error);
