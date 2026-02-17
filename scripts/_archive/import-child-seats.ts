/**
 * FLM AUTO — Child Seats Importer
 * Imports top 50+ child seats with dimensions, ISOFIX compatibility, ratings
 * Comprehensive database of popular car seats from ADAC/TCS test results
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-child-seats.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChildSeat {
  brand: string;
  model: string;
  seat_type: string; // infant, convertible, booster, all-in-one
  group_ece: string; // 0+, 0+/1, 1, 2/3, 1/2/3
  weight_min_kg: number;
  weight_max_kg: number;
  age_min_months: number;
  age_max_months: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  weight_kg: number;
  isofix_compatible: boolean;
  belt_compatible: boolean;
  swivel: boolean;
  adac_rating: number | null; // 1.0-5.0 (lower = better)
  tcs_rating: number | null;
  price_eur: number;
}

// Comprehensive child seat database from ADAC/TCS test results 2022-2025
const CHILD_SEATS: ChildSeat[] = [
  // ═══ INFANT SEATS (Group 0+, birth to ~13kg / ~12 months) ═══
  { brand: 'Cybex', model: 'Cloud T i-Size', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 670, height_mm: 560, weight_kg: 4.3, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.5, tcs_rating: null, price_eur: 310 },
  { brand: 'Maxi-Cosi', model: 'Pebble 360', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 670, height_mm: 570, weight_kg: 4.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 280 },
  { brand: 'Maxi-Cosi', model: 'CabrioFix i-Size', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 12, age_min_months: 0, age_max_months: 12, width_mm: 440, depth_mm: 660, height_mm: 550, weight_kg: 3.2, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 180 },
  { brand: 'Cybex', model: 'Aton S2 i-Size', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 660, height_mm: 555, weight_kg: 4.2, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 200 },
  { brand: 'Joie', model: 'i-Snug 2', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 650, height_mm: 540, weight_kg: 3.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 130 },
  { brand: 'BeSafe', model: 'iZi Go Modular X2 i-Size', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 12, width_mm: 440, depth_mm: 680, height_mm: 570, weight_kg: 4.4, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 320 },
  { brand: 'Nuna', model: 'Arra Next', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 690, height_mm: 560, weight_kg: 4.1, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 350 },
  { brand: 'Britax Römer', model: 'Baby-Safe 5Z2', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 670, height_mm: 560, weight_kg: 4.6, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 300 },
  { brand: 'Recaro', model: 'Avan Prime', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 660, height_mm: 550, weight_kg: 4.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 250 },
  { brand: 'Avionaut', model: 'Pixel Pro 2.0', seat_type: 'infant', group_ece: '0+', weight_min_kg: 0, weight_max_kg: 13, age_min_months: 0, age_max_months: 15, width_mm: 440, depth_mm: 660, height_mm: 540, weight_kg: 2.5, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.4, tcs_rating: null, price_eur: 290 },

  // ═══ CONVERTIBLE / TODDLER (Group 0+/1, birth to ~18kg / ~4 years) ═══
  { brand: 'Cybex', model: 'Sirona S2 i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 440, depth_mm: 690, height_mm: 630, weight_kg: 15.0, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.5, tcs_rating: null, price_eur: 450 },
  { brand: 'Cybex', model: 'Sirona T i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 440, depth_mm: 690, height_mm: 640, weight_kg: 15.2, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.4, tcs_rating: null, price_eur: 500 },
  { brand: 'Maxi-Cosi', model: 'Pearl 360', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 3, age_max_months: 48, width_mm: 475, depth_mm: 630, height_mm: 600, weight_kg: 12.0, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.7, tcs_rating: null, price_eur: 380 },
  { brand: 'Maxi-Cosi', model: 'Mica Pro Eco i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 445, depth_mm: 660, height_mm: 625, weight_kg: 14.0, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.6, tcs_rating: null, price_eur: 420 },
  { brand: 'Britax Römer', model: 'Dualfix 5Z i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 450, depth_mm: 670, height_mm: 620, weight_kg: 14.7, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.8, tcs_rating: null, price_eur: 500 },
  { brand: 'Joie', model: 'i-Spin 360 E', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 450, depth_mm: 680, height_mm: 630, weight_kg: 13.1, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.6, tcs_rating: null, price_eur: 350 },
  { brand: 'BeSafe', model: 'iZi Turn M i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 445, depth_mm: 685, height_mm: 640, weight_kg: 14.5, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.5, tcs_rating: null, price_eur: 550 },
  { brand: 'Recaro', model: 'Salia 125 i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 440, depth_mm: 675, height_mm: 620, weight_kg: 14.3, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.7, tcs_rating: null, price_eur: 460 },
  { brand: 'Nuna', model: 'Prym', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 450, depth_mm: 670, height_mm: 630, weight_kg: 13.8, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.8, tcs_rating: null, price_eur: 500 },
  { brand: 'Swandoo', model: 'Marie 3 i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 448, depth_mm: 670, height_mm: 620, weight_kg: 13.5, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.5, tcs_rating: null, price_eur: 480 },
  { brand: 'Chicco', model: 'Seat3Fit i-Size Air', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 440, depth_mm: 680, height_mm: 630, weight_kg: 12.8, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.9, tcs_rating: null, price_eur: 400 },
  { brand: 'Lionelo', model: 'Antoon RWF i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 445, depth_mm: 670, height_mm: 625, weight_kg: 14.0, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 2.1, tcs_rating: null, price_eur: 320 },

  // ═══ BOOSTER SEATS (Group 2/3, 15-36kg / ~3-12 years) ═══
  { brand: 'Cybex', model: 'Solution T i-Fix', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 36, age_max_months: 144, width_mm: 500, depth_mm: 410, height_mm: 640, weight_kg: 7.2, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.5, tcs_rating: null, price_eur: 290 },
  { brand: 'Cybex', model: 'Solution G i-Fix', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 36, age_max_months: 144, width_mm: 500, depth_mm: 410, height_mm: 640, weight_kg: 7.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 230 },
  { brand: 'Maxi-Cosi', model: 'RodiFix Pro2 i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 490, depth_mm: 410, height_mm: 650, weight_kg: 6.5, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 200 },
  { brand: 'Britax Römer', model: 'Kidfix i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 500, depth_mm: 420, height_mm: 670, weight_kg: 7.4, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 250 },
  { brand: 'Joie', model: 'i-Trillo lx', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 36, age_max_months: 144, width_mm: 490, depth_mm: 400, height_mm: 640, weight_kg: 5.6, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 150 },
  { brand: 'Recaro', model: 'Mako 2 Elite', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 500, depth_mm: 410, height_mm: 650, weight_kg: 6.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 230 },
  { brand: 'BeSafe', model: 'iZi Flex Fix i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 500, depth_mm: 430, height_mm: 660, weight_kg: 7.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.5, tcs_rating: null, price_eur: 300 },
  { brand: 'Nuna', model: 'Aace lx', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 490, depth_mm: 420, height_mm: 640, weight_kg: 6.3, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 270 },
  { brand: 'Chicco', model: 'Fold&Go i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 480, depth_mm: 400, height_mm: 630, weight_kg: 5.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.0, tcs_rating: null, price_eur: 170 },
  { brand: 'Graco', model: 'EverSure i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 490, depth_mm: 410, height_mm: 640, weight_kg: 5.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.1, tcs_rating: null, price_eur: 120 },

  // ═══ ALL-IN-ONE SEATS (Group 1/2/3, 9-36kg / ~9 months - 12 years) ═══
  { brand: 'Cybex', model: 'Pallas G i-Size', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 500, depth_mm: 440, height_mm: 680, weight_kg: 8.4, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 340 },
  { brand: 'Britax Römer', model: 'Advansafix M i-Size', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 15, age_max_months: 144, width_mm: 470, depth_mm: 480, height_mm: 680, weight_kg: 10.3, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.1, tcs_rating: null, price_eur: 350 },
  { brand: 'Joie', model: 'Every Stage FX', seat_type: 'all-in-one', group_ece: '0+/1/2/3', weight_min_kg: 0, weight_max_kg: 36, age_min_months: 0, age_max_months: 144, width_mm: 480, depth_mm: 510, height_mm: 700, weight_kg: 11.5, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.3, tcs_rating: null, price_eur: 230 },
  { brand: 'Joie', model: 'Bold R', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 480, depth_mm: 450, height_mm: 670, weight_kg: 8.6, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.0, tcs_rating: null, price_eur: 200 },
  { brand: 'Chicco', model: 'MySeat i-Size Air', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 15, age_max_months: 144, width_mm: 475, depth_mm: 470, height_mm: 690, weight_kg: 10.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.2, tcs_rating: null, price_eur: 260 },
  { brand: 'Maxi-Cosi', model: 'Titan Pro2 i-Size', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 480, depth_mm: 455, height_mm: 685, weight_kg: 9.5, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.0, tcs_rating: null, price_eur: 300 },
  { brand: 'Recaro', model: 'Tian Elite', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 470, depth_mm: 460, height_mm: 680, weight_kg: 9.2, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.1, tcs_rating: null, price_eur: 280 },
  { brand: 'Kinderkraft', model: 'Oneto3 i-Size', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 480, depth_mm: 460, height_mm: 670, weight_kg: 8.9, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.4, tcs_rating: null, price_eur: 180 },

  // ═══ NARROW / COMPACT SEATS (important for 3-across) ═══
  { brand: 'Diono', model: 'Radian 3RXT', seat_type: 'convertible', group_ece: '0+/1/2', weight_min_kg: 0, weight_max_kg: 30, age_min_months: 0, age_max_months: 120, width_mm: 430, depth_mm: 450, height_mm: 580, weight_kg: 12.7, isofix_compatible: false, belt_compatible: true, swivel: false, adac_rating: null, tcs_rating: null, price_eur: 380 },
  { brand: 'Diono', model: 'Radian 3R', seat_type: 'convertible', group_ece: '0+/1/2', weight_min_kg: 0, weight_max_kg: 30, age_min_months: 0, age_max_months: 120, width_mm: 430, depth_mm: 450, height_mm: 575, weight_kg: 11.3, isofix_compatible: false, belt_compatible: true, swivel: false, adac_rating: null, tcs_rating: null, price_eur: 250 },
  { brand: 'Multimac', model: '1320', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 1320, depth_mm: 430, height_mm: 650, weight_kg: 20.0, isofix_compatible: true, belt_compatible: false, swivel: false, adac_rating: null, tcs_rating: null, price_eur: 1300 },

  // ═══ ADDITIONAL POPULAR SEATS ═══
  { brand: 'Cybex', model: 'Solution Z i-Fix', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 36, age_max_months: 144, width_mm: 500, depth_mm: 410, height_mm: 640, weight_kg: 7.1, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.6, tcs_rating: null, price_eur: 260 },
  { brand: 'Britax Römer', model: 'Kidfix M i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 490, depth_mm: 410, height_mm: 660, weight_kg: 6.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.7, tcs_rating: null, price_eur: 200 },
  { brand: 'Maxi-Cosi', model: 'Kore Pro i-Size', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 490, depth_mm: 400, height_mm: 650, weight_kg: 6.0, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 210 },
  { brand: 'Joie', model: 'Traver Shield', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 490, depth_mm: 440, height_mm: 670, weight_kg: 7.8, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.9, tcs_rating: null, price_eur: 180 },
  { brand: 'Britax Römer', model: 'Dualfix iSENSE', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 450, depth_mm: 680, height_mm: 625, weight_kg: 14.5, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.7, tcs_rating: null, price_eur: 470 },
  { brand: 'Maxi-Cosi', model: 'Stone i-Size', seat_type: 'convertible', group_ece: '0+/1', weight_min_kg: 0, weight_max_kg: 18, age_min_months: 0, age_max_months: 48, width_mm: 450, depth_mm: 685, height_mm: 630, weight_kg: 13.5, isofix_compatible: true, belt_compatible: false, swivel: true, adac_rating: 1.8, tcs_rating: null, price_eur: 420 },
  { brand: 'Cybex', model: 'Pallas S-Fix', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 500, depth_mm: 430, height_mm: 670, weight_kg: 8.1, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 1.8, tcs_rating: null, price_eur: 270 },
  { brand: 'Graco', model: 'SlimFit LX', seat_type: 'all-in-one', group_ece: '0+/1/2/3', weight_min_kg: 0, weight_max_kg: 36, age_min_months: 0, age_max_months: 144, width_mm: 465, depth_mm: 470, height_mm: 685, weight_kg: 10.5, isofix_compatible: false, belt_compatible: true, swivel: false, adac_rating: null, tcs_rating: null, price_eur: 200 },
  { brand: 'Safety 1st', model: 'Ever Fix', seat_type: 'all-in-one', group_ece: '1/2/3', weight_min_kg: 9, weight_max_kg: 36, age_min_months: 9, age_max_months: 144, width_mm: 475, depth_mm: 450, height_mm: 670, weight_kg: 8.5, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.3, tcs_rating: null, price_eur: 160 },
  { brand: 'Osann', model: 'Flux Plus', seat_type: 'booster', group_ece: '2/3', weight_min_kg: 15, weight_max_kg: 36, age_min_months: 42, age_max_months: 144, width_mm: 470, depth_mm: 400, height_mm: 630, weight_kg: 5.2, isofix_compatible: true, belt_compatible: true, swivel: false, adac_rating: 2.2, tcs_rating: null, price_eur: 100 },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Child Seats Importer');
  console.log(`  Importing ${CHILD_SEATS.length} child seats`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Check existing
  const { count: existing } = await supabase.from('child_seats').select('*', { count: 'exact', head: true });
  console.log(`Existing child seats: ${existing}\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const seat of CHILD_SEATS) {
    // Check if exists
    const { data: existingRow } = await supabase
      .from('child_seats')
      .select('id')
      .eq('brand', seat.brand)
      .eq('model', seat.model)
      .limit(1);

    if (existingRow && existingRow.length > 0) {
      // Update with new columns
      const { error } = await supabase.from('child_seats').update({
        seat_type: seat.seat_type,
        group_ece: seat.group_ece,
        weight_min_kg: seat.weight_min_kg,
        weight_max_kg: seat.weight_max_kg,
        age_min_months: seat.age_min_months,
        age_max_months: seat.age_max_months,
        width_mm: seat.width_mm,
        depth_mm: seat.depth_mm,
        height_mm: seat.height_mm,
        weight_kg: seat.weight_kg,
        isofix_compatible: seat.isofix_compatible,
        belt_compatible: seat.belt_compatible,
        swivel: seat.swivel,
        adac_rating: seat.adac_rating,
        price_eur: seat.price_eur,
      }).eq('id', existingRow[0].id);

      if (!error) updated++; else { errors++; console.log(`  ERROR updating ${seat.brand} ${seat.model}: ${error.message}`); }
    } else {
      const { error } = await supabase.from('child_seats').insert({
        brand: seat.brand,
        model: seat.model,
        seat_type: seat.seat_type,
        group_ece: seat.group_ece,
        weight_min_kg: seat.weight_min_kg,
        weight_max_kg: seat.weight_max_kg,
        age_min_months: seat.age_min_months,
        age_max_months: seat.age_max_months,
        width_mm: seat.width_mm,
        depth_mm: seat.depth_mm,
        height_mm: seat.height_mm,
        weight_kg: seat.weight_kg,
        isofix_compatible: seat.isofix_compatible,
        belt_compatible: seat.belt_compatible,
        swivel: seat.swivel,
        adac_rating: seat.adac_rating,
        tcs_rating: seat.tcs_rating,
        price_eur: seat.price_eur,
      });

      if (!error) inserted++; else { errors++; console.log(`  ERROR inserting ${seat.brand} ${seat.model}: ${error.message}`); }
    }
  }

  const { count: finalCount } = await supabase.from('child_seats').select('*', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CHILD SEATS IMPORT COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Inserted:    ${inserted}`);
  console.log(`  Updated:     ${updated}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Total seats: ${finalCount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Breakdown by type
  for (const type of ['infant', 'convertible', 'booster', 'all-in-one']) {
    const count = CHILD_SEATS.filter(s => s.seat_type === type).length;
    console.log(`  ${type}: ${count}`);
  }
}

main().catch(console.error);
