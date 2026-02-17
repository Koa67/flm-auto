/**
 * FLM AUTO - Import Verification v3
 * Uses correct column names from actual schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('FLM AUTO - IMPORT VERIFICATION v3');
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. Counts
  console.log('📊 COUNTS\n');
  const tables = ['brands', 'models', 'generations', 'engine_variants', 'powertrain_specs', 'performance_specs'];
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count?.toLocaleString()}`);
  }

  // 2. By brand
  console.log('\n📊 PAR MARQUE\n');
  const { data: brands } = await supabase.from('brands').select('id, name');
  for (const brand of brands || []) {
    const { count } = await supabase
      .from('models')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brand.id);
    console.log(`  ${brand.name}: ${count} models`);
  }

  // 3. Internal codes coverage
  console.log('\n📊 INTERNAL_CODE COVERAGE\n');
  const { count: totalGens } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: withCode } = await supabase.from('generations').select('*', { count: 'exact', head: true }).not('internal_code', 'is', null);
  console.log(`  ${withCode}/${totalGens} generations have internal_code (${Math.round((withCode || 0) / (totalGens || 1) * 100)}%)`);

  // 4. Iconic chassis codes (direct lookup)
  console.log('\n🏎️ ICONIC CHASSIS CODES\n');
  const iconicCodes = ['E46', 'E39', 'E38', 'G20', 'G80', 'W140', 'W463', 'W222', 'C190', 'R232'];
  
  for (const code of iconicCodes) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, internal_code, model_id')
      .eq('internal_code', code);
    
    if (data && data.length > 0) {
      // Get model name
      const { data: model } = await supabase
        .from('models')
        .select('name, brands(name)')
        .eq('id', data[0].model_id)
        .single();
      
      // Count variants
      const { count: varCount } = await supabase
        .from('engine_variants')
        .select('*', { count: 'exact', head: true })
        .eq('generation_id', data[0].id);
      
      const brand = (model?.brands as any)?.name || '?';
      console.log(`  ✅ ${code}: ${brand} ${model?.name} - ${varCount} variants`);
    } else {
      console.log(`  ❌ ${code}: NOT FOUND`);
    }
  }

  // 5. Specs coverage
  console.log('\n📈 SPECS COVERAGE\n');
  const { count: total } = await supabase.from('engine_variants').select('*', { count: 'exact', head: true });
  const { count: withPower } = await supabase.from('powertrain_specs').select('*', { count: 'exact', head: true }).not('power_hp', 'is', null);
  const { count: with0100 } = await supabase.from('performance_specs').select('*', { count: 'exact', head: true }).not('acceleration_0_100_kmh', 'is', null);
  const { count: withVmax } = await supabase.from('performance_specs').select('*', { count: 'exact', head: true }).not('top_speed_kmh', 'is', null);
  
  const t = total || 1;
  console.log(`  Power (hp):     ${withPower?.toLocaleString()} / ${t.toLocaleString()} (${Math.round((withPower || 0) / t * 100)}%)`);
  console.log(`  0-100 km/h:     ${with0100?.toLocaleString()} / ${t.toLocaleString()} (${Math.round((with0100 || 0) / t * 100)}%)`);
  console.log(`  Top speed:      ${withVmax?.toLocaleString()} / ${t.toLocaleString()} (${Math.round((withVmax || 0) / t * 100)}%)`);

  // 6. Top performers
  console.log('\n🏆 TOP 5 MOST POWERFUL\n');
  const { data: topPower } = await supabase
    .from('powertrain_specs')
    .select('power_hp, engine_variants(name)')
    .not('power_hp', 'is', null)
    .order('power_hp', { ascending: false })
    .limit(5);
  
  topPower?.forEach((p, i) => {
    const name = (p.engine_variants as any)?.name || '?';
    console.log(`  ${i + 1}. ${p.power_hp}hp - ${name.slice(0, 60)}...`);
  });

  // 7. Fastest 0-100
  console.log('\n🏆 TOP 5 FASTEST 0-100\n');
  const { data: fastest } = await supabase
    .from('performance_specs')
    .select('acceleration_0_100_kmh, engine_variants(name)')
    .not('acceleration_0_100_kmh', 'is', null)
    .gt('acceleration_0_100_kmh', 0)
    .order('acceleration_0_100_kmh', { ascending: true })
    .limit(5);
  
  fastest?.forEach((p, i) => {
    const name = (p.engine_variants as any)?.name || '?';
    console.log(`  ${i + 1}. ${p.acceleration_0_100_kmh}s - ${name.slice(0, 60)}...`);
  });

  // 8. Sample query - E46 variants
  console.log('\n🔍 SAMPLE: E46 VARIANTS\n');
  const { data: e46 } = await supabase
    .from('generations')
    .select('id')
    .eq('internal_code', 'E46')
    .single();
  
  if (e46) {
    const { data: e46Vars } = await supabase
      .from('engine_variants')
      .select(`
        name,
        powertrain_specs(power_hp, torque_nm),
        performance_specs(acceleration_0_100_kmh, top_speed_kmh)
      `)
      .eq('generation_id', e46.id)
      .not('powertrain_specs.power_hp', 'is', null)
      .order('powertrain_specs(power_hp)', { ascending: false })
      .limit(5);
    
    e46Vars?.forEach(v => {
      const ps = v.powertrain_specs as any;
      const perf = v.performance_specs as any;
      console.log(`  • ${v.name}`);
      console.log(`    ${ps?.power_hp || '?'}hp | ${ps?.torque_nm || '?'}Nm | 0-100: ${perf?.acceleration_0_100_kmh || '?'}s`);
    });
  }

  // 9. Data quality issues
  console.log('\n⚠️ DATA QUALITY NOTES\n');
  
  // Check orphan generations (no variants)
  const { data: allGens } = await supabase.from('generations').select('id, name, internal_code');
  let orphans = 0;
  for (const gen of allGens || []) {
    const { count } = await supabase
      .from('engine_variants')
      .select('*', { count: 'exact', head: true })
      .eq('generation_id', gen.id);
    if (count === 0) orphans++;
  }
  console.log(`  Generations without variants: ${orphans}/${allGens?.length}`);

  // Check models mapping
  const { data: models } = await supabase.from('models').select('id, name').limit(100);
  const weirdModels = models?.filter(m => 
    m.name.includes('Specs') || 
    m.name === 'LCI' ||
    m.name.length <= 1
  );
  if (weirdModels && weirdModels.length > 0) {
    console.log(`  Potentially incorrect model names: ${weirdModels.length}`);
    console.log(`    Examples: ${weirdModels.slice(0, 5).map(m => m.name).join(', ')}`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('VERIFICATION COMPLETE');
  console.log('════════════════════════════════════════════════════════════\n');
}

verify().catch(console.error);
