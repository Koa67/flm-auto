import * as fs from "fs";

interface KofferraumEntry {
  brand: string;
  model: string;
  dateRange: string;
  priceEur: number | null;
  volumeManufacturer: number | null;
  volumeAdac: number | null;
  volumeAdacDachhoch: number | null;
  category: string;
}

async function scrapeAdacKofferraum(): Promise<KofferraumEntry[]> {
  const url = "https://www.adac.de/rund-ums-fahrzeug/autokatalog/autotest/kofferraumvolumen-vergleich-2026/";
  
  console.log("Fetching ADAC Kofferraumvolumen page...");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  
  // Extract __APOLLO_STATE__ JSON
  const stateMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!stateMatch) {
    throw new Error("Could not find __APOLLO_STATE__");
  }

  const apolloState = JSON.parse(stateMatch[1]);
  const entries: KofferraumEntry[] = [];

  // Category mapping by table ID
  const categoryMap: Record<string, string> = {
    "ContentfulTable:3ujLhon7Usp2GCsgmaUM0F": "SUV",
    "ContentfulTable:6GcwAPK2gjHKjSemVFXNIY": "Van",
    "ContentfulTable:UwsoI9GAz38PcKkcVO57R": "Kombi",
    "ContentfulTable:52WvtuC66WXAXWzOkcRDKC": "Hochdachkombi",
    "ContentfulTable:1Od1hQuGFbhDad05YW7LRj": "Limousine Stufenheck",
    "ContentfulTable:60gn8hdMcHxSO0qmM7zZLY": "Limousine Schrägheck",
  };

  for (const [key, category] of Object.entries(categoryMap)) {
    const table = apolloState[key];
    if (!table?.data?.[0]?.children) continue;

    const rows = table.data[0].children;
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.type !== "table-row") continue;

      const cells = row.children;
      if (cells.length < 6) continue;

      const getText = (cell: any): string => {
        try {
          return cell.children[0].children[0].text || "";
        } catch {
          return "";
        }
      };

      const parseNum = (s: string): number | null => {
        const n = parseInt(s.replace(/[^\d]/g, ""), 10);
        return isNaN(n) ? null : n;
      };

      const brand = getText(cells[0]);
      const modelRaw = getText(cells[1]);
      
      // Parse model and date range: "Q2 (10/20 - )" -> model: "Q2", dateRange: "10/20 - "
      const modelMatch = modelRaw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      const model = modelMatch ? modelMatch[1].trim() : modelRaw;
      const dateRange = modelMatch ? modelMatch[2].trim() : "";

      entries.push({
        brand,
        model,
        dateRange,
        priceEur: parseNum(getText(cells[2])),
        volumeManufacturer: parseNum(getText(cells[3])),
        volumeAdac: parseNum(getText(cells[4])),
        volumeAdacDachhoch: parseNum(getText(cells[5])),
        category,
      });
    }
  }

  return entries;
}

async function main() {
  try {
    const entries = await scrapeAdacKofferraum();
    
    console.log(`\nExtracted ${entries.length} vehicles\n`);
    
    // Stats by category
    const byCategory = entries.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("By category:");
    for (const [cat, count] of Object.entries(byCategory)) {
      console.log(`  ${cat}: ${count}`);
    }

    // Sample entries
    console.log("\nSample entries:");
    entries.slice(0, 5).forEach(e => {
      console.log(`  ${e.brand} ${e.model}: Manufacturer=${e.volumeManufacturer}L, ADAC=${e.volumeAdac}L (diff: ${(e.volumeManufacturer || 0) - (e.volumeAdac || 0)}L)`);
    });

    // Save to JSON
    const outputPath = "/Users/koa/Dev/flm-auto/data/adac-kofferraum.json";
    fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
    console.log(`\nSaved to ${outputPath}`);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
