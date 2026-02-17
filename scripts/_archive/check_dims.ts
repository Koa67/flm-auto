import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Get all generations with existing dimensions
  const { data: dims } = await supabase.from('interior_dimensions').select('generation_id');
  const dimGenIds = new Set((dims || []).map((d: any) => d.generation_id));
  console.log(`Total generations with dimensions: ${dimGenIds.size}`);
  
  // Get all generations with models/brands
  const { data: gens } = await supabase.from('generations').select('id, name, model_id, production_start, production_end');
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: brands } = await supabase.from('brands').select('id, name');
  
  const brandMap = new Map((brands || []).map((b: any) => [b.id, b.name]));
  const modelMap = new Map((models || []).map((m: any) => [m.id, m]));
  
  // Count by brand: total gens vs gens with dims
  const brandCounts: Record<string, { total: number, withDims: number }> = {};
  for (const gen of (gens || [])) {
    const model = modelMap.get(gen.model_id);
    const brandName = model ? brandMap.get(model.brand_id) : null;
    if (!brandName) continue;
    if (!brandCounts[brandName]) brandCounts[brandName] = { total: 0, withDims: 0 };
    brandCounts[brandName].total++;
    if (dimGenIds.has(gen.id)) brandCounts[brandName].withDims++;
  }
  
  // Print brands sorted by name
  const sorted = Object.entries(brandCounts).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\nBrand | Total Gens | With Dims | Coverage`);
  console.log('-'.repeat(55));
  let totalGens = 0, totalWithDims = 0;
  for (const [brand, counts] of sorted) {
    const pct = counts.total > 0 ? Math.round(100 * counts.withDims / counts.total) : 0;
    console.log(`${brand.padEnd(20)} ${String(counts.total).padStart(5)} ${String(counts.withDims).padStart(9)} ${String(pct).padStart(6)}%`);
    totalGens += counts.total;
    totalWithDims += counts.withDims;
  }
  console.log('-'.repeat(55));
  console.log(`${'TOTAL'.padEnd(20)} ${String(totalGens).padStart(5)} ${String(totalWithDims).padStart(9)} ${String(Math.round(100 * totalWithDims / totalGens)).padStart(6)}%`);
}
main().catch(console.error);
