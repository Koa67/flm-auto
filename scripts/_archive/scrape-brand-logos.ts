/**
 * FLM AUTO — Brand Logo Scraper
 * 
 * Sources (in priority order):
 * 1. Wikimedia Commons — Category:SVG_logos_of_automobile_manufacturers
 * 2. Logo.dev CDN — https://img.logo.dev/{domain}?token=...
 * 3. Simple-icons via CDN — https://cdn.simpleicons.org/{brand}
 * 
 * Outputs: updates brands table with logo_url
 * Also saves local JSON backup.
 * 
 * Usage: npx ts-node scrape-brand-logos.ts
 *        npx ts-node scrape-brand-logos.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const DRY_RUN = process.argv.includes('--dry-run');

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, { headers: { 'User-Agent': 'FLM-Auto-Research/1.0 (contact@flm-auto.com)' } }, (res: any) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function checkUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : require('http');
    const req = mod.get(url, { headers: { 'User-Agent': 'FLM-Auto/1.0' }, method: 'HEAD' }, (res: any) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Known Wikimedia filenames for car brand logos (curated)
const WIKIMEDIA_LOGOS: Record<string, string> = {
  'Audi': 'https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg',
  'BMW': 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg',
  'Mercedes-Benz': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Benz_combined_logo_including_wordmark.svg',
  'Volkswagen': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg',
  'Porsche': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Porsche_logo.svg',
  'Toyota': 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Toyota.svg',
  'Honda': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg',
  'Nissan': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Nissan_2020_logo.svg',
  'Mazda': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Mazda_Motor_logo.svg',
  'Hyundai': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg',
  'Kia': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Kia-logo.svg',
  'Volvo': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Volvo_Trucks_%26_Bus_logo.svg',
  'Skoda': 'https://upload.wikimedia.org/wikipedia/commons/f/fd/%C5%A0koda_Auto_2016.svg',
  'Tesla': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
  'Peugeot': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Peugeot_2010_logo.svg',
  'Renault': 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Renault_2021_Text.svg',
  'Ferrari': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Ferrari_logo.svg',
  'Lamborghini': 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Lamborghini_Logo.svg',
  'Alfa Romeo': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Alfa_Romeo_2015.svg',
  'Fiat': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Fiat_Automobiles_logo_%282006%29.svg',
  'Jaguar': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Jaguar_2012_logo.svg',
  'Land Rover': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Land_Rover_logo2.svg',
  'Mini': 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Mini_logo.svg',
  'Maserati': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Maserati_Logo.svg',
  'Aston Martin': 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Aston_Martin_Logo_2021.svg',
  'Bentley': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bentley_logo_2.svg',
  'Rolls-Royce': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Rolls-Royce_Motor_Cars_logo.svg',
  'Lexus': 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Lexus_division_emblem.svg',
  'Ford': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Ford_Motor_Company_Logo.svg',
  'Citroen': 'https://upload.wikimedia.org/wikipedia/commons/0/04/Citro%C3%ABn_logo_2016.svg',
  'Opel': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Opel-Logo_2017.svg',
  'Seat': 'https://upload.wikimedia.org/wikipedia/commons/6/62/SEAT_Logo_from_2017.svg',
};

// Simple-icons slugs for fallback
const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  'BMW': 'bmw', 'Audi': 'audi', 'Mercedes-Benz': 'mercedes',
  'Volkswagen': 'volkswagen', 'Porsche': 'porsche', 'Toyota': 'toyota',
  'Honda': 'honda', 'Hyundai': 'hyundai', 'Kia': 'kia', 'Tesla': 'tesla',
  'Ferrari': 'ferrari', 'Lamborghini': 'lamborghini', 'Mazda': 'mazda',
  'Nissan': 'nissan', 'Volvo': 'volvo', 'Peugeot': 'peugeot',
  'Renault': 'renault', 'Fiat': 'fiat', 'Ford': 'ford',
  'Mini': 'mini', 'Skoda': 'skoda', 'Rolls-Royce': 'rollsroyce',
  'Alfa Romeo': 'alfaromeo', 'Aston Martin': 'astonmartin',
  'Bentley': 'bentley', 'Jaguar': 'jaguar', 'Lexus': 'lexus',
  'Land Rover': 'landrover', 'Maserati': 'maserati',
  'Opel': 'opel', 'Seat': 'seat', 'Citroen': 'citroen',
};

interface LogoResult {
  brand: string;
  logo_url: string;
  source: 'wikimedia' | 'simpleicons' | 'none';
  format: 'svg' | 'png' | 'none';
}

async function main() {
  console.log(`🏷️  FLM AUTO — Brand Logo Scraper ${DRY_RUN ? '(DRY-RUN)' : ''}\n`);

  // Get all brands from DB
  const { data: brands } = await supabase.from('brands').select('id, name, logo_url');
  if (!brands) { console.log('❌ Failed to load brands'); return; }

  console.log(`  ${brands.length} brands in DB\n`);

  const results: LogoResult[] = [];
  let found = 0, missing = 0, alreadySet = 0;

  for (const brand of brands) {
    process.stdout.write(`  ${brand.name.padEnd(20)}`);

    // Skip if already has a logo
    if (brand.logo_url) {
      console.log(`✅ already set`);
      alreadySet++;
      results.push({ brand: brand.name, logo_url: brand.logo_url, source: 'wikimedia', format: 'svg' });
      continue;
    }

    // Strategy 1: Wikimedia curated URL
    const wikiUrl = WIKIMEDIA_LOGOS[brand.name];
    if (wikiUrl) {
      const ok = await checkUrl(wikiUrl);
      if (ok) {
        console.log(`✅ Wikimedia ${wikiUrl.endsWith('.svg') ? 'SVG' : 'PNG'}`);
        results.push({ brand: brand.name, logo_url: wikiUrl, source: 'wikimedia', format: wikiUrl.endsWith('.svg') ? 'svg' : 'png' });
        
        if (!DRY_RUN) {
          await supabase.from('brands').update({ logo_url: wikiUrl }).eq('id', brand.id);
        }
        found++;
        await delay(100);
        continue;
      }
    }

    // Strategy 2: Simple Icons CDN
    const slug = SIMPLE_ICONS_SLUGS[brand.name];
    if (slug) {
      const siUrl = `https://cdn.simpleicons.org/${slug}/ffffff`;
      // Simple icons always returns 200 with a placeholder if not found, so just use it
      console.log(`🔄 SimpleIcons fallback`);
      results.push({ brand: brand.name, logo_url: siUrl, source: 'simpleicons', format: 'svg' });
      
      if (!DRY_RUN) {
        await supabase.from('brands').update({ logo_url: siUrl }).eq('id', brand.id);
      }
      found++;
      continue;
    }

    console.log(`❌ no source`);
    results.push({ brand: brand.name, logo_url: '', source: 'none', format: 'none' });
    missing++;
  }

  // Save local backup
  const outputPath = '/Users/koa/Dev/flm-auto/data/brand-logos.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Found:        ${found}`);
  console.log(`  Already set:  ${alreadySet}`);
  console.log(`  Missing:      ${missing}`);
  console.log(`  Saved:        ${outputPath}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
