/**
 * FLM AUTO - TÜV Report Scraper v2 (Fiabilité complète)
 * Source: car-recalls.eu/reliability
 * 
 * Run: npx ts-node scrapers/02_tuv_reliability.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://car-recalls.eu/reliability';
const OUTPUT_DIR = '../data/raw/tuv';

const AGE_CATEGORIES = [
  { slug: '2-3-years', label: '2-3 ans', production_years: '2021-2022' },
  { slug: '4-5-years', label: '4-5 ans', production_years: '2019-2020' },
  { slug: '6-7-years', label: '6-7 ans', production_years: '2017-2018' },
  { slug: '8-9-years', label: '8-9 ans', production_years: '2015-2016' },
  { slug: '10-11-years', label: '10-11 ans', production_years: '2013-2014' },
];

const REPORTS = ['2025', '2026'];

interface TuvResult {
  report_year: string;
  age_category: string;
  production_years: string;
  rank: number;
  brand: string;
  model: string;
  defect_rate_percent: number;
  avg_mileage_tkm: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  return await response.text();
}

function parseTable(html: string, reportYear: string, ageCategory: string, productionYears: string): TuvResult[] {
  const results: TuvResult[] = [];
  
  // Pattern: <tr> avec <td>rank</td><td><a>Model</a></td><td>defect%</td><td>mileage</td>
  // Le rank peut avoir rowspan, donc on le track séparément
  
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let currentRank = 0;
  let trMatch;
  
  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];
    
    // Skip header rows
    if (row.includes('<th')) continue;
    
    // Extraire les cellules
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      cells.push(tdMatch[1].trim());
    }
    
    if (cells.length < 3) continue;
    
    // Déterminer si c'est une nouvelle row avec rank ou continuation (rowspan)
    let modelCell: string;
    let defectCell: string;
    let mileageCell: string;
    
    // Check si le premier cell est un nombre (rank)
    const firstCellNum = parseInt(cells[0].replace(/<[^>]+>/g, '').trim());
    
    if (!isNaN(firstCellNum) && firstCellNum > 0 && firstCellNum < 500) {
      // Nouvelle row avec rank
      currentRank = firstCellNum;
      modelCell = cells[1];
      defectCell = cells[2];
      mileageCell = cells[3] || '';
    } else {
      // Row continuation (rowspan) - pas de rank
      modelCell = cells[0];
      defectCell = cells[1];
      mileageCell = cells[2] || '';
    }
    
    // Extraire le nom du modèle depuis le lien <a>
    const modelMatch = modelCell.match(/<a[^>]*>([^<]+)<\/a>/);
    if (!modelMatch) continue;
    
    const fullModel = modelMatch[1].trim();
    
    // Séparer brand et model
    let brand = '';
    let model = '';
    
    // Patterns connus
    const brandPatterns = [
      'Mercedes-Benz', 'Alfa Romeo', 'Aston Martin', 'Land Rover', 'Rolls-Royce',
      'BMW', 'Audi', 'VW', 'Volkswagen', 'Porsche', 'Skoda', 'Škoda',
      'Toyota', 'Honda', 'Mazda', 'Hyundai', 'Kia', 'Nissan', 'Lexus',
      'Ford', 'Opel', 'Peugeot', 'Renault', 'Citroën', 'Citroen', 'Fiat',
      'Volvo', 'Seat', 'SEAT', 'Dacia', 'Mini', 'MINI', 'Smart',
      'Tesla', 'Jaguar', 'Jeep', 'Suzuki', 'Mitsubishi', 'Subaru'
    ];
    
    for (const b of brandPatterns) {
      if (fullModel.startsWith(b + ' ') || fullModel === b) {
        brand = b;
        model = fullModel.substring(b.length).trim();
        break;
      }
    }
    
    // Fallback: premier mot = brand
    if (!brand) {
      const parts = fullModel.split(' ');
      brand = parts[0];
      model = parts.slice(1).join(' ');
    }
    
    // Normaliser
    if (brand === 'VW') brand = 'Volkswagen';
    if (brand === 'Škoda') brand = 'Skoda';
    if (brand === 'MINI') brand = 'Mini';
    if (brand === 'SEAT') brand = 'Seat';
    
    // Parser defect rate (format: "2,6" ou "2.6")
    const defectRate = parseFloat(defectCell.replace(',', '.').replace(/<[^>]+>/g, '').trim());
    if (isNaN(defectRate)) continue;
    
    // Parser mileage (format: "33" = 33k km)
    const mileage = parseInt(mileageCell.replace(/<[^>]+>/g, '').trim()) || 0;
    
    results.push({
      report_year: reportYear,
      age_category: ageCategory,
      production_years: productionYears,
      rank: currentRank,
      brand,
      model: model || fullModel,
      defect_rate_percent: defectRate,
      avg_mileage_tkm: mileage,
    });
  }
  
  return results;
}

async function scrapeReport(reportYear: string): Promise<TuvResult[]> {
  console.log(`\n📊 Scraping TÜV Report ${reportYear}...`);
  const results: TuvResult[] = [];
  
  for (const category of AGE_CATEGORIES) {
    const url = `${BASE_URL}/reliability-tuv-report-${reportYear}-${category.slug}/`;
    console.log(`  📁 ${category.label}...`);
    
    try {
      const html = await fetchPage(url);
      const categoryResults = parseTable(html, reportYear, category.label, category.production_years);
      results.push(...categoryResults);
      console.log(`     ✓ Found ${categoryResults.length} vehicles`);
    } catch (e) {
      console.log(`     ⚠️ Page not available`);
    }
    
    await delay(500);
  }
  
  return results;
}

async function main() {
  console.log('🚀 FLM AUTO - TÜV Report Scraper v2');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const allResults: TuvResult[] = [];
  
  for (const year of REPORTS) {
    const yearResults = await scrapeReport(year);
    allResults.push(...yearResults);
    
    // Save per-year file
    const yearFile = path.join(OUTPUT_DIR, `tuv_${year}.json`);
    fs.writeFileSync(yearFile, JSON.stringify(yearResults, null, 2));
    console.log(`  💾 Saved ${yearResults.length} entries to tuv_${year}.json`);
  }
  
  // Save combined
  const combinedFile = path.join(OUTPUT_DIR, 'tuv_all_years.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allResults, null, 2));
  
  // Create summary by brand
  const brandSummary: Record<string, { count: number; avg_defect: number; models: string[] }> = {};
  for (const result of allResults) {
    if (!brandSummary[result.brand]) {
      brandSummary[result.brand] = { count: 0, avg_defect: 0, models: [] };
    }
    brandSummary[result.brand].count++;
    brandSummary[result.brand].avg_defect += result.defect_rate_percent;
    if (!brandSummary[result.brand].models.includes(result.model)) {
      brandSummary[result.brand].models.push(result.model);
    }
  }
  
  // Calculate averages
  for (const brand of Object.keys(brandSummary)) {
    brandSummary[brand].avg_defect = 
      Math.round((brandSummary[brand].avg_defect / brandSummary[brand].count) * 100) / 100;
  }
  
  const summaryFile = path.join(OUTPUT_DIR, 'brand_summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(brandSummary, null, 2));
  
  // MVP brands stats
  const mvpBrands = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda'];
  console.log('\n📊 MVP Brands Summary:');
  for (const brand of mvpBrands) {
    const data = brandSummary[brand];
    if (data) {
      console.log(`  ${brand}: ${data.count} entries, avg ${data.avg_defect}% defects, ${data.models.length} models`);
    }
  }
  
  console.log(`\n✅ Total: ${allResults.length} TÜV entries across ${Object.keys(brandSummary).length} brands`);
}

main().catch(console.error);
