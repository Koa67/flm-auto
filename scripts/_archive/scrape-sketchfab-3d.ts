/**
 * FLM AUTO — Sketchfab 3D Models Scraper
 * Modèles 3D automobiles (viewer embedable)
 * 
 * Usage: npx ts-node scrape-sketchfab-3d.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Sketchfab API (gratuit, 50 req/jour sans clé)
const SKETCHFAB_API = 'https://api.sketchfab.com/v3';

interface SketchfabModel {
  uid: string;
  name: string;
  viewerUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  user: string;
  license: string;
  isDownloadable: boolean;
  viewCount: number;
  likeCount: number;
}

async function searchSketchfab(query: string, count: number = 24): Promise<SketchfabModel[]> {
  const url = `${SKETCHFAB_API}/search?type=models&q=${encodeURIComponent(query)}&count=${count}&sort_by=-relevance`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    
    return (data.results || []).map((m: any) => ({
      uid: m.uid,
      name: m.name,
      viewerUrl: m.viewerUrl,
      embedUrl: `https://sketchfab.com/models/${m.uid}/embed`,
      thumbnailUrl: m.thumbnails?.images?.[0]?.url || '',
      user: m.user?.displayName || '',
      license: m.license?.label || 'Unknown',
      isDownloadable: m.isDownloadable || false,
      viewCount: m.viewCount || 0,
      likeCount: m.likeCount || 0,
    }));
    
  } catch (e) {
    return [];
  }
}

// Termes de recherche par marque/modèle
const SEARCH_QUERIES = [
  // Premium allemand
  'BMW M3 car', 'BMW M4 car', 'BMW i4 car', 'BMW X5 car',
  'Mercedes S-Class car', 'Mercedes AMG GT', 'Mercedes EQS',
  'Audi R8 car', 'Audi RS6', 'Audi e-tron GT',
  'Porsche 911 car', 'Porsche Taycan', 'Porsche Cayenne',
  
  // Sportives
  'Ferrari 296 car', 'Ferrari SF90', 'Lamborghini Huracan',
  'McLaren 720S', 'Bugatti Chiron',
  
  // Françaises
  'Renault Megane car', 'Peugeot 308 car', 'Citroen C5 car',
  'Alpine A110 car',
  
  // Électriques
  'Tesla Model S car', 'Tesla Model 3 car', 'Tesla Cybertruck',
  'Rivian R1T', 'Lucid Air',
  
  // Japonaises
  'Toyota Supra car', 'Nissan GT-R car', 'Honda NSX car',
  'Mazda MX-5 car', 'Lexus LC',
  
  // SUV populaires
  'Range Rover car', 'BMW X6 car', 'Mercedes GLE car',
  
  // Génériques (qualité)
  'car 3d model detailed', 'sports car 3d',
];

async function matchGeneration(modelName: string): Promise<string | null> {
  // Extraire marque/modèle du nom
  const makes = ['BMW', 'Mercedes', 'Audi', 'Porsche', 'Ferrari', 'Lamborghini',
                 'McLaren', 'Bugatti', 'Tesla', 'Renault', 'Peugeot', 'Citroen',
                 'Toyota', 'Nissan', 'Honda', 'Mazda', 'Lexus', 'Range Rover'];
  
  const nameLower = modelName.toLowerCase();
  let matchedMake: string | undefined;
  
  for (const make of makes) {
    if (nameLower.includes(make.toLowerCase())) {
      matchedMake = make;
      break;
    }
  }
  
  if (!matchedMake) return null;
  
  // Chercher dans nos modèles
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', `%${matchedMake}%`)
    .single();
  
  if (!brand) return null;
  
  const { data: models } = await supabase
    .from('models')
    .select('id, name')
    .eq('brand_id', brand.id);
  
  if (!models) return null;
  
  for (const model of models) {
    if (nameLower.includes(model.name.toLowerCase())) {
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
  console.log('🎮 FLM AUTO — Sketchfab 3D Models Scraper\n');
  
  let totalFound = 0;
  let totalSaved = 0;
  let totalMatched = 0;
  const seenUids = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    process.stdout.write(`🔍 "${query}"...`);
    
    const models = await searchSketchfab(query, 12);
    
    // Filtrer les doublons
    const newModels = models.filter(m => !seenUids.has(m.uid));
    newModels.forEach(m => seenUids.add(m.uid));
    
    console.log(` ${newModels.length} new models`);
    totalFound += newModels.length;
    
    for (const model of newModels) {
      // Filtrer : CC license préféré, bonne qualité (views/likes)
      const isGoodQuality = model.viewCount > 100 || model.likeCount > 5;
      const isUsable = model.license.includes('CC') || model.license === 'Unknown';
      
      if (!isGoodQuality && !isUsable) continue;
      
      const generationId = await matchGeneration(model.name);
      
      // Créer la table si nécessaire ou insérer dans vehicle_images avec type '3d'
      const { error } = await supabase.from('vehicle_images').insert({
        generation_id: generationId,
        url: model.thumbnailUrl,
        source: 'Sketchfab',
        source_url: model.viewerUrl,
        image_type: '3d_model',
        alt_text: model.name,
        metadata: {
          embed_url: model.embedUrl,
          uid: model.uid,
          author: model.user,
          license: model.license,
          views: model.viewCount,
          likes: model.likeCount,
          downloadable: model.isDownloadable,
        },
      });
      
      if (!error) {
        totalSaved++;
        if (generationId) totalMatched++;
      }
    }
    
    await delay(2000); // API rate limit
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Sketchfab: ${totalFound} found, ${totalSaved} saved, ${totalMatched} matched`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
