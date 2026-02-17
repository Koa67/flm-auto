import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CHECKPOINT_FILE = "data/sketchfab-checkpoint.json";
const RATE_LIMIT_MS = 600;

interface Checkpoint {
  processedBrands: string[];
  totalInserted: number;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
  }
  return { processedBrands: [], totalInserted: 0 };
}

function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchSketchfab(query: string): Promise<any[]> {
  try {
    const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query)}&sort_by=-likeCount&count=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FLM-Auto/1.0 (car encyclopedia)" },
    });
    if (!res.ok) {
      console.error(`  Sketchfab API ${res.status}: ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    return (json.results || []).filter(
      (m: any) => m.viewerUrl && m.likeCount >= 2
    );
  } catch (e: any) {
    console.error(`  Fetch error: ${e.message}`);
    return [];
  }
}

function getBestThumbnail(model: any): string | undefined {
  const imgs = model.thumbnails?.images || [];
  const sorted = [...imgs].sort((a: any, b: any) => b.width - a.width);
  return sorted[0]?.url;
}

// Top models per brand for targeted searches
const TOP_MODELS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale", "4C", "Giulietta"],
  "Audi": ["A3", "A4", "A6", "Q5", "RS6", "R8", "e-tron GT"],
  "BMW": ["3 Series", "5 Series", "M3", "X5", "M4", "i4"],
  "Citroën": ["C3", "C4", "C5 X", "Berlingo"],
  "Cupra": ["Formentor", "Born", "Leon"],
  "Dacia": ["Duster", "Sandero", "Spring"],
  "DS": ["DS 3", "DS 4", "DS 7", "DS 9"],
  "Ferrari": ["F40", "488", "SF90", "296 GTB", "LaFerrari", "Enzo"],
  "Fiat": ["500", "Panda", "Tipo", "500X"],
  "Ford": ["Mustang", "Focus", "Fiesta", "Puma", "Bronco"],
  "Honda": ["Civic", "CR-V", "Jazz", "NSX", "S2000"],
  "Hyundai": ["Tucson", "i30", "IONIQ 5", "Kona", "i20 N"],
  "Jaguar": ["F-Type", "XE", "F-Pace", "E-Type"],
  "Jeep": ["Wrangler", "Grand Cherokee", "Compass", "Renegade"],
  "Kia": ["EV6", "Sportage", "Ceed", "Stinger"],
  "Lamborghini": ["Huracan", "Aventador", "Urus", "Countach", "Revuelto"],
  "Land Rover": ["Defender", "Range Rover", "Discovery", "Evoque"],
  "Lexus": ["LC", "RX", "IS", "NX", "LFA"],
  "Maserati": ["MC20", "Ghibli", "Levante", "GranTurismo"],
  "Mazda": ["MX-5", "3", "CX-5", "CX-60", "RX-7"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "AMG GT", "G-Class", "EQS"],
  "MINI": ["Cooper", "Countryman", "Clubman"],
  "Nissan": ["GT-R", "370Z", "Qashqai", "Juke", "Leaf"],
  "Opel": ["Corsa", "Astra", "Mokka", "Grandland"],
  "Peugeot": ["208", "308", "3008", "508", "e-208"],
  "Porsche": ["911", "Cayenne", "Taycan", "Macan", "718 Cayman"],
  "Renault": ["Clio", "Megane", "Captur", "Scenic", "Alpine A110"],
  "Seat": ["Leon", "Ibiza", "Arona", "Ateca"],
  "Škoda": ["Octavia", "Superb", "Kodiaq", "Enyaq"],
  "Tesla": ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  "Toyota": ["Supra", "Corolla", "RAV4", "Yaris GR", "Land Cruiser"],
  "Volkswagen": ["Golf", "Polo", "Tiguan", "ID.4", "Passat", "GTI"],
};

async function main() {
  console.log("=== Sketchfab 3D Model Scraper ===\n");

  const cp = loadCheckpoint();
  let totalInserted = cp.totalInserted;

  // Get all brands from DB to match generation_ids
  const { data: brands } = await supabase.from("brands").select("id, name, slug");
  console.log(`Loaded ${brands?.length || 0} brands from DB`);

  for (const [brandName, modelNames] of Object.entries(TOP_MODELS)) {
    if (cp.processedBrands.includes(brandName)) {
      console.log(`Skipping ${brandName} (already done)`);
      continue;
    }

    console.log(`\n--- ${brandName} ---`);
    let brandInserted = 0;
    const dbBrand = brands?.find((b) =>
      b.name.toLowerCase() === brandName.toLowerCase() ||
      b.name.toLowerCase().includes(brandName.toLowerCase().split(" ")[0])
    );

    for (const modelName of modelNames) {
      const query = `${brandName} ${modelName} car 3d`;
      console.log(`  Searching: "${query}"`);

      const results = await searchSketchfab(query);
      await sleep(RATE_LIMIT_MS);

      if (results.length === 0) {
        console.log(`    No results`);
        continue;
      }

      // Try to find matching generation_id
      let genId: string | null = null;
      if (dbBrand) {
        const { data: matchModels } = await supabase
          .from("models")
          .select("id")
          .eq("brand_id", dbBrand.id)
          .ilike("name", `%${modelName.replace(/\s+/g, "%")}%`)
          .limit(1);

        if (matchModels?.[0]) {
          const { data: matchGens } = await supabase
            .from("generations")
            .select("id")
            .eq("model_id", matchModels[0].id)
            .order("production_start", { ascending: false, nullsFirst: false })
            .limit(1);
          genId = matchGens?.[0]?.id || null;
        }
      }

      // Take top 2 by likes
      const top = results.slice(0, 2);

      for (const model of top) {
        const thumbnail = getBestThumbnail(model);
        const embedUrl = `https://sketchfab.com/models/${model.uid}/embed`;

        const { error } = await supabase.from("vehicle_3d_models").upsert(
          {
            generation_id: genId,
            brand: brandName,
            model: modelName,
            source: "sketchfab",
            model_url: model.viewerUrl,
            embed_url: embedUrl,
            thumbnail_url: thumbnail || null,
            format: "embed",
            license: model.license?.label || null,
            author: model.user?.displayName || null,
          },
          { onConflict: "model_url" }
        );

        if (error) {
          console.log(`    Error: ${error.message}`);
        } else {
          brandInserted++;
          totalInserted++;
        }
      }

      console.log(`    Saved ${Math.min(2, results.length)} models${genId ? ` (gen: ${genId.slice(0, 8)}...)` : " (no gen match)"}`);
    }

    console.log(`  ${brandName}: +${brandInserted} (total: ${totalInserted})`);
    cp.processedBrands.push(brandName);
    cp.totalInserted = totalInserted;
    saveCheckpoint(cp);
  }

  console.log(`\n=== DONE: ${totalInserted} 3D models saved ===`);
}

main().catch(console.error);
