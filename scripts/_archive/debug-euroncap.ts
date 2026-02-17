/**
 * Debug Euro NCAP HTML parsing
 */

async function debugParsing(): Promise<void> {
  const url = 'https://www.euroncap.com/en/results/bmw/5+series/50186';
  
  console.log('Fetching', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  
  const html = await response.text();
  
  // Save for inspection
  const fs = require('fs');
  fs.writeFileSync('data/euroncap/debug_bmw5.html', html);
  console.log(`Saved ${html.length} chars to debug_bmw5.html`);
  
  // Look for percentages
  const percentages = html.match(/\d{2}%/g);
  console.log('\nAll percentages found:', percentages?.slice(0, 20));
  
  // Look for "89%" near "Adult"
  const adultContext = html.match(/.{0,100}Adult.{0,100}/gi);
  console.log('\nContext around "Adult":', adultContext?.slice(0, 3));
  
  // Look for specific patterns in HTML
  const ratingPattern = html.match(/(\d{2})%\s*<\/span>/g);
  console.log('\nPercentages before </span>:', ratingPattern);
  
  // Look for data attributes or JSON
  const jsonMatch = html.match(/assessment['"]\s*:\s*\{[^}]+\}/i);
  console.log('\nJSON-like patterns:', jsonMatch);
  
  // Look for specific sections
  const sections = ['Adult Occupant', 'Child Occupant', 'Vulnerable', 'Safety Assist'];
  for (const section of sections) {
    const match = html.match(new RegExp(`${section}[^\\d]{0,50}(\\d{2,3})%`, 'i'));
    console.log(`\n${section}: ${match ? match[1] + '%' : 'NOT FOUND'}`);
  }
}

debugParsing().catch(console.error);
