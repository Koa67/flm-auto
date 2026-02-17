/**
 * IGCD (Internet Game Cars Database) Scraper v2
 * Scrapes video game appearances for BMW, Mercedes-Benz, Lamborghini
 */

import * as fs from 'fs';
import * as path from 'path';

const BRANDS = [
  { id: 'BMW', country: 'DE' },
  { id: 'Mercedes-Benz', country: 'DE' },
  { id: 'Lamborghini', country: 'IT' },
];

const BASE_URL = 'https://www.igcd.net';
const DELAY_MS = 600;

interface IGCDAppearance {
  igcd_vehicle_id: string;
  brand: string;
  model: string;
  year: number | null;
  variant: string | null;
  game_title: string;
  game_year: number | null;
  vehicle_url: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FLM-AUTO-Research/1.0 (Educational project)',
      'Accept': 'text/html',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  
  return response.text();
}

async function getModelPages(brand: string, country: string): Promise<string[]> {
  const pages: string[] = [];
  let page = 1;
  
  while (page <= 10) { // Safety limit
    const url = `${BASE_URL}/marque.php?id=${encodeURIComponent(brand)}&pays=${country}&sortStyle=alpha&page=${page}`;
    console.log(`  Fetching model list page ${page}...`);
    
    const html = await fetchPage(url);
    
    // Pattern: marque2.php?id=BMW&amp;pays=DE&amp;model=M3&amp;mk=4
    const modelRegex = /marque2\.php\?id=[^"'\s]+/g;
    const matches = html.match(modelRegex) || [];
    
    if (matches.length === 0) {
      console.log(`    No models found on page ${page}, stopping.`);
      break;
    }
    
    // Decode HTML entities and build full URLs
    const decoded = matches.map(m => {
      const clean = m.replace(/&amp;/g, '&');
      return `${BASE_URL}/${clean}`;
    });
    
    // Deduplicate
    const unique = [...new Set(decoded)];
    const newCount = unique.filter(u => !pages.includes(u)).length;
    pages.push(...unique.filter(u => !pages.includes(u)));
    
    console.log(`    Found ${unique.length} model links (${newCount} new)`);
    
    // Check if there's a next page
    if (!html.includes(`page=${page + 1}`)) {
      console.log(`    No more pages.`);
      break;
    }
    
    page++;
    await delay(DELAY_MS);
  }
  
  return pages;
}

async function scrapeModelPage(url: string, brand: string): Promise<IGCDAppearance[]> {
  const appearances: IGCDAppearance[] = [];
  
  try {
    const html = await fetchPage(url);
    
    // Each vehicle entry structure:
    // <a href="vehicle.php?id=XXXXX">
    //   <img ...>
    // </a>
    // <h5>2014 BMW i8</h5>
    // Game Name (2019)
    
    // Extract vehicle IDs and their context
    // Pattern: vehicle.php?id=(\d+)
    const vehicleIdRegex = /vehicle\.php\?id=(\d+)/g;
    let match;
    const vehicleIds: string[] = [];
    
    while ((match = vehicleIdRegex.exec(html)) !== null) {
      if (!vehicleIds.includes(match[1])) {
        vehicleIds.push(match[1]);
      }
    }
    
    // For each vehicle ID, find the surrounding context
    for (const vehicleId of vehicleIds) {
      // Find the h5 tag after this vehicle link
      const idPos = html.indexOf(`vehicle.php?id=${vehicleId}`);
      if (idPos === -1) continue;
      
      // Get surrounding context (500 chars after)
      const context = html.substring(idPos, idPos + 800);
      
      // Extract title from <h5>...</h5>
      const h5Match = context.match(/<h5[^>]*>([^<]+)<\/h5>/);
      if (!h5Match) continue;
      
      const title = h5Match[1].trim();
      
      // Extract game name (text after </h5> until next tag or newline)
      const afterH5 = context.substring(context.indexOf('</h5>') + 5);
      const gameMatch = afterH5.match(/^\s*([^<\n]+)/);
      const gameRaw = gameMatch ? gameMatch[1].trim() : '';
      
      // Parse title: "2014 BMW i8 *Übermacht Niobe*" or "BMW M3"
      const yearMatch = title.match(/^(\d{4})\s+/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      
      // Extract variant (in asterisks or italics)
      const variantMatch = title.match(/\*([^*]+)\*/);
      const variant = variantMatch ? variantMatch[1] : null;
      
      // Extract model
      let modelPart = title
        .replace(/^\d{4}\s+/, '')
        .replace(/\*[^*]+\*/, '')
        .replace(new RegExp(`^${brand}\\s+`, 'i'), '')
        .trim();
      
      // Parse game: "Need for Speed: Heat (2019)"
      const gameYearMatch = gameRaw.match(/^(.+?)\s*\((\d{4})\)\s*$/);
      const gameTitle = gameYearMatch ? gameYearMatch[1].trim() : gameRaw;
      const gameYear = gameYearMatch ? parseInt(gameYearMatch[2]) : null;
      
      if (modelPart && gameTitle) {
        appearances.push({
          igcd_vehicle_id: vehicleId,
          brand,
          model: modelPart,
          year,
          variant,
          game_title: gameTitle,
          game_year: gameYear,
          vehicle_url: `${BASE_URL}/vehicle.php?id=${vehicleId}`,
        });
      }
    }
  } catch (error) {
    console.error(`  Error scraping ${url}:`, error);
  }
  
  return appearances;
}

async function scrapeBrand(brand: string, country: string): Promise<IGCDAppearance[]> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping ${brand}...`);
  console.log('='.repeat(60));
  
  const modelPages = await getModelPages(brand, country);
  console.log(`\nTotal: ${modelPages.length} unique model pages for ${brand}`);
  
  const allAppearances: IGCDAppearance[] = [];
  
  for (let i = 0; i < modelPages.length; i++) {
    const url = modelPages[i];
    const modelName = decodeURIComponent(url.split('model=')[1]?.split('&')[0] || 'unknown');
    
    process.stdout.write(`  [${i + 1}/${modelPages.length}] ${modelName.substring(0, 20).padEnd(20)}...`);
    
    const appearances = await scrapeModelPage(url, brand);
    allAppearances.push(...appearances);
    
    console.log(` ${appearances.length} appearances`);
    
    await delay(DELAY_MS);
  }
  
  return allAppearances;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - IGCD Scraper v2 (Video Game Cars)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const outputDir = path.join(__dirname, '../data/igcd');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const allAppearances: IGCDAppearance[] = [];
  
  for (const { id: brand, country } of BRANDS) {
    try {
      const appearances = await scrapeBrand(brand, country);
      allAppearances.push(...appearances);
      
      // Save per-brand
      const brandFile = path.join(outputDir, `${brand.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
      fs.writeFileSync(brandFile, JSON.stringify(appearances, null, 2));
      console.log(`\n✓ Saved ${appearances.length} ${brand} appearances to ${path.basename(brandFile)}`);
      
    } catch (error) {
      console.error(`\n✗ Error scraping ${brand}:`, error);
    }
    
    await delay(2000);
  }
  
  // Save combined
  const combinedFile = path.join(outputDir, 'all_game_appearances.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allAppearances, null, 2));
  
  // Stats
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total appearances: ${allAppearances.length}`);
  
  const byBrand = allAppearances.reduce((acc, a) => {
    acc[a.brand] = (acc[a.brand] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nBy brand:');
  Object.entries(byBrand).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });
  
  const byGame = allAppearances.reduce((acc, a) => {
    acc[a.game_title] = (acc[a.game_title] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topGames = Object.entries(byGame)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  console.log('\nTop 20 games:');
  topGames.forEach(([game, count], i) => {
    console.log(`  ${i + 1}. ${game}: ${count}`);
  });
  
  console.log(`\n✓ Done!`);
}

main().catch(console.error);
