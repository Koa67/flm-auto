/**
 * FLM AUTO — Body Type Tagger
 * 
 * Assigns body_type to generations based on:
 * 1. Existing spec_type='body_style' in third_party_specs
 * 2. Model name heuristics (SUV keywords, known patterns)
 * 3. Generation name patterns
 * 
 * Body types: sedan, suv, hatchback, wagon, coupe, cabriolet, minivan, pickup, sports
 * 
 * Usage: npx ts-node tag-body-types.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const DRY_RUN = process.argv.includes('--dry-run');

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.log(`  paginate error on ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

type BodyType = 'sedan' | 'suv' | 'hatchback' | 'wagon' | 'coupe' | 'cabriolet' | 'minivan' | 'pickup' | 'sports';

// Keywords → body type (order matters: first match wins)
const BODY_KEYWORDS: [RegExp, BodyType][] = [
  // Specific model overrides
  [/\b(f[- ]?150|silverado|ranger|tacoma|tundra|hilux|amarok|navara|frontier|titan|colorado|ridgeline|maverick|santa cruz|pickup|pick-up)\b/i, 'pickup'],
  [/\b(mustang|camaro|corvette|911|cayman|boxster|718|gt[- ]?r|nsx|supra|mx[- ]?5|miata|z4|z3|slk|slc|f[- ]?type|vantage|db11|db12|dbs|mc20|huracan|huracán|aventador|gallardo|murcielago|murciélago|revuelto|temerario|diablo|countach|458|488|f8|812|296|sf90|laferrari|roma|portofino|california|gtc4|r8|tt|lfa|lc|rc[- ]f|amg[- ]gt|i8|m2|m4)\b/i, 'sports'],
  [/\b(cabrio|cabriolet|convertible|roadster|spider|spyder|targa|drop[- ]?top|dawn)\b/i, 'cabriolet'],
  [/\b(coupé|coupe|fastback|gran turismo|granturismo|gran coupe|gran coupé)\b/i, 'coupe'],
  [/\b(pickup|pick[- ]?up|truck|cab)\b/i, 'pickup'],
  [/\b(van|minivan|monospace|mpv|space|ludospace|berlingo|kangoo|caddy|partner|rifter|combo|vito|caravelle|multivan|transporter|staria|carnival|sedona|sharan|touran|alhambra|galaxy|s[- ]?max|zafira|scenic|espace|carens|sienna|odyssey|alphard|vellfire|noah|voxy|serena)\b/i, 'minivan'],
  [/\b(suv|crossover|x[1-7]|xm|glb|glc|gle|gls|gla|eqa|eqb|eqc|eqe[- ]suv|eqs[- ]suv|q[2-8]|sq[2-8]|e[- ]?tron|cayenne|macan|urus|purosangue|levante|grecale|dbx|bentayga|cullinan|tucson|kona|ioniq[- ]5|bayon|creta|santa[- ]fe|venue|palisade|sportage|sorento|niro|ev6|ev9|seltos|stonic|telluride|qashqai|juke|x[- ]?trail|ariya|rogue|pathfinder|murano|kicks|cx[- ]?\d|rav4|highlander|4runner|fortuner|land[- ]?cruiser|c[- ]?hr|bz4x|cr[- ]?v|hr[- ]?v|zr[- ]?v|pilot|passport|xc\d0|ex\d0|ex30|c40|tiguan|t[- ]?roc|t[- ]?cross|touareg|taigo|tayron|id\.[45]|karoq|kodiaq|kamiq|enyaq|elroq|ateca|tarraco|arona|formentor|2008|3008|5008|c3[- ]aircross|c4[- ]aircross|c5[- ]aircross|captur|kadjar|austral|arkana|mokka|grandland|crossland|countryman|stelvio|tonale|f[- ]?pace|e[- ]?pace|discovery|defender|range[- ]rover|velar|evoque)\b/i, 'suv'],
  [/\b(break|wagon|estate|touring|avant|variant|sportwagon|sw|sport tourer|shooting brake|alltrack|cross country|v60|v90|v40|v50|v70)\b/i, 'wagon'],
  [/\b(hatch|hatchback|3[- ]?door|5[- ]?door|hot[- ]?hatch|gti|golf|polo|fiesta|corsa|clio|208|308|i10|i20|i30|picanto|rio|ceed|yaris|jazz|fit|swift|ibiza|leon|fabia|scala|punto|sandero|twingo|up!?|mii|citigo|micra)\b/i, 'hatchback'],
  [/\b(berline|sedan|saloon|limousine|quatre portes|4[- ]?door|classe[- ]?[scea]|series?\s*[357]|a[3-8](?!\s*sportback)|camry|accord|civic sedan|corolla sedan|3 series|5 series|7 series|model[- ]?s|model[- ]?3|s60|s90|s80|s40|passat|jetta|octavia|superb|a4|a6|a8)\b/i, 'sedan'],
];

// Model-level overrides (brand-specific)
const MODEL_OVERRIDES: Record<string, Record<string, BodyType>> = {
  'Ferrari': { '296': 'sports', '488': 'sports', 'F8': 'sports', 'SF90': 'sports', 'Roma': 'coupe', 'Portofino': 'cabriolet', 'Purosangue': 'suv', '812': 'sports', 'LaFerrari': 'sports', '458': 'sports', 'California': 'cabriolet', 'F12': 'sports', 'GTC4Lusso': 'coupe' },
  'Lamborghini': { 'Huracan': 'sports', 'Huracán': 'sports', 'Aventador': 'sports', 'Revuelto': 'sports', 'Temerario': 'sports', 'Urus': 'suv', 'Gallardo': 'sports', 'Murcielago': 'sports', 'Murciélago': 'sports', 'Diablo': 'sports', 'Countach': 'sports', 'Miura': 'sports', 'Espada': 'coupe', 'Sian': 'sports', 'Sián': 'sports', 'Veneno': 'sports', 'Reventon': 'sports', 'Centenario': 'sports', 'LM': 'suv', 'Jalpa': 'sports', 'Urraco': 'sports', 'Silhouette': 'sports', 'Islero': 'coupe', 'Jarama': 'coupe', '350': 'sports', '400': 'sports' },
  'Rolls-Royce': { 'Ghost': 'sedan', 'Phantom': 'sedan', 'Wraith': 'coupe', 'Dawn': 'cabriolet', 'Cullinan': 'suv', 'Spectre': 'coupe' },
  'Bentley': { 'Continental GT': 'coupe', 'Flying Spur': 'sedan', 'Bentayga': 'suv', 'Mulsanne': 'sedan' },
  'Aston Martin': { 'Vantage': 'sports', 'DB11': 'coupe', 'DB12': 'coupe', 'DBS': 'coupe', 'DBX': 'suv', 'Valkyrie': 'sports' },
  'Maserati': { 'Ghibli': 'sedan', 'Quattroporte': 'sedan', 'Levante': 'suv', 'GranTurismo': 'coupe', 'MC20': 'sports', 'Grecale': 'suv' },
  'Mercedes-Benz': {
    'Classe G': 'suv', 'Classe V': 'minivan', 'Classe S': 'sedan', 'Classe E': 'sedan', 'Classe C': 'sedan', 'Classe A': 'hatchback', 'Classe B': 'minivan',
    'W110-W112': 'sedan', 'Ponton': 'sedan', '150': 'sedan', '320': 'sedan', '540': 'sedan', '770': 'sedan', '200': 'sedan',
    'SL': 'cabriolet', 'SLK': 'cabriolet', 'SLC': 'cabriolet', 'SLR': 'sports', 'SLS': 'sports',
    'CLA': 'sedan', 'CLK': 'coupe', 'CLS': 'sedan', 'CLE': 'coupe', 'CLE Coupé': 'coupe',
    'Citan': 'minivan', 'Vito': 'minivan', 'Sprinter': 'minivan',
    'AMG GT': 'sports', 'AMG ONE': 'sports',
    'GLB': 'suv', 'GLC': 'suv', 'GLE': 'suv', 'GLS': 'suv', 'GLA': 'suv',
    'EQA': 'suv', 'EQB': 'suv', 'EQC': 'suv', 'EQE': 'sedan', 'EQE SUV': 'suv', 'EQS': 'sedan', 'EQS SUV': 'suv', 'EQV': 'minivan',
    'ML': 'suv', 'GL': 'suv', 'GLK': 'suv',
    'W114-W115': 'sedan', 'W108-W109': 'sedan', 'W123': 'sedan', 'W124': 'sedan', 'W126': 'sedan', 'W140': 'sedan', 'W116': 'sedan',
    'Pagode': 'cabriolet', '600': 'sedan', '190': 'sedan', '170': 'sedan', '220': 'sedan', '230': 'sedan', '240': 'sedan', '250': 'sedan', '260': 'sedan', '280': 'sedan', '300': 'sedan', '350': 'sedan', '380': 'sedan', '420': 'sedan', '450': 'sedan', '500': 'sedan', '560': 'sedan',
    'Classe R': 'minivan', 'Vaneo': 'minivan',
  },
  'BMW': {
    'iX': 'suv', 'iX1': 'suv', 'iX3': 'suv',
    'i3': 'hatchback', 'i4': 'sedan', 'i5': 'sedan', 'i7': 'sedan', 'i8': 'sports',
    'CSL': 'coupe', 'Nazca': 'sports', 'Turbo': 'sports', 'GT': 'coupe', 'Type': 'sedan', 'New': 'sedan',
    '1': 'hatchback', '2': 'coupe', '3': 'sedan', '4': 'coupe', '5': 'sedan', '6': 'coupe', '7': 'sedan', '8': 'coupe',
    'X1': 'suv', 'X2': 'suv', 'X3': 'suv', 'X4': 'suv', 'X5': 'suv', 'X6': 'suv', 'X7': 'suv', 'XM': 'suv',
    'Z1': 'cabriolet', 'Z3': 'cabriolet', 'Z4': 'cabriolet', 'Z8': 'cabriolet',
    'M2': 'coupe', 'M3': 'sedan', 'M4': 'coupe', 'M5': 'sedan', 'M6': 'coupe', 'M8': 'coupe',
    '2000': 'sedan', '1500': 'sedan', '1600': 'sedan', '1800': 'sedan', '2002': 'sedan', '3.0': 'sedan',
    '2 Active Tourer': 'minivan', '2 Gran Tourer': 'minivan',
  },
  'Porsche': {
    'Panamera': 'sedan', 'Taycan': 'sedan',
  },
  'Audi': {
    'A1': 'hatchback', 'A2': 'hatchback', 'A3': 'hatchback', 'A4': 'sedan', 'A5': 'coupe', 'A6': 'sedan', 'A7': 'coupe', 'A8': 'sedan',
    'Q2': 'suv', 'Q3': 'suv', 'Q4': 'suv', 'Q5': 'suv', 'Q7': 'suv', 'Q8': 'suv',
    'TT': 'sports', 'R8': 'sports', 'RS': 'sedan', 'S1': 'hatchback', 'S3': 'hatchback', 'S4': 'sedan', 'S5': 'coupe', 'S6': 'sedan', 'S7': 'coupe', 'S8': 'sedan',
    'e-tron': 'suv', 'e-tron GT': 'sedan', 'Q4 e-tron': 'suv', 'Q6 e-tron': 'suv', 'Q8 e-tron': 'suv',
    'V8': 'sedan', '80': 'sedan', '90': 'sedan', '100': 'sedan', '200': 'sedan', '50': 'sedan',
    'Cabriolet': 'cabriolet',
  },
  'Jaguar': {
    'XE': 'sedan', 'XF': 'sedan', 'XJ': 'sedan', 'F-TYPE': 'sports', 'F-PACE': 'suv', 'E-PACE': 'suv', 'I-PACE': 'suv',
    'S-Type': 'sedan', 'X-Type': 'sedan', 'XK': 'coupe', 'XKR': 'coupe',
  },
  'Alfa Romeo': {
    'Giulia': 'sedan', 'Giulietta': 'hatchback', 'Stelvio': 'suv', 'Tonale': 'suv',
    '4C': 'sports', '8C': 'sports', 'Spider': 'cabriolet', 'GTV': 'coupe', 'GT': 'coupe', 'Brera': 'coupe',
    '147': 'hatchback', '156': 'sedan', '159': 'sedan', '166': 'sedan', '33': 'hatchback', '75': 'sedan', '155': 'sedan', 'MiTo': 'hatchback',
  },
  'Fiat': {
    '500': 'hatchback', '500X': 'suv', '500L': 'minivan', '500e': 'hatchback',
    'Panda': 'hatchback', 'Punto': 'hatchback', 'Tipo': 'sedan', 'Bravo': 'hatchback', 'Stilo': 'hatchback',
    'Ducato': 'minivan', 'Doblo': 'minivan', 'Fiorino': 'minivan', 'Scudo': 'minivan', 'Ulysse': 'minivan',
    '124 Spider': 'cabriolet', 'Barchetta': 'cabriolet', 'Coupe': 'coupe',
    'Multipla': 'minivan', 'Idea': 'minivan', 'Sedici': 'suv', 'Freemont': 'suv',
    'Fullback': 'pickup',
  },
  'Volvo': {
    'S40': 'sedan', 'S60': 'sedan', 'S80': 'sedan', 'S90': 'sedan',
    'V40': 'hatchback', 'V50': 'wagon', 'V60': 'wagon', 'V70': 'wagon', 'V90': 'wagon',
    'XC40': 'suv', 'XC60': 'suv', 'XC70': 'suv', 'XC90': 'suv',
    'C30': 'hatchback', 'C40': 'suv', 'C70': 'cabriolet',
    'EX30': 'suv', 'EX40': 'suv', 'EX60': 'suv', 'EX90': 'suv', 'EC40': 'suv', 'EM90': 'minivan',
    '240': 'sedan', '740': 'sedan', '850': 'sedan', '940': 'sedan', '960': 'sedan',
    '440': 'hatchback', '460': 'sedan', '480': 'coupe',
  },
  'Lexus': {
    'IS': 'sedan', 'ES': 'sedan', 'GS': 'sedan', 'LS': 'sedan',
    'NX': 'suv', 'RX': 'suv', 'UX': 'suv', 'LX': 'suv', 'GX': 'suv', 'TX': 'suv',
    'LC': 'coupe', 'RC': 'coupe', 'LFA': 'sports', 'SC': 'coupe', 'CT': 'hatchback',
    'RZ': 'suv',
  },
  'Land Rover': {
    'Range Rover': 'suv', 'Range Rover Sport': 'suv', 'Range Rover Velar': 'suv', 'Range Rover Evoque': 'suv',
    'Discovery': 'suv', 'Discovery Sport': 'suv', 'Defender': 'suv', 'Freelander': 'suv',
  },
  'Mini': {
    'Cooper': 'hatchback', 'Countryman': 'suv', 'Clubman': 'wagon', 'Paceman': 'suv',
    'Cabrio': 'cabriolet', 'Convertible': 'cabriolet', 'Coupe': 'coupe', 'Roadster': 'cabriolet',
    'Aceman': 'suv',
  },
  'Opel': {
    'Corsa': 'hatchback', 'Astra': 'hatchback', 'Insignia': 'sedan', 'Mokka': 'suv', 'Grandland': 'suv', 'Crossland': 'suv',
    'Zafira': 'minivan', 'Meriva': 'minivan', 'Combo': 'minivan', 'Vivaro': 'minivan',
    'Adam': 'hatchback', 'Karl': 'hatchback', 'Vectra': 'sedan', 'Omega': 'sedan', 'Signum': 'sedan',
    'GT': 'sports', 'Speedster': 'sports', 'Calibra': 'coupe', 'Tigra': 'coupe', 'Manta': 'coupe',
    'Frontera': 'suv', 'Antara': 'suv',
  },
  'Seat': {
    'Ibiza': 'hatchback', 'Leon': 'hatchback', 'Arona': 'suv', 'Ateca': 'suv', 'Tarraco': 'suv',
    'Toledo': 'sedan', 'Exeo': 'sedan', 'Cordoba': 'sedan', 'Marbella': 'hatchback',
    'Alhambra': 'minivan', 'Altea': 'minivan',
  },
  'Citroen': {
    'C3': 'hatchback', 'C4': 'hatchback', 'C5': 'sedan', 'C6': 'sedan',
    'C3 Aircross': 'suv', 'C4 Aircross': 'suv', 'C5 Aircross': 'suv',
    'Berlingo': 'minivan', 'C8': 'minivan', 'SpaceTourer': 'minivan',
    'DS3': 'hatchback', 'DS4': 'hatchback', 'DS5': 'sedan',
    'C1': 'hatchback', 'C2': 'hatchback', 'Saxo': 'hatchback', 'Xsara': 'hatchback', 'ZX': 'hatchback',
    'XM': 'sedan', 'CX': 'sedan', 'BX': 'sedan', 'Xantia': 'sedan',
    'e-C4': 'hatchback', 'e-C4 X': 'sedan',
  },
  'Peugeot': {
    '108': 'hatchback', '206': 'hatchback', '207': 'hatchback', '208': 'hatchback', '306': 'hatchback', '307': 'hatchback', '308': 'hatchback',
    '301': 'sedan', '405': 'sedan', '406': 'sedan', '407': 'sedan', '408': 'sedan', '508': 'sedan', '605': 'sedan', '607': 'sedan',
    '2008': 'suv', '3008': 'suv', '4008': 'suv', '5008': 'suv',
    'Partner': 'minivan', 'Rifter': 'minivan', 'Traveller': 'minivan', '807': 'minivan', '806': 'minivan',
    'RCZ': 'coupe',
  },
  'Renault': {
    'Clio': 'hatchback', 'Megane': 'hatchback', 'Twingo': 'hatchback', 'Zoe': 'hatchback',
    'Captur': 'suv', 'Kadjar': 'suv', 'Austral': 'suv', 'Koleos': 'suv', 'Arkana': 'suv',
    'Scenic': 'minivan', 'Espace': 'minivan', 'Kangoo': 'minivan', 'Trafic': 'minivan', 'Master': 'minivan',
    'Laguna': 'sedan', 'Talisman': 'sedan', 'Latitude': 'sedan', 'Fluence': 'sedan', 'Safrane': 'sedan', 'Vel Satis': 'sedan',
    'Wind': 'cabriolet', 'Spider': 'cabriolet',
    'Sandero': 'hatchback', '5': 'hatchback', '4': 'hatchback',
    'Rafale': 'suv', 'Symbioz': 'suv',
  },
  'Kia': {
    'Picanto': 'hatchback', 'Rio': 'hatchback', 'Ceed': 'hatchback', "Cee'd": 'hatchback', 'Soul': 'hatchback',
    'Sportage': 'suv', 'Sorento': 'suv', 'Niro': 'suv', 'Seltos': 'suv', 'Stonic': 'suv', 'EV6': 'suv', 'EV9': 'suv', 'EV3': 'suv', 'Telluride': 'suv',
    'Optima': 'sedan', 'K5': 'sedan', 'Stinger': 'sedan', 'Cerato': 'sedan',
    'Carnival': 'minivan', 'Carens': 'minivan',
    'ProCeed': 'wagon', 'Ceed SW': 'wagon',
  },
  'Hyundai': {
    'i10': 'hatchback', 'i20': 'hatchback', 'i30': 'hatchback', 'i40': 'sedan', 'i45': 'sedan',
    'Tucson': 'suv', 'Kona': 'suv', 'Santa Fe': 'suv', 'Bayon': 'suv', 'Venue': 'suv', 'Palisade': 'suv', 'Creta': 'suv',
    'Ioniq 5': 'suv', 'Ioniq 6': 'sedan', 'Ioniq 7': 'suv', 'IONIQ 5': 'suv', 'IONIQ 6': 'sedan',
    'Sonata': 'sedan', 'Elantra': 'sedan', 'Accent': 'sedan',
    'Staria': 'minivan', 'H-1': 'minivan',
    'Inster': 'hatchback',
  },
  'Honda': {
    'Civic': 'hatchback', 'Jazz': 'hatchback', 'Fit': 'hatchback', 'e': 'hatchback',
    'Accord': 'sedan', 'City': 'sedan', 'Insight': 'sedan', 'Legend': 'sedan',
    'CR-V': 'suv', 'HR-V': 'suv', 'ZR-V': 'suv', 'Pilot': 'suv', 'Passport': 'suv', 'Element': 'suv',
    'Odyssey': 'minivan', 'Shuttle': 'minivan', 'Stream': 'minivan', 'FR-V': 'minivan', 'Freed': 'minivan',
    'S2000': 'cabriolet', 'NSX': 'sports', 'Integra': 'coupe', 'Prelude': 'coupe', 'CR-Z': 'coupe',
    'Ridgeline': 'pickup',
    'N-ONE': 'hatchback', 'N-BOX': 'minivan', 'N-WGN': 'hatchback',
  },
  'Nissan': {
    'Micra': 'hatchback', 'Note': 'hatchback', 'Leaf': 'hatchback', 'Pulsar': 'hatchback', 'Almera': 'hatchback', 'Tiida': 'hatchback',
    'Qashqai': 'suv', 'Juke': 'suv', 'X-Trail': 'suv', 'Ariya': 'suv', 'Rogue': 'suv', 'Pathfinder': 'suv', 'Murano': 'suv', 'Kicks': 'suv', 'Terra': 'suv', 'Patrol': 'suv',
    'Sentra': 'sedan', 'Altima': 'sedan', 'Maxima': 'sedan', 'Versa': 'sedan', 'Skyline': 'sedan', 'Teana': 'sedan', 'Sylphy': 'sedan', 'Sunny': 'sedan', 'Bluebird': 'sedan',
    'GT-R': 'sports', '370Z': 'sports', '350Z': 'sports', 'Z': 'sports', 'Fairlady': 'sports', '240Z': 'sports', '300ZX': 'sports', 'Silvia': 'coupe',
    'Serena': 'minivan', 'NV200': 'minivan', 'NV300': 'minivan', 'Primastar': 'minivan', 'Evalia': 'minivan', 'Elgrand': 'minivan',
    'Navara': 'pickup', 'Frontier': 'pickup', 'Titan': 'pickup',
  },
  'Toyota': {
    'Yaris': 'hatchback', 'Aygo': 'hatchback', 'Corolla': 'hatchback', 'Auris': 'hatchback', 'Starlet': 'hatchback', 'Vitz': 'hatchback', 'Aqua': 'hatchback',
    'Camry': 'sedan', 'Crown': 'sedan', 'Avalon': 'sedan', 'Prius': 'hatchback', 'Mirai': 'sedan',
    'RAV4': 'suv', 'C-HR': 'suv', 'Highlander': 'suv', 'Land Cruiser': 'suv', '4Runner': 'suv', 'Fortuner': 'suv', 'bZ4X': 'suv',
    'Hilux': 'pickup', 'Tacoma': 'pickup', 'Tundra': 'pickup',
    'Supra': 'sports', 'MR2': 'sports', 'GT86': 'sports', '86': 'sports', 'GR86': 'sports', 'Celica': 'coupe',
    'Sienna': 'minivan', 'Alphard': 'minivan', 'Vellfire': 'minivan', 'Noah': 'minivan', 'Voxy': 'minivan', 'Verso': 'minivan', 'ProAce': 'minivan', 'HiAce': 'minivan',
    'Avensis': 'sedan', 'Carina': 'sedan', 'Corona': 'sedan',
  },
  'Volkswagen': {
    'Golf': 'hatchback', 'Polo': 'hatchback', 'Up': 'hatchback', 'up!': 'hatchback', 'Lupo': 'hatchback',
    'Passat': 'sedan', 'Arteon': 'sedan', 'Jetta': 'sedan', 'Phaeton': 'sedan', 'Bora': 'sedan', 'Vento': 'sedan',
    'Tiguan': 'suv', 'Touareg': 'suv', 'T-Roc': 'suv', 'T-Cross': 'suv', 'Taigo': 'suv', 'Tayron': 'suv', 'Atlas': 'suv',
    'ID.3': 'hatchback', 'ID.4': 'suv', 'ID.5': 'suv', 'ID.7': 'sedan', 'ID.Buzz': 'minivan', 'ID': 'hatchback', 'ID.': 'hatchback',
    'Touran': 'minivan', 'Sharan': 'minivan', 'Caddy': 'minivan', 'Caravelle': 'minivan', 'Multivan': 'minivan', 'Transporter': 'minivan', 'T': 'minivan', 'Crafter': 'minivan',
    'Scirocco': 'coupe', 'Corrado': 'coupe', 'Karmann': 'coupe', 'CC': 'coupe', 'Eos': 'cabriolet',
    'Beetle': 'hatchback', 'New Beetle': 'hatchback', 'Coccinelle': 'hatchback',
    'Amarok': 'pickup', 'Saveiro': 'pickup',
    'Fox': 'hatchback', 'Gol': 'hatchback',
  },
  'Tesla': {
    'Model S': 'sedan', 'Model 3': 'sedan', 'Model X': 'suv', 'Model Y': 'suv', 'Cybertruck': 'pickup', 'Roadster': 'sports',
  },
  'Ford': {
    'Fiesta': 'hatchback', 'Focus': 'hatchback', 'Puma': 'suv', 'Kuga': 'suv', 'EcoSport': 'suv', 'Explorer': 'suv', 'Edge': 'suv', 'Escape': 'suv', 'Bronco': 'suv', 'Expedition': 'suv',
    'Mondeo': 'sedan', 'Fusion': 'sedan', 'Taurus': 'sedan',
    'Mustang': 'sports', 'Mustang Mach-E': 'suv', 'GT': 'sports',
    'F-150': 'pickup', 'Ranger': 'pickup', 'Maverick': 'pickup',
    'Galaxy': 'minivan', 'S-MAX': 'minivan', 'Tourneo': 'minivan', 'Transit': 'minivan', 'C-MAX': 'minivan', 'B-MAX': 'minivan',
    'Ka': 'hatchback', 'Ka+': 'hatchback',
  },
  'Mazda': {
    '2': 'hatchback', '3': 'hatchback', '6': 'sedan',
    'CX-3': 'suv', 'CX-30': 'suv', 'CX-5': 'suv', 'CX-60': 'suv', 'CX-7': 'suv', 'CX-8': 'suv', 'CX-9': 'suv', 'CX-50': 'suv', 'CX-70': 'suv', 'CX-80': 'suv', 'CX-90': 'suv',
    'MX-5': 'cabriolet', 'MX-30': 'suv', 'RX-7': 'sports', 'RX-8': 'sports',
    '5': 'minivan', 'MPV': 'minivan', 'Premacy': 'minivan',
    '323': 'hatchback', '626': 'sedan', 'Xedos': 'sedan',
    'BT-50': 'pickup',
  },
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

function detectBodyType(brandName: string, modelName: string, genName: string, existingBodyStyle?: string): BodyType | null {
  // 1. Use existing body_style spec if available
  if (existingBodyStyle) {
    const bs = norm(existingBodyStyle);
    if (bs.includes('sedan') || bs.includes('saloon') || bs.includes('berline')) return 'sedan';
    if (bs.includes('suv') || bs.includes('crossover') || bs.includes('sport utility')) return 'suv';
    if (bs.includes('hatchback') || bs.includes('hatch')) return 'hatchback';
    if (bs.includes('wagon') || bs.includes('estate') || bs.includes('break') || bs.includes('touring')) return 'wagon';
    if (bs.includes('coupe') || bs.includes('coupé')) return 'coupe';
    if (bs.includes('cabrio') || bs.includes('convert') || bs.includes('roadster') || bs.includes('spider')) return 'cabriolet';
    if (bs.includes('van') || bs.includes('mpv') || bs.includes('minivan')) return 'minivan';
    if (bs.includes('pickup') || bs.includes('truck')) return 'pickup';
  }

  // 2. Model-level overrides
  const brandOverrides = MODEL_OVERRIDES[brandName];
  if (brandOverrides) {
    // Try exact match first, then partial
    if (brandOverrides[modelName]) return brandOverrides[modelName];
    for (const [key, type] of Object.entries(brandOverrides)) {
      if (norm(modelName).includes(norm(key)) || norm(key).includes(norm(modelName))) return type;
    }
  }

  // 3. Keyword matching on combined string
  const combined = `${brandName} ${modelName} ${genName}`;
  for (const [pattern, type] of BODY_KEYWORDS) {
    if (pattern.test(combined)) return type;
  }

  return null;
}

async function main() {
  console.log(`🚗 FLM AUTO — Body Type Tagger ${DRY_RUN ? '(DRY-RUN)' : ''}\n`);

  // Load all data (paginated)
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  
  // Try with body_type first, fallback without it
  let gens: any[] = [];
  let hasBodyTypeCol = true;
  const testGens = await paginate('generations', 'id, name, model_id, body_type');
  if (testGens.length === 0) {
    // Column might not exist, try without it
    const fallback = await paginate('generations', 'id, name, model_id');
    if (fallback.length > 0) {
      console.log('⚠️  body_type column missing — loading without it...');
      console.log('   Run this SQL in Supabase dashboard FIRST:');
      console.log('   ALTER TABLE generations ADD COLUMN body_type TEXT;');
      console.log('   CREATE INDEX idx_gen_body_type ON generations(body_type);\n');
      hasBodyTypeCol = false;
      gens = fallback.map(g => ({ ...g, body_type: null }));
    }
  } else {
    gens = testGens;
  }
  
  if (!brands.length || !models.length || !gens.length) { console.log('❌ Failed to load data'); return; }

  // Get existing body_style specs
  const { data: bodySpecs } = await supabase
    .from('third_party_specs')
    .select('generation_id, spec_value, raw_data')
    .eq('spec_type', 'body_style')
    .limit(10000);

  const bodyStyleByGen = new Map<string, string>();
  for (const bs of (bodySpecs || [])) {
    const val = bs.raw_data?.toString() || bs.spec_value?.toString() || '';
    if (val) bodyStyleByGen.set(bs.generation_id, val);
  }

  // Build lookups
  const brandMap = new Map(brands.map(b => [b.id, b.name]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  // Tag each generation
  let tagged = 0, skipped = 0, alreadySet = 0, unknown = 0;
  const typeCounts: Record<string, number> = {};
  const updates: { id: string; body_type: string }[] = [];
  const unknownSamples: string[] = [];

  for (const gen of gens) {
    // Skip if already tagged
    if (gen.body_type) {
      alreadySet++;
      typeCounts[gen.body_type] = (typeCounts[gen.body_type] || 0) + 1;
      continue;
    }

    const model = modelMap.get(gen.model_id);
    if (!model) { skipped++; continue; }

    const brandName = brandMap.get(model.brand_id) || '';
    const existingBodyStyle = bodyStyleByGen.get(gen.id);
    const bodyType = detectBodyType(brandName, model.name, gen.name || '', existingBodyStyle);

    if (bodyType) {
      tagged++;
      typeCounts[bodyType] = (typeCounts[bodyType] || 0) + 1;
      updates.push({ id: gen.id, body_type: bodyType });
    } else {
      unknown++;
      if (unknownSamples.length < 20) {
        unknownSamples.push(`${brandName} ${model.name} (${gen.name || 'default'})`);
      }
    }
  }

  // Apply updates
  if (!DRY_RUN && !hasBodyTypeCol && updates.length > 0) {
    console.log('\n  ⚠️  Cannot write: body_type column missing. Create it first, then re-run without --dry-run.');
  } else if (!DRY_RUN && updates.length > 0) {
    console.log(`  Writing ${updates.length} body types to DB...`);
    let written = 0;
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      for (const u of batch) {
        const { error } = await supabase
          .from('generations')
          .update({ body_type: u.body_type })
          .eq('id', u.id);
        if (!error) written++;
      }
      process.stdout.write(`  ${Math.min(i + 100, updates.length)}/${updates.length}\r`);
    }
    console.log(`  ✅ ${written} generations updated`);
  }

  // Report
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  BODY TYPE TAGGING RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total generations:  ${gens.length}`);
  console.log(`  Already tagged:     ${alreadySet}`);
  console.log(`  Newly tagged:       ${tagged}`);
  console.log(`  Unknown (no match): ${unknown}`);
  console.log(`  Skipped (no model): ${skipped}`);

  console.log('\n  Distribution:');
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round(count / gens.length * 100);
    const bar = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(25 - Math.floor(pct / 2));
    console.log(`    ${type.padEnd(12)} ${String(count).padStart(5)}  ${bar} ${pct}%`);
  }

  if (unknownSamples.length > 0) {
    console.log('\n  Untagged samples (add to BODY_KEYWORDS or MODEL_OVERRIDES):');
    for (const s of unknownSamples) {
      console.log(`    ❓ ${s}`);
    }
  }

  console.log(`\n  Mode: ${DRY_RUN ? '🔍 DRY-RUN' : '⚡ EXECUTED'}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
