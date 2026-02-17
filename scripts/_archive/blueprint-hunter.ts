/**
 * BLUEPRINT HUNTER 📐
 * 
 * Recherche spécifique de:
 * - Blueprints / Plans techniques
 * - Coupes moteur (cutaway)
 * - Schémas électriques
 * - Diagrammes de suspension
 * - Vues éclatées (exploded view)
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'FLM-Auto-Research/1.0 (contact@flm-auto.com)' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// WIKIMEDIA BLUEPRINT SEARCH
// ============================================================
async function searchWikimediaBlueprints(brand: string, model: string): Promise<any[]> {
  const searchQueries = [
    // Specific technical terms
    `"${brand}" "${model}" blueprint`,
    `"${brand}" "${model}" cutaway`,
    `"${brand}" "${model}" technical drawing`,
    `"${brand}" "${model}" cross section`,
    `"${brand}" "${model}" exploded view`,
    `"${brand}" "${model}" diagram`,
    `"${brand}" "${model}" schematic`,
    // Generic brand searches for technical content
    `"${brand}" engine cutaway`,
    `"${brand}" chassis diagram`,
    `"${brand}" suspension`,
  ];
  
  const results: any[] = [];
  const seenUrls = new Set<string>();
  
  for (const query of searchQueries) {
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=5&format=json`;
      const data = await fetchJSON(url);
      
      for (const item of (data?.query?.search || [])) {
        const title = item.title;
        if (!title.match(/\.(jpg|jpeg|png|svg|gif)$/i)) continue;
        
        // Get image info
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json`;
        const infoData = await fetchJSON(infoUrl);
        
        const pages = infoData?.query?.pages || {};
        const page = Object.values(pages)[0] as any;
        const imageInfo = page?.imageinfo?.[0];
        
        if (imageInfo?.url && !seenUrls.has(imageInfo.url)) {
          seenUrls.add(imageInfo.url);
          
          // Determine type from title/query
          let type = 'technical';
          const lowerTitle = title.toLowerCase();
          if (lowerTitle.includes('blueprint')) type = 'blueprint';
          else if (lowerTitle.includes('cutaway') || lowerTitle.includes('cross section')) type = 'cutaway';
          else if (lowerTitle.includes('engine')) type = 'engine';
          else if (lowerTitle.includes('chassis') || lowerTitle.includes('suspension')) type = 'chassis';
          else if (lowerTitle.includes('exploded')) type = 'exploded_view';
          else if (lowerTitle.includes('diagram') || lowerTitle.includes('schematic')) type = 'diagram';
          else if (lowerTitle.includes('interior') || lowerTitle.includes('dashboard')) type = 'interior';
          
          results.push({
            url: imageInfo.url,
            thumbnail_url: imageInfo.url.includes('/commons/') 
              ? imageInfo.url.replace('/commons/', '/commons/thumb/').replace(/(\.[^.]+)$/, '$1/800px-' + title.replace('File:', '').replace(/ /g, '_'))
              : imageInfo.url,
            width: imageInfo.width,
            height: imageInfo.height,
            type,
            title: title.replace('File:', ''),
            license: imageInfo.extmetadata?.LicenseShortName?.value || 'CC',
            author: (imageInfo.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').substring(0, 100),
            source: 'Wikimedia Commons',
          });
        }
      }
      
      await sleep(150);
    } catch (e) {
      // Continue
    }
  }
  
  return results;
}

// ============================================================
// GENERIC AUTOMOTIVE TECHNICAL IMAGES
// ============================================================
const GENERIC_TECHNICAL_IMAGES = {
  'engine_4cyl_turbo': {
    type: 'engine_diagram',
    description: '4-cylinder turbocharged engine layout',
    components: ['turbocharger', 'intercooler', 'intake_manifold', 'exhaust_manifold', 'timing_chain'],
  },
  'engine_6cyl': {
    type: 'engine_diagram', 
    description: 'Inline-6 or V6 engine layout',
    components: ['cylinder_bank', 'crankshaft', 'camshafts', 'oil_system', 'cooling_system'],
  },
  'engine_v8': {
    type: 'engine_diagram',
    description: 'V8 engine with cross-plane crankshaft',
    components: ['cylinder_banks', 'intake_plenum', 'headers', 'oil_pan', 'timing_cover'],
  },
  'electric_motor': {
    type: 'motor_diagram',
    description: 'Permanent magnet synchronous motor (PMSM)',
    components: ['stator', 'rotor', 'inverter', 'reduction_gear', 'cooling_jacket'],
  },
  'battery_pack': {
    type: 'battery_diagram',
    description: 'Lithium-ion battery pack skateboard layout',
    components: ['modules', 'bms', 'cooling_plate', 'high_voltage_bus', 'contactors'],
  },
  'suspension_front_macpherson': {
    type: 'suspension_diagram',
    description: 'MacPherson strut front suspension',
    components: ['strut', 'spring', 'control_arm', 'steering_knuckle', 'anti_roll_bar'],
  },
  'suspension_front_double_wishbone': {
    type: 'suspension_diagram',
    description: 'Double wishbone front suspension',
    components: ['upper_arm', 'lower_arm', 'coilover', 'steering_arm', 'hub_carrier'],
  },
  'suspension_rear_multilink': {
    type: 'suspension_diagram',
    description: 'Multi-link rear suspension',
    components: ['trailing_arm', 'lateral_links', 'toe_link', 'spring', 'damper'],
  },
  'braking_system': {
    type: 'brake_diagram',
    description: 'Hydraulic braking system with ABS',
    components: ['master_cylinder', 'abs_module', 'brake_lines', 'calipers', 'rotors'],
  },
  'steering_eps': {
    type: 'steering_diagram',
    description: 'Electric power steering (EPS) system',
    components: ['steering_column', 'eps_motor', 'rack_pinion', 'tie_rods', 'steering_wheel'],
  },
  'transmission_dct': {
    type: 'transmission_diagram',
    description: 'Dual-clutch transmission (DCT)',
    components: ['dual_clutch', 'odd_gear_shaft', 'even_gear_shaft', 'mechatronics', 'diff'],
  },
  'transmission_torque_converter': {
    type: 'transmission_diagram',
    description: 'Torque converter automatic transmission',
    components: ['torque_converter', 'planetary_gears', 'valve_body', 'clutch_packs', 'output_shaft'],
  },
  'awd_system': {
    type: 'drivetrain_diagram',
    description: 'All-wheel drive system',
    components: ['transfer_case', 'front_diff', 'rear_diff', 'prop_shaft', 'cv_joints'],
  },
  'hvac_system': {
    type: 'hvac_diagram',
    description: 'Climate control system',
    components: ['compressor', 'condenser', 'evaporator', 'blower', 'heater_core'],
  },
  'electrical_12v': {
    type: 'electrical_diagram',
    description: '12V electrical system',
    components: ['battery', 'alternator', 'fuse_box', 'body_control_module', 'can_bus'],
  },
};

function assignGenericDiagrams(brand: string, model: string, segment: string): any[] {
  const diagrams: any[] = [];
  
  // Base diagrams for all vehicles
  diagrams.push(GENERIC_TECHNICAL_IMAGES['braking_system']);
  diagrams.push(GENERIC_TECHNICAL_IMAGES['steering_eps']);
  diagrams.push(GENERIC_TECHNICAL_IMAGES['electrical_12v']);
  diagrams.push(GENERIC_TECHNICAL_IMAGES['hvac_system']);
  
  // Segment-specific
  if (segment === 'electric') {
    diagrams.push(GENERIC_TECHNICAL_IMAGES['electric_motor']);
    diagrams.push(GENERIC_TECHNICAL_IMAGES['battery_pack']);
  } else {
    // ICE vehicles
    if (segment === 'sports' || segment === 'luxury') {
      diagrams.push(GENERIC_TECHNICAL_IMAGES['engine_6cyl']);
      diagrams.push(GENERIC_TECHNICAL_IMAGES['suspension_front_double_wishbone']);
    } else {
      diagrams.push(GENERIC_TECHNICAL_IMAGES['engine_4cyl_turbo']);
      diagrams.push(GENERIC_TECHNICAL_IMAGES['suspension_front_macpherson']);
    }
    diagrams.push(GENERIC_TECHNICAL_IMAGES['transmission_dct']);
  }
  
  diagrams.push(GENERIC_TECHNICAL_IMAGES['suspension_rear_multilink']);
  
  // AWD for SUVs and premium
  if (segment === 'suv' || ['BMW', 'Audi', 'Mercedes-Benz', 'Porsche'].includes(brand)) {
    diagrams.push(GENERIC_TECHNICAL_IMAGES['awd_system']);
  }
  
  return diagrams.map(d => ({ ...d, source: 'Technical Reference', generic: true }));
}

// ============================================================
// MAIN
// ============================================================
async function blueprintHunter() {
  console.log('📐 BLUEPRINT HUNTER - Technical Drawings & Schematics\n');
  console.log('═'.repeat(60));
  
  // Get all generations
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allGens = [...allGens, ...data];
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`📊 ${allGens.length} generations\n`);
  
  // Priority order
  const priorityBrands = ['BMW', 'Mercedes-Benz', 'Porsche', 'Audi', 'Tesla', 'Volkswagen', 'Toyota', 'Hyundai', 'Volvo'];
  const sortedGens = allGens.sort((a, b) => {
    const brandA = (a.model as any)?.brand?.name || '';
    const brandB = (b.model as any)?.brand?.name || '';
    return (priorityBrands.indexOf(brandA) === -1 ? 99 : priorityBrands.indexOf(brandA)) - 
           (priorityBrands.indexOf(brandB) === -1 ? 99 : priorityBrands.indexOf(brandB));
  });
  
  let processed = 0;
  let totalBlueprints = 0;
  let totalDiagrams = 0;
  const specsToInsert: any[] = [];
  
  for (const gen of sortedGens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brand = model.brand.name;
    const modelName = model.name;
    
    // Determine segment
    const nameLower = modelName.toLowerCase();
    let segment = 'standard';
    if (nameLower.includes('model') || nameLower.includes('ioniq') || nameLower.includes('id.') || nameLower.includes('taycan') || nameLower.includes('eq') || nameLower.includes('e-tron')) {
      segment = 'electric';
    } else if (nameLower.includes('x1') || nameLower.includes('x3') || nameLower.includes('x5') || nameLower.includes('gl') || nameLower.includes('q3') || nameLower.includes('q5') || nameLower.includes('q7') || nameLower.includes('cayenne') || nameLower.includes('macan') || nameLower.includes('tiguan') || nameLower.includes('touareg')) {
      segment = 'suv';
    } else if (nameLower.includes('911') || nameLower.includes('m3') || nameLower.includes('m4') || nameLower.includes('m5') || nameLower.includes('amg') || nameLower.includes('rs')) {
      segment = 'sports';
    } else if (nameLower.includes('s-class') || nameLower.includes('7 series') || nameLower.includes('a8')) {
      segment = 'luxury';
    }
    
    // Search Wikimedia for real blueprints
    const blueprints = await searchWikimediaBlueprints(brand, modelName);
    totalBlueprints += blueprints.length;
    
    // Add generic technical diagrams
    const diagrams = assignGenericDiagrams(brand, modelName, segment);
    totalDiagrams += diagrams.length;
    
    const allTechnical = [...blueprints, ...diagrams];
    
    specsToInsert.push({
      generation_id: gen.id,
      source: 'Blueprint Database',
      spec_type: 'blueprints_schematics',
      spec_value: allTechnical.length,
      raw_data: {
        total: allTechnical.length,
        real_blueprints: blueprints.length,
        generic_diagrams: diagrams.length,
        segment,
        items: allTechnical,
      },
    });
    
    processed++;
    const pct = ((processed / sortedGens.length) * 100).toFixed(1);
    process.stdout.write(`\r   [${pct}%] ${processed}/${sortedGens.length} | Blueprints: ${totalBlueprints} | Diagrams: ${totalDiagrams} | ${brand} ${modelName}        `);
    
    // Batch insert
    if (specsToInsert.length >= 100) {
      const batch = specsToInsert.splice(0, 100);
      await supabase.from('third_party_specs').upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    }
    
    await sleep(100);
  }
  
  // Final batch
  if (specsToInsert.length > 0) {
    await supabase.from('third_party_specs').upsert(specsToInsert, { onConflict: 'generation_id,source,spec_type' });
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('📐 BLUEPRINT HUNTER COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Generations: ${processed}`);
  console.log(`   Real blueprints found: ${totalBlueprints}`);
  console.log(`   Technical diagrams: ${totalDiagrams}`);
  console.log(`   Total third_party_specs: ${count}`);
}

blueprintHunter().catch(console.error);
