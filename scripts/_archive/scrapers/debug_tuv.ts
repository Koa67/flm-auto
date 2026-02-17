/**
 * Debug TÜV scraping - analyse la structure HTML réelle
 */

import * as fs from 'fs';

const TEST_URL = 'https://car-recalls.eu/reliability/reliability-tuv-report-2025-2-3-years/';

async function debug() {
  console.log('🔍 Fetching:', TEST_URL);
  
  const response = await fetch(TEST_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  
  // Sauvegarder le HTML brut pour analyse
  fs.writeFileSync('../data/raw/tuv/debug_page.html', html);
  console.log('📄 Saved HTML to ../data/raw/tuv/debug_page.html');
  
  // Chercher les patterns de table
  console.log('\n📊 HTML length:', html.length);
  console.log('Contains <table>:', html.includes('<table'));
  console.log('Contains <tr>:', html.includes('<tr'));
  console.log('Contains "defect":', html.toLowerCase().includes('defect'));
  console.log('Contains "%":', html.includes('%'));
  
  // Extraire un sample de 2000 chars autour du premier %
  const percentIdx = html.indexOf('%');
  if (percentIdx > 0) {
    const sample = html.substring(Math.max(0, percentIdx - 500), percentIdx + 500);
    console.log('\n📝 Sample around first %:\n', sample);
  }
  
  // Chercher les patterns de modèles de voiture
  const carPatterns = ['BMW', 'Mercedes', 'Audi', 'VW', 'Porsche', 'Skoda'];
  carPatterns.forEach(car => {
    const count = (html.match(new RegExp(car, 'gi')) || []).length;
    console.log(`Found "${car}": ${count} times`);
  });
}

debug().catch(console.error);
