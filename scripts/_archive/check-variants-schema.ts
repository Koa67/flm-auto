/**
 * Check engine_variants table schema
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get one existing variant to see columns
  const { data, error } = await supabase
    .from('engine_variants')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Sample variant columns:', Object.keys(data?.[0] || {}));
    console.log('Sample data:', JSON.stringify(data?.[0], null, 2));
  }
}

check();
