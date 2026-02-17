/**
 * 34-iihs-hardcoded.ts — IIHS Top Safety Pick data (0 HTTP requests)
 *
 * Hardcoded TSP/TSP+ awards from 2015-2025.
 * TSP+ → 5 stars, TSP → 4 stars.
 * Never overwrites existing ratings.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/34-iihs-hardcoded.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/34-iihs-hardcoded.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

interface IIHSEntry {
  brand: string;
  model: string;
  year: number;
  award: 'TSP+' | 'TSP';
}

const IIHS_DATA: IIHSEntry[] = [
  // ═══════════════════ 2025 ═══════════════════
  // TSP+
  { brand: 'Hyundai', model: 'Elantra', year: 2025, award: 'TSP+' },
  { brand: 'Kia', model: 'K4', year: 2025, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2025, award: 'TSP+' },
  { brand: 'Toyota', model: 'Prius', year: 2025, award: 'TSP+' },
  { brand: 'Honda', model: 'Accord', year: 2025, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Ioniq 6', year: 2025, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Sonata', year: 2025, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2025, award: 'TSP+' },
  { brand: 'Audi', model: 'A5', year: 2025, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model 3', year: 2025, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla Cross', year: 2025, award: 'TSP+' },
  { brand: 'Ford', model: 'Explorer', year: 2025, award: 'TSP+' },
  { brand: 'Honda', model: 'Pilot', year: 2025, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2025, award: 'TSP+' },
  { brand: 'Kia', model: 'EV9', year: 2025, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2025, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2025, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-70', year: 2025, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-90', year: 2025, award: 'TSP+' },
  { brand: 'Nissan', model: 'Murano', year: 2025, award: 'TSP+' },
  { brand: 'Nissan', model: 'Pathfinder', year: 2025, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model Y', year: 2025, award: 'TSP+' },
  { brand: 'Volkswagen', model: 'Atlas', year: 2025, award: 'TSP+' },
  { brand: 'Volvo', model: 'EX90', year: 2025, award: 'TSP+' },
  { brand: 'Audi', model: 'Q5', year: 2025, award: 'TSP+' },
  { brand: 'BMW', model: 'X5', year: 2025, award: 'TSP+' },
  { brand: 'Mercedes-Benz', model: 'GLC', year: 2025, award: 'TSP+' },
  { brand: 'Audi', model: 'A6', year: 2025, award: 'TSP+' },
  // TSP
  { brand: 'Mercedes-Benz', model: 'C-Class', year: 2025, award: 'TSP' },
  { brand: 'Toyota', model: 'bZ4X', year: 2025, award: 'TSP' },
  { brand: 'Ford', model: 'Mustang Mach-E', year: 2025, award: 'TSP' },
  { brand: 'Lexus', model: 'NX', year: 2025, award: 'TSP' },
  { brand: 'Mini', model: 'Countryman', year: 2025, award: 'TSP' },

  // ═══════════════════ 2024 ═══════════════════
  // TSP+
  { brand: 'Ford', model: 'Mustang Mach-E', year: 2024, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-70', year: 2024, award: 'TSP+' },
  { brand: 'Mercedes-Benz', model: 'C-Class', year: 2024, award: 'TSP+' },
  { brand: 'Mercedes-Benz', model: 'GLC', year: 2024, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'Tundra', year: 2024, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2024, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Ioniq 5', year: 2024, award: 'TSP+' },
  { brand: 'BMW', model: 'X2', year: 2024, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2024, award: 'TSP+' },
  { brand: 'Honda', model: 'HR-V', year: 2024, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2024, award: 'TSP+' },
  { brand: 'Kia', model: 'EV6', year: 2024, award: 'TSP+' },
  { brand: 'Kia', model: 'Sportage', year: 2024, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2024, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-50', year: 2024, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-90', year: 2024, award: 'TSP+' },
  { brand: 'BMW', model: '5 Series', year: 2024, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2024, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2024, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2024, award: 'TSP+' },
  { brand: 'Nissan', model: 'Rogue', year: 2024, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Kona', year: 2024, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'Highlander', year: 2024, award: 'TSP+' },
  { brand: 'Nissan', model: 'Altima', year: 2024, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Palisade', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla', year: 2024, award: 'TSP+' },
  { brand: 'Toyota', model: 'Crown', year: 2024, award: 'TSP+' },
  { brand: 'Honda', model: 'Accord', year: 2024, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: 'X1', year: 2024, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'E-Class', year: 2024, award: 'TSP' },
  { brand: 'Nissan', model: 'Kicks', year: 2024, award: 'TSP' },
  { brand: 'Audi', model: 'Q8', year: 2024, award: 'TSP' },

  // ═══════════════════ 2023 ═══════════════════
  // TSP+
  { brand: 'BMW', model: 'X3', year: 2023, award: 'TSP+' },
  { brand: 'Honda', model: 'Accord', year: 2023, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2023, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2023, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2023, award: 'TSP+' },
  { brand: 'Kia', model: 'Sportage', year: 2023, award: 'TSP+' },
  { brand: 'Kia', model: 'EV6', year: 2023, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-50', year: 2023, award: 'TSP+' },
  { brand: 'Nissan', model: 'Rogue', year: 2023, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2023, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2023, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2023, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2023, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Ioniq 5', year: 2023, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model Y', year: 2023, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2023, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2023, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2023, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2023, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Kona', year: 2023, award: 'TSP+' },
  { brand: 'Kia', model: 'Niro', year: 2023, award: 'TSP+' },
  { brand: 'Nissan', model: 'Altima', year: 2023, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla', year: 2023, award: 'TSP+' },
  { brand: 'Toyota', model: 'Highlander', year: 2023, award: 'TSP+' },
  { brand: 'Honda', model: 'HR-V', year: 2023, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2023, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2023, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2023, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC40', year: 2023, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2023, award: 'TSP+' },
  { brand: 'BMW', model: '3 Series', year: 2023, award: 'TSP+' },
  // TSP
  { brand: 'Audi', model: 'Q5', year: 2023, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'C-Class', year: 2023, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2023, award: 'TSP' },
  { brand: 'Volkswagen', model: 'ID.4', year: 2023, award: 'TSP' },
  { brand: 'Nissan', model: 'Kicks', year: 2023, award: 'TSP' },

  // ═══════════════════ 2022 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Civic', year: 2022, award: 'TSP+' },
  { brand: 'Honda', model: 'Accord', year: 2022, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2022, award: 'TSP+' },
  { brand: 'Honda', model: 'Insight', year: 2022, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2022, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2022, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2022, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2022, award: 'TSP+' },
  { brand: 'Nissan', model: 'Rogue', year: 2022, award: 'TSP+' },
  { brand: 'Nissan', model: 'Altima', year: 2022, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2022, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2022, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model 3', year: 2022, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Ioniq 5', year: 2022, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2022, award: 'TSP+' },
  { brand: 'Kia', model: 'EV6', year: 2022, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2022, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2022, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2022, award: 'TSP+' },
  { brand: 'Toyota', model: 'Highlander', year: 2022, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla', year: 2022, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2022, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2022, award: 'TSP' },
  { brand: 'BMW', model: '3 Series', year: 2022, award: 'TSP+' },
  { brand: 'BMW', model: 'X3', year: 2022, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC40', year: 2022, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2022, award: 'TSP+' },
  // TSP
  { brand: 'Kia', model: 'Sportage', year: 2022, award: 'TSP' },
  { brand: 'Honda', model: 'HR-V', year: 2022, award: 'TSP' },
  { brand: 'Hyundai', model: 'Kona', year: 2022, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'C-Class', year: 2022, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2022, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2022, award: 'TSP' },

  // ═══════════════════ 2021 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2021, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2021, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2021, award: 'TSP+' },
  { brand: 'Honda', model: 'Insight', year: 2021, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2021, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2021, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-30', year: 2021, award: 'TSP+' },
  { brand: 'Nissan', model: 'Rogue', year: 2021, award: 'TSP+' },
  { brand: 'Nissan', model: 'Altima', year: 2021, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2021, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2021, award: 'TSP+' },
  { brand: 'Toyota', model: 'Highlander', year: 2021, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla', year: 2021, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2021, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2021, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Sonata', year: 2021, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2021, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2021, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2021, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2021, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC40', year: 2021, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2021, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model 3', year: 2021, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2021, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2021, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2021, award: 'TSP' },
  { brand: 'BMW', model: 'X3', year: 2021, award: 'TSP' },
  { brand: 'BMW', model: 'X5', year: 2021, award: 'TSP' },
  { brand: 'Honda', model: 'HR-V', year: 2021, award: 'TSP' },
  { brand: 'Hyundai', model: 'Kona', year: 2021, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2021, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'E-Class', year: 2021, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'GLC', year: 2021, award: 'TSP' },
  { brand: 'Nissan', model: 'Kicks', year: 2021, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2021, award: 'TSP' },
  { brand: 'Volkswagen', model: 'ID.4', year: 2021, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2021, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2021, award: 'TSP' },

  // ═══════════════════ 2020 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2020, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2020, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2020, award: 'TSP+' },
  { brand: 'Honda', model: 'Insight', year: 2020, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2020, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2020, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-30', year: 2020, award: 'TSP+' },
  { brand: 'Nissan', model: 'Altima', year: 2020, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2020, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2020, award: 'TSP+' },
  { brand: 'Toyota', model: 'Highlander', year: 2020, award: 'TSP+' },
  { brand: 'Toyota', model: 'Corolla', year: 2020, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2020, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2020, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Sonata', year: 2020, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2020, award: 'TSP+' },
  { brand: 'Kia', model: 'Telluride', year: 2020, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2020, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2020, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC40', year: 2020, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2020, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model 3', year: 2020, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2020, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2020, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2020, award: 'TSP' },
  { brand: 'BMW', model: 'X3', year: 2020, award: 'TSP' },
  { brand: 'BMW', model: 'X5', year: 2020, award: 'TSP' },
  { brand: 'Honda', model: 'HR-V', year: 2020, award: 'TSP' },
  { brand: 'Hyundai', model: 'Kona', year: 2020, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2020, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2020, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'GLC', year: 2020, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'E-Class', year: 2020, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2020, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2020, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2020, award: 'TSP' },

  // ═══════════════════ 2019 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2019, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2019, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2019, award: 'TSP+' },
  { brand: 'Honda', model: 'Insight', year: 2019, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2019, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2019, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2019, award: 'TSP+' },
  { brand: 'Toyota', model: 'RAV4', year: 2019, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Tucson', year: 2019, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2019, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2019, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2019, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2019, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC40', year: 2019, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2019, award: 'TSP+' },
  { brand: 'Tesla', model: 'Model 3', year: 2019, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2019, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2019, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2019, award: 'TSP' },
  { brand: 'BMW', model: 'X3', year: 2019, award: 'TSP' },
  { brand: 'BMW', model: 'X5', year: 2019, award: 'TSP' },
  { brand: 'Hyundai', model: 'Kona', year: 2019, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2019, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2019, award: 'TSP' },
  { brand: 'Nissan', model: 'Altima', year: 2019, award: 'TSP' },
  { brand: 'Toyota', model: 'Corolla', year: 2019, award: 'TSP' },
  { brand: 'Toyota', model: 'Highlander', year: 2019, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2019, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2019, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2019, award: 'TSP' },

  // ═══════════════════ 2018 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2018, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2018, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2018, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2018, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2018, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2018, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2018, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2018, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2018, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2018, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2018, award: 'TSP+' },
  { brand: 'Lexus', model: 'NX', year: 2018, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2018, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2018, award: 'TSP' },
  { brand: 'BMW', model: 'X3', year: 2018, award: 'TSP' },
  { brand: 'Hyundai', model: 'Tucson', year: 2018, award: 'TSP' },
  { brand: 'Hyundai', model: 'Kona', year: 2018, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2018, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2018, award: 'TSP' },
  { brand: 'Toyota', model: 'RAV4', year: 2018, award: 'TSP' },
  { brand: 'Toyota', model: 'Corolla', year: 2018, award: 'TSP' },
  { brand: 'Toyota', model: 'Highlander', year: 2018, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2018, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2018, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2018, award: 'TSP' },

  // ═══════════════════ 2017 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2017, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2017, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2017, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2017, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2017, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2017, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2017, award: 'TSP+' },
  { brand: 'Kia', model: 'Sorento', year: 2017, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2017, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2017, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2017, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2017, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2017, award: 'TSP' },
  { brand: 'BMW', model: 'X3', year: 2017, award: 'TSP' },
  { brand: 'Hyundai', model: 'Tucson', year: 2017, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2017, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2017, award: 'TSP' },
  { brand: 'Nissan', model: 'Altima', year: 2017, award: 'TSP' },
  { brand: 'Toyota', model: 'RAV4', year: 2017, award: 'TSP' },
  { brand: 'Toyota', model: 'Corolla', year: 2017, award: 'TSP' },
  { brand: 'Toyota', model: 'Highlander', year: 2017, award: 'TSP' },
  { brand: 'Volkswagen', model: 'Tiguan', year: 2017, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2017, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2017, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'C-Class', year: 2017, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'E-Class', year: 2017, award: 'TSP' },
  { brand: 'Mercedes-Benz', model: 'GLC', year: 2017, award: 'TSP' },

  // ═══════════════════ 2016 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2016, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2016, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2016, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2016, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2016, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2016, award: 'TSP+' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2016, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2016, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2016, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2016, award: 'TSP+' },
  { brand: 'Lexus', model: 'RX', year: 2016, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2016, award: 'TSP' },
  { brand: 'Hyundai', model: 'Tucson', year: 2016, award: 'TSP' },
  { brand: 'Kia', model: 'Sportage', year: 2016, award: 'TSP' },
  { brand: 'Kia', model: 'Sorento', year: 2016, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2016, award: 'TSP' },
  { brand: 'Toyota', model: 'RAV4', year: 2016, award: 'TSP' },
  { brand: 'Toyota', model: 'Corolla', year: 2016, award: 'TSP' },
  { brand: 'Toyota', model: 'Highlander', year: 2016, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2016, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2016, award: 'TSP' },

  // ═══════════════════ 2015 ═══════════════════
  // TSP+
  { brand: 'Honda', model: 'Accord', year: 2015, award: 'TSP+' },
  { brand: 'Honda', model: 'Civic', year: 2015, award: 'TSP+' },
  { brand: 'Honda', model: 'CR-V', year: 2015, award: 'TSP+' },
  { brand: 'Mazda', model: '3', year: 2015, award: 'TSP+' },
  { brand: 'Mazda', model: 'CX-5', year: 2015, award: 'TSP+' },
  { brand: 'Toyota', model: 'Camry', year: 2015, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC60', year: 2015, award: 'TSP+' },
  { brand: 'Volvo', model: 'XC90', year: 2015, award: 'TSP+' },
  { brand: 'Volvo', model: 'S60', year: 2015, award: 'TSP+' },
  // TSP
  { brand: 'BMW', model: '3 Series', year: 2015, award: 'TSP' },
  { brand: 'Honda', model: 'HR-V', year: 2015, award: 'TSP' },
  { brand: 'Hyundai', model: 'Tucson', year: 2015, award: 'TSP' },
  { brand: 'Hyundai', model: 'Santa Fe', year: 2015, award: 'TSP' },
  { brand: 'Kia', model: 'Sorento', year: 2015, award: 'TSP' },
  { brand: 'Nissan', model: 'Rogue', year: 2015, award: 'TSP' },
  { brand: 'Toyota', model: 'RAV4', year: 2015, award: 'TSP' },
  { brand: 'Toyota', model: 'Corolla', year: 2015, award: 'TSP' },
  { brand: 'Toyota', model: 'Highlander', year: 2015, award: 'TSP' },
  { brand: 'Audi', model: 'A4', year: 2015, award: 'TSP' },
  { brand: 'Audi', model: 'Q5', year: 2015, award: 'TSP' },
];

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  34-IIHS-HARDCODED');
  console.log('  IIHS Top Safety Pick awards (0 HTTP, hardcoded)');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log(`\n  Hardcoded entries: ${IIHS_DATA.length}`);

  // Load DB
  console.log('  Loading DB...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll('generations', 'id, name, production_start, production_end, model_id');
  const safety = await paginateAll('safety_ratings', 'generation_id');
  const existingSafetyGens = new Set(safety.map((s: any) => s.generation_id));

  const brandByName = new Map<string, any>();
  for (const b of brands) brandByName.set(b.name.toLowerCase(), b);

  const modelsByBrandId = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrandId.has(m.brand_id)) modelsByBrandId.set(m.brand_id, []);
    modelsByBrandId.get(m.brand_id)!.push(m);
  }

  const gensByModelId = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModelId.has(g.model_id)) gensByModelId.set(g.model_id, []);
    gensByModelId.get(g.model_id)!.push(g);
  }

  console.log(`  Existing safety: ${existingSafetyGens.size} gens`);

  const stats = {
    matched: 0,
    alreadyRated: 0,
    noGenMatch: 0,
    noBrandMatch: 0,
    noModelMatch: 0,
    inserted: 0,
  };

  const toInsert: any[] = [];
  const newSafetyGens = new Set<string>();

  for (const entry of IIHS_DATA) {
    const brand = brandByName.get(entry.brand.toLowerCase());
    if (!brand) { stats.noBrandMatch++; continue; }

    const brandModels = modelsByBrandId.get(brand.id) || [];
    let model = brandModels.find((m: any) => m.name.toLowerCase() === entry.model.toLowerCase());
    if (!model) {
      model = brandModels.find((m: any) =>
        m.name.toLowerCase().includes(entry.model.toLowerCase()) ||
        entry.model.toLowerCase().includes(m.name.toLowerCase())
      );
    }
    if (!model) { stats.noModelMatch++; continue; }

    const modelGens = gensByModelId.get(model.id) || [];
    if (modelGens.length === 0) { stats.noGenMatch++; continue; }

    // Find best generation for this year
    let bestGen: any = null;
    let bestDist = Infinity;

    for (const g of modelGens) {
      const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
      const gEnd = g.production_end ? new Date(g.production_end).getFullYear() : null;
      if (!gStart) continue;

      // Check if year falls within production range
      if (entry.year >= gStart - 1 && entry.year <= (gEnd || gStart + 10)) {
        const dist = Math.abs(entry.year - gStart);
        if (dist < bestDist) { bestDist = dist; bestGen = g; }
      }
    }

    // Fallback: closest gen by start year
    if (!bestGen) {
      for (const g of modelGens) {
        const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
        if (!gStart) continue;
        const dist = Math.abs(entry.year - gStart);
        if (dist <= 3 && dist < bestDist) { bestDist = dist; bestGen = g; }
      }
    }

    if (!bestGen) { stats.noGenMatch++; continue; }

    if (existingSafetyGens.has(bestGen.id) || newSafetyGens.has(bestGen.id)) {
      stats.alreadyRated++;
      continue;
    }

    const stars = entry.award === 'TSP+' ? 5 : 4;
    toInsert.push({
      generation_id: bestGen.id,
      stars,
      source_url: `iihs:${entry.award}:${entry.year}`,
    });
    newSafetyGens.add(bestGen.id);
    stats.matched++;
  }

  console.log(`\n  Matched: ${stats.matched} new ratings`);
  console.log(`  Already rated: ${stats.alreadyRated}`);
  console.log(`  No brand match: ${stats.noBrandMatch}`);
  console.log(`  No model match: ${stats.noModelMatch}`);
  console.log(`  No gen match: ${stats.noGenMatch}`);

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} safety ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else inserted += batch.length;
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  const newTotal = existingSafetyGens.size + stats.matched;
  console.log('\n' + '='.repeat(60));
  console.log('  IIHS HARDCODED RESULTS');
  console.log('='.repeat(60));
  console.log(`  Input: ${IIHS_DATA.length} entries`);
  console.log(`  New ratings: ${stats.matched}`);
  console.log(`  Coverage: ${existingSafetyGens.size} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'iihs-hardcoded-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: existingSafetyGens.size, after: newTotal }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
