import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : 'https://www.auto-data.net' + url;
    https.get(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location as string).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  // Fetch BMW brand page
  const brandHtml = await fetchPage('/en/bmw-brand-86');
  const modelRegex = /href="(\/en\/bmw-[^"]*-model-\d+)"/g;
  const models = [...new Set([...brandHtml.matchAll(modelRegex)].map((m: any) => m[1]))].slice(0, 5);
  
  for (const modelUrl of models) {
    const modelName = modelUrl.split('/').pop()?.replace(/-model-\d+$/, '').replace(/-/g, ' ') || '';
    console.log('\nMODEL:', modelName, '→', modelUrl);
    
    const modelHtml = await fetchPage(modelUrl);
    const genRegex = /href="(\/en\/[^"]*-generation-\d+)"/g;
    const gens = [...new Set([...modelHtml.matchAll(genRegex)].map((m: any) => m[1]))].slice(0, 5);
    
    for (const genUrl of gens) {
      const genSlug = genUrl.split('/').pop()?.replace(/-generation-\d+$/, '').replace(/-/g, ' ') || '';
      console.log('  GEN:', genSlug, '→', genUrl);
    }
  }
})();
