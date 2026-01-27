/**
 * FLM AUTO - Database Status
 * Usage: npm run db:stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getStats() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - Database Status                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const tables = [
    'brands', 'models', 'generations', 'engine_variants',
    'powertrain_specs', 'performance_specs', 'vehicle_appearances', 'safety_ratings',
  ];

  console.log('Table Counts:');
  console.log('─'.repeat(40));

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table.padEnd(25)} ${error ? '❌ Error' : count?.toLocaleString()}`);
  }

  // Brand breakdown
  console.log('\nBrand Breakdown:');
  console.log('─'.repeat(40));

  const { data: brands } = await supabase.from('brands').select('name');
  for (const brand of brands || []) {
    const { count } = await supabase
      .from('generations')
      .select('*, models!inner(brands!inner(name))', { count: 'exact', head: true })
      .eq('models.brands.name', brand.name);
    console.log(`  ${brand.name.padEnd(25)} ${count} generations`);
  }

  // Appearances by type
  console.log('\nAppearances by Type:');
  console.log('─'.repeat(40));

  const mediaTypes = ['movie', 'documentary', 'tv_series', 'video_game'];
  for (const type of mediaTypes) {
    const { count } = await supabase.from('vehicle_appearances').select('*', { count: 'exact', head: true }).eq('media_type', type);
    console.log(`  ${type.padEnd(25)} ${(count || 0).toLocaleString()}`);
  }

  // Data quality
  console.log('\nData Quality:');
  console.log('─'.repeat(40));

  const { count: linkedApps } = await supabase.from('vehicle_appearances').select('*', { count: 'exact', head: true }).not('generation_id', 'is', null);
  const { count: totalApps } = await supabase.from('vehicle_appearances').select('*', { count: 'exact', head: true });
  console.log(`  Appearances linked:     ${Math.round((linkedApps || 0) / (totalApps || 1) * 100)}%`);

  const { count: withSpecs } = await supabase.from('powertrain_specs').select('*', { count: 'exact', head: true }).not('power_hp', 'is', null);
  const { count: totalVars } = await supabase.from('engine_variants').select('*', { count: 'exact', head: true });
  console.log(`  Variants with specs:    ${Math.round((withSpecs || 0) / (totalVars || 1) * 100)}%`);

  console.log('\n✅ Done');
}

getStats().catch(console.error);
