import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

// Mercedes chassis codes → Model names (COMPLETE)
const MERCEDES_CHASSIS_MAP: Record<string, string> = {
  // === MODERN (2000+) ===
  // Classe A
  'W168': 'Classe A', 'W169': 'Classe A', 'W176': 'Classe A', 'W177': 'Classe A',
  'V177': 'Classe A Berline',
  // Classe B
  'W245': 'Classe B', 'W246': 'Classe B', 'W247': 'Classe B',
  // Classe C
  'W202': 'Classe C', 'W203': 'Classe C', 'W204': 'Classe C', 'W205': 'Classe C', 'W206': 'Classe C',
  'C204': 'Classe C Coupé', 'C205': 'Classe C Coupé', 'C206': 'Classe C Coupé',
  'S204': 'Classe C Break', 'S205': 'Classe C Break', 'S206': 'Classe C Break',
  'A205': 'Classe C Cabriolet',
  // Classe E
  'W210': 'Classe E', 'W211': 'Classe E', 'W212': 'Classe E', 'W213': 'Classe E', 'W214': 'Classe E',
  'C207': 'Classe E Coupé', 'C238': 'Classe E Coupé',
  'A207': 'Classe E Cabriolet', 'A238': 'Classe E Cabriolet',
  'S210': 'Classe E Break', 'S211': 'Classe E Break', 'S212': 'Classe E Break', 'S213': 'Classe E Break',
  // Classe S
  'W220': 'Classe S', 'W221': 'Classe S', 'W222': 'Classe S', 'W223': 'Classe S',
  'X222': 'Classe S Maybach',
  'C215': 'CL', 'C216': 'CL', 'C217': 'Classe S Coupé',
  'A217': 'Classe S Cabriolet',
  // CLA
  'C117': 'CLA', 'C118': 'CLA', 'C174': 'CLA',
  'X117': 'CLA Shooting Brake', 'X118': 'CLA Shooting Brake', 'X174': 'CLA Shooting Brake',
  // CLS
  'C219': 'CLS', 'C218': 'CLS', 'C257': 'CLS', 'W257': 'CLS',
  'X218': 'CLS Shooting Brake',
  // CLK
  'W208': 'CLK', 'W209': 'CLK',
  // GLA/GLB
  'X156': 'GLA', 'H247': 'GLA',
  'X247': 'GLB',
  // GLC
  'X253': 'GLC', 'X254': 'GLC',
  'C253': 'GLC Coupé', 'C254': 'GLC Coupé',
  // GLK
  'X204': 'GLK',
  // GLE/ML
  'W163': 'Classe M', 'W164': 'Classe M', 'W166': 'GLE', 'V167': 'GLE', 'W167': 'GLE',
  'C292': 'GLE Coupé', 'C167': 'GLE Coupé',
  // GLS/GL
  'X164': 'GL', 'X166': 'GLS', 'X167': 'GLS',
  // Classe R
  'W251': 'Classe R',
  // Classe G
  'W460': 'Classe G', 'W461': 'Classe G', 'W463': 'Classe G', 'W464': 'Classe G', 'W465': 'Classe G',
  // Classe V/Viano/Vito
  'W415': 'Citan', 'W447': 'Classe V', 'W638': 'Vito', 'W639': 'Viano',
  // AMG GT
  'C190': 'AMG GT', 'C192': 'AMG GT', 'R190': 'AMG GT Roadster',
  // SL
  'R129': 'SL', 'R230': 'SL', 'R231': 'SL', 'R232': 'SL',
  // SLK/SLC
  'R170': 'SLK', 'R171': 'SLK', 'R172': 'SLC', 'R173': 'SLC',
  // SLR/SLS
  'C199': 'SLR McLaren', 'C197': 'SLS AMG',
  // EQ
  'V295': 'EQE', 'X294': 'EQE SUV',
  'V297': 'EQS', 'X296': 'EQS SUV',
  'H243': 'EQA', 'X243': 'EQB',
  'N293': 'EQC',
  // CLE
  'C236': 'CLE Coupé', 'A236': 'CLE Cabriolet',
  // Maybach
  'W420': 'Maybach Classe S',
  // AMG One
  'E63': 'AMG One',
  
  // === CLASSIC (Pre-2000) ===
  // 190 (W201)
  'W201': '190',
  // W124 (E-Class predecessor)
  'W124': 'W124 (Classe E)',
  // W140 (S-Class 1991-1998)
  'W140': 'Classe S (W140)',
  // W126 (S-Class 1979-1991)
  'W126': 'Classe S (W126)',
  // W123 (E-Class 1976-1985)
  'W123': 'W123',
  // W116 (S-Class 1972-1980)
  'W116': 'Classe S (W116)',
  // SL Classic
  'C107': 'SLC', 'R107': 'SL',
  // W115/W114 (/8)
  'W114': '/8', 'W115': '/8',
  // W108/W109 (S-Class predecessor)
  'W108': 'W108', 'W109': 'W109',
  // Pagode
  'W113': 'Pagode SL',
  // 600
  'W100': '600 Grosser',
  // Fintail
  'W110': 'Fintail', 'W111': 'Fintail', 'W112': 'Fintail',
  // Ponton
  'W105': 'Ponton', 'W120': 'Ponton', 'W121': 'Ponton', 'W128': 'Ponton', 'W180': 'Ponton',
  // 300 SL
  'W198': '300 SL',
  // Pre-war & early post-war
  'W186': '300', 'W187': '220', 'W188': '300 S', 'W189': '300d',
  'W157': '300 SC',
  'W136': '170', 'W138': '230', 'W142': '320', 'W143': '230',
  'W129': '150',
  
  // Default
  'Default': 'Autres',
};

async function fixModelNames() {
  console.log('🔧 FIXING MODEL NAMES (COMPLETE MAP)\n');
  console.log('═'.repeat(60));
  
  const { data: mercedesBrand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();
  
  if (!mercedesBrand) {
    console.log('Mercedes-Benz brand not found');
    return;
  }
  
  const { data: mercedesModel } = await supabase
    .from('models')
    .select('id')
    .eq('name', 'Mercedes')
    .eq('brand_id', mercedesBrand.id)
    .single();
  
  if (!mercedesModel) {
    console.log('No generic "Mercedes" model found (already fixed?)');
    return;
  }
  
  const { data: mercedesGens } = await supabase
    .from('generations')
    .select('id, name')
    .eq('model_id', mercedesModel.id);
  
  console.log(`\n📦 MERCEDES-BENZ`);
  console.log(`   Generations to fix: ${mercedesGens?.length || 0}`);
  
  let fixed = 0;
  let unknown: string[] = [];
  const created: Record<string, string> = {};
  
  for (const gen of mercedesGens || []) {
    const chassis = gen.name;
    const modelName = MERCEDES_CHASSIS_MAP[chassis];
    
    if (modelName && modelName !== 'Autres') {
      if (!created[modelName]) {
        const { data: existing } = await supabase
          .from('models')
          .select('id')
          .eq('brand_id', mercedesBrand.id)
          .eq('name', modelName)
          .single();
        
        if (existing) {
          created[modelName] = existing.id;
        } else {
          const { data: newModel } = await supabase
            .from('models')
            .insert({ brand_id: mercedesBrand.id, name: modelName })
            .select('id')
            .single();
          
          if (newModel) {
            created[modelName] = newModel.id;
            console.log(`   ✅ Created: ${modelName}`);
          }
        }
      }
      
      if (created[modelName]) {
        await supabase
          .from('generations')
          .update({ model_id: created[modelName] })
          .eq('id', gen.id);
        fixed++;
      }
    } else {
      unknown.push(chassis);
    }
  }
  
  console.log(`\n   Fixed: ${fixed} generations`);
  console.log(`   New models created: ${Object.keys(created).length}`);
  
  if (unknown.length > 0) {
    console.log(`   ⚠️ Still unknown: ${unknown.join(', ')}`);
  }
  
  const { count } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('model_id', mercedesModel.id);
  
  if (count === 0) {
    await supabase.from('models').delete().eq('id', mercedesModel.id);
    console.log(`   🗑️ Deleted empty "Mercedes" model`);
  } else {
    console.log(`   ℹ️ ${count} generations still orphaned`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ MERCEDES FIX COMPLETE');
}

fixModelNames();
