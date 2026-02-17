/**
 * Debug media types in vehicle_appearances
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  // Check media_type distribution
  const { data: all } = await supabase
    .from('vehicle_appearances')
    .select('media_type')
    .limit(5000);
  
  const types: Record<string, number> = {};
  all?.forEach(d => { 
    types[d.media_type || 'NULL'] = (types[d.media_type || 'NULL'] || 0) + 1; 
  });
  console.log('Media type distribution (sample 5000):', types);
  
  // Check Forza entries
  const { data: forza } = await supabase
    .from('vehicle_appearances')
    .select('movie_title, media_type, movie_year')
    .ilike('movie_title', '%Forza%')
    .limit(10);
  
  console.log('\nForza entries:', forza);

  // Check games specifically
  const { data: games, count } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact' })
    .eq('media_type', 'video_game')
    .limit(5);
  
  console.log(`\nVideo game entries (media_type='video_game'): ${count}`);
  console.log('Sample:', games?.slice(0, 2));

  // Check what media_type games actually have
  const { data: forzaSample } = await supabase
    .from('vehicle_appearances')
    .select('*')
    .eq('movie_title', 'Forza Motorsport')
    .limit(1);
  
  console.log('\nForza Motorsport full record:', forzaSample?.[0]);
}

debug().catch(console.error);
