import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function countTable(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return -1;
  return count ?? 0;
}

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function fmt(n: number): string { return n.toLocaleString('fr-FR'); }

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

async function main() {
  console.log('');
  console.log('################################################################');
  console.log('#              FLM AUTO -- DATA AUDIT                          #');
  console.log(`#              ${new Date().toISOString().slice(0, 19)}                  #`);
  console.log('################################################################');

  // 1. Core table counts
  section('1. CORE TABLE COUNTS');
  const tables = [
    'brands', 'models', 'generations', 'engine_variants',
    'vehicle_images', 'vehicle_videos', 'third_party_specs',
    'safety_ratings', 'family_fit_compatibility', 'interior_dimensions',
  ];
  const optionalTables = [
    'wishlists', 'price_alerts', 'newsletter_subscribers',
    'vehicle_appearances', 'trims', 'ux_scores', 'reliability_issues',
  ];

  const counts: Record<string, number> = {};
  for (const t of tables) {
    const c = await countTable(t);
    counts[t] = c;
    const status = c === -1 ? 'ERROR / NOT FOUND' : fmt(c);
    console.log(`  ${t.padEnd(30)} ${status.padStart(12)}`);
  }
  console.log('  --- optional tables ---');
  for (const t of optionalTables) {
    const c = await countTable(t);
    if (c >= 0) {
      counts[t] = c;
      console.log(`  ${t.padEnd(30)} ${fmt(c).padStart(12)}`);
    } else {
      console.log(`  ${t.padEnd(30)} ${'(not found)'.padStart(12)}`);
    }
  }

  // 2. Vehicle images by source
  section('2. VEHICLE IMAGES BY SOURCE');
  const images = await paginateAll('vehicle_images', 'source');
  const bySource: Record<string, number> = {};
  images.forEach((img: any) => {
    const src = img.source || '(null)';
    bySource[src] = (bySource[src] || 0) + 1;
  });
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(30)} ${fmt(count).padStart(12)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(30)} ${fmt(images.length).padStart(12)}`);

  // 3. Third-party specs by spec_type
  section('3. THIRD-PARTY SPECS BY spec_type');
  const specs = await paginateAll('third_party_specs', 'spec_type');
  const bySpecType: Record<string, number> = {};
  specs.forEach((s: any) => {
    const t = s.spec_type || '(null)';
    bySpecType[t] = (bySpecType[t] || 0) + 1;
  });
  for (const [specType, count] of Object.entries(bySpecType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${specType.padEnd(40)} ${fmt(count).padStart(10)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(40)} ${fmt(specs.length).padStart(10)}`);

  // 4. Third-party specs by source
  section('4. THIRD-PARTY SPECS BY source');
  const specsS = await paginateAll('third_party_specs', 'source');
  const bySpecSrc: Record<string, number> = {};
  specsS.forEach((s: any) => {
    const src = s.source || '(null)';
    bySpecSrc[src] = (bySpecSrc[src] || 0) + 1;
  });
  for (const [source, count] of Object.entries(bySpecSrc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(40)} ${fmt(count).padStart(10)}`);
  }

  // 5. Image coverage
  section('5. IMAGE COVERAGE (generations with 0 images)');
  const allGens = await paginateAll('generations', 'id');
  const genIds = new Set(allGens.map((g: any) => g.id));
  const imgsGen = await paginateAll('vehicle_images', 'generation_id');
  const gensWithImages = new Set(imgsGen.map((i: any) => i.generation_id));
  const gensWithout = [...genIds].filter(id => !gensWithImages.has(id));
  console.log(`  Total generations:              ${fmt(genIds.size)}`);
  console.log(`  Generations WITH images:        ${fmt(gensWithImages.size)}`);
  console.log(`  Generations WITHOUT images:     ${fmt(gensWithout.length)}`);
  console.log(`  Image coverage:                 ${((gensWithImages.size / genIds.size) * 100).toFixed(1)}%`);

  // 6. Videos by source
  if (counts['vehicle_videos'] > 0) {
    section('6. VEHICLE VIDEOS BY source');
    const videos = await paginateAll('vehicle_videos', 'source');
    const byVidSrc: Record<string, number> = {};
    videos.forEach((v: any) => {
      const src = v.source || '(null)';
      byVidSrc[src] = (byVidSrc[src] || 0) + 1;
    });
    for (const [source, count] of Object.entries(byVidSrc).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${source.padEnd(30)} ${fmt(count).padStart(12)}`);
    }
    console.log(`  ${'TOTAL'.padEnd(30)} ${fmt(videos.length).padStart(12)}`);
  }

  // 7. Video coverage
  if (counts['vehicle_videos'] > 0) {
    section('7. VIDEO COVERAGE');
    const vidsGen = await paginateAll('vehicle_videos', 'generation_id');
    const gensWithVids = new Set(vidsGen.map((v: any) => v.generation_id));
    const gensNoVids = [...genIds].filter(id => !gensWithVids.has(id));
    console.log(`  Total generations:              ${fmt(genIds.size)}`);
    console.log(`  Generations WITH videos:        ${fmt(gensWithVids.size)}`);
    console.log(`  Generations WITHOUT videos:     ${fmt(gensNoVids.length)}`);
    console.log(`  Video coverage:                 ${((gensWithVids.size / genIds.size) * 100).toFixed(1)}%`);
  }

  // 8. Brand breakdown
  section('8. BRAND BREAKDOWN (models & generations per brand)');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, brand_id');
  const gens = await paginateAll('generations', 'id, model_id');

  const modelsByBrand: Record<string, number> = {};
  const gensByBrand: Record<string, number> = {};
  const brandName: Record<string, string> = {};
  brands.forEach((b: any) => { brandName[b.id] = b.name; modelsByBrand[b.id] = 0; gensByBrand[b.id] = 0; });
  const modelBrand: Record<string, string> = {};
  models.forEach((m: any) => { modelsByBrand[m.brand_id] = (modelsByBrand[m.brand_id] || 0) + 1; modelBrand[m.id] = m.brand_id; });
  gens.forEach((g: any) => { const bid = modelBrand[g.model_id]; if (bid) gensByBrand[bid] = (gensByBrand[bid] || 0) + 1; });

  const brandRows = brands.map((b: any) => ({
    name: b.name, models: modelsByBrand[b.id] || 0, gens: gensByBrand[b.id] || 0,
  })).sort((a: any, b: any) => b.gens - a.gens);

  console.log(`  ${'Brand'.padEnd(25)} ${'Models'.padStart(8)} ${'Gens'.padStart(8)}`);
  console.log(`  ${'-'.repeat(25)} ${'-'.repeat(8)} ${'-'.repeat(8)}`);
  for (const row of brandRows) {
    console.log(`  ${row.name.padEnd(25)} ${String(row.models).padStart(8)} ${String(row.gens).padStart(8)}`);
  }
  console.log(`  ${'-'.repeat(25)} ${'-'.repeat(8)} ${'-'.repeat(8)}`);
  console.log(`  ${'TOTAL'.padEnd(25)} ${String(models.length).padStart(8)} ${String(gens.length).padStart(8)}`);

  // 9. Interior dimensions coverage
  if (counts['interior_dimensions'] > 0) {
    section('9. INTERIOR DIMENSIONS COVERAGE');
    const dims = await paginateAll('interior_dimensions', 'generation_id, trunk_volume_liters, trunk_volume_max_liters');
    const gensWithDims = new Set(dims.map((d: any) => d.generation_id));
    const withTrunk = dims.filter((d: any) => d.trunk_volume_liters != null).length;
    const withTrunkMax = dims.filter((d: any) => d.trunk_volume_max_liters != null).length;
    console.log(`  Total dimension rows:           ${fmt(dims.length)}`);
    console.log(`  Unique generations:             ${fmt(gensWithDims.size)}`);
    console.log(`  With trunk_volume_liters:       ${fmt(withTrunk)}`);
    console.log(`  With trunk_volume_max_liters:   ${fmt(withTrunkMax)}`);
    console.log(`  Dimension coverage:             ${((gensWithDims.size / genIds.size) * 100).toFixed(1)}%`);
  }

  // 10. Safety ratings coverage
  if (counts['safety_ratings'] > 0) {
    section('10. SAFETY RATINGS COVERAGE');
    const ratings = await paginateAll('safety_ratings', 'generation_id, stars, confidence');
    const gensWithR = new Set(ratings.map((r: any) => r.generation_id));
    const byRSrc: Record<string, number> = {};
    ratings.forEach((r: any) => { const s = r.confidence || '(null)'; byRSrc[s] = (byRSrc[s] || 0) + 1; });
    console.log(`  Total rating rows:              ${fmt(ratings.length)}`);
    console.log(`  Unique generations:             ${fmt(gensWithR.size)}`);
    console.log(`  Safety coverage:                ${((gensWithR.size / genIds.size) * 100).toFixed(1)}%`);
    console.log('');
    for (const [src, c] of Object.entries(byRSrc).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${src.padEnd(30)} ${fmt(c).padStart(10)}`);
    }
  }

  // Final summary
  section('FINAL SUMMARY');
  console.log(`  Brands:            ${fmt(counts['brands'] || 0)}`);
  console.log(`  Models:            ${fmt(counts['models'] || 0)}`);
  console.log(`  Generations:       ${fmt(counts['generations'] || 0)}`);
  console.log(`  Engine variants:   ${fmt(counts['engine_variants'] || 0)}`);
  console.log(`  Photos:            ${fmt(counts['vehicle_images'] || 0)}`);
  console.log(`  Videos:            ${fmt(counts['vehicle_videos'] || 0)}`);
  console.log(`  Specs:             ${fmt(counts['third_party_specs'] || 0)}`);
  console.log(`  Safety ratings:    ${fmt(counts['safety_ratings'] || 0)}`);
  console.log(`  Family fit:        ${fmt(counts['family_fit_compatibility'] || 0)}`);
  console.log(`  Int. dimensions:   ${fmt(counts['interior_dimensions'] || 0)}`);
  console.log('');
  console.log('  Audit complete.');
  console.log('');
}

main().catch(console.error);
