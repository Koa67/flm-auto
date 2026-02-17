import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

const MVP_BRANDS = ["Audi", "BMW", "Mercedes-Benz", "Porsche", "VW", "Skoda", "Renault", "VW Nutzfahrzeuge"];

async function importAdacKofferraum() {
  const data: KofferraumEntry[] = JSON.parse(
    fs.readFileSync("/Users/koa/Dev/flm-auto/data/adac-kofferraum.json", "utf-8")
  );

  const mvpData = data.filter(e => 
    MVP_BRANDS.some(b => e.brand.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(e.brand.toLowerCase()))
  );

  console.log(`Processing ${mvpData.length} MVP vehicles...\n`);

  const { data: generations, error: genError } = await supabase
    .from("generations")
    .select(`
      id,
      name,
      production_start,
      production_end,
      models!inner (
        id,
        name,
        brands!inner (
          id,
          name
        )
      )
    `);

  if (genError) throw genError;
  console.log(`Found ${generations?.length} generations in DB\n`);

  let matched = 0;
  let unmatched = 0;
  const unmatchedList: string[] = [];
  const toInsert: any[] = [];

  for (const entry of mvpData) {
    let brandSearch = entry.brand;
    if (brandSearch === "VW Nutzfahrzeuge") brandSearch = "Volkswagen";
    if (brandSearch === "VW") brandSearch = "Volkswagen";
    if (brandSearch === "Mercedes-Benz") brandSearch = "Mercedes";

    const gen = generations?.find(g => {
      const brand = (g.models as any).brands.name.toLowerCase();
      const model = (g.models as any).name.toLowerCase();
      
      const brandMatch = brand.includes(brandSearch.toLowerCase()) || 
                         brandSearch.toLowerCase().includes(brand);
      
      let modelSearch = entry.model.toLowerCase()
        .replace("e-tech electric", "")
        .replace("plug-in hybrid", "")
        .replace("elektro", "")
        .replace("-reihe", "")
        .replace(" ev", "")
        .replace(" coupé", "")
        .replace(" limousine", "")
        .replace(" touring", "")
        .replace(" active tourer", "")
        .replace(" t-modell", "")
        .replace(" sportback", "")
        .replace(" avant", "")
        .replace(" combi", "")
        .replace(" variant", "")
        .replace(" sportstourer", "")
        .trim();
      
      const modelMatch = model.includes(modelSearch) || modelSearch.includes(model);
      
      return brandMatch && modelMatch;
    });

    if (gen) {
      matched++;
      toInsert.push({
        generation_id: gen.id,
        source: "ADAC",
        source_url: "https://www.adac.de/rund-ums-fahrzeug/autokatalog/autotest/kofferraumvolumen-vergleich-2026/",
        spec_type: "cargo_volume_liters",
        spec_value: entry.volumeAdac,
        raw_data: {
          volumeManufacturer: entry.volumeManufacturer,
          volumeAdac: entry.volumeAdac,
          volumeAdacDachhoch: entry.volumeAdacDachhoch,
          category: entry.category,
          priceEur: entry.priceEur,
          dateRange: entry.dateRange,
        },
        tested_at: new Date().toISOString().split("T")[0],
      });
    } else {
      unmatched++;
      unmatchedList.push(`${entry.brand} ${entry.model}`);
    }
  }

  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
  
  if (unmatchedList.length > 0) {
    console.log("\nUnmatched vehicles:");
    unmatchedList.slice(0, 30).forEach(v => console.log(`  - ${v}`));
    if (unmatchedList.length > 30) console.log(`  ... and ${unmatchedList.length - 30} more`);
  }

  if (toInsert.length > 0) {
    console.log("\nInserting records...");
    let insertCount = 0;
    let skipCount = 0;
    
    for (const record of toInsert) {
      const { error } = await supabase.from("third_party_specs").insert(record);
      if (error) {
        if (error.code === "23505") skipCount++;
        else console.error(`Error: ${error.message}`);
      } else {
        insertCount++;
      }
    }
    console.log(`Inserted: ${insertCount}, Skipped (duplicates): ${skipCount}`);
  }
}

importAdacKofferraum().catch(console.error);
