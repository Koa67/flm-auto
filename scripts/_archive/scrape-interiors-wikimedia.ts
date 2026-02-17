/**
 * FLM AUTO — Wikimedia Interiors Scraper
 * Catégories : intérieurs auto, tableaux de bord, habitacles
 * 
 * Usage: npx ts-node scrape-interiors-wikimedia.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface WikiImage {
  title: string;
  url: string;
  width: number;
  height: number;
  descriptionurl: string;
}

// Catégories Wikimedia pour intérieurs
const INTERIOR_CATEGORIES = [
  'Category:Automobile_interiors',
  'Category:Car_dashboards',
  'Category:Car_interiors',
  'Category:Automobile_instrument_panels',
  'Category:Car_steering_wheels',
  'Category:Automobile_seats',
  'Category:Car_gear_shifts',
];

// Sous-catégories par marque
const BRAND_INTERIOR_CATEGORIES: Record<string, string[]> = {
  'BMW': ['Category:BMW_interiors', 'Category:Interior_of_BMW_vehicles'],
  'Mercedes-Benz': ['Category:Mercedes-Benz_interiors', 'Category:Interior_of_Mercedes-Benz_vehicles'],
  'Audi': ['Category:Audi_interiors', 'Category:Interior_of_Audi_vehicles'],
  'Volkswagen': ['Category:Volkswagen_interiors'],
  'Porsche': ['Category:Porsche_interiors'],
  'Tesla': ['Category:Tesla_interiors', 'Category:Interior_of_Tesla_vehicles'],
  'Toyota': ['Category:Toyota_interiors'],
  'Renault': ['Category:Renault_interiors'],
  'Peugeot': ['Category:Peugeot_interiors'],
};

async function fetchCategoryImages(category: string): Promise<WikiImage[]> {
  const images: WikiImage[] = [];
  let continueParam = '';
  
  do {
    const url = `https://commons.wikimedia.org/w/api.php?` +
      `action=query&generator=categorymembers&gcmtype=file&gcmtitle=${encodeURIComponent(category)}` +
      `&gcmlimit=50&prop=imageinfo&iiprop=url|size&format=json${continueParam}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.query?.pages) {
        for (const page of Object.values(data.query.pages) as any[]) {
          if (page.imageinfo?.[0]) {
            const info = page.imageinfo[0];
            // Filtrer : JPG/PNG, taille raisonnable, pas de logo/icône
            if (info.width >= 800 && info.height >= 600 && 
                (info.url.endsWith('.jpg') || info.url.endsWith('.jpeg') || info.url.endsWith('.png'))) {
              images.push({
                title: page.title,
                url: info.url,
                width: info.width,
                height: info.height,
                descriptionurl: info.descriptionurl,
              });
            }
          }
        }
      }
      
      continueParam = data.continue?.gcmcontinue 
        ? `&gcmcontinue=${data.continue.gcmcontinue}` 
        : '';
        
    } catch (e) {
      console.log(`   ⚠️ Error fetching ${category}`);
      break;
    }
    
    await delay(200);
  } while (continueParam && images.length < 200); // Max 200 par catégorie
  
  return images;
}

function extractVehicleFromTitle(title: string): { make?: string; model?: string; year?: number } {
  // Pattern: "2024 BMW M3 interior.jpg" ou "Interior BMW Serie 3 G20.jpg"
  const result: { make?: string; model?: string; year?: number } = {};
  
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) result.year = parseInt(yearMatch[0]);
  
  const makes = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Porsche', 'Tesla', 
                 'Toyota', 'Honda', 'Nissan', 'Renault', 'Peugeot', 'Citroen', 'Fiat',
                 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Mazda', 'Volvo', 'Skoda', 'Seat'];
  
  for (const make of makes) {
    if (title.toLowerCase().includes(make.toLowerCase())) {
      result.make = make === 'VW' ? 'Volkswagen' : make;
      break;
    }
  }
  
  return result;
}

async function matchGeneration(make: string | undefined, title: string): Promise<string | null> {
  if (!make) return null;
  
  // Chercher le modèle dans le titre
  const { data: models } = await supabase
    .from('models')
    .select('id, name, brand:brands(name)')
    .ilike('brand.name', `%${make}%`)
    .limit(100);
  
  if (!models) return null;
  
  for (const model of models) {
    if (title.toLowerCase().includes(model.name.toLowerCase())) {
      // Trouver la génération la plus récente
      const { data: gen } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', model.id)
        .order('production_start', { ascending: false })
        .limit(1)
        .single();
      
      return gen?.id || null;
    }
  }
  
  return null;
}

async function main() {
  console.log('🚗 FLM AUTO — Wikimedia Interiors Scraper\n');
  
  let totalFound = 0;
  let totalSaved = 0;
  let totalMatched = 0;

  // 1. Catégories générales
  console.log('📂 Catégories générales...\n');
  for (const category of INTERIOR_CATEGORIES) {
    const catName = category.replace('Category:', '');
    process.stdout.write(`   ${catName}...`);
    
    const images = await fetchCategoryImages(category);
    totalFound += images.length;
    process.stdout.write(` ${images.length} images\n`);
    
    for (const img of images) {
      const vehicle = extractVehicleFromTitle(img.title);
      const generationId = await matchGeneration(vehicle.make, img.title);
      
      const { error } = await supabase.from('vehicle_images').insert({
        generation_id: generationId,
        url: img.url,
        source: 'Wikimedia Commons',
        source_url: img.descriptionurl,
        image_type: 'interior',
        width: img.width,
        height: img.height,
        alt_text: img.title.replace('File:', '').replace(/\.(jpg|jpeg|png)$/i, ''),
      });
      
      if (!error) {
        totalSaved++;
        if (generationId) totalMatched++;
      }
    }
    
    await delay(500);
  }

  // 2. Catégories par marque
  console.log('\n📂 Catégories par marque...\n');
  for (const [brand, categories] of Object.entries(BRAND_INTERIOR_CATEGORIES)) {
    console.log(`\n🏷️  ${brand}`);
    
    for (const category of categories) {
      const images = await fetchCategoryImages(category);
      totalFound += images.length;
      
      if (images.length > 0) {
        console.log(`   ${category.replace('Category:', '')}: ${images.length} images`);
        
        for (const img of images) {
          const vehicle = extractVehicleFromTitle(img.title);
          vehicle.make = brand; // On sait la marque
          const generationId = await matchGeneration(brand, img.title);
          
          const { error } = await supabase.from('vehicle_images').insert({
            generation_id: generationId,
            url: img.url,
            source: 'Wikimedia Commons',
            source_url: img.descriptionurl,
            image_type: 'interior',
            width: img.width,
            height: img.height,
            alt_text: img.title.replace('File:', '').replace(/\.(jpg|jpeg|png)$/i, ''),
          });
          
          if (!error) {
            totalSaved++;
            if (generationId) totalMatched++;
          }
        }
      }
    }
    
    await delay(300);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Interiors: ${totalFound} found, ${totalSaved} saved, ${totalMatched} matched`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
