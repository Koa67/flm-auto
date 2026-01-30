#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const ULTIMATESPECS_DIR = path.join(DATA_DIR, 'ultimatespecs');

// Count all vehicles in ultimatespecs
let totalVehicles = 0;
let vehiclesByBrand = {};

const usFiles = fs.readdirSync(ULTIMATESPECS_DIR).filter(f => f.endsWith('.json') && !f.includes('missing'));
for (const file of usFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ULTIMATESPECS_DIR, file), 'utf-8'));
    const brand = data[0]?.brand || file.replace('.json', '');
    vehiclesByBrand[brand] = data.length;
    totalVehicles += data.length;
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
}

// Count photos
const photoFiles = [
  'vehicle-photos.json',
  'photos-mega-batch.json', 
  'photos-premium-batch.json'
].filter(f => fs.existsSync(path.join(DATA_DIR, f)));

let allPhotos = [];
for (const file of photoFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
    allPhotos = allPhotos.concat(data);
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
}

// Photos by brand
const photosByBrand = {};
for (const p of allPhotos) {
  const brand = p.brand || 'Unknown';
  photosByBrand[brand] = (photosByBrand[brand] || 0) + 1;
}

// Unique generations with photos
const gensWithPhotos = new Set(allPhotos.map(p => 
  p.generation_id || `${p.brand}-${p.model}-${p.generation}`
));

console.log('\n📊 FLM AUTO - Photo Coverage Analysis\n');
console.log('=' .repeat(60));
console.log(`\n🚗 Total vehicles in UltimateSpecs: ${totalVehicles.toLocaleString()}`);
console.log(`📸 Total photos: ${allPhotos.length.toLocaleString()}`);
console.log(`🎯 Unique generations with photos: ${gensWithPhotos.size.toLocaleString()}`);
console.log(`📉 Coverage: ~${((gensWithPhotos.size / totalVehicles) * 100).toFixed(1)}%`);

console.log('\n📊 Photos by Brand (Top 20):\n');
const sortedBrands = Object.entries(photosByBrand)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

for (const [brand, count] of sortedBrands) {
  const vehicleCount = vehiclesByBrand[brand] || '?';
  console.log(`  ${brand.padEnd(20)} ${String(count).padStart(4)} photos | ${vehicleCount} vehicles`);
}

console.log('\n🚨 Brands with 0 photos:');
const brandsWithNoPhotos = Object.keys(vehiclesByBrand).filter(b => !photosByBrand[b]);
console.log(`  ${brandsWithNoPhotos.length} brands: ${brandsWithNoPhotos.slice(0, 10).join(', ')}${brandsWithNoPhotos.length > 10 ? '...' : ''}`);

console.log('\n⚠️  Missing major brands in UltimateSpecs:');
const majorBrands = ['BMW', 'Mercedes-Benz', 'Lamborghini', 'Porsche'];
for (const brand of majorBrands) {
  if (!vehiclesByBrand[brand]) {
    console.log(`  ❌ ${brand} - NOT in UltimateSpecs!`);
  }
}
