/**
 * FLM AUTO - IMCDb Scraper v5 (Working!)
 * Extracts vehicle-movie pairs from thumbnail grid
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
];

async function scrapeBrandPage(page: Page, brand: { name: string; urlName: string }, pageNum: number = 1): Promise<MovieAppearance[]> {
  const appearances: MovieAppearance[] = [];
  
  try {
    const url = pageNum === 1 
      ? `https://www.imcdb.org/vehicles.php?make=${brand.urlName}&model=`
      : `https://www.imcdb.org/vehicles.php?make=${brand.urlName}&model=&page=${pageNum}`;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1000);
    
    const data = await page.evaluate((brandName: string) => {
      const results: any[] = [];
      
      // Find all vehicle links
      const vehicleLinks = document.querySelectorAll('a[href*="vehicle_"]');
      
      vehicleLinks.forEach((vehicleLink) => {
        const vehicleHref = (vehicleLink as HTMLAnchorElement).getAttribute('href') || '';
        
        // Parse vehicle info from URL: vehicle_XXXXX-Brand-Model-Year.html
        // Example: vehicle_1397260-Ferrari-121-LM-0484LM-1954.html
        const vehicleMatch = vehicleHref.match(/vehicle_\d+-([^.]+)\.html/);
        if (!vehicleMatch) return;
        
        const vehicleParts = vehicleMatch[1].split('-');
        // First part is brand, last part might be year
        const lastPart = vehicleParts[vehicleParts.length - 1];
        const yearMatch = lastPart.match(/^(19|20)\d{2}$/);
        const vehicleYear = yearMatch ? parseInt(lastPart) : null;
        
        // Model is everything between brand and year
        const modelParts = vehicleYear 
          ? vehicleParts.slice(1, -1) 
          : vehicleParts.slice(1);
        const model = modelParts.join(' ') || 'Unknown';
        
        // Find movie link - traverse up to find container, then find movie link
        let movieHref = '';
        let movieTitle = '';
        let movieYear: number | null = null;
        
        // Go up the DOM tree looking for a movie link
        let current: Element | null = vehicleLink;
        for (let i = 0; i < 10 && current; i++) {
          current = current.parentElement;
          if (!current) break;
          
          const movieLink = current.querySelector('a[href*="movie_"], a[href*="movie.php"]') as HTMLAnchorElement | null;
          if (movieLink) {
            movieHref = movieLink.getAttribute('href') || '';
            movieTitle = movieLink.textContent?.trim() || '';
            
            // Try to extract year from nearby text
            const containerText = current.textContent || '';
            const movieYearMatch = containerText.match(/\((\d{4})\)/);
            if (movieYearMatch) {
              movieYear = parseInt(movieYearMatch[1]);
            }
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
      appearances.push({
        ...d,
        scraped_at: new Date().toISOString(),
      });
    }
    
  } catch (err) {
    // Ignore
  }
  
  return appearances;
}

async function scrapeBrand(page: Page, brand: { name: string; urlName: string }): Promise<MovieAppearance[]> {
  const allAppearances: MovieAppearance[] = [];
  
  // Get first page
  const page1 = await scrapeBrandPage(page, brand, 1);
  allAppearances.push(...page1);
  
  // If we got results, try more pages
  if (page1.length >= 50) {
    for (let p = 2; p <= 5; p++) {
      const pageN = await scrapeBrandPage(page, brand, p);
      if (pageN.length === 0) break;
      allAppearances.push(...pageN);
      await delay(500);
    }
  }
  
  // Dedupe by vehicle_url
  const seen = new Set<string>();
  return allAppearances.filter(a => {
    if (seen.has(a.vehicle_url)) return false;
    seen.add(a.vehicle_url);
    return true;
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - IMCDb Scraper v5 (Working!)                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/imcdb');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'appearances-new-brands.json');
  const allAppearances: MovieAppearance[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allAppearances.push(...existing);
    console.log(`Loaded ${existing.length} existing appearances\n`);
  }

  const processedBrands = new Set(allAppearances.map(a => a.brand));

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
      
      const appearances = await scrapeBrand(page, brand);
      allAppearances.push(...appearances);
      
      console.log(` → ${appearances.length} appearances ✅`);
      
      // Save progress
      if ((i + 1) % 5 === 0) {
        fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));
      }
      
      await delay(1500);
    }

    await page.close();
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`Total appearances: ${allAppearances.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
