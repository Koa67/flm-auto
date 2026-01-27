/**
 * FLM AUTO - Import IMCDB scraped data to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(__dirname, '../data/imcdb');

interface MovieAppearance {
  vehicle_id: string;
  vehicle_model: string;
  chassis_code: string;
  movie_id: string;
  movie_title: string;
  movie_year: string | null;
  stars: number;
  vehicle_url: string;
  movie_url: string;
  thumbnail_url: string;
}

interface ChassisDetail {
  brand: string;
  chassis_code: string;
  total_count: number;
  pages_scraped: number;
  appearances: MovieAppearance[];
  scraped_at: string;
}

function starsToImportance(stars: number): 'star' | 'featured' | 'background' {
  if (stars >= 4) return 'star';
  if (stars >= 2) return 'featured';
  return 'background';
}

function parseMovieYear(yearStr: string | null): number | null {
  if (!yearStr) return null;
  // Handle ranges like "2002-2015" - take first year
  const match = yearStr.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function detectMediaType(title: string, yearStr: string | null): 'movie' | 'tv_series' | 'music_video' | 'documentary' | 'other' {
  // TV series often have year ranges
  if (yearStr && yearStr.includes('-')) return 'tv_series';
  
  // Common TV keywords
  const tvKeywords = ['Season', 'Episode', 'Series', 'Show', 'Pilot'];
  if (tvKeywords.some(kw => title.includes(kw))) return 'tv_series';
  
  // Music videos
  if (title.includes('Feat.') || title.includes('ft.') || title.includes(':') && title.match(/[A-Z][a-z]+ [A-Z][a-z]+:/)) {
    return 'music_video';
  }
  
  // Documentaries
  const docKeywords = ['Documentary', 'History of', 'Definitive Story', 'Motorweek', 'Top Gear', 'Fifth Gear'];
  if (docKeywords.some(kw => title.includes(kw))) return 'documentary';
  
  return 'movie';
}

async function importChassisDetail(detail: ChassisDetail): Promise<number> {
  const records = detail.appearances.map(app => ({
    imcdb_vehicle_id: app.vehicle_id,
    imcdb_movie_id: app.movie_id,
    vehicle_make: detail.brand,
    vehicle_model: app.vehicle_model || detail.chassis_code,
    chassis_code: detail.chassis_code,
    movie_title: app.movie_title,
    movie_year: parseMovieYear(app.movie_year),
    media_type: detectMediaType(app.movie_title, app.movie_year),
    role_importance: starsToImportance(app.stars),
    imcdb_url: app.vehicle_url,
    screenshot_url: app.thumbnail_url || null,
    is_verified: true,
    notes: `Stars: ${app.stars}/5`
  }));
  
  // Upsert in batches of 100
  let inserted = 0;
  const batchSize = 100;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('vehicle_appearances')
      .upsert(batch, { 
        onConflict: 'imcdb_vehicle_id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`  Error inserting batch: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  
  return inserted;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FLM AUTO - Import IMCDB Data to Supabase             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Load combined data
  const combinedFile = path.join(DATA_DIR, 'all_chassis_details.json');
  
  if (!fs.existsSync(combinedFile)) {
    console.error('Combined data file not found. Run scrape:imcdb-detail first.');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(combinedFile, 'utf-8'));
  const details: ChassisDetail[] = data.details;
  
  console.log(`Found ${details.length} chassis with ${data.total_appearances.toLocaleString()} total appearances\n`);
  
  let totalImported = 0;
  
  for (const detail of details) {
    console.log(`Importing ${detail.brand} ${detail.chassis_code} (${detail.total_count} appearances)...`);
    
    const count = await importChassisDetail(detail);
    totalImported += count;
    
    console.log(`  ✓ Imported ${count} records`);
  }
  
  // Get final counts
  const { count: totalCount } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true });
  
  const { data: byBrand } = await supabase
    .from('vehicle_appearances')
    .select('vehicle_make')
    .then(res => {
      const counts: Record<string, number> = {};
      res.data?.forEach(r => {
        counts[r.vehicle_make] = (counts[r.vehicle_make] || 0) + 1;
      });
      return { data: counts };
    });
  
  const { data: byType } = await supabase
    .from('vehicle_appearances')
    .select('media_type')
    .then(res => {
      const counts: Record<string, number> = {};
      res.data?.forEach(r => {
        counts[r.media_type] = (counts[r.media_type] || 0) + 1;
      });
      return { data: counts };
    });
  
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total records in DB: ${totalCount?.toLocaleString()}`);
  
  if (byBrand) {
    console.log('\nBy brand:');
    Object.entries(byBrand).forEach(([brand, count]) => {
      console.log(`  ${brand}: ${count.toLocaleString()}`);
    });
  }
  
  if (byType) {
    console.log('\nBy media type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count.toLocaleString()}`);
    });
  }
  
  // Sample iconic entries
  const { data: samples } = await supabase
    .from('vehicle_appearances')
    .select('*')
    .eq('role_importance', 'star')
    .order('movie_year', { ascending: false })
    .limit(10);
  
  if (samples && samples.length > 0) {
    console.log('\nSample "star" appearances:');
    samples.forEach(s => {
      console.log(`  • ${s.vehicle_make} ${s.chassis_code} in "${s.movie_title}" (${s.movie_year})`);
    });
  }
  
  console.log('\n✓ Done!');
}

main().catch(console.error);
