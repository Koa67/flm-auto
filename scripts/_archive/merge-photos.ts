/**
 * FLM AUTO - Merge All Photo Files into Single Database
 * Deduplicates and organizes photos by brand/generation
 * 
 * Usage: npx tsx scripts/merge-photos.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface PhotoResult {
  brand: string;
  model: string;
  generation: string | null;
  variant?: string;
  source: string;
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
  license?: string;
  author?: string;
  source_url?: string;
}

function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FLM AUTO - Merge All Photo Files                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const dataDir = path.join(__dirname, '../data');
  
  const photoFiles = [
    'vehicle-photos.json',
    'photos-mega-batch.json',
    'photos-premium-batch.json',
    'photos-ultimate.json',
    'photos-aggressive.json',
    'vehicle-photos-new-brands.json',
    'vehicle-photos-missing.json',
  ];
  
  const allPhotos: PhotoResult[] = [];
  const seenUrls = new Set<string>();
  const stats: Record<string, number> = {};
  
  console.log('📂 Loading photo files...\n');
  
  for (const file of photoFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`   ⏭️  ${file} - not found`);
      continue;
    }
    
    try {
      const photos: PhotoResult[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let added = 0;
      
      for (const photo of photos) {
        // Normalize URL for deduplication
        const urlKey = photo.url.split('?')[0].toLowerCase();
        
        if (seenUrls.has(urlKey)) continue;
        seenUrls.add(urlKey);
        
        // Validate photo
        if (!photo.url || !photo.brand) continue;
        
        // Normalize data
        photo.brand = photo.brand.trim();
        photo.generation = photo.generation?.trim() || null;
        photo.model = photo.model?.trim() || photo.brand;
        
        allPhotos.push(photo);
        added++;
        
        // Track by brand
        stats[photo.brand] = (stats[photo.brand] || 0) + 1;
      }
      
      console.log(`   ✅ ${file.padEnd(30)} ${photos.length.toString().padStart(5)} loaded, ${added.toString().padStart(5)} new`);
      
    } catch (err) {
      console.log(`   ❌ ${file} - error: ${(err as Error).message}`);
    }
  }
  
  // Sort by brand, then generation
  allPhotos.sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand);
    if (brandCompare !== 0) return brandCompare;
    return (a.generation || '').localeCompare(b.generation || '');
  });
  
  // Save merged file
  const outputFile = path.join(dataDir, 'photos-all-merged.json');
  fs.writeFileSync(outputFile, JSON.stringify(allPhotos, null, 2));
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\n  Total unique photos: ${allPhotos.length}\n`);
  
  // Top brands
  console.log('  Top 20 brands by photo count:');
  const sortedBrands = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [brand, count] of sortedBrands) {
    console.log(`    ${brand.padEnd(20)} ${count.toString().padStart(4)} photos`);
  }
  
  // Brands with 0 photos (check against specs)
  const specsDir = path.join(dataDir, 'ultimatespecs');
  const specBrands = new Set<string>();
  
  if (fs.existsSync(specsDir)) {
    for (const file of fs.readdirSync(specsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const specs = JSON.parse(fs.readFileSync(path.join(specsDir, file), 'utf-8'));
        if (specs.length > 0 && specs[0].brand) {
          specBrands.add(specs[0].brand);
        }
      } catch (e) {}
    }
  }
  
  const brandsWithPhotos = new Set(Object.keys(stats));
  const missingBrands = Array.from(specBrands).filter(b => !brandsWithPhotos.has(b));
  
  if (missingBrands.length > 0) {
    console.log(`\n  ⚠️  Brands with 0 photos: ${missingBrands.join(', ')}`);
  }
  
  console.log(`\n  📁 Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main();
