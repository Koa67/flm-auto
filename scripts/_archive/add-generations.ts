/**
 * FLM AUTO - Add generations for new models (date format fix)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MODELS_GENS = [
  { brand: 'Mercedes-Benz', model: 'GLC', gens: [{ name: 'X253', start: 2015, end: 2022 }, { name: 'X254', start: 2022, end: null }] },
  { brand: 'Mercedes-Benz', model: 'GLK', gens: [{ name: 'X204', start: 2008, end: 2015 }] },
  { brand: 'Mercedes-Benz', model: 'CLS', gens: [{ name: 'C219', start: 2004, end: 2010 }, { name: 'C218', start: 2011, end: 2017 }, { name: 'C257', start: 2018, end: null }] },
  
  { brand: 'Tesla', model: 'Model 3', gens: [{ name: 'Gen 1', start: 2017, end: null }] },
  { brand: 'Tesla', model: 'Model S', gens: [{ name: 'Gen 1', start: 2012, end: null }] },
  { brand: 'Tesla', model: 'Model X', gens: [{ name: 'Gen 1', start: 2015, end: null }] },
  { brand: 'Tesla', model: 'Model Y', gens: [{ name: 'Gen 1', start: 2020, end: null }] },
  
  { brand: 'Hyundai', model: 'i10', gens: [{ name: 'PA', start: 2007, end: 2013 }, { name: 'IA', start: 2013, end: 2019 }, { name: 'AC3', start: 2019, end: null }] },
  { brand: 'Hyundai', model: 'i20', gens: [{ name: 'PB', start: 2008, end: 2014 }, { name: 'GB', start: 2014, end: 2020 }, { name: 'BC3', start: 2020, end: null }] },
  { brand: 'Hyundai', model: 'i30', gens: [{ name: 'FD', start: 2007, end: 2011 }, { name: 'GD', start: 2011, end: 2017 }, { name: 'PD', start: 2017, end: null }] },
  { brand: 'Hyundai', model: 'ix20', gens: [{ name: 'JC', start: 2010, end: 2019 }] },
  { brand: 'Hyundai', model: 'ix35', gens: [{ name: 'LM', start: 2009, end: 2015 }] },
  { brand: 'Hyundai', model: 'Tucson', gens: [{ name: 'JM', start: 2004, end: 2009 }, { name: 'TL', start: 2015, end: 2020 }, { name: 'NX4', start: 2020, end: null }] },
  { brand: 'Hyundai', model: 'Kona', gens: [{ name: 'OS', start: 2017, end: 2023 }, { name: 'SX2', start: 2023, end: null }] },
  { brand: 'Hyundai', model: 'Kona Electric', gens: [{ name: 'OS EV', start: 2018, end: 2023 }, { name: 'SX2 EV', start: 2023, end: null }] },
  { brand: 'Hyundai', model: 'Ioniq', gens: [{ name: 'AE', start: 2016, end: 2022 }] },
  { brand: 'Hyundai', model: 'Ioniq 5', gens: [{ name: 'NE', start: 2021, end: null }] },
  { brand: 'Hyundai', model: 'Ioniq 6', gens: [{ name: 'CE', start: 2022, end: null }] },
  { brand: 'Hyundai', model: 'Santa Fe', gens: [{ name: 'SM', start: 2000, end: 2006 }, { name: 'CM', start: 2006, end: 2012 }, { name: 'DM', start: 2012, end: 2018 }, { name: 'TM', start: 2018, end: null }] },
  
  { brand: 'Volvo', model: 'XC40', gens: [{ name: 'Gen 1', start: 2017, end: null }] },
  { brand: 'Volvo', model: 'XC60', gens: [{ name: 'Y20', start: 2008, end: 2017 }, { name: 'SPA', start: 2017, end: null }] },
  { brand: 'Volvo', model: 'XC90', gens: [{ name: 'Gen 1', start: 2002, end: 2014 }, { name: 'SPA', start: 2015, end: null }] },
  { brand: 'Volvo', model: 'V40', gens: [{ name: 'Gen 2', start: 2012, end: 2019 }] },
  { brand: 'Volvo', model: 'V60', gens: [{ name: 'Gen 1', start: 2010, end: 2018 }, { name: 'SPA', start: 2018, end: null }] },
  { brand: 'Volvo', model: 'V90', gens: [{ name: 'SPA', start: 2016, end: null }] },
  { brand: 'Volvo', model: 'S60', gens: [{ name: 'Gen 1', start: 2000, end: 2009 }, { name: 'Gen 2', start: 2010, end: 2018 }, { name: 'SPA', start: 2018, end: null }] },
  { brand: 'Volvo', model: 'S90', gens: [{ name: 'SPA', start: 2016, end: null }] },
  { brand: 'Volvo', model: 'C40', gens: [{ name: 'Gen 1', start: 2021, end: null }] },
  { brand: 'Volvo', model: 'EX30', gens: [{ name: 'Gen 1', start: 2023, end: null }] },
  { brand: 'Volvo', model: 'EX90', gens: [{ name: 'Gen 1', start: 2024, end: null }] },
  
  { brand: 'Volkswagen', model: 'Golf Plus', gens: [{ name: 'Gen 1', start: 2004, end: 2014 }] },
  { brand: 'Volkswagen', model: 'Golf Sportsvan', gens: [{ name: 'Gen 1', start: 2014, end: 2020 }] },
  { brand: 'Volkswagen', model: 'e-Golf', gens: [{ name: 'Gen 1', start: 2014, end: 2020 }] },
  { brand: 'Volkswagen', model: 'e-Up!', gens: [{ name: 'Gen 1', start: 2013, end: 2023 }] },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🚀 FLM AUTO - Add Generations\n');
  
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(brands?.map(b => [b.name, b.id]) || []);
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  
  let added = 0;
  
  for (const item of MODELS_GENS) {
    const brandId = brandMap.get(item.brand);
    if (!brandId) continue;
    
    const model = models?.find(m => m.brand_id === brandId && m.name === item.model);
    if (!model) {
      console.log(`⚠️ Model not found: ${item.brand} ${item.model}`);
      continue;
    }
    
    for (const gen of item.gens) {
      const genSlug = slugify(`${item.model}-${gen.name}-${gen.start}`);
      
      const { error } = await supabase
        .from('generations')
        .insert({
          model_id: model.id,
          name: gen.name,
          slug: genSlug,
          production_start: gen.start ? `${gen.start}-01-01` : null,
          production_end: gen.end ? `${gen.end}-12-31` : null,
        });
      
      if (error) {
        if (error.message.includes('duplicate')) {
          console.log(`⏭️ Exists: ${item.brand} ${item.model} ${gen.name}`);
        } else {
          console.error(`❌ Error: ${item.brand} ${item.model} ${gen.name}:`, error.message);
        }
      } else {
        console.log(`✅ Added: ${item.brand} ${item.model} ${gen.name} (${gen.start}-${gen.end || 'present'})`);
        added++;
      }
    }
  }
  
  console.log(`\n📊 Added ${added} generations`);
  
  const { count } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total generations: ${count}`);
}

main().catch(console.error);
