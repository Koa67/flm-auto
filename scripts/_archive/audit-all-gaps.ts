import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('📊 FLM AUTO — Complete Gap Audit\n');
  const [brands, models, generations, specs, images, videos] = await Promise.all([
    paginate('brands', 'id, name, logo_url'),
    paginate('models', 'id, name, brand_id'),
    paginate('generations', 'id, name, model_id, body_type'),
    paginate('third_party_specs', 'id, generation_id, source, spec_type'),
    paginate('vehicle_images', 'id, generation_id, image_type'),
    paginate('youtube_videos', 'id, generation_id'),
  ]);

  const totalGens = generations.length;
  console.log(`  Total generations: ${totalGens}\n`);

  const withBodyType = generations.filter(g => g.body_type).length;
  console.log(`📦 BODY TYPES: ${withBodyType} (${(withBodyType/totalGens*100).toFixed(0)}%)\n`);

  const photosByGen = new Map<string, Set<string>>();
  for (const img of images) {
    if (!photosByGen.has(img.generation_id)) photosByGen.set(img.generation_id, new Set());
    photosByGen.get(img.generation_id)!.add(img.image_type);
  }
  const withExterior = [...photosByGen.entries()].filter(([_, types]) => types.has('exterior')).length;
  console.log(`📷 PHOTOS: ${photosByGen.size} gens with any photo (${(photosByGen.size/totalGens*100).toFixed(0)}%)`);
  console.log(`   Exterior: ${withExterior} gens\n`);

  const gensWithVideos = new Set(videos.map(v => v.generation_id)).size;
  console.log(`🎬 YOUTUBE: ${gensWithVideos} gens (${(gensWithVideos/totalGens*100).toFixed(0)}%), ${videos.length} total rows\n`);

  const specsBySource = new Map<string, Set<string>>();
  const specsByType = new Map<string, Set<string>>();
  for (const s of specs) {
    if (!specsBySource.has(s.source)) specsBySource.set(s.source, new Set());
    specsBySource.get(s.source)!.add(s.generation_id);
    if (!specsByType.has(s.spec_type)) specsByType.set(s.spec_type, new Set());
    specsByType.get(s.spec_type)!.add(s.generation_id);
  }

  console.log(`📋 SPECS BY SOURCE`);
  for (const [source, genSet] of [...specsBySource.entries()].sort((a,b) => b[1].size - a[1].size)) {
    console.log(`   ${source}: ${genSet.size} gens (${(genSet.size/totalGens*100).toFixed(0)}%)`);
  }

  console.log(`\n📑 ALL SPEC TYPES (top 15)`);
  for (const [type, genSet] of [...specsByType.entries()].sort((a,b) => b[1].size - a[1].size).slice(0, 15)) {
    console.log(`   ${type}: ${genSet.size} gens (${(genSet.size/totalGens*100).toFixed(0)}%)`);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  GAPS SUMMARY`);
  console.log(`════════════════════════════════════════════════════════`);
  const gaps = [
    { name: 'Photos', pct: photosByGen.size/totalGens*100 },
    { name: 'YouTube', pct: gensWithVideos/totalGens*100 },
    { name: 'Body type', pct: withBodyType/totalGens*100 },
  ];
  for (const g of gaps.sort((a,b) => a.pct - b.pct)) {
    const bar = '█'.repeat(Math.floor(g.pct / 5)) + '░'.repeat(20 - Math.floor(g.pct / 5));
    console.log(`  ${g.name.padEnd(12)} ${bar} ${g.pct.toFixed(0)}%`);
  }
}

main().catch(console.error);
