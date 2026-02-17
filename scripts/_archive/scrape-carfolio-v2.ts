/**
 * FLM AUTO — Carfolio.com Scraper v2
 * Fix: HTTP redirect handling, better parsing
 * 
 * Usage: npx ts-node scrape-carfolio-v2.ts
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow'
  });
  return res.text();
}

interface CarSpec {
  make: string;
  model: string;
  year?: number;
  variant?: string;
  body_type?: string;
  doors?: number;
  engine_cc?: number;
  power_hp?: number;
  power_kw?: number;
  torque_nm?: number;
  transmission?: string;
  drive?: string;
  fuel?: string;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  weight_kg?: number;
  top_speed?: number;
  accel_0_100?: number;
  consumption?: number;
  co2?: number;
}

function extractNumber(text: string): number | undefined {
  const match = text.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(',', '')) : undefined;
}

function parseCarfolioSpecs(html: string): CarSpec | null {
  const car: CarSpec = { make: '', model: '' };
  
  // Title parsing: "2024 BMW M3 Competition - specifications"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].replace(' - specifications', '').replace(' - Carfolio.com', '');
    const parts = title.split(' ');
    if (parts.length >= 2) {
      // Check if first part is year
      if (/^\d{4}$/.test(parts[0])) {
        car.year = parseInt(parts[0]);
        car.make = parts[1];
        car.model = parts.slice(2).join(' ');
      } else {
        car.make = parts[0];
        car.model = parts.slice(1).join(' ');
      }
    }
  }

  if (!car.make || !car.model) return null;

  // Extract specs from definition lists or tables
  const specMappings: [RegExp, keyof CarSpec][] = [
    [/body\s*(?:style|type)[^:]*:\s*([^<\n]+)/i, 'body_type'],
    [/doors[^:]*:\s*(\d+)/i, 'doors'],
    [/engine[^:]*(?:capacity|displacement|size)[^:]*:\s*([\d,]+)\s*(?:cc|cm)/i, 'engine_cc'],
    [/(?:max(?:imum)?\.?\s*)?power[^:]*:\s*([\d,]+)\s*(?:hp|bhp|ps|cv)/i, 'power_hp'],
    [/(?:max(?:imum)?\.?\s*)?power[^:]*:\s*([\d,]+)\s*kw/i, 'power_kw'],
    [/(?:max(?:imum)?\.?\s*)?torque[^:]*:\s*([\d,]+)\s*nm/i, 'torque_nm'],
    [/transmission[^:]*:\s*([^<\n,]+)/i, 'transmission'],
    [/drive(?:train)?[^:]*:\s*([^<\n,]+)/i, 'drive'],
    [/fuel\s*(?:type)?[^:]*:\s*([^<\n,]+)/i, 'fuel'],
    [/length[^:]*:\s*([\d,]+)\s*mm/i, 'length_mm'],
    [/width[^:]*:\s*([\d,]+)\s*mm/i, 'width_mm'],
    [/height[^:]*:\s*([\d,]+)\s*mm/i, 'height_mm'],
    [/wheelbase[^:]*:\s*([\d,]+)\s*mm/i, 'wheelbase_mm'],
    [/(?:kerb|curb|unladen)\s*weight[^:]*:\s*([\d,]+)\s*kg/i, 'weight_kg'],
    [/(?:top|max(?:imum)?)\s*speed[^:]*:\s*([\d,]+)\s*km/i, 'top_speed'],
    [/0-100[^:]*:\s*([\d.]+)\s*s/i, 'accel_0_100'],
    [/(?:combined|average)\s*(?:fuel)?\s*consumption[^:]*:\s*([\d.]+)\s*l/i, 'consumption'],
    [/co2[^:]*:\s*([\d,]+)\s*g/i, 'co2'],
  ];

  for (const [regex, field] of specMappings) {
    const match = html.match(regex);
    if (match) {
      const value = extractNumber(match[1]);
      if (value !== undefined) {
        (car as any)[field] = field === 'body_type' || field === 'transmission' || field === 'drive' || field === 'fuel' 
          ? match[1].trim() 
          : value;
      } else if (typeof match[1] === 'string') {
        (car as any)[field] = match[1].trim();
      }
    }
  }

  return car;
}

async function scrapeMakePage(make: string): Promise<string[]> {
  const url = `https://www.carfolio.com/specifications/models/car/?man=${encodeURIComponent(make)}`;
  console.log(`   Fetching models for ${make}...`);
  
  try {
    const html = await fetchPage(url);
    
    // Extract model links
    const modelLinks: string[] = [];
    const linkRegex = /href="(\/specifications\/models\/[^"]+)"/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      if (!match[1].includes('?man=')) {
        modelLinks.push(`https://www.carfolio.com${match[1]}`);
      }
    }
    
    return [...new Set(modelLinks)].slice(0, 20); // Limit per make
  } catch (e) {
    console.log(`   ⚠️ Error: ${(e as Error).message}`);
    return [];
  }
}

async function scrapeSpecPage(url: string): Promise<CarSpec | null> {
  try {
    const html = await fetchPage(url);
    return parseCarfolioSpecs(html);
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🚗 FLM AUTO — Carfolio Scraper v2\n');
  
  let totalScraped = 0;
  let totalSaved = 0;

  // Priority makes
  const makes = [
    'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
    'Porsche', 'Toyota', 'Honda', 'Nissan',
    'Renault', 'Peugeot', 'Citroen', 'Ford',
    'Hyundai', 'Kia', 'Mazda', 'Volvo'
  ];

  for (const make of makes) {
    console.log(`\n🏷️  ${make}`);
    
    const modelUrls = await scrapeMakePage(make);
    console.log(`   Found ${modelUrls.length} model pages`);
    
    for (const modelUrl of modelUrls.slice(0, 10)) {
      const spec = await scrapeSpecPage(modelUrl);
      
      if (spec && spec.make && spec.model) {
        totalScraped++;
        
        const { error } = await supabase.from('scraped_data').insert({
          source: 'Carfolio',
          source_url: modelUrl,
          raw_data: spec,
          scraped_at: new Date().toISOString()
        });
        
        if (!error) {
          totalSaved++;
          console.log(`   ✓ ${spec.year || ''} ${spec.model}`);
        }
      }
      
      await delay(300);
    }
    
    await delay(500);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Carfolio v2: ${totalScraped} scraped, ${totalSaved} saved`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
