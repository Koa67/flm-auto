import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function main() {
  // Direct SQL to find orphans
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT COUNT(*) as orphan_count 
      FROM vehicle_images vi 
      LEFT JOIN generations g ON vi.generation_id = g.id 
      WHERE g.id IS NULL
    `
  });

  if (error) {
    // RPC doesn't exist, do it manually
    console.log('Checking orphans manually...\n');
    
    // Get all image generation_ids
    const { data: imgs } = await supabase.from('vehicle_images').select('generation_id');
    const imgGenIds = [...new Set((imgs || []).map(i => i.generation_id))];
    console.log(`Unique generation_ids in vehicle_images: ${imgGenIds.length}`);

    // Get all valid generation ids
    const { data: gens } = await supabase.from('generations').select('id');
    const validIds = new Set((gens || []).map(g => g.id));
    console.log(`Total generations in DB: ${validIds.size}`);

    // Find orphans
    const orphanIds = imgGenIds.filter(id => !validIds.has(id));
    console.log(`Orphan generation_ids: ${orphanIds.length}`);

    if (orphanIds.length > 0) {
      console.log('\nSample orphan IDs:');
      for (const id of orphanIds.slice(0, 5)) {
        console.log(`  ${id}`);
      }

      // Get sample images with these orphan IDs
      const { data: orphanImgs } = await supabase
        .from('vehicle_images')
        .select('id, generation_id, alt_text, source')
        .in('generation_id', orphanIds.slice(0, 10));

      console.log('\nSample orphan images:');
      for (const img of orphanImgs || []) {
        console.log(`  ${img.source} | ${img.alt_text} | gen: ${img.generation_id.slice(0,8)}...`);
      }
    }
  } else {
    console.log('Orphan count:', data);
  }
}

main().catch(console.error);
