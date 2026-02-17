// model-aliases.ts - Bidirectional model name mapping for scrapers

export const MODEL_NORMALIZATIONS: Record<string, Record<string, string>> = {
  'BMW': {
    // Chassis codes → Model names
    'E06': '2000', 'E10': '2002', 'E20': '2002', 'E21': '3', 'E26': 'M1', 'E9': '3.0 CS',
    'E12': '5', 'E23': '7', 'E24': '6', 'E28': '5', 'E30': '3', 'E31': '8', 'E32': '7',
    'E34': '5', 'E36': '3', 'E38': '7', 'E39': '5', 'E46': '3', 'E53': 'X5', 'E60': '5',
    'E61': '5', 'E63': '6', 'E64': '6', 'E65': '7', 'E66': '7', 'E70': 'X5', 'E71': 'X6',
    'E81': '1', 'E82': '1', 'E83': 'X3', 'E84': 'X1', 'E85': 'Z4', 'E86': 'Z4', 'E87': '1',
    'E88': '1', 'E89': 'Z4', 'E90': '3', 'E91': '3', 'E92': '3', 'E93': '3',
    'F01': '7', 'F02': '7', 'F06': '6', 'F07': '5', 'F10': '5', 'F11': '5', 'F12': '6',
    'F13': '6', 'F15': 'X5', 'F16': 'X6', 'F20': '1', 'F21': '1', 'F22': '2', 'F23': '2',
    'F25': 'X3', 'F26': 'X4', 'F30': '3', 'F31': '3', 'F32': '4', 'F33': '4', 'F34': '3',
    'F36': '4', 'F39': 'X2', 'F40': '1', 'F44': '2', 'F45': '2', 'F46': '2', 'F48': 'X1',
    'F80': 'M3', 'F82': 'M4', 'F83': 'M4', 'F87': 'M2', 'F90': 'M5', 'F95': 'X5', 'F96': 'X6',
    'G01': 'X3', 'G02': 'X4', 'G05': 'X5', 'G06': 'X6', 'G07': 'X7', 'G09': 'XM',
    'G11': '7', 'G12': '7', 'G14': '8', 'G15': '8', 'G16': '8', 'G20': '3', 'G21': '3',
    'G22': '4', 'G23': '4', 'G26': 'i4', 'G29': 'Z4', 'G30': '5', 'G31': '5', 'G32': '6',
    'G42': '2', 'G45': 'X3', 'G60': '5', 'G61': '5', 'G70': '7', 'G80': 'M3', 'G81': 'M3',
    'G82': 'M4', 'G83': 'M4', 'G87': 'M2',
    'U06': '2', 'U10': 'X2', 'U11': 'X1', 'I01': 'i3', 'I20': 'iX',
    // Name variations (Series → number)
    '1 Series': '1', '1-Series': '1', 'Serie 1': '1', 'Série 1': '1', '1er': '1',
    '2 Series': '2', '2-Series': '2', 'Serie 2': '2', 'Série 2': '2', '2er': '2',
    '3 Series': '3', '3-Series': '3', 'Serie 3': '3', 'Série 3': '3', '3er': '3',
    '4 Series': '4', '4-Series': '4', 'Serie 4': '4', 'Série 4': '4', '4er': '4',
    '5 Series': '5', '5-Series': '5', 'Serie 5': '5', 'Série 5': '5', '5er': '5',
    '6 Series': '6', '6-Series': '6', 'Serie 6': '6', 'Série 6': '6', '6er': '6',
    '7 Series': '7', '7-Series': '7', 'Serie 7': '7', 'Série 7': '7', '7er': '7',
    '8 Series': '8', '8-Series': '8', 'Serie 8': '8', 'Série 8': '8', '8er': '8',
    'X1': 'X1', 'X2': 'X2', 'X3': 'X3', 'X4': 'X4', 'X5': 'X5', 'X6': 'X6', 'X7': 'X7',
    'Z4': 'Z4', 'Z3': 'Z3', 'Z8': 'Z8',
    'i3': 'i3', 'i4': 'i4', 'i5': 'i5', 'i7': 'i7', 'i8': 'i8', 'iX': 'iX', 'iX1': 'iX1', 'iX3': 'iX3',
    'M2': 'M2', 'M3': 'M3', 'M4': 'M4', 'M5': 'M5', 'M6': 'M6', 'M8': 'M8',
  },
  'Mercedes-Benz': {
    'A-Class': 'Classe A', 'A Class': 'Classe A', 'A-Klasse': 'Classe A',
    'B-Class': 'Classe B', 'B Class': 'Classe B', 'B-Klasse': 'Classe B',
    'C-Class': 'Classe C', 'C Class': 'Classe C', 'C-Klasse': 'Classe C',
    'E-Class': 'Classe E', 'E Class': 'Classe E', 'E-Klasse': 'Classe E',
    'G-Class': 'Classe G', 'G Class': 'Classe G', 'G-Klasse': 'Classe G',
    'S-Class': 'Classe S', 'S Class': 'Classe S', 'S-Klasse': 'Classe S',
    'V-Class': 'Classe V', 'V Class': 'Classe V', 'V-Klasse': 'Classe V',
    'M-Class': 'Classe M', 'M Class': 'Classe M', 'ML': 'Classe M',
    'R-Class': 'Classe R', 'R Class': 'Classe R',
    'GLA-Class': 'GLA', 'GLB-Class': 'GLB', 'GLC-Class': 'GLC', 'GLE-Class': 'GLE', 'GLS-Class': 'GLS',
  },
  'Audi': {
    'A 1': 'A1', 'A 2': 'A2', 'A 3': 'A3', 'A 4': 'A4', 'A 5': 'A5', 'A 6': 'A6', 'A 7': 'A7', 'A 8': 'A8',
    'Q 2': 'Q2', 'Q 3': 'Q3', 'Q 4': 'Q4', 'Q 5': 'Q5', 'Q 7': 'Q7', 'Q 8': 'Q8',
    'e-tron': 'e-tron', 'E-Tron': 'e-tron', 'etron': 'e-tron',
    'e-tron GT': 'e-tron GT', 'RS e-tron GT': 'RS e-tron GT',
    'TT': 'TT', 'R8': 'R8',
    'RS3': 'RS3', 'RS4': 'RS4', 'RS5': 'RS5', 'RS6': 'RS6', 'RS7': 'RS7',
    'S3': 'S3', 'S4': 'S4', 'S5': 'S5', 'S6': 'S6', 'S7': 'S7', 'S8': 'S8',
  },
  'Volkswagen': {
    'Golf': 'Golf', 'Polo': 'Polo', 'Passat': 'Passat', 'Tiguan': 'Tiguan', 'Touareg': 'Touareg',
    'T-Roc': 'T-Roc', 'T-Cross': 'T-Cross', 'Taigo': 'Taigo', 'Arteon': 'Arteon',
    'ID.3': 'ID.3', 'ID.4': 'ID.4', 'ID.5': 'ID.5', 'ID.7': 'ID.7', 'ID.Buzz': 'ID.Buzz',
    'ID3': 'ID.3', 'ID4': 'ID.4', 'ID5': 'ID.5', 'ID7': 'ID.7',
    'Up': 'up!', 'up': 'up!', 'Up!': 'up!',
  },
  'Porsche': {
    '911 Carrera': '911', '911 Turbo': '911', '911 GT3': '911', '911 Targa': '911',
    'Boxster': '718', 'Cayman': '718', '718 Boxster': '718', '718 Cayman': '718',
    'Panamera': 'Panamera', 'Cayenne': 'Cayenne', 'Macan': 'Macan', 'Taycan': 'Taycan',
  },
  'Volvo': {
    'S 60': 'S60', 'S 90': 'S90', 'V 60': 'V60', 'V 90': 'V90',
    'XC 40': 'XC40', 'XC 60': 'XC60', 'XC 90': 'XC90',
    'C 40': 'C40', 'EX 30': 'EX30', 'EX 90': 'EX90',
  },
  'Peugeot': {
    '208': '208', '308': '308', '408': '408', '508': '508',
    '2008': '2008', '3008': '3008', '5008': '5008',
    'e-208': 'e-208', 'e-308': 'e-308', 'e-2008': 'e-2008',
  },
  'Renault': {
    'Clio': 'Clio', 'Megane': 'Megane', 'Mégane': 'Megane',
    'Captur': 'Captur', 'Kadjar': 'Kadjar', 'Austral': 'Austral', 'Arkana': 'Arkana',
    'Scenic': 'Scenic', 'Scénic': 'Scenic',
    'Zoe': 'Zoe', 'Zoé': 'Zoe', 'ZOE': 'Zoe',
    'Megane E-Tech': 'Megane E-Tech', 'Mégane E-Tech': 'Megane E-Tech',
  },
};

/**
 * Normalize a model name to match our DB
 */
export function normalizeModelName(brand: string, modelName: string): string {
  // Clean input: remove brand prefix if present (handle variations)
  let cleaned = modelName
    .replace(/^(bmw|mercedes[- ]?benz|audi|volkswagen|vw|porsche|toyota|honda|volvo|hyundai|kia|skoda|tesla|ford|renault|peugeot|nissan|mazda|lexus|jaguar|mini|fiat|opel|seat|ferrari|lamborghini|land rover)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove chassis codes and year suffixes (e.g., "G20", "B9", "2024")
  cleaned = cleaned
    .replace(/\s+[A-Z]\d{1,2}$/i, '')      // G20, B9, F30
    .replace(/\s+\d{4}$/i, '')              // 2024, 2023
    .replace(/\s+(sedan|coupe|cabrio|cabriolet|wagon|touring|avant|sportback|allroad|limousine|estate|hatchback|suv|crossover)$/i, '')
    .trim();
  
  const brandMap = MODEL_NORMALIZATIONS[brand];
  if (!brandMap) return cleaned;
  
  // Direct match
  if (brandMap[cleaned]) return brandMap[cleaned];
  
  // Try case-insensitive
  const lowerName = cleaned.toLowerCase();
  for (const [key, value] of Object.entries(brandMap)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  // Try partial match (e.g., "3 Series Sedan" → "3")
  for (const [key, value] of Object.entries(brandMap)) {
    if (cleaned.toLowerCase().startsWith(key.toLowerCase())) {
      return value;
    }
  }
  
  return cleaned;
}

/**
 * Get all aliases for a DB model name (for searching external sources)
 */
export function getModelAliases(brand: string, dbModelName: string): string[] {
  const brandMap = MODEL_NORMALIZATIONS[brand];
  if (!brandMap) return [dbModelName];
  
  const aliases = [dbModelName];
  for (const [alias, normalized] of Object.entries(brandMap)) {
    if (normalized === dbModelName && alias !== dbModelName) {
      aliases.push(alias);
    }
  }
  return aliases;
}
