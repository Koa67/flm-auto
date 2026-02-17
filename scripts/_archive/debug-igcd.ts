/**
 * Debug IGCD HTML structure
 */

async function main() {
  const url = 'https://www.igcd.net/marque.php?id=BMW&pays=DE';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FLM-AUTO-Research/1.0',
      'Accept': 'text/html',
    },
  });
  
  const html = await response.text();
  
  console.log('=== First 5000 chars ===');
  console.log(html.substring(0, 5000));
  
  console.log('\n=== Looking for marque2 links ===');
  
  // Try different patterns
  const patterns = [
    /marque2\.php[^"']*/g,
    /href="([^"]*marque2[^"]*)"/g,
    /marque2/g,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    console.log(`\nPattern ${pattern}:`);
    console.log(`  Found: ${matches?.length || 0}`);
    if (matches && matches.length > 0) {
      console.log(`  First 5:`, matches.slice(0, 5));
    }
  }
  
  // Look for any href patterns
  console.log('\n=== All hrefs containing "model" ===');
  const hrefMatches = html.match(/href="[^"]*model[^"]*"/gi);
  console.log(hrefMatches?.slice(0, 10));
}

main().catch(console.error);
