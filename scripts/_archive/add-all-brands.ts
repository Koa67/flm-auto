/**
 * FLM AUTO - Add missing brands and popular models
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BRANDS_AND_MODELS = [
  {
    brand: { name: 'Ferrari', country: 'Italy', founded: 1947 },
    models: [
      { name: '296', body: 'Coupe', start: 2022 },
      { name: '488', body: 'Coupe', start: 2015, end: 2019 },
      { name: 'F8', body: 'Coupe', start: 2019, end: 2022 },
      { name: 'SF90', body: 'Coupe', start: 2019 },
      { name: 'Roma', body: 'Coupe', start: 2020 },
      { name: 'Portofino', body: 'Convertible', start: 2017 },
      { name: 'Purosangue', body: 'SUV', start: 2022 },
      { name: '812', body: 'Coupe', start: 2017 },
      { name: 'LaFerrari', body: 'Coupe', start: 2013, end: 2018 },
      { name: '458', body: 'Coupe', start: 2009, end: 2015 },
      { name: 'California', body: 'Convertible', start: 2008, end: 2017 },
      { name: 'F12', body: 'Coupe', start: 2012, end: 2017 },
      { name: 'GTC4Lusso', body: 'Shooting Brake', start: 2016, end: 2020 },
    ]
  },
  {
    brand: { name: 'Ford', country: 'USA', founded: 1903 },
    models: [
      { name: 'Fiesta', body: 'Hatchback', start: 1976 },
      { name: 'Focus', body: 'Hatchback', start: 1998 },
      { name: 'Mondeo', body: 'Sedan', start: 1993 },
      { name: 'Mustang', body: 'Coupe', start: 1964 },
      { name: 'Mustang Mach-E', body: 'SUV', start: 2020 },
      { name: 'Puma', body: 'SUV', start: 2019 },
      { name: 'Kuga', body: 'SUV', start: 2008 },
      { name: 'Explorer', body: 'SUV', start: 1990 },
      { name: 'Ranger', body: 'Pickup', start: 1983 },
      { name: 'F-150', body: 'Pickup', start: 1975 },
      { name: 'Bronco', body: 'SUV', start: 2021 },
      { name: 'GT', body: 'Supercar', start: 2004 },
    ]
  },
  {
    brand: { name: 'Honda', country: 'Japan', founded: 1948 },
    models: [
      { name: 'Civic', body: 'Sedan', start: 1972 },
      { name: 'Accord', body: 'Sedan', start: 1976 },
      { name: 'CR-V', body: 'SUV', start: 1995 },
      { name: 'HR-V', body: 'SUV', start: 1998 },
      { name: 'Jazz', body: 'Hatchback', start: 2001 },
      { name: 'e', body: 'Hatchback', start: 2020 },
      { name: 'ZR-V', body: 'SUV', start: 2023 },
      { name: 'e:Ny1', body: 'SUV', start: 2023 },
      { name: 'NSX', body: 'Supercar', start: 1990, end: 2022 },
      { name: 'S2000', body: 'Roadster', start: 1999, end: 2009 },
      { name: 'Type R', body: 'Hatchback', start: 1997 },
    ]
  },
  {
    brand: { name: 'Toyota', country: 'Japan', founded: 1937 },
    models: [
      { name: 'Corolla', body: 'Sedan', start: 1966 },
      { name: 'Camry', body: 'Sedan', start: 1982 },
      { name: 'Yaris', body: 'Hatchback', start: 1999 },
      { name: 'RAV4', body: 'SUV', start: 1994 },
      { name: 'Land Cruiser', body: 'SUV', start: 1951 },
      { name: 'Prius', body: 'Hatchback', start: 1997 },
      { name: 'C-HR', body: 'SUV', start: 2016 },
      { name: 'Highlander', body: 'SUV', start: 2000 },
      { name: 'Supra', body: 'Coupe', start: 1978 },
      { name: 'GR86', body: 'Coupe', start: 2021 },
      { name: 'bZ4X', body: 'SUV', start: 2022 },
      { name: 'Aygo', body: 'Hatchback', start: 2005 },
    ]
  },
  {
    brand: { name: 'Nissan', country: 'Japan', founded: 1933 },
    models: [
      { name: 'Qashqai', body: 'SUV', start: 2006 },
      { name: 'Juke', body: 'SUV', start: 2010 },
      { name: 'X-Trail', body: 'SUV', start: 2000 },
      { name: 'Leaf', body: 'Hatchback', start: 2010 },
      { name: 'Ariya', body: 'SUV', start: 2022 },
      { name: 'Micra', body: 'Hatchback', start: 1982 },
      { name: 'GT-R', body: 'Coupe', start: 2007 },
      { name: '370Z', body: 'Coupe', start: 2008, end: 2020 },
      { name: 'Z', body: 'Coupe', start: 2022 },
      { name: 'Navara', body: 'Pickup', start: 1985 },
    ]
  },
  {
    brand: { name: 'Mazda', country: 'Japan', founded: 1920 },
    models: [
      { name: 'Mazda3', body: 'Hatchback', start: 2003 },
      { name: 'Mazda6', body: 'Sedan', start: 2002 },
      { name: 'CX-3', body: 'SUV', start: 2015 },
      { name: 'CX-30', body: 'SUV', start: 2019 },
      { name: 'CX-5', body: 'SUV', start: 2012 },
      { name: 'CX-60', body: 'SUV', start: 2022 },
      { name: 'CX-90', body: 'SUV', start: 2023 },
      { name: 'MX-5', body: 'Roadster', start: 1989 },
      { name: 'MX-30', body: 'SUV', start: 2020 },
      { name: 'RX-7', body: 'Coupe', start: 1978, end: 2002 },
      { name: 'RX-8', body: 'Coupe', start: 2003, end: 2012 },
    ]
  },
  {
    brand: { name: 'Kia', country: 'South Korea', founded: 1944 },
    models: [
      { name: 'Picanto', body: 'Hatchback', start: 2004 },
      { name: 'Rio', body: 'Hatchback', start: 2000 },
      { name: 'Ceed', body: 'Hatchback', start: 2006 },
      { name: 'Sportage', body: 'SUV', start: 1993 },
      { name: 'Sorento', body: 'SUV', start: 2002 },
      { name: 'Niro', body: 'SUV', start: 2016 },
      { name: 'EV6', body: 'SUV', start: 2021 },
      { name: 'EV9', body: 'SUV', start: 2023 },
      { name: 'Stinger', body: 'Sedan', start: 2017 },
      { name: 'Carnival', body: 'MPV', start: 1998 },
    ]
  },
  {
    brand: { name: 'Jaguar', country: 'UK', founded: 1922 },
    models: [
      { name: 'XE', body: 'Sedan', start: 2015 },
      { name: 'XF', body: 'Sedan', start: 2007 },
      { name: 'XJ', body: 'Sedan', start: 1968, end: 2019 },
      { name: 'F-Type', body: 'Coupe', start: 2013 },
      { name: 'F-Pace', body: 'SUV', start: 2016 },
      { name: 'E-Pace', body: 'SUV', start: 2017 },
      { name: 'I-Pace', body: 'SUV', start: 2018 },
    ]
  },
  {
    brand: { name: 'Land Rover', country: 'UK', founded: 1948 },
    models: [
      { name: 'Range Rover', body: 'SUV', start: 1970 },
      { name: 'Range Rover Sport', body: 'SUV', start: 2005 },
      { name: 'Range Rover Velar', body: 'SUV', start: 2017 },
      { name: 'Range Rover Evoque', body: 'SUV', start: 2011 },
      { name: 'Discovery', body: 'SUV', start: 1989 },
      { name: 'Discovery Sport', body: 'SUV', start: 2014 },
      { name: 'Defender', body: 'SUV', start: 1983 },
    ]
  },
  {
    brand: { name: 'Lexus', country: 'Japan', founded: 1989 },
    models: [
      { name: 'IS', body: 'Sedan', start: 1999 },
      { name: 'ES', body: 'Sedan', start: 1989 },
      { name: 'LS', body: 'Sedan', start: 1989 },
      { name: 'NX', body: 'SUV', start: 2014 },
      { name: 'RX', body: 'SUV', start: 1998 },
      { name: 'UX', body: 'SUV', start: 2018 },
      { name: 'LC', body: 'Coupe', start: 2017 },
      { name: 'LFA', body: 'Supercar', start: 2010, end: 2012 },
      { name: 'RZ', body: 'SUV', start: 2022 },
    ]
  },
  {
    brand: { name: 'Peugeot', country: 'France', founded: 1810 },
    models: [
      { name: '208', body: 'Hatchback', start: 2012 },
      { name: '308', body: 'Hatchback', start: 2007 },
      { name: '408', body: 'Sedan', start: 2022 },
      { name: '508', body: 'Sedan', start: 2010 },
      { name: '2008', body: 'SUV', start: 2013 },
      { name: '3008', body: 'SUV', start: 2008 },
      { name: '5008', body: 'SUV', start: 2009 },
      { name: 'e-208', body: 'Hatchback', start: 2019 },
      { name: 'e-2008', body: 'SUV', start: 2019 },
    ]
  },
  {
    brand: { name: 'Renault', country: 'France', founded: 1899 },
    models: [
      { name: 'Clio', body: 'Hatchback', start: 1990 },
      { name: 'Megane', body: 'Hatchback', start: 1995 },
      { name: 'Captur', body: 'SUV', start: 2013 },
      { name: 'Kadjar', body: 'SUV', start: 2015 },
      { name: 'Austral', body: 'SUV', start: 2022 },
      { name: 'Arkana', body: 'SUV', start: 2019 },
      { name: 'Scenic', body: 'MPV', start: 1996 },
      { name: 'Zoe', body: 'Hatchback', start: 2012 },
      { name: 'Megane E-Tech', body: 'SUV', start: 2022 },
      { name: 'Twingo', body: 'Hatchback', start: 1992 },
    ]
  },
  {
    brand: { name: 'Opel', country: 'Germany', founded: 1862 },
    models: [
      { name: 'Corsa', body: 'Hatchback', start: 1982 },
      { name: 'Astra', body: 'Hatchback', start: 1991 },
      { name: 'Insignia', body: 'Sedan', start: 2008 },
      { name: 'Mokka', body: 'SUV', start: 2012 },
      { name: 'Grandland', body: 'SUV', start: 2017 },
      { name: 'Crossland', body: 'SUV', start: 2017 },
      { name: 'Combo', body: 'MPV', start: 1994 },
      { name: 'Zafira', body: 'MPV', start: 1999 },
    ]
  },
  {
    brand: { name: 'Fiat', country: 'Italy', founded: 1899 },
    models: [
      { name: '500', body: 'Hatchback', start: 2007 },
      { name: '500X', body: 'SUV', start: 2014 },
      { name: '500e', body: 'Hatchback', start: 2020 },
      { name: 'Panda', body: 'Hatchback', start: 1980 },
      { name: 'Tipo', body: 'Hatchback', start: 2015 },
      { name: 'Punto', body: 'Hatchback', start: 1993, end: 2018 },
      { name: '124 Spider', body: 'Roadster', start: 2016 },
    ]
  },
  {
    brand: { name: 'Seat', country: 'Spain', founded: 1950 },
    models: [
      { name: 'Ibiza', body: 'Hatchback', start: 1984 },
      { name: 'Leon', body: 'Hatchback', start: 1998 },
      { name: 'Arona', body: 'SUV', start: 2017 },
      { name: 'Ateca', body: 'SUV', start: 2016 },
      { name: 'Tarraco', body: 'SUV', start: 2018 },
      { name: 'Cupra Formentor', body: 'SUV', start: 2020 },
      { name: 'Cupra Born', body: 'Hatchback', start: 2021 },
    ]
  },
  {
    brand: { name: 'Citroen', country: 'France', founded: 1919 },
    models: [
      { name: 'C3', body: 'Hatchback', start: 2002 },
      { name: 'C4', body: 'Hatchback', start: 2004 },
      { name: 'C5 X', body: 'Sedan', start: 2021 },
      { name: 'C3 Aircross', body: 'SUV', start: 2017 },
      { name: 'C4 Cactus', body: 'Hatchback', start: 2014 },
      { name: 'C5 Aircross', body: 'SUV', start: 2017 },
      { name: 'Berlingo', body: 'MPV', start: 1996 },
      { name: 'e-C4', body: 'Hatchback', start: 2020 },
    ]
  },
  {
    brand: { name: 'Mini', country: 'UK', founded: 1959 },
    models: [
      { name: 'Cooper', body: 'Hatchback', start: 2001 },
      { name: 'Clubman', body: 'Wagon', start: 2007 },
      { name: 'Countryman', body: 'SUV', start: 2010 },
      { name: 'Convertible', body: 'Convertible', start: 2004 },
      { name: 'Electric', body: 'Hatchback', start: 2020 },
      { name: 'Aceman', body: 'SUV', start: 2024 },
    ]
  },
  {
    brand: { name: 'Alfa Romeo', country: 'Italy', founded: 1910 },
    models: [
      { name: 'Giulia', body: 'Sedan', start: 2016 },
      { name: 'Stelvio', body: 'SUV', start: 2017 },
      { name: 'Tonale', body: 'SUV', start: 2022 },
      { name: 'Giulietta', body: 'Hatchback', start: 2010, end: 2020 },
      { name: '4C', body: 'Coupe', start: 2013, end: 2020 },
      { name: '8C', body: 'Coupe', start: 2007, end: 2010 },
    ]
  },
  {
    brand: { name: 'Maserati', country: 'Italy', founded: 1914 },
    models: [
      { name: 'Ghibli', body: 'Sedan', start: 2013 },
      { name: 'Quattroporte', body: 'Sedan', start: 1963 },
      { name: 'Levante', body: 'SUV', start: 2016 },
      { name: 'GranTurismo', body: 'Coupe', start: 2007 },
      { name: 'MC20', body: 'Supercar', start: 2020 },
      { name: 'Grecale', body: 'SUV', start: 2022 },
    ]
  },
  {
    brand: { name: 'Aston Martin', country: 'UK', founded: 1913 },
    models: [
      { name: 'Vantage', body: 'Coupe', start: 2005 },
      { name: 'DB11', body: 'Coupe', start: 2016 },
      { name: 'DB12', body: 'Coupe', start: 2023 },
      { name: 'DBS', body: 'Coupe', start: 2007 },
      { name: 'DBX', body: 'SUV', start: 2020 },
      { name: 'Valkyrie', body: 'Hypercar', start: 2021 },
    ]
  },
  {
    brand: { name: 'Bentley', country: 'UK', founded: 1919 },
    models: [
      { name: 'Continental GT', body: 'Coupe', start: 2003 },
      { name: 'Flying Spur', body: 'Sedan', start: 2005 },
      { name: 'Bentayga', body: 'SUV', start: 2016 },
      { name: 'Mulsanne', body: 'Sedan', start: 2010, end: 2020 },
    ]
  },
  {
    brand: { name: 'Rolls-Royce', country: 'UK', founded: 1906 },
    models: [
      { name: 'Ghost', body: 'Sedan', start: 2009 },
      { name: 'Phantom', body: 'Sedan', start: 2003 },
      { name: 'Wraith', body: 'Coupe', start: 2013 },
      { name: 'Dawn', body: 'Convertible', start: 2015 },
      { name: 'Cullinan', body: 'SUV', start: 2018 },
      { name: 'Spectre', body: 'Coupe', start: 2023 },
    ]
  },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🚀 FLM AUTO - Add Missing Brands & Models\n');
  
  // Get existing brands
  const { data: existingBrands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(existingBrands?.map(b => [b.name.toLowerCase(), b.id]) || []);
  
  console.log(`📋 Existing brands: ${existingBrands?.length}\n`);
  
  let brandsAdded = 0;
  let modelsAdded = 0;
  let gensAdded = 0;
  
  for (const item of BRANDS_AND_MODELS) {
    let brandId = brandMap.get(item.brand.name.toLowerCase());
    
    // Add brand if missing
    if (!brandId) {
      const { data: newBrand, error } = await supabase
        .from('brands')
        .insert({
          name: item.brand.name,
          slug: slugify(item.brand.name),
        })
        .select()
        .single();
      
      if (error) {
        console.log(`   ❌ Brand ${item.brand.name}: ${error.message}`);
        continue;
      }
      
      brandId = newBrand.id;
      brandMap.set(item.brand.name.toLowerCase(), brandId);
      brandsAdded++;
      console.log(`✅ Added brand: ${item.brand.name}`);
    } else {
      console.log(`⏭️ Brand exists: ${item.brand.name}`);
    }
    
    // Add models
    for (const model of item.models) {
      // Check if model exists
      const { data: existingModel } = await supabase
        .from('models')
        .select('id')
        .eq('brand_id', brandId)
        .ilike('name', model.name)
        .single();
      
      let modelId: string;
      
      if (existingModel) {
        modelId = existingModel.id;
      } else {
        const { data: newModel, error } = await supabase
          .from('models')
          .insert({
            brand_id: brandId,
            name: model.name,
            slug: slugify(`${item.brand.name}-${model.name}`),
          })
          .select()
          .single();
        
        if (error) {
          continue;
        }
        
        modelId = newModel.id;
        modelsAdded++;
      }
      
      // Add generation
      const genName = model.end ? `${model.start}-${model.end}` : `${model.start}-present`;
      
      const { data: existingGen } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', modelId)
        .limit(1);
      
      if (!existingGen || existingGen.length === 0) {
        const { error: genError } = await supabase
          .from('generations')
          .insert({
            model_id: modelId,
            name: genName,
            slug: slugify(`${model.name}-${model.start}`),
            production_start: `${model.start}-01-01`,
            production_end: model.end ? `${model.end}-12-31` : null,
            body_style: model.body,
          });
        
        if (!genError) gensAdded++;
      }
    }
  }
  
  // Final counts
  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: modelCount } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: genCount } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Results:');
  console.log('═'.repeat(50));
  console.log(`   Brands added: ${brandsAdded}`);
  console.log(`   Models added: ${modelsAdded}`);
  console.log(`   Generations added: ${gensAdded}`);
  console.log('\n📊 DB Totals:');
  console.log(`   Brands: ${brandCount}`);
  console.log(`   Models: ${modelCount}`);
  console.log(`   Generations: ${genCount}`);
}

main().catch(console.error);
