/**
 * FLM AUTO - Carwow Performance Data Scraper
 * Source: carwow.co.uk/drag-race-leaderboard
 * 
 * Run: npx ts-node scripts/scrapers/08_carwow_performance.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const LEADERBOARD_URL = 'https://www.carwow.co.uk/blog/drag-race-leaderboard';
const OUTPUT_DIR = '../data/raw/carwow';

interface PerformanceEntry {
  rank: number;
  brand: string;
  model: string;
  variant: string;
  quarter_mile_sec: number;
  zero_to_60_mph: number;
  zero_to_100_kmh: number | null;
  trap_speed_mph: number;
  trap_speed_kmh: number;
  power_hp: number;
  torque_nm: number | null;
  weight_kg: number | null;
  drivetrain: string;
  fuel_type: string;
  video_url: string | null;
}

async function fetchLeaderboard(): Promise<PerformanceEntry[]> {
  console.log('🏁 Fetching Carwow leaderboard...');
  
  const response = await fetch(LEADERBOARD_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  const entries: PerformanceEntry[] = [];
  
  // Parse table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  let rank = 0;
  
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    
    // Extract cells
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    
    if (cells.length >= 4 && cells[0].match(/\d/)) {
      rank++;
      
      // Parse car name
      const carName = cells[1] || '';
      const brandMatch = carName.match(/^(\w+)/);
      
      entries.push({
        rank,
        brand: brandMatch ? brandMatch[1] : '',
        model: carName,
        variant: '',
        quarter_mile_sec: parseFloat(cells[2]) || 0,
        zero_to_60_mph: parseFloat(cells[3]) || 0,
        zero_to_100_kmh: null,
        trap_speed_mph: parseFloat(cells[4]) || 0,
        trap_speed_kmh: parseFloat(cells[4]) ? parseFloat(cells[4]) * 1.60934 : 0,
        power_hp: parseInt(cells[5]?.replace(/[^\d]/g, '')) || 0,
        torque_nm: null,
        weight_kg: null,
        drivetrain: cells[6] || '',
        fuel_type: cells[7] || '',
        video_url: null,
      });
    }
  }
  
  return entries;
}

async function main() {
  console.log('🚀 FLM AUTO - Carwow Performance Scraper');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const entries = await fetchLeaderboard();
  
  // Filter for our brands
  const targetBrands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Porsche', 'Skoda'];
  const filteredEntries = entries.filter(e => 
    targetBrands.some(b => e.brand.toLowerCase().includes(b.toLowerCase()) || 
                          e.model.toLowerCase().includes(b.toLowerCase()))
  );
  
  // Save all
  const allFile = path.join(OUTPUT_DIR, 'all_performance.json');
  fs.writeFileSync(allFile, JSON.stringify(entries, null, 2));
  
  // Save filtered
  const filteredFile = path.join(OUTPUT_DIR, 'mvp_brands_performance.json');
  fs.writeFileSync(filteredFile, JSON.stringify(filteredEntries, null, 2));
  
  // Create top 10 by brand
  const topByBrand: Record<string, PerformanceEntry[]> = {};
  for (const brand of targetBrands) {
    topByBrand[brand] = entries
      .filter(e => e.brand.toLowerCase() === brand.toLowerCase() || 
                   e.model.toLowerCase().startsWith(brand.toLowerCase()))
      .slice(0, 10);
  }
  
  const topFile = path.join(OUTPUT_DIR, 'top_by_brand.json');
  fs.writeFileSync(topFile, JSON.stringify(topByBrand, null, 2));
  
  console.log(`\n✅ Total: ${entries.length} performance entries`);
  console.log(`📊 MVP brands: ${filteredEntries.length} entries`);
}

main().catch(console.error);
