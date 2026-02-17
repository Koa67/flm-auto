/**
 * Check vehicle_images table schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  // Try to get one row to see columns
  const { data, error } = await supabase
    .from('vehicle_images')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  }

  console.log('Sample row:', data);

  // Also try inserting minimal data to see what's required
  const { error: insertError } = await supabase
    .from('vehicle_images')
    .insert({
      generation_id: '58786bea-277f-42f2-96b8-f34583dac698',
      url: 'https://test.com/image.jpg',
    });

  if (insertError) {
    console.log('Insert error:', insertError.message);
  } else {
    console.log('Minimal insert worked!');
    // Delete test
    await supabase.from('vehicle_images').delete().eq('url', 'https://test.com/image.jpg');
  }
}

checkSchema();
