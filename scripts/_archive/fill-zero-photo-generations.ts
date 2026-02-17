import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CHECKPOINT_FILE = path.join(__dirname, '..', 'data', 'zero-photo-checkpoint.json');
const RATE_LIMIT_MS = 1000;

interface Checkpoint {
  processedGenerationIds: string[];
  lastProcessedIndex: number;
  timestamp: string;
}

interface Generation {
  id: string;
  name: string;
  slug: string;
  production_start: number | null;
  production_end: number | null;
  model_name: string;
  model_slug: string;
  brand_name: string;
  brand_slug: string;
}

async function paginateAll(table: string, select: string) {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * PAGE, (page + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

function loadCheckpoint(): Checkpoint | null {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWikimediaCategory(categoryName: string): Promise<string[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(categoryName)}&cmtype=file&cmlimit=20&format=json`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.query?.categorymembers) {
      return data.query.categorymembers.map((item: any) => item.title);
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryName}:`, error);
  }
  
  return [];
}

async function searchWikimedia(searchTerm: string): Promise<string[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&srlimit=10&format=json`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.query?.search) {
      return data.query.search.map((item: any) => item.title);
    }
  } catch (error) {
    console.error(`Error searching ${searchTerm}:`, error);
  }
  
  return [];
}

async function getImageUrl(title: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const imageInfo = pages[pageId]?.imageinfo?.[0];
      if (imageInfo?.url) {
        return imageInfo.url;
      }
    }
  } catch (error) {
    console.error(`Error getting image URL for ${title}:`, error);
  }
  
  return null;
}

async function findImagesForGeneration(generation: Generation): Promise<string[]> {
  const { brand_name, model_name, name: generation_name } = generation;
  
  // Strategy 1: Try full generation category
  await sleep(RATE_LIMIT_MS);
  let files = await fetchWikimediaCategory(`${brand_name} ${model_name} ${generation_name}`);
  
  if (files.length > 0) {
    console.log(`  Found ${files.length} images in category: ${brand_name} ${model_name} ${generation_name}`);
    return files;
  }
  
  // Strategy 2: Try model-only category
  await sleep(RATE_LIMIT_MS);
  files = await fetchWikimediaCategory(`${brand_name} ${model_name}`);
  
  if (files.length > 0) {
    console.log(`  Found ${files.length} images in category: ${brand_name} ${model_name}`);
    return files;
  }
  
  // Strategy 3: Try search with generation
  await sleep(RATE_LIMIT_MS);
  files = await searchWikimedia(`${brand_name} ${model_name} ${generation_name}`);
  
  if (files.length > 0) {
    console.log(`  Found ${files.length} images via search: ${brand_name} ${model_name} ${generation_name}`);
    return files;
  }
  
  // Strategy 4: Try search with model only
  await sleep(RATE_LIMIT_MS);
  files = await searchWikimedia(`${brand_name} ${model_name}`);
  
  if (files.length > 0) {
    console.log(`  Found ${files.length} images via search: ${brand_name} ${model_name}`);
    return files;
  }
  
  console.log(`  No images found`);
  return [];
}

async function insertImages(generationId: string, imageUrls: string[]) {
  const records = imageUrls.map(url => ({
    generation_id: generationId,
    url,
    source: 'Wikimedia Commons',
    category: 'exterior'
  }));
  
  const { error } = await supabase
    .from('vehicle_images')
    .insert(records);
  
  if (error) {
    console.error(`  Error inserting images:`, error);
    throw error;
  }
}

async function main() {
  console.log('Finding generations with 0 images...\n');
  
  // Find all generations with no images
  const query = `
    id,
    name,
    slug,
    production_start,
    production_end,
    models!inner(
      name,
      slug,
      brands!inner(
        name,
        slug
      )
    )
  `;
  
  const allGenerations = await paginateAll('generations', query);
  
  // Filter out generations that have images
  const generationsWithImages = await paginateAll('vehicle_images', 'generation_id');
  const generationIdsWithImages = new Set(generationsWithImages.map((img: any) => img.generation_id));
  
  const zeroPhotoGenerations: Generation[] = allGenerations
    .filter((gen: any) => !generationIdsWithImages.has(gen.id))
    .map((gen: any) => ({
      id: gen.id,
      name: gen.name,
      slug: gen.slug,
      production_start: gen.production_start,
      production_end: gen.production_end,
      model_name: gen.models.name,
      model_slug: gen.models.slug,
      brand_name: gen.models.brands.name,
      brand_slug: gen.models.brands.slug
    }));
  
  console.log(`Found ${zeroPhotoGenerations.length} generations with 0 images\n`);
  
  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const processedIds = new Set(checkpoint?.processedGenerationIds || []);
  
  let startIndex = 0;
  if (checkpoint) {
    console.log(`Loaded checkpoint: ${processedIds.size} generations already processed`);
    startIndex = checkpoint.lastProcessedIndex + 1;
  }
  
  // Process each generation
  let totalImagesAdded = 0;
  
  for (let i = startIndex; i < zeroPhotoGenerations.length; i++) {
    const generation = zeroPhotoGenerations[i];
    
    // Skip if already processed
    if (processedIds.has(generation.id)) {
      continue;
    }
    
    console.log(`[${i + 1}/${zeroPhotoGenerations.length}] ${generation.brand_name} ${generation.model_name} ${generation.name}`);
    
    try {
      // Find images
      const files = await findImagesForGeneration(generation);
      
      if (files.length > 0) {
        // Get image URLs
        const imageUrls: string[] = [];
        for (const file of files) {
          await sleep(RATE_LIMIT_MS);
          const url = await getImageUrl(file);
          if (url) {
            imageUrls.push(url);
          }
        }
        
        // Insert images
        if (imageUrls.length > 0) {
          await insertImages(generation.id, imageUrls);
          console.log(`  Inserted ${imageUrls.length} images`);
          totalImagesAdded += imageUrls.length;
        }
      }
      
      // Mark as processed
      processedIds.add(generation.id);
      
      // Save checkpoint every 50 generations
      if ((i + 1) % 50 === 0) {
        saveCheckpoint({
          processedGenerationIds: Array.from(processedIds),
          lastProcessedIndex: i,
          timestamp: new Date().toISOString()
        });
        console.log(`\nCheckpoint saved (${processedIds.size} processed, ${totalImagesAdded} images added)\n`);
      }
      
    } catch (error) {
      console.error(`  Error processing generation:`, error);
      // Save checkpoint on error
      saveCheckpoint({
        processedGenerationIds: Array.from(processedIds),
        lastProcessedIndex: i,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  // Final checkpoint
  saveCheckpoint({
    processedGenerationIds: Array.from(processedIds),
    lastProcessedIndex: zeroPhotoGenerations.length - 1,
    timestamp: new Date().toISOString()
  });
  
  console.log(`\n✅ Complete! Processed ${zeroPhotoGenerations.length} generations, added ${totalImagesAdded} images`);
}

main().catch(console.error);
