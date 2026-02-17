/**
 * FLM AUTO - Add Missing Brands
 * Adds Tesla, Hyundai, Volvo + base models for Family Fit coverage
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simplified brand data - only columns that exist in schema
const BRANDS_TO_ADD = [
  { name: "Tesla", slug: "tesla" },
  { name: "Hyundai", slug: "hyundai" },
  { name: "Volvo", slug: "volvo" },
];

const MODELS_TO_ADD = [
  // Tesla
  { brand: "Tesla", name: "Model 3", slug: "model-3", year_start: 2017, body_types: ["sedan"] },
  { brand: "Tesla", name: "Model Y", slug: "model-y", year_start: 2020, body_types: ["suv"] },
  { brand: "Tesla", name: "Model S", slug: "model-s", year_start: 2012, body_types: ["sedan"] },
  { brand: "Tesla", name: "Model X", slug: "model-x", year_start: 2015, body_types: ["suv"] },
  
  // Hyundai
  { brand: "Hyundai", name: "Tucson", slug: "tucson", year_start: 2004, body_types: ["suv"] },
  { brand: "Hyundai", name: "Ioniq 5", slug: "ioniq-5", year_start: 2021, body_types: ["suv"] },
  { brand: "Hyundai", name: "Ioniq 6", slug: "ioniq-6", year_start: 2022, body_types: ["sedan"] },
  { brand: "Hyundai", name: "Kona", slug: "kona", year_start: 2017, body_types: ["suv"] },
  { brand: "Hyundai", name: "Santa Fe", slug: "santa-fe", year_start: 2000, body_types: ["suv"] },
  
  // Volvo
  { brand: "Volvo", name: "V60", slug: "v60", year_start: 2010, body_types: ["wagon"] },
  { brand: "Volvo", name: "V90", slug: "v90", year_start: 2016, body_types: ["wagon"] },
  { brand: "Volvo", name: "XC40", slug: "xc40", year_start: 2017, body_types: ["suv"] },
  { brand: "Volvo", name: "XC60", slug: "xc60", year_start: 2008, body_types: ["suv"] },
  { brand: "Volvo", name: "XC90", slug: "xc90", year_start: 2002, body_types: ["suv"] },
];

const GENERATIONS_TO_ADD = [
  // Tesla Model 3
  { brand: "Tesla", model: "Model 3", name: "Highland", year_start: 2023, year_end: null },
  { brand: "Tesla", model: "Model 3", name: "Gen 1", year_start: 2017, year_end: 2023 },
  
  // Tesla Model Y
  { brand: "Tesla", model: "Model Y", name: "Gen 1", year_start: 2020, year_end: null },
  
  // Hyundai Tucson
  { brand: "Hyundai", model: "Tucson", name: "NX4", year_start: 2021, year_end: null },
  { brand: "Hyundai", model: "Tucson", name: "TL", year_start: 2015, year_end: 2021 },
  
  // Hyundai Ioniq 5
  { brand: "Hyundai", model: "Ioniq 5", name: "NE", year_start: 2021, year_end: null },
  
  // Hyundai Ioniq 6
  { brand: "Hyundai", model: "Ioniq 6", name: "CE", year_start: 2022, year_end: null },
  
  // Hyundai Santa Fe
  { brand: "Hyundai", model: "Santa Fe", name: "MX5", year_start: 2024, year_end: null },
  { brand: "Hyundai", model: "Santa Fe", name: "TM", year_start: 2018, year_end: 2024 },
  
  // Volvo V60
  { brand: "Volvo", model: "V60", name: "225", year_start: 2018, year_end: null },
  { brand: "Volvo", model: "V60", name: "155", year_start: 2010, year_end: 2018 },
  
  // Volvo XC40
  { brand: "Volvo", model: "XC40", name: "XZ", year_start: 2017, year_end: null },
  
  // Volvo XC60
  { brand: "Volvo", model: "XC60", name: "246", year_start: 2017, year_end: null },
  
  // Volvo XC90
  { brand: "Volvo", model: "XC90", name: "256", year_start: 2015, year_end: null },
];

async function addMissingBrands() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     FLM AUTO - Add Missing Brands (Tesla, Hyundai, Volvo)  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // 1. Add brands
  console.log("📦 Adding brands...");
  for (const brand of BRANDS_TO_ADD) {
    const { error } = await supabase.from("brands").insert(brand);
    if (error) {
      if (error.code === "23505") {
        console.log(`  ⏭️  ${brand.name}: already exists`);
      } else {
        console.error(`  ❌ ${brand.name}: ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${brand.name}`);
    }
  }

  // 2. Get all brand IDs
  const { data: brands } = await supabase.from("brands").select("id, name");
  const brandMap = new Map(brands?.map(b => [b.name, b.id]) || []);
  console.log(`\n📊 Brands in DB: ${Array.from(brandMap.keys()).join(", ")}`);

  // 3. Add models
  console.log("\n📦 Adding models...");
  for (const model of MODELS_TO_ADD) {
    const brandId = brandMap.get(model.brand);
    if (!brandId) {
      console.log(`  ⏭️  ${model.brand} ${model.name}: brand not found`);
      continue;
    }
    
    const { error } = await supabase.from("models").insert({
      brand_id: brandId,
      name: model.name,
      slug: model.slug,
      year_start: model.year_start,
      body_types: model.body_types,
    });
    
    if (error) {
      if (error.code === "23505") {
        console.log(`  ⏭️  ${model.brand} ${model.name}: already exists`);
      } else {
        console.error(`  ❌ ${model.brand} ${model.name}: ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${model.brand} ${model.name}`);
    }
  }

  // 4. Get model IDs for new brands
  const { data: models } = await supabase
    .from("models")
    .select("id, name, brand_id, brands!inner(name)")
    .in("brands.name", ["Tesla", "Hyundai", "Volvo"]);
  
  const modelMap = new Map(
    models?.map(m => [`${(m.brands as any).name}-${m.name}`, m.id]) || []
  );
  console.log(`\n📊 Models found: ${modelMap.size}`);

  // 5. Add generations
  console.log("\n📦 Adding generations...");
  for (const gen of GENERATIONS_TO_ADD) {
    const modelKey = `${gen.brand}-${gen.model}`;
    const modelId = modelMap.get(modelKey);
    
    if (!modelId) {
      console.log(`  ⏭️  ${gen.brand} ${gen.model} ${gen.name}: model not found`);
      continue;
    }
    
    const { error } = await supabase.from("generations").insert({
      model_id: modelId,
      name: gen.name,
      production_start: gen.year_start,
      production_end: gen.year_end,
    });
    
    if (error) {
      if (error.code === "23505") {
        console.log(`  ⏭️  ${gen.brand} ${gen.model} ${gen.name}: already exists`);
      } else {
        console.error(`  ❌ ${gen.brand} ${gen.model} ${gen.name}: ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${gen.brand} ${gen.model} ${gen.name}`);
    }
  }

  // Final count
  const { count: brandCount } = await supabase.from("brands").select("*", { count: "exact", head: true });
  const { count: genCount } = await supabase.from("generations").select("*", { count: "exact", head: true });
  
  console.log("\n" + "═".repeat(60));
  console.log("RESULTS");
  console.log("═".repeat(60));
  console.log(`\n📊 Total brands: ${brandCount}`);
  console.log(`📊 Total generations: ${genCount}`);
  console.log("\n✅ Done! Now re-run import scripts.");
}

addMissingBrands().catch(console.error);
