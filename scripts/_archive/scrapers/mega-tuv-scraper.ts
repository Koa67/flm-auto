/**
 * FLM AUTO - MEGA TÜV Scraper
 * Scrape TOUTES les années et catégories d'âge
 * + détails des défauts par véhicule
 * 
 * Run: npx ts-node scrapers/mega-tuv-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/tuv';
const BASE_URL = 'https://car-recalls.eu/reliability';
const DELAY_MS = 400;

const REPORTS = [
  { year: '2024', url_year: '2024' },
  { year: '2025', url_year: '2025' },
];

const AGE_CATEGORIES = [
  { slug: '2-3-years', label: '2-3 years', production: '2021-2022' },
  { slug: '4-5-years', label: '4-5 years', production: '2019-2020' },
  { slug: '6-7-years', label: '6-7 years', production: '2017-2018' },
  { slug: '8-9-years', label: '8-9 years', production: '2015-2016' },
  { slug: '10-11-years', label: '10-11 years', production: '2013-2014' },
];

interface TuvEntry {
  report_year: string;
  age_category: string;
  production_years: string;
  rank: number;
  brand: string;
  model: string;
  defect_rate_percent: number;
  avg_mileage_tkm: number;
  // Detailed defects
  defects: {
    category: string;
    description: string;
    rate_percent: number | null;
  }[];
  // Comparison
  better_than_average: boolean;
  category_average: number | null;
  // Source
  source_url: string;
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
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(1000 * (i + 1));
    }
  }
  throw new Error('Fetch failed');
}

function parseTablePage(html: string, reportYear: string, ageCategory: string, productionYears: string, sourceUrl: string): TuvEntry[] {
  const results: TuvEntry[] = [];
  
  // Find all table rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let currentRank = 0;
  let trMatch;
  
  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];
    
    // Skip header rows
    if (row.includes('<th')) continue;
    
    // Extract cells
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      cells.push(tdMatch[1].trim());
    }
    
    if (cells.length < 3) continue;
    
    // Determine row structure
    let modelCell: string;
    let defectCell: string;
    let mileageCell: string;
    
    const firstCellNum = parseInt(cells[0].replace(/<[^>]+>/g, '').trim());
    
    if (!isNaN(firstCellNum) && firstCellNum > 0 && firstCellNum < 500) {
      currentRank = firstCellNum;
      modelCell = cells[1];
      defectCell = cells[2];
      mileageCell = cells[3] || '';
    } else {
      modelCell = cells[0];
      defectCell = cells[1];
      mileageCell = cells[2] || '';
    }
    
    // Extract model name from link
    const modelMatch = modelCell.match(/<a[^>]*>([^<]+)<\/a>/);
    if (!modelMatch) continue;
    
    const fullModel = modelMatch[1].trim();
    
    // Parse brand and model
    const brandPatterns = [
      'Mercedes-Benz', 'Alfa Romeo', 'Aston Martin', 'Land Rover', 'Rolls-Royce',
      'BMW', 'Audi', 'VW', 'Volkswagen', 'Porsche', 'Skoda', 'Škoda',
      'Toyota', 'Honda', 'Mazda', 'Hyundai', 'Kia', 'Nissan', 'Lexus',
      'Ford', 'Opel', 'Peugeot', 'Renault', 'Citroën', 'Citroen', 'Fiat',
      'Volvo', 'Seat', 'SEAT', 'Dacia', 'Mini', 'MINI', 'Smart',
      'Tesla', 'Jaguar', 'Jeep', 'Suzuki', 'Mitsubishi', 'Subaru',
      'Chevrolet', 'Dodge', 'Chrysler', 'Cadillac', 'Genesis', 'Infiniti',
      'Cupra', 'DS', 'Polestar', 'MG', 'BYD', 'NIO', 'Xpeng',
    ];
    
    let brand = '';
    let model = '';
    
    for (const b of brandPatterns) {
      if (fullModel.startsWith(b + ' ') || fullModel === b) {
        brand = b;
        model = fullModel.substring(b.length).trim();
        break;
      }
    }
    
    if (!brand) {
      const parts = fullModel.split(' ');
      brand = parts[0];
      model = parts.slice(1).join(' ');
    }
    
    // Normalize brands
    if (brand === 'VW') brand = 'Volkswagen';
    if (brand === 'Škoda') brand = 'Skoda';
    if (brand === 'MINI') brand = 'Mini';
    if (brand === 'SEAT') brand = 'Seat';
    
    // Parse defect rate
    const defectRate = parseFloat(defectCell.replace(',', '.').replace(/<[^>]+>/g, '').trim());
    if (isNaN(defectRate)) continue;
    
    // Parse mileage
    const mileage = parseInt(mileageCell.replace(/<[^>]+>/g, '').trim()) || 0;
    
    // Check if better than average (green background)
    const betterThanAverage = row.includes('background-color: green') || 
                              row.includes('background:#') ||
                              row.includes('style="color:green"');
    
    results.push({
      report_year: reportYear,
      age_category: ageCategory,
      production_years: productionYears,
      rank: currentRank,
      brand,
      model: model || fullModel,
      defect_rate_percent: defectRate,
      avg_mileage_tkm: mileage,
      defects: [],
      better_than_average: betterThanAverage,
      category_average: null,
      source_url: sourceUrl,
      scraped_at: new Date().toISOString(),
    });
  }
  
  // Try to extract category average
  const avgMatch = html.match(/average[^:]*:\s*([\d.,]+)\s*%/i);
  if (avgMatch) {
    const avg = parseFloat(avgMatch[1].replace(',', '.'));
    results.forEach(r => r.category_average = avg);
  }
  
  return results;
}

async function scrapeDefectDetails(modelUrl: string): Promise<{ category: string; description: string; rate_percent: number | null }[]> {
  try {
    const html = await fetchWithRetry(modelUrl);
    const defects: { category: string; description: string; rate_percent: number | null }[] = [];
    
    // Look for defect categories: lighting, brakes, axles, steering, etc.
    const defectCategories = [
      'lighting', 'brakes', 'brake', 'axle', 'steering', 'chassis', 
      'suspension', 'exhaust', 'engine', 'oil', 'transmission', 
      'electrical', 'body', 'corrosion', 'rust', 'emission'
    ];
    
    for (const category of defectCategories) {
      const regex = new RegExp(`${category}[^:]*:\\s*([\\d.,]+)\\s*%`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        defects.push({
          category,
          description: match[0],
          rate_percent: parseFloat(match[1].replace(',', '.')),
        });
      }
    }
    
    return defects;
  } catch {
    return [];
  }
}

async function main() {
  console.log('🚀 FLM AUTO - MEGA TÜV Scraper');
  console.log('⏱️  Estimated time: 10-20 minutes\n');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const allResults: TuvEntry[] = [];
  const startTime = Date.now();
  
  for (const report of REPORTS) {
    console.log(`\n📊 TÜV Report ${report.year}`);
    
    for (const category of AGE_CATEGORIES) {
      const url = `${BASE_URL}/reliability-tuv-report-${report.url_year}-${category.slug}/`;
      console.log(`   📁 ${category.label}...`);
      
      try {
        const html = await fetchWithRetry(url);
        const entries = parseTablePage(html, report.year, category.label, category.production, url);
        
        console.log(`      Found ${entries.length} vehicles`);
        
        // Optionally fetch defect details for each (slower but more data)
        // Uncomment to enable deep scraping of defect details
        /*
        for (const entry of entries) {
          await delay(200);
          const modelUrl = `https://car-recalls.eu/model/${entry.model.toLowerCase().replace(/\s+/g, '-')}/`;
          entry.defects = await scrapeDefectDetails(modelUrl);
        }
        */
        
        allResults.push(...entries);
        
      } catch (e) {
        console.log(`      ⚠️ Failed to fetch`);
      }
      
      await delay(DELAY_MS);
    }
    
    // Save per-year
    const yearResults = allResults.filter(r => r.report_year === report.year);
    const yearFile = path.join(OUTPUT_DIR, `tuv_${report.year}_full.json`);
    fs.writeFileSync(yearFile, JSON.stringify(yearResults, null, 2));
    console.log(`   💾 Saved ${yearResults.length} entries for ${report.year}`);
  }
  
  // Save combined
  const allFile = path.join(OUTPUT_DIR, 'mega_tuv_all.json');
  fs.writeFileSync(allFile, JSON.stringify(allResults, null, 2));
  
  // Summary
  console.log('\n\n📊 SCRAPING COMPLETE!');
  console.log(`   Total entries: ${allResults.length}`);
  
  // By brand
  const byBrand = new Map<string, number>();
  for (const r of allResults) {
    byBrand.set(r.brand, (byBrand.get(r.brand) || 0) + 1);
  }
  
  console.log('\n📊 Top brands by entries:');
  const sorted = [...byBrand.entries()].sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 15).forEach(([brand, count]) => {
    console.log(`   ${brand}: ${count}`);
  });
  
  // Best/worst by defect rate (2-3 years)
  const young = allResults.filter(r => r.age_category === '2-3 years' && r.report_year === '2025');
  const sortedByDefect = young.sort((a, b) => a.defect_rate_percent - b.defect_rate_percent);
  
  console.log('\n🏆 Best reliability (2-3 years, 2025):');
  sortedByDefect.slice(0, 10).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.brand} ${r.model}: ${r.defect_rate_percent}%`);
  });
  
  console.log('\n⚠️ Worst reliability (2-3 years, 2025):');
  sortedByDefect.slice(-10).reverse().forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.brand} ${r.model}: ${r.defect_rate_percent}%`);
  });
  
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n⏱️  Total time: ${elapsed.toFixed(1)} minutes`);
}

main().catch(console.error);
