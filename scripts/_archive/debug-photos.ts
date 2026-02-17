import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function main() {
  // Count total images
  const { count: totalImages } = await supabase
    .from('vehicle_images')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total images in DB: ${totalImages}`);

  // Count by source
  const { data: bySource } = await supabase
    .from('vehicle_images')
    .select('source')
    .limit(10000);
    
  const sources: Record<string, number> = {};
  for (const row of bySource || []) {
    sources[row.source || 'null'] = (sources[row.source || 'null'] || 0) + 1;
  }
  
  console.log('\nBy source:');
  for (const [src, count] of Object.entries(sources).sort((a,b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }

  // Check for orphan generation_ids (not in generations table)
  const { data: images } = await supabase
    .from('vehicle_images')
    .select('generation_id')
    .limit(10000);
    
  const genIds = [...new Set((images || []).map(i => i.generation_id))];
  
  const { data: validGens } = await supabase
    .from('generations')
    .select('id')
    .in('id', genIds.slice(0, 500));
    
  const validIds = new Set((validGens || []).map(g => g.id));
  const orphans = genIds.filter(id => !validIds.has(id));
  
  console.log(`\nUnique generation_ids in images: ${genIds.length}`);
  console.log(`Valid generation_ids: ${validIds.size}`);
  console.log(`Orphan generation_ids: ${orphans.length}`);
  
  // Sample recent Pexels entries
  const { data: pexels } = await supabase
    .from('vehicle_images')
    .select('generation_id, source, alt_text, created_at')
    .eq('source', 'Pexels')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('\nRecent Pexels entries:');
  for (const p of pexels || []) {
    console.log(`  ${p.alt_text} | gen: ${p.generation_id?.slice(0,8)}...`);
  }
}

main().catch(console.error);
