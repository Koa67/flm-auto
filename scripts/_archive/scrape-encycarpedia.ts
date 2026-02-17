/**
 * FLM AUTO — EncyCARpedia Scraper
 * Source : https://www.encycarpedia.com/
 * Data : Rankings, performances, design moderne
 * 
 * Usage: npx ts-node scrape-encycarpedia.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    };
    
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

interface EncyCARpediaCar {
  make: string;
  model: string;
  variant: string;
  years: string;
  power_hp: number;
  fuel_type: string;
  drivetrain: string;
  body_type: string;
  acceleration_0_62: number;
  top_speed_mph: number;
  displacement_l: number;
  cylinders: number;
  torque_lbft: number;
  mpg_combined: number;
  source_url: string;
}

function parseEncyCARpediaList(html: string): EncyCARpediaCar[] {
  const cars: EncyCARpediaCar[] = [];
  
  // Pattern to match car cards
  const cardPattern = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?(\d{4})\s*-\s*(\d{4}|present)[\s\S]*?(\d+)\s*hp[\s\S]*?(Gas|Diesel|Electric|Hybrid)[\s\S]*?(RWD|FWD|AWD)/gi;
  
  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const [_, url, name, yearStart, yearEnd, hp, fuel, drive] = match;
    
    const nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
      cars.push({
        make: nameParts[0],
        model: nameParts.slice(1).join(' '),
        variant: '',
        years: `${yearStart}-${yearEnd}`,
        power_hp: parseInt(hp),
        fuel_type: fuel,
        drivetrain: drive,
        body_type: '',
        acceleration_0_62: 0,
        top_speed_mph: 0,
        displacement_l: 0,
        cylinders: 0,
        torque_lbft: 0,
        mpg_combined: 0,
        source_url: url.startsWith('http') ? url : `https://www.encycarpedia.com${url}`
      });
    }
  }
  
  return cars;
}

async function scrapeCategory(category: string): Promise<EncyCARpediaCar[]> {
  const url = `https://www.encycarpedia.com/us/${category}`;
  console.log(`   📄 Scraping ${category}...`);
  
  try {
    const html = await fetchPage(url);
    return parseEncyCARpediaList(html);
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('🏎️  FLM AUTO — EncyCARpedia Scraper\n');
  
  let totalScraped = 0;
  let totalSaved = 0;

  // Categories to scrape
  const categories = [
    'sedans',
    'hatchbacks', 
    'coupes',
    'convertibles',
    'suvs',
    'wagons',
    'vans',
    'trucks'
  ];

  // Also scrape by make
  const makes = [
    'bmw', 'mercedes-benz', 'audi', 'porsche',
    'ferrari', 'lamborghini', 'mclaren',
    'toyota', 'honda', 'nissan',
    'ford', 'chevrolet', 'dodge'
  ];

  for (const category of categories) {
    const cars = await scrapeCategory(category);
    console.log(`   Found ${cars.length} cars in ${category}`);
    
    for (const car of cars) {
      totalScraped++;
      
      const { error } = await supabase.from('scraped_data').insert({
        source: 'EncyCARpedia',
        source_url: car.source_url,
        raw_data: car,
        scraped_at: new Date().toISOString()
      });
      
      if (!error) totalSaved++;
    }
    
    await delay(1000);
  }

  console.log('\n🏷️  Scraping by make...\n');
  
  for (const make of makes) {
    const url = `https://www.encycarpedia.com/us/make/${make}`;
    try {
      const html = await fetchPage(url);
      const cars = parseEncyCARpediaList(html);
      console.log(`   ${make}: ${cars.length} cars`);
      
      for (const car of cars) {
        totalScraped++;
        
        const { error } = await supabase.from('scraped_data').insert({
          source: 'EncyCARpedia',
          source_url: car.source_url,
          raw_data: car,
          scraped_at: new Date().toISOString()
        });
        
        if (!error) totalSaved++;
      }
    } catch (e) {
      console.log(`   ${make}: error`);
    }
    
    await delay(800);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ EncyCARpedia: ${totalScraped} scraped, ${totalSaved} saved`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
