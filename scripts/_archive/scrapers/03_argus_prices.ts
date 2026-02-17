/**
 * FLM AUTO - L'Argus Prix Scraper
 * Source: largus.fr/prix-du-neuf
 * 
 * Run: npx ts-node scripts/scrapers/03_argus_prices.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

const BASE_URL = 'https://www.largus.fr';
const OUTPUT_DIR = '../data/raw/argus';

const BRANDS = [
  { name: 'BMW', slug: 'bmw' },
  { name: 'Mercedes-Benz', slug: 'mercedes-benz' },
  { name: 'Audi', slug: 'audi' },
  { name: 'Volkswagen', slug: 'volkswagen' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Skoda', slug: 'skoda' },
];

interface PriceEntry {
  brand: string;
  model: string;
  version: string;
  price_base_eur: number;
  price_equipped_eur: number | null;
  engine: string;
  power_hp: number;
  transmission: string;
  fuel_type: string;
  co2_gkm: number;
  malus_eur: number;
  consumption_l100: number;
  scraped_at: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      console.log(`    Retry ${i + 1}/${retries}...`);
      await delay(2000 * (i + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function getBrandModels(brand: { name: string; slug: string }): Promise<string[]> {
  const url = `${BASE_URL}/prix-du-neuf/${brand.slug}.html`;
  const html = await fetchWithRetry(url);
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  const modelLinks: string[] = [];
  const links = doc.querySelectorAll('a[href*="/prix-du-neuf/"]');
  
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(brand.slug) && !href.endsWith(`${brand.slug}.html`)) {
      modelLinks.push(href);
    }
  });
  
  return [...new Set(modelLinks)];
}

async function getModelVersions(modelUrl: string, brandName: string): Promise<PriceEntry[]> {
  const url = modelUrl.startsWith('http') ? modelUrl : `${BASE_URL}${modelUrl}`;
  const html = await fetchWithRetry(url);
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  const entries: PriceEntry[] = [];
  
  // Extract model name from URL
  const modelMatch = modelUrl.match(/\/([^\/]+)\.html$/);
  const modelName = modelMatch ? modelMatch[1].replace(/-/g, ' ') : 'Unknown';
  
  // Find version rows
  const rows = doc.querySelectorAll('tr[data-version], .version-row, .price-row');
  
  rows.forEach(row => {
    try {
      const versionEl = row.querySelector('.version-name, .name, td:first-child');
      const priceEl = row.querySelector('.price, .prix, [data-price]');
      const engineEl = row.querySelector('.engine, .motorisation');
      const powerEl = row.querySelector('.power, .puissance');
      const co2El = row.querySelector('.co2, .emissions');
      
      if (versionEl && priceEl) {
        const priceText = priceEl.textContent?.replace(/[^\d]/g, '') || '0';
        
        entries.push({
          brand: brandName,
          model: modelName,
          version: versionEl.textContent?.trim() || '',
          price_base_eur: parseInt(priceText),
          price_equipped_eur: null,
          engine: engineEl?.textContent?.trim() || '',
          power_hp: parseInt(powerEl?.textContent?.replace(/[^\d]/g, '') || '0'),
          transmission: 'auto',
          fuel_type: 'essence',
          co2_gkm: parseInt(co2El?.textContent?.replace(/[^\d]/g, '') || '0'),
          malus_eur: 0,
          consumption_l100: 0,
          scraped_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      // Skip malformed rows
    }
  });
  
  return entries;
}

async function scrapeBrand(brand: { name: string; slug: string }): Promise<PriceEntry[]> {
  console.log(`\n💰 Scraping ${brand.name} prices...`);
  const entries: PriceEntry[] = [];
  
  try {
    const models = await getBrandModels(brand);
    console.log(`  Found ${models.length} models`);
    
    for (const modelUrl of models.slice(0, 50)) { // Limit for safety
      await delay(800);
      
      try {
        const versions = await getModelVersions(modelUrl, brand.name);
        entries.push(...versions);
        console.log(`    ${modelUrl}: ${versions.length} versions`);
      } catch (e) {
        console.log(`    ⚠️ Failed: ${modelUrl}`);
      }
    }
  } catch (e) {
    console.error(`  ❌ Error scraping ${brand.name}:`, e);
  }
  
  return entries;
}

async function main() {
  console.log('🚀 FLM AUTO - L\'Argus Price Scraper');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allEntries: PriceEntry[] = [];
  
  for (const brand of BRANDS) {
    const brandEntries = await scrapeBrand(brand);
    allEntries.push(...brandEntries);
    
    // Save per-brand
    const brandFile = path.join(OUTPUT_DIR, `${brand.slug}_prices.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandEntries, null, 2));
    console.log(`  💾 Saved ${brandEntries.length} entries`);
  }
  
  // Save combined
  const combinedFile = path.join(OUTPUT_DIR, 'all_prices.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allEntries, null, 2));
  
  console.log(`\n✅ Total: ${allEntries.length} price entries`);
}

main().catch(console.error);
