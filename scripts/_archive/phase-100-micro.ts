/**
 * PHASE 100 - MICRO BATCHES
 * 
 * Hypothèse: Supabase écrase les rows quand le batch est trop gros
 * Solution: batches de 100 specs max
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const PREMIUM_BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Tesla', 'Lexus', 'Jaguar', 'Land Rover'];

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function getSegment(modelName: string): string {
  const name = modelName.toLowerCase();
  if (['model', 'ioniq', 'id.', 'eq', 'i4', 'ix', 'taycan', 'enyaq', 'e-tron'].some(k => name.includes(k))) return 'electric';
  if (['911', 'm3', 'm4', 'm5', 'amg', 'rs', 'gt'].some(k => name.includes(k))) return 'sports';
  if (['x1', 'x3', 'x5', 'gl', 'q3', 'q5', 'q7', 'cayenne', 'macan', 'tiguan'].some(k => name.includes(k))) return 'suv';
  return 'sedan';
}

function generateSpecs(genId: string, brandName: string, modelName: string): any[] {
  const segment = getSegment(modelName);
  const isPremium = PREMIUM_BRANDS.includes(brandName);
  const isElectric = segment === 'electric';
  const isSports = segment === 'sports';
  
  return [
    { generation_id: genId, source: 'Generated', spec_type: 'dimensions', spec_value: 0, raw_data: { length: randInt(4200, 5100), width: randInt(1800, 2000) }},
    { generation_id: genId, source: 'Generated', spec_type: 'weight', spec_value: randInt(1300, 2500), raw_data: {}},
    { generation_id: genId, source: 'Generated', spec_type: 'engine', spec_value: 0, raw_data: isElectric ? { kw: randInt(150, 500) } : { hp: randInt(120, 500) }},
    { generation_id: genId, source: 'Generated', spec_type: 'performance', spec_value: 0, raw_data: { zero_100: isSports ? rand(3, 5) : rand(6, 12) }},
    { generation_id: genId, source: 'Generated', spec_type: 'consumption', spec_value: 0, raw_data: isElectric ? { kwh: rand(14, 22) } : { l: rand(5, 12) }},
    { generation_id: genId, source: 'Generated', spec_type: 'price', spec_value: isPremium ? randInt(45000, 120000) : randInt(20000, 50000), raw_data: {}},
    { generation_id: genId, source: 'Generated', spec_type: 'safety', spec_value: 5, raw_data: { ncap: 5, airbags: randInt(6, 12) }},
    { generation_id: genId, source: 'Generated', spec_type: 'warranty', spec_value: brandName === 'Kia' ? 7 : 3, raw_data: {}},
    { generation_id: genId, source: 'Generated', spec_type: 'maintenance', spec_value: isPremium ? randInt(400, 800) : randInt(200, 400), raw_data: {}},
    { generation_id: genId, source: 'Generated', spec_type: 'reliability', spec_value: 0, raw_data: { score: rand(3, 4.8) }},
  ];
}

async function microBatches() {
  console.log('🔬 PHASE 100 - MICRO BATCHES\n');
  console.log('═'.repeat(60));
  
  // Clean
  console.log('\n🗑️  Cleaning...');
  await supabase.from('third_party_specs').delete().eq('source', 'Generated');
  
  // Get ALL generations with pagination
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, model_id')
      .range(page * 500, (page + 1) * 500 - 1)
      .order('id');
    if (!data || data.length === 0) break;
    allGens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  
  // Dedupe
  const uniqueGens = [...new Map(allGens.map(g => [g.id, g])).values()];
  console.log(`📊 Unique generations: ${uniqueGens.length}`);
  
  // Get models & brands
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(brands?.map(b => [b.id, b.name]));
  const modelMap = new Map(models?.map(m => [m.id, { name: m.name, brand: brandMap.get(m.brand_id) || 'Unknown' }]));
  
  // Process ONE generation at a time, insert immediately
  console.log('\n⚙️  Processing generations one by one...\n');
  
  let totalInserted = 0;
  let gensProcessed = 0;
  
  for (const gen of uniqueGens) {
    const modelInfo = modelMap.get(gen.model_id);
    if (!modelInfo) continue;
    
    const specs = generateSpecs(gen.id, modelInfo.brand, modelInfo.name);
    
    // Insert this generation's specs
    const { error } = await supabase.from('third_party_specs').insert(specs);
    
    if (error) {
      console.log(`\n❌ Error for gen ${gen.id}: ${error.message}`);
    } else {
      totalInserted += specs.length;
      gensProcessed++;
    }
    
    if (gensProcessed % 100 === 0) {
      process.stdout.write(`\r   ${gensProcessed}/${uniqueGens.length} generations, ${totalInserted} specs`);
    }
  }
  
  // Verify
  const { data: verify } = await supabase
    .from('third_party_specs')
    .select('generation_id')
    .eq('source', 'Generated');
  
  const coveredGens = new Set(verify?.map(v => v.generation_id));
  const { count: total } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🔬 MICRO BATCHES COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Generations processed: ${gensProcessed}`);
  console.log(`   Generations covered: ${coveredGens.size}`);
  console.log(`   Specs inserted: ${totalInserted}`);
  console.log(`   Total specs in DB: ${total}`);
}

microBatches().catch(console.error);
