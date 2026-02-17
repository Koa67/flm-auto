/**
 * MEGA SCRAPER v2 - Vehicle Dimensions
 * 
 * Sources:
 * A) Edmunds.com - Interior dimensions (headroom, legroom, shoulder room)
 * B) auto-data.net - Exterior + specs  
 * C) automobiledimension.com - Backup exterior
 * 
 * Run: npx tsx scripts/scrapers/mega-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// MVP Brands for FLM Auto
const MVP_BRANDS = {
  audi: { edmunds: 'audi', autodata: 'audi' },
  bmw: { edmunds: 'bmw', autodata: 'bmw' },
  mercedes: { edmunds: 'mercedes-benz', autodata: 'mercedes-benz' },
  volkswagen: { edmunds: 'volkswagen', autodata: 'volkswagen' },
  skoda: { edmunds: 'skoda', autodata: 'skoda' },
  porsche: { edmunds: 'porsche', autodata: 'porsche' },
  renault: { edmunds: 'renault', autodata: 'renault' }
};

// Priority family vehicles for MVP
const PRIORITY_MODELS = [
  // Audi
  { brand: 'audi', model: 'q3', years: ['2024', '2023'] },
  { brand: 'audi', model: 'q5', years: ['2024', '2023'] },
  { brand: 'audi', model: 'q7', years: ['2024', '2023'] },
  { brand: 'audi', model: 'a3', years: ['2024', '2023'] },
  { brand: 'audi', model: 'a4', years: ['2024', '2023'] },
  { brand: 'audi', model: 'a6', years: ['2024', '2023'] },
  // BMW
  { brand: 'bmw', model: '3-series', years: ['2024', '2023'] },
  { brand: 'bmw', model: '5-series', years: ['2024', '2023'] },
  { brand: 'bmw', model: 'x1', years: ['2024', '2023'] },
  { brand: 'bmw', model: 'x3', years: ['2024', '2023'] },
  { brand: 'bmw', model: 'x5', years: ['2024', '2023'] },
  // Mercedes
  { brand: 'mercedes', model: 'c-class', years: ['2024', '2023'] },
  { brand: 'mercedes', model: 'e-class', years: ['2024', '2023'] },
  { brand: 'mercedes', model: 'glc', years: ['2024', '2023'] },
  { brand: 'mercedes', model: 'gle', years: ['2024', '2023'] },
  // VW
  { brand: 'volkswagen', model: 'tiguan', years: ['2024', '2023'] },
  { brand: 'volkswagen', model: 'passat', years: ['2024', '2023'] },
  { brand: 'volkswagen', model: 'golf', years: ['2024', '2023'] },
  { brand: 'volkswagen', model: 'id-4', years: ['2024', '2023'] },
  // Skoda
  { brand: 'skoda', model: 'octavia', years: ['2024', '2023'] },
  { brand: 'skoda', model: 'kodiaq', years: ['2024', '2023'] },
  { brand: 'skoda', model: 'superb', years: ['2024', '2023'] },
  // Porsche
  { brand: 'porsche', model: 'cayenne', years: ['2024', '2023'] },
  { brand: 'porsche', model: 'macan', years: ['2024', '2023'] },
  // Renault  
  { brand: 'renault', model: 'scenic', years: ['2024', '2023'] },
  { brand: 'renault', model: 'austral', years: ['2024', '2023'] },
  { brand: 'renault', model: 'espace', years: ['2024', '2023'] },
];

interface VehicleDimensions {
  brand: string;
  model: string;
  year: string;
  variant?: string;
  sources: {
    edmunds?: string;
    autodata?: string;
  };
  interior: {
    frontHeadroomMm?: number;
    rearHeadroomMm?: number;
    frontLegroomMm?: number;
    rearLegroomMm?: number;
    frontShoulderRoomMm?: number;
    rearShoulderRoomMm?: number;
  };
  exterior: {
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    wheelbaseMm?: number;
  };
  cargo: {
    volumeL?: number;
    volumeMaxL?: number;
  };
  scraped_at: string;
}

// Convert inches to mm
const inToMm = (inches: number): number => Math.round(inches * 25.4);

// Convert cu.ft to liters
const cuftToL = (cuft: number): number => Math.round(cuft * 28.3168);

/**
 * Parse Edmunds specs page HTML
 */
function parseEdmundsSpecs(html: string, brand: string, model: string, year: string): Partial<VehicleDimensions> {
  const dims: Partial<VehicleDimensions> = {
    brand,
    model,
    year,
    sources: {},
    interior: {},
    exterior: {},
    cargo: {},
    scraped_at: new Date().toISOString()
  };

  // Front dimensions
  const frontHeadMatch = html.match(/Front head room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (frontHeadMatch) dims.interior!.frontHeadroomMm = inToMm(parseFloat(frontHeadMatch[1]));

  const frontLegMatch = html.match(/Front leg room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (frontLegMatch) dims.interior!.frontLegroomMm = inToMm(parseFloat(frontLegMatch[1]));

  const frontShoulderMatch = html.match(/Front shoulder room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (frontShoulderMatch) dims.interior!.frontShoulderRoomMm = inToMm(parseFloat(frontShoulderMatch[1]));

  // Rear dimensions
  const rearHeadMatch = html.match(/Rear head room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (rearHeadMatch) dims.interior!.rearHeadroomMm = inToMm(parseFloat(rearHeadMatch[1]));

  const rearLegMatch = html.match(/Rear leg room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (rearLegMatch) dims.interior!.rearLegroomMm = inToMm(parseFloat(rearLegMatch[1]));

  const rearShoulderMatch = html.match(/Rear shoulder room[^<]*<\/td>\s*<td[^>]*>([0-9.]+)\s*in/i);
  if (rearShoulderMatch) dims.interior!.rearShoulderRoomMm = inToMm(parseFloat(rearShoulderMatch[1]));

  // Exterior
  const lengthMatch = html.match(/\|\s*Length\s*\|\s*([0-9.]+)\s*in/i) || 
                      html.match(/Length[^|]*\|[^|]*([0-9.]+)\s*in/i);
  if (lengthMatch) dims.exterior!.lengthMm = inToMm(parseFloat(lengthMatch[1]));

  const widthMatch = html.match(/Overall width without mirrors[^|]*\|[^|]*([0-9.]+)\s*in/i);
  if (widthMatch) dims.exterior!.widthMm = inToMm(parseFloat(widthMatch[1]));

  const heightMatch = html.match(/\|\s*Height\s*\|\s*([0-9.]+)\s*in/i);
  if (heightMatch) dims.exterior!.heightMm = inToMm(parseFloat(heightMatch[1]));

  const wheelbaseMatch = html.match(/Wheelbase[^|]*\|[^|]*([0-9.]+)\s*in/i);
  if (wheelbaseMatch) dims.exterior!.wheelbaseMm = inToMm(parseFloat(wheelbaseMatch[1]));

  // Cargo
  const cargoMatch = html.match(/Cargo capacity[^|]*\|[^|]*([0-9.]+)\s*cu\.ft/i);
  if (cargoMatch) dims.cargo!.volumeL = cuftToL(parseFloat(cargoMatch[1]));

  return dims;
}

/**
 * Parse auto-data.net specs
 */
function parseAutoDataSpecs(html: string): Partial<VehicleDimensions> {
  const dims: Partial<VehicleDimensions> = {
    interior: {},
    exterior: {},
    cargo: {}
  };

  // Exterior (in mm from auto-data)
  const lengthMatch = html.match(/Length[:\s]*(\d{4})\s*mm/i);
  if (lengthMatch) dims.exterior!.lengthMm = parseInt(lengthMatch[1]);

  const widthMatch = html.match(/Width[:\s]*(\d{4})\s*mm/i);
  if (widthMatch) dims.exterior!.widthMm = parseInt(widthMatch[1]);

  const heightMatch = html.match(/Height[:\s]*(\d{4})\s*mm/i);
  if (heightMatch) dims.exterior!.heightMm = parseInt(heightMatch[1]);

  const wheelbaseMatch = html.match(/Wheelbase[:\s]*(\d{4})\s*mm/i);
  if (wheelbaseMatch) dims.exterior!.wheelbaseMm = parseInt(wheelbaseMatch[1]);

  // Cargo (in liters)
  const cargoMatch = html.match(/(?:Trunk|Boot|Cargo)[^:]*:\s*(\d+)\s*(?:L|l|liters)/i);
  if (cargoMatch) dims.cargo!.volumeL = parseInt(cargoMatch[1]);

  return dims;
}

/**
 * Merge dimensions from multiple sources
 */
function mergeDimensions(edmunds: Partial<VehicleDimensions>, autodata: Partial<VehicleDimensions>): VehicleDimensions {
  return {
    brand: edmunds.brand || autodata.brand || '',
    model: edmunds.model || autodata.model || '',
    year: edmunds.year || autodata.year || '',
    variant: edmunds.variant || autodata.variant,
    sources: {
      ...edmunds.sources,
      ...autodata.sources
    },
    interior: {
      ...autodata.interior,
      ...edmunds.interior  // Edmunds interior takes priority
    },
    exterior: {
      ...edmunds.exterior,
      ...autodata.exterior  // Auto-data exterior takes priority (metric)
    },
    cargo: {
      ...edmunds.cargo,
      ...autodata.cargo
    },
    scraped_at: new Date().toISOString()
  };
}

/**
 * Generate Edmunds URL for a vehicle
 */
function getEdmundsUrl(brand: string, model: string, year: string): string {
  const brandSlug = MVP_BRANDS[brand as keyof typeof MVP_BRANDS]?.edmunds || brand;
  return `https://www.edmunds.com/${brandSlug}/${model}/${year}/features-specs/`;
}

/**
 * Main export: URL list for scraping
 */
export function generateScrapeUrls(): Array<{brand: string; model: string; year: string; edmundsUrl: string}> {
  const urls: Array<{brand: string; model: string; year: string; edmundsUrl: string}> = [];
  
  for (const vehicle of PRIORITY_MODELS) {
    for (const year of vehicle.years) {
      urls.push({
        brand: vehicle.brand,
        model: vehicle.model,
        year,
        edmundsUrl: getEdmundsUrl(vehicle.brand, vehicle.model, year)
      });
    }
  }
  
  return urls;
}

// Export for use
export {
  parseEdmundsSpecs,
  parseAutoDataSpecs,
  mergeDimensions,
  VehicleDimensions,
  MVP_BRANDS,
  PRIORITY_MODELS
};

// Generate URL list for manual or automated scraping
if (require.main === module) {
  const urls = generateScrapeUrls();
  console.log('=== MEGA SCRAPER URL LIST ===\n');
  console.log(`Total URLs to scrape: ${urls.length}\n`);
  
  urls.forEach((u, i) => {
    console.log(`${i + 1}. ${u.brand} ${u.model} ${u.year}`);
    console.log(`   ${u.edmundsUrl}\n`);
  });
  
  // Save URL list
  const outputDir = path.join(__dirname, '../../data/raw');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'scrape-urls.json'),
    JSON.stringify(urls, null, 2)
  );
  
  console.log(`\nURL list saved to data/raw/scrape-urls.json`);
}
