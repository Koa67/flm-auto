/**
 * FLM AUTO - IMCDb Scraper v6 (Full pagination)
 * Gets ALL pages for each brand
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface MovieAppearance {
  brand: string;
  model: string;
  year: number | null;
  movie_title: string;
  movie_year: number | null;
  movie_url: string;
  vehicle_url: string;
  scraped_at: string;
}

const BRANDS = [
  { name: 'Ferrari', urlName: 'Ferrari' },
  { name: 'Porsche', urlName: 'Porsche' },
  { name: 'Audi', urlName: 'Audi' },
  { name: 'Aston Martin', urlName: 'Aston+Martin' },
  { name: 'Jaguar', urlName: 'Jaguar' },
  { name: 'Rolls-Royce', urlName: 'Rolls-Royce' },
  { name: 'Bentley', urlName: 'Bentley' },
  { name: 'Maserati', urlName: 'Maserati' },
  { name: 'Ford', urlName: 'Ford' },
  { name: 'Chevrolet', urlName: 'Chevrolet' },
  { name: 'Dodge', urlName: 'Dodge' },
  { name: 'Cadillac', urlName: 'Cadillac' },
  { name: 'Toyota', urlName: 'Toyota' },
  { name: 'Nissan', urlName: 'Nissan' },
  { name: 'Honda', urlName: 'Honda' },
  { name: 'Volkswagen', urlName: 'Volkswagen' },
  { name: 'Volvo', urlName: 'Volvo' },
  { name: 'Peugeot', urlName: 'Peugeot' },
  { name: 'Renault', urlName: 'Renault' },
  { name: 'Alfa Romeo', urlName: 'Alfa+Romeo' },
  { name: 'Fiat', urlName: 'Fiat' },
  { name: 'DeLorean', urlName: 'DeLorean' },
  { name: 'Tesla', urlName: 'Tesla' },
  { name: 'Land Rover', urlName: 'Land+Rover' },
  { name: 'Jeep', urlName: 'Jeep' },
  { name: 'Mini', urlName: 'Mini' },
  { name: 'McLaren', urlName: 'McLaren' },
  { name: 'Bugatti', urlName: 'Bugatti' },
  { name: 'Lotus', urlName: 'Lotus' },
  { name: 'Subaru', urlName: 'Subaru' },
  { name: 'Mitsubishi', urlName: 'Mitsubishi' },
  { name: 'Mazda', urlName: 'Mazda' },
  { name: 'Lexus', urlName: 'Lexus' },
  { name: 'Hyundai', urlName: 'Hyundai' },
  { name: 'Kia', urlName: 'Kia' },
  // Add more popular brands
  { name: 'Mercedes-Benz', urlName: 'Mercedes-Benz' },
  { name: 'BMW', urlName: 'BMW' },
  { name: 'Lamborghini', urlName: 'Lamborghini' },
  { name: 'Pontiac', urlName: 'Pontiac' },
  { name: 'Plymouth', urlName: 'Plymouth' },
  { name: 'Oldsmobile', urlName: 'Oldsmobile' },
  { name: 'Buick', urlName: 'Buick' },
  { name: 'Lincoln', urlName: 'Lincoln' },
  { name: 'Chrysler', urlName: 'Chrysler' },
  { name: 'AMC', urlName: 'AMC' },
  { name: 'Saab', urlName: 'Saab' },
  { name: 'Citroën', urlName: 'Citro%EBn' },
  { name: 'Opel', urlName: 'Opel' },
  { name: 'Triumph', urlName: 'Triumph' },
  { name: 'MG', urlName: 'MG' },
];

async function scrapeBrandPage(page: Page, brand: { name: string; urlName: string }, pageNum: number): Promise<MovieAppearance[]> {
  const appearances: MovieAppearance[] = [];
  
  try {
    const url = `https://www.imcdb.org/vehicles.php?make=${brand.urlName}&model=&page=${pageNum}`;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(800);
    
    const data = await page.evaluate((brandName: string) => {
      const results: any[] = [];
      const vehicleLinks = document.querySelectorAll('a[href*="vehicle_"]');
      
      vehicleLinks.forEach((vehicleLink) => {
        const vehicleHref = (vehicleLink as HTMLAnchorElement).getAttribute('href') || '';
        const vehicleMatch = vehicleHref.match(/vehicle_\d+-([^.]+)\.html/);
        if (!vehicleMatch) return;
        
        const vehicleParts = vehicleMatch[1].split('-');
        const lastPart = vehicleParts[vehicleParts.length - 1];
        const yearMatch = lastPart.match(/^(19|20)\d{2}$/);
        const vehicleYear = yearMatch ? parseInt(lastPart) : null;
        const modelParts = vehicleYear ? vehicleParts.slice(1, -1) : vehicleParts.slice(1);
        const model = modelParts.join(' ') || 'Unknown';
        
        let movieHref = '';
        let movieTitle = '';
        let movieYear: number | null = null;
        
        let current: Element | null = vehicleLink;
        for (let i = 0; i < 10 && current; i++) {
          current = current.parentElement;
          if (!current) break;
          
          const movieLink = current.querySelector('a[href*="movie_"], a[href*="movie.php"]') as HTMLAnchorElement | null;
          if (movieLink) {
            movieHref = movieLink.getAttribute('href') || '';
            movieTitle = movieLink.textContent?.trim() || '';
            const containerText = current.textContent || '';
            const movieYearMatch = containerText.match(/\((\d{4})\)/);
            if (movieYearMatch) movieYear = parseInt(movieYearMatch[1]);
            break;
          }
        }
        
        if (movieTitle) {
          results.push({
            brand: brandName,
            model,
            year: vehicleYear,
            movie_title: movieTitle,
            movie_year: movieYear,
            movie_url: movieHref.startsWith('http') ? movieHref : `https://www.imcdb.org/${movieHref}`,
            vehicle_url: vehicleHref.startsWith('http') ? vehicleHref : `https://www.imcdb.org/${vehicleHref}`,
          });
        }
      });
      
      return results;
    }, brand.name);
    
    for (const d of data) {
      appearances.push({ ...d, scraped_at: new Date().toISOString() });
    }
    
  } catch (err) {
    // Ignore
  }
  
  return appearances;
}

async function scrapeBrand(page: Page, brand: { name: string; urlName: string }, maxPages: number = 20): Promise<MovieAppearance[]> {
  const allAppearances: MovieAppearance[] = [];
  
  for (let p = 1; p <= maxPages; p++) {
    const pageResults = await scrapeBrandPage(page, brand, p);
    
    if (pageResults.length === 0) break; // No more results
    
    allAppearances.push(...pageResults);
    
    // Progress indicator
    if (p > 1) process.stdout.write(`.`);
    
    await delay(600);
  }
  
  // Dedupe
  const seen = new Set<string>();
  return allAppearances.filter(a => {
    if (seen.has(a.vehicle_url)) return false;
    seen.add(a.vehicle_url);
    return true;
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - IMCDb Scraper v6 (Full Pagination)          ║');
  console.log('║     Target: 20 pages per brand, ~50 brands                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/imcdb');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'appearances-full.json');
  let allAppearances: MovieAppearance[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allAppearances = existing;
    console.log(`Loaded ${existing.length} existing appearances\n`);
  }

  const processedBrands = new Set<string>();
  allAppearances.forEach(a => processedBrands.add(a.brand));

  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    for (let i = 0; i < BRANDS.length; i++) {
      const brand = BRANDS[i];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
      
      process.stdout.write(`[${i + 1}/${BRANDS.length}] ${brand.name.padEnd(15)} (${elapsedStr})`);
      
      if (processedBrands.has(brand.name)) {
        const count = allAppearances.filter(a => a.brand === brand.name).length;
        console.log(` → SKIP (${count} exists) ⏭️`);
        continue;
      }
      
      const appearances = await scrapeBrand(page, brand, 20);
      allAppearances.push(...appearances);
      
      console.log(` → ${appearances.length} appearances ✅`);
      
      // Save progress every 5 brands
      if ((i + 1) % 5 === 0) {
        fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));
      }
      
      await delay(1000);
    }

    await page.close();
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));

  // Stats
  const brandStats = new Map<string, number>();
  allAppearances.forEach(a => {
    brandStats.set(a.brand, (brandStats.get(a.brand) || 0) + 1);
  });

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('TOP 10 BRANDS:');
  const sorted = [...brandStats.entries()].sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 10).forEach(([brand, count]) => {
    console.log(`  ${brand.padEnd(20)} ${count}`);
  });
  console.log('─'.repeat(60));
  console.log(`Total appearances: ${allAppearances.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
