/**
 * FLM AUTO — The-Blueprints.com Scraper
 * Blueprints techniques, vues de dessus/côté/face
 * 
 * ⚠️ Site protégé - respecter robots.txt et rate limits
 * 
 * Usage: npx ts-node scrape-blueprints.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Alternative : Wikimedia blueprints (légal, CC license)
const BLUEPRINT_CATEGORIES = [
  'Category:Automobile_drawings',
  'Category:Technical_drawings_of_automobiles',
  'Category:Automobile_diagrams',
  'Category:Car_blueprints',
  'Category:Vehicle_orthographic_projections',
];

// Blueprints par marque sur Wikimedia
const BRAND_BLUEPRINT_CATEGORIES: Record<string, string[]> = {
  'BMW': ['Category:Drawings_of_BMW_vehicles', 'Category:Technical_drawings_of_BMW'],
  'Mercedes-Benz': ['Category:Drawings_of_Mercedes-Benz_vehicles'],
  'Audi': ['Category:Drawings_of_Audi_vehicles'],
  'Volkswagen': ['Category:Drawings_of_Volkswagen_vehicles'],
  'Porsche': ['Category:Drawings_of_Porsche_vehicles'],
  'Ferrari': ['Category:Drawings_of_Ferrari_vehicles'],
  'Lamborghini': ['Category:Drawings_of_Lamborghini_vehicles'],
};

interface Blueprint {
  title: string;
  url: string;
  width: number;
  height: number;
  source_url: string;
  view_type?: 'side' | 'top' | 'front' | 'rear' | 'perspective' | 'multi';
}

async function fetchWikimediaBlueprints(category: string): Promise<Blueprint[]> {
  const blueprints: Blueprint[] = [];
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
            const title = page.title.toLowerCase();
            
            // Filtrer : dessins techniques, blueprints, schémas
            const isBlueprint = title.includes('blueprint') || 
                               title.includes('drawing') || 
                               title.includes('diagram') ||
                               title.includes('orthographic') ||
                               title.includes('technical') ||
                               title.includes('schematic') ||
                               info.url.endsWith('.svg');
            
            if (isBlueprint && info.width >= 500) {
              // Détecter le type de vue
              let viewType: Blueprint['view_type'] = 'perspective';
              if (title.includes('side') || title.includes('profile')) viewType = 'side';
              else if (title.includes('top') || title.includes('plan')) viewType = 'top';
              else if (title.includes('front')) viewType = 'front';
              else if (title.includes('rear') || title.includes('back')) viewType = 'rear';
              else if (title.includes('orthographic') || title.includes('multi')) viewType = 'multi';
              
              blueprints.push({
                title: page.title,
                url: info.url,
                width: info.width,
                height: info.height,
                source_url: info.descriptionurl,
                view_type: viewType,
              });
            }
          }
        }
      }
      
      continueParam = data.continue?.gcmcontinue 
        ? `&gcmcontinue=${data.continue.gcmcontinue}` 
        : '';
        
    } catch (e) {
      break;
    }
    
    await delay(200);
  } while (continueParam && blueprints.length < 100);
  
  return blueprints;
}

function extractVehicleInfo(title: string): { make?: string; model?: string } {
  const result: { make?: string; model?: string } = {};
  
  const makes = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Porsche', 
                 'Ferrari', 'Lamborghini', 'McLaren', 'Bugatti', 'Pagani',
                 'Toyota', 'Honda', 'Nissan', 'Mazda', 'Subaru',
                 'Ford', 'Chevrolet', 'Dodge', 'Jeep',
                 'Renault', 'Peugeot', 'Citroen', 'Fiat', 'Alfa Romeo'];
  
  const titleLower = title.toLowerCase();
  for (const make of makes) {
    if (titleLower.includes(make.toLowerCase())) {
      result.make = make === 'VW' ? 'Volkswagen' : make;
      break;
    }
  }
  
  return result;
}

async function matchGeneration(make: string | undefined, title: string): Promise<string | null> {
  if (!make) return null;
  
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', `%${make}%`)
    .single();
  
  if (!brand) return null;
  
  const { data: models } = await supabase
    .from('models')
    .select('id, name')
    .eq('brand_id', brand.id);
  
  if (!models) return null;
  
  const titleLower = title.toLowerCase();
  for (const model of models) {
    if (titleLower.includes(model.name.toLowerCase())) {
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
  console.log('📐 FLM AUTO — Blueprints Scraper (Wikimedia)\n');
  
  let totalFound = 0;
  let totalSaved = 0;
  let totalMatched = 0;

  // 1. Catégories générales
  console.log('📂 Catégories générales...\n');
  for (const category of BLUEPRINT_CATEGORIES) {
    const catName = category.replace('Category:', '');
    process.stdout.write(`   ${catName}...`);
    
    const blueprints = await fetchWikimediaBlueprints(category);
    totalFound += blueprints.length;
    process.stdout.write(` ${blueprints.length} blueprints\n`);
    
    for (const bp of blueprints) {
      const vehicle = extractVehicleInfo(bp.title);
      const generationId = await matchGeneration(vehicle.make, bp.title);
      
      const { error } = await supabase.from('vehicle_images').insert({
        generation_id: generationId,
        url: bp.url,
        source: 'Wikimedia Commons',
        source_url: bp.source_url,
        image_type: 'blueprint',
        width: bp.width,
        height: bp.height,
        alt_text: bp.title.replace('File:', '').replace(/\.(svg|png|jpg)$/i, ''),
        metadata: { view_type: bp.view_type },
      });
      
      if (!error) {
        totalSaved++;
        if (generationId) totalMatched++;
      }
    }
    
    await delay(500);
  }

  // 2. Par marque
  console.log('\n📂 Par marque...\n');
  for (const [brand, categories] of Object.entries(BRAND_BLUEPRINT_CATEGORIES)) {
    console.log(`🏷️  ${brand}`);
    
    for (const category of categories) {
      const blueprints = await fetchWikimediaBlueprints(category);
      totalFound += blueprints.length;
      
      if (blueprints.length > 0) {
        console.log(`   ${blueprints.length} blueprints`);
        
        for (const bp of blueprints) {
          const generationId = await matchGeneration(brand, bp.title);
          
          const { error } = await supabase.from('vehicle_images').insert({
            generation_id: generationId,
            url: bp.url,
            source: 'Wikimedia Commons',
            source_url: bp.source_url,
            image_type: 'blueprint',
            width: bp.width,
            height: bp.height,
            alt_text: bp.title.replace('File:', '').replace(/\.(svg|png|jpg)$/i, ''),
            metadata: { view_type: bp.view_type },
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
  console.log(`  ✅ Blueprints: ${totalFound} found, ${totalSaved} saved, ${totalMatched} matched`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
