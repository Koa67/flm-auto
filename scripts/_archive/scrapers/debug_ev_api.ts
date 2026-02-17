/**
 * FLM AUTO - Cherche l'API EV-Database
 */

import * as fs from 'fs';

async function findApi() {
  const html = fs.readFileSync('../data/raw/ev_database/debug_list.html', 'utf-8');
  
  // Chercher les URLs d'API dans les scripts
  console.log('🔍 Searching for API endpoints...\n');
  
  // Pattern 1: fetch/ajax calls
  const fetchMatches = html.match(/fetch\s*\(\s*['"]([^'"]+)['"]/g) || [];
  console.log('Fetch calls:', fetchMatches.slice(0, 10));
  
  // Pattern 2: JSON file references
  const jsonMatches = html.match(/['"][^'"]*\.json['"]/g) || [];
  console.log('\nJSON refs:', jsonMatches.slice(0, 10));
  
  // Pattern 3: API endpoints
  const apiMatches = html.match(/['"]\/api\/[^'"]+['"]/g) || [];
  console.log('\nAPI endpoints:', apiMatches.slice(0, 10));
  
  // Pattern 4: data URLs
  const dataUrlMatches = html.match(/data-url=['"]([^'"]+)['"]/g) || [];
  console.log('\nData URLs:', dataUrlMatches.slice(0, 10));
  
  // Chercher la structure des items
  console.log('\n\n🔍 Looking for vehicle item structure...');
  
  // Les items ont probablement une classe spécifique
  const itemClasses = html.match(/class="[^"]*item[^"]*"/g) || [];
  const uniqueClasses = [...new Set(itemClasses)];
  console.log('Item classes:', uniqueClasses.slice(0, 10));
  
  // Chercher data-content ou similaire
  const dataContent = html.match(/data-content=['"]([^'"]{100,500})['"]/);
  if (dataContent) {
    console.log('\nData content sample:', dataContent[1].substring(0, 300));
  }
  
  // Chercher les specs dans le HTML brut
  console.log('\n\n🔍 Looking for spec patterns...');
  
  // Pattern: nombre + unité (kWh, km, kW, etc.)
  const specPattern = /(\d+(?:\.\d+)?)\s*(kWh|km|kW|Wh\/km|min|sec|mph|km\/h)/gi;
  const specs = html.match(specPattern) || [];
  const uniqueSpecs = [...new Set(specs)];
  console.log('Spec values found:', uniqueSpecs.length);
  console.log('Samples:', uniqueSpecs.slice(0, 30));
  
  // Chercher les noms de voitures
  console.log('\n\n🔍 Looking for car names...');
  const carNames = html.match(/(?:BMW|Audi|Mercedes|Volkswagen|VW|Porsche|Skoda)\s+[A-Za-z0-9\-\s]+(?=<|"|'|\s{2})/gi) || [];
  const uniqueCars = [...new Set(carNames.map(c => c.trim()))];
  console.log('Car names found:', uniqueCars.length);
  uniqueCars.slice(0, 30).forEach(c => console.log('  ', c));
}

findApi().catch(console.error);
