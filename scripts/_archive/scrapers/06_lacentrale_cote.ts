/**
 * FLM AUTO - La Centrale Cote Occasion Scraper
 * Source: lacentrale.fr/cote-voitures
 * 
 * Run: npx ts-node scripts/scrapers/06_lacentrale_cote.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.lacentrale.fr';
const OUTPUT_DIR = '../data/raw/lacentrale';

const BRANDS = [
  { name: 'BMW', slug: 'bmw' },
  { name: 'Mercedes-Benz', slug: 'mercedes' },
  { name: 'Audi', slug: 'audi' },
  { name: 'Volkswagen', slug: 'volkswagen' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Skoda', slug: 'skoda' },
];

const YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
const MILEAGES = [0, 20000, 50000, 100000, 150000];

interface CoteEntry {
  brand: string;
  model: string;
  version: string;
  year: number;
  mileage_km: number;
  cote_eur: number;
  price_new_eur: number | null;
  depreciation_percent: number | null;
  fuel_type: string;
  transmission: string;
  power_hp: number;
  scraped_at: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCote(brand: string, model: string, year: number, mileage: number): Promise<number | null> {
  const url = `${BASE_URL}/cote-auto/${brand.toLowerCase()}/${model.toLowerCase()}/${year}?km=${mileage}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      }
    });
    
    const html = await response.text();
    
    // Extract cote value
    const coteMatch = html.match(/cote[^>]*>[\s]*(\d[\d\s]*)\s*€/i) ||
                      html.match(/prix[^>]*>[\s]*(\d[\d\s]*)\s*€/i) ||
                      html.match(/"price":\s*(\d+)/);
    
    if (coteMatch) {
      return parseInt(coteMatch[1].replace(/\s/g, ''));
    }
  } catch (e) {
    // Silently fail
  }
  
  return null;
}

async function getBrandModels(brand: { name: string; slug: string }): Promise<string[]> {
  const url = `${BASE_URL}/cote-voitures-${brand.slug}---.html`;
  
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    const models: string[] = [];
    const modelRegex = /cote-voitures-[^"]*-([a-z0-9\-]+)---/g;
    let match;
    
    while ((match = modelRegex.exec(html)) !== null) {
      const model = match[1].replace(/-/g, ' ');
      if (!models.includes(model) && model !== brand.slug) {
        models.push(model);
      }
    }
    
    return models.slice(0, 20); // Limit per brand
  } catch (e) {
    return [];
  }
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<CoteEntry[]> {
  console.log(`\n💶 Scraping ${brand.name} cotes...`);
  const entries: CoteEntry[] = [];
  
  const models = await getBrandModels(brand);
  console.log(`  Found ${models.length} models`);
  
  for (const model of models) {
    for (const year of YEARS) {
      for (const mileage of MILEAGES) {
        await delay(300);
        
        const cote = await fetchCote(brand.slug, model.replace(/\s/g, '-'), year, mileage);
        
        if (cote && cote > 1000) {
          entries.push({
            brand: brand.name,
            model,
            version: '',
            year,
            mileage_km: mileage,
            cote_eur: cote,
            price_new_eur: null,
            depreciation_percent: null,
            fuel_type: '',
            transmission: '',
            power_hp: 0,
            scraped_at: new Date().toISOString(),
          });
        }
      }
    }
    console.log(`    ${model}: ${entries.filter(e => e.model === model).length} cotes`);
  }
  
  return entries;
}

async function main() {
  console.log('🚀 FLM AUTO - La Centrale Cote Scraper');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allEntries: CoteEntry[] = [];
  
  for (const brand of BRANDS) {
    const brandEntries = await scrapeBrand(brand);
    allEntries.push(...brandEntries);
    
    const brandFile = path.join(OUTPUT_DIR, `${brand.slug}_cotes.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandEntries, null, 2));
    console.log(`  💾 Saved ${brandEntries.length} cotes`);
  }
  
  const combinedFile = path.join(OUTPUT_DIR, 'all_cotes.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allEntries, null, 2));
  
  console.log(`\n✅ Total: ${allEntries.length} cote entries`);
}

main().catch(console.error);
