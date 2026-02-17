import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

// Mercedes chassis codes → Model names (COMPLETE)
const MERCEDES_CHASSIS_MAP: Record<string, string> = {
  // === MODERN (2000+) ===
  'W168': 'Classe A', 'W169': 'Classe A', 'W176': 'Classe A', 'W177': 'Classe A',
  'V177': 'Classe A Berline',
  'W245': 'Classe B', 'W246': 'Classe B', 'W247': 'Classe B',
  'W202': 'Classe C', 'W203': 'Classe C', 'W204': 'Classe C', 'W205': 'Classe C', 'W206': 'Classe C',
  'C204': 'Classe C Coupé', 'C205': 'Classe C Coupé', 'C206': 'Classe C Coupé',
  'S204': 'Classe C Break', 'S205': 'Classe C Break', 'S206': 'Classe C Break',
  'A205': 'Classe C Cabriolet',
  'W210': 'Classe E', 'W211': 'Classe E', 'W212': 'Classe E', 'W213': 'Classe E', 'W214': 'Classe E',
  'C207': 'Classe E Coupé', 'C238': 'Classe E Coupé',
  'A207': 'Classe E Cabriolet', 'A238': 'Classe E Cabriolet',
  'S210': 'Classe E Break', 'S211': 'Classe E Break', 'S212': 'Classe E Break', 'S213': 'Classe E Break',
  'W220': 'Classe S', 'W221': 'Classe S', 'W222': 'Classe S', 'W223': 'Classe S',
  'X222': 'Classe S Maybach',
  'C215': 'CL', 'C216': 'CL', 'C217': 'Classe S Coupé',
  'A217': 'Classe S Cabriolet',
  'C117': 'CLA', 'C118': 'CLA', 'C174': 'CLA',
  'X117': 'CLA Shooting Brake', 'X118': 'CLA Shooting Brake', 'X174': 'CLA Shooting Brake',
  'C219': 'CLS', 'C218': 'CLS', 'C257': 'CLS', 'W257': 'CLS',
  'X218': 'CLS Shooting Brake',
  'W208': 'CLK', 'W209': 'CLK',
  'X156': 'GLA', 'H247': 'GLA',
  'X247': 'GLB',
  'X253': 'GLC', 'X254': 'GLC',
  'C253': 'GLC Coupé', 'C254': 'GLC Coupé',
  'X204': 'GLK',
  'W163': 'Classe M', 'W164': 'Classe M', 'W166': 'GLE', 'V167': 'GLE', 'W167': 'GLE',
  'C292': 'GLE Coupé', 'C167': 'GLE Coupé',
  'X164': 'GL', 'X166': 'GLS', 'X167': 'GLS',
  'W251': 'Classe R',
  'W460': 'Classe G', 'W461': 'Classe G', 'W463': 'Classe G', 'W464': 'Classe G', 'W465': 'Classe G',
  'W415': 'Citan', 'W447': 'Classe V', 'W638': 'Vito', 'W639': 'Viano',
  'C190': 'AMG GT', 'C192': 'AMG GT', 'R190': 'AMG GT Roadster',
  'R129': 'SL', 'R230': 'SL', 'R231': 'SL', 'R232': 'SL',
  'R170': 'SLK', 'R171': 'SLK', 'R172': 'SLC', 'R173': 'SLC',
  'C199': 'SLR McLaren', 'C197': 'SLS AMG',
  'V295': 'EQE', 'X294': 'EQE SUV',
  'V297': 'EQS', 'X296': 'EQS SUV',
  'H243': 'EQA', 'X243': 'EQB',
  'N293': 'EQC',
  'C236': 'CLE Coupé', 'A236': 'CLE Cabriolet',
  'W420': 'Maybach Classe S',
  // === CLASSIC ===
  'W201': '190',
  'W124': 'W124',
  'W140': 'Classe S',
  'W126': 'Classe S',
  'W123': 'W123',
  'W116': 'Classe S',
  'C107': 'SLC', 'R107': 'SL',
  'W114': 'W114/W115', 'W115': 'W114/W115',
  'W108': 'W108/W109', 'W109': 'W108/W109',
  'W113': 'Pagode',
  'W100': '600',
  'W110': 'W110/W111/W112', 'W111': 'W110/W111/W112', 'W112': 'W110/W111/W112',
  'W105': 'Ponton', 'W120': 'Ponton', 'W121': 'Ponton', 'W128': 'Ponton', 'W180': 'Ponton',
  'W198': '300 SL',
  'W186': '300', 'W187': '220', 'W188': '300 S', 'W189': '300d',
  'W157': '300 SC',
  'W136': '170', 'W138': '230', 'W142': '320', 'W143': '230',
  'W129': '150',
};

async function fixAll() {
  console.log('🔧 FIXING ALL MERCEDES GENERATIONS\n');
  
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();
  
  const { data: mercedesModel } = await supabase
    .from('models')
    .select('id')
    .eq('name', 'Mercedes')
    .eq('brand_id', brand!.id)
    .single();
  
  if (!mercedesModel) {
    console.log('No generic "Mercedes" model');
    return;
  }
  
  // Get ALL 109 generations
  const { data: gens } = await supabase
    .from('generations')
    .select('id, name, slug, chassis_code')
    .eq('model_id', mercedesModel.id);
  
  console.log(`Found ${gens?.length} orphan generations\n`);
  
  // List unique names
  const names = [...new Set(gens?.map(g => g.name))].sort();
  console.log('Unique names:', names.join(', '));
  console.log('');
  
  let fixed = 0;
  let unknown: string[] = [];
  const modelCache: Record<string, string> = {};
  
  for (const gen of gens || []) {
    // Try name first, then chassis_code, then slug
    const code = gen.name !== 'Default' ? gen.name : (gen.chassis_code || gen.slug?.toUpperCase());
    const modelName = MERCEDES_CHASSIS_MAP[code];
    
    if (modelName) {
      // Get or create model
      if (!modelCache[modelName]) {
        const { data: existing } = await supabase
          .from('models')
          .select('id')
          .eq('brand_id', brand!.id)
          .eq('name', modelName)
          .single();
        
        if (existing) {
          modelCache[modelName] = existing.id;
        } else {
          const { data: newModel } = await supabase
            .from('models')
            .insert({ brand_id: brand!.id, name: modelName })
            .select('id')
            .single();
          if (newModel) {
            modelCache[modelName] = newModel.id;
            console.log(`✅ Created: ${modelName}`);
          }
        }
      }
      
      if (modelCache[modelName]) {
        await supabase
          .from('generations')
          .update({ model_id: modelCache[modelName] })
          .eq('id', gen.id);
        fixed++;
      }
    } else {
      if (!unknown.includes(code || 'NULL')) {
        unknown.push(code || 'NULL');
      }
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`⚠️ Unknown codes: ${unknown.join(', ')}`);
  
  // Check remaining
  const { count } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('model_id', mercedesModel.id);
  
  if (count === 0) {
    await supabase.from('models').delete().eq('id', mercedesModel.id);
    console.log(`🗑️ Deleted "Mercedes" model`);
  } else {
    console.log(`ℹ️ ${count} still orphaned`);
  }
}

fixAll();
