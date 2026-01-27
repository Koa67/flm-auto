/**
 * Debug: Check generations table schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  // Get one generation to see column names
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Sample generation:');
  console.log(JSON.stringify(data?.[0], null, 2));
  console.log('\nColumn names:', Object.keys(data?.[0] || {}));
}

debug();
