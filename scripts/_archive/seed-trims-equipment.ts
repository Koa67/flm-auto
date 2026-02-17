/**
 * FLM AUTO — Seed Trims & Equipment for 50 popular models
 * Inserts trim levels and links them to existing equipment items
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-trims-equipment.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EqStatus = 'standard' | 'option' | 'unavailable';

interface TrimDef {
  name: string;
  marketing_name?: string;
  base_price: number;
  is_base_trim: boolean;
  sort_order: number;
  summary_fr: string;
  // Equipment mapping: equipment_name -> status (+ optional price)
  equipment: Record<string, EqStatus | [EqStatus, number]>;
}

interface ModelTrims {
  brand: string;
  model: string;
  trims: TrimDef[];
}

// ─── Equipment shortcuts ────────────────────────────────
// Standard safety package for most modern cars
const SAFETY_BASE: Record<string, EqStatus> = {
  automatic_emergency_braking: 'standard',
  lane_keep_assist: 'standard',
  parking_sensors_rear: 'standard',
};
const SAFETY_FULL: Record<string, EqStatus> = {
  ...SAFETY_BASE,
  adaptive_cruise_control: 'standard',
  blind_spot_monitoring: 'standard',
  rear_cross_traffic_alert: 'standard',
  '360_camera': 'standard',
  parking_sensors_front: 'standard',
};

// ─── MODEL DATA ─────────────────────────────────────────
const MODELS: ModelTrims[] = [
  // ═══ PEUGEOT ═══
  {
    brand: 'Peugeot', model: '208',
    trims: [
      {
        name: 'Active Pack', base_price: 20900, is_base_trim: true, sort_order: 1,
        summary_fr: 'Entrée de gamme bien équipée',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', wireless_carplay: 'unavailable', wireless_android_auto: 'unavailable', heated_seats_front: 'unavailable', digital_cockpit: 'option', keyless_entry: 'unavailable' },
      },
      {
        name: 'Allure', base_price: 23500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le meilleur rapport équipement/prix',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'option', parking_sensors_front: 'option', keyless_entry: 'option' },
      },
      {
        name: 'Allure Pack', base_price: 25200, is_base_trim: false, sort_order: 3,
        summary_fr: 'Allure enrichie avec plus de confort',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'GT', base_price: 28600, is_base_trim: false, sort_order: 4,
        summary_fr: 'Finition haut de gamme sportive',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', keyless_entry: 'standard', keyless_start: 'standard', ambient_lighting: 'standard' },
      },
    ],
  },
  {
    brand: 'Peugeot', model: '308',
    trims: [
      {
        name: 'Active Pack', base_price: 26600, is_base_trim: true, sort_order: 1,
        summary_fr: 'Entrée de gamme avec i-Cockpit',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'unavailable', heated_seats_front: 'unavailable' },
      },
      {
        name: 'Allure', base_price: 29200, is_base_trim: false, sort_order: 2,
        summary_fr: 'Équipement complet et connecté',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', keyless_entry: 'option' },
      },
      {
        name: 'GT', base_price: 34500, is_base_trim: false, sort_order: 3,
        summary_fr: 'Premium et sportif',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', keyless_entry: 'standard', keyless_start: 'standard', heated_seats_front: 'standard', ambient_lighting: 'standard', electric_seats_driver: 'standard' },
      },
    ],
  },
  {
    brand: 'Peugeot', model: '3008',
    trims: [
      {
        name: 'Active Pack', base_price: 34500, is_base_trim: true, sort_order: 1,
        summary_fr: 'SUV familial bien équipé dès la base',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Allure', base_price: 37500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le choix de la majorité',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'GT', base_price: 43000, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le sommet de la gamme',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', electric_seats_passenger: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', head_up_display: 'option', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  {
    brand: 'Peugeot', model: '5008',
    trims: [
      {
        name: 'Active Pack', base_price: 37500, is_base_trim: true, sort_order: 1,
        summary_fr: 'SUV 7 places abordable',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Allure', base_price: 40500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Confort et connectivité pour la famille',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'GT', base_price: 47000, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le SUV familial premium PSA',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', tri_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ RENAULT ═══
  {
    brand: 'Renault', model: 'Clio',
    trims: [
      {
        name: 'Evolution', base_price: 19400, is_base_trim: true, sort_order: 1,
        summary_fr: 'Bien équipée pour le prix',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', wireless_carplay: 'unavailable', heated_seats_front: 'unavailable' },
      },
      {
        name: 'Techno', base_price: 23300, is_base_trim: false, sort_order: 2,
        summary_fr: 'Technologie et confort au rendez-vous',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'Esprit Alpine', base_price: 26100, is_base_trim: false, sort_order: 3,
        summary_fr: 'Finition sportive et distinguée',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', keyless_entry: 'standard', ambient_lighting: 'standard' },
      },
    ],
  },
  {
    brand: 'Renault', model: 'Austral',
    trims: [
      {
        name: 'Evolution', base_price: 33500, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV familial Renault accessible',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Techno', base_price: 37000, is_base_trim: false, sort_order: 2,
        summary_fr: 'Connectivité OpenR Link et confort supérieur',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', head_up_display: 'option', keyless_entry: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Esprit Alpine', base_price: 42000, is_base_trim: false, sort_order: 3,
        summary_fr: 'Sportivité et raffinement maximal',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', head_up_display: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', premium_audio: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ VOLKSWAGEN ═══
  {
    brand: 'Volkswagen', model: 'Golf',
    trims: [
      {
        name: 'Life', base_price: 29990, is_base_trim: true, sort_order: 1,
        summary_fr: 'L\'essentiel de la Golf',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard' },
      },
      {
        name: 'Style', base_price: 34500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Confort et élégance',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'R-Line', base_price: 38000, is_base_trim: false, sort_order: 3,
        summary_fr: 'Style sportif sans compromis',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard', electric_seats_driver: 'option', head_up_display: 'option' },
      },
    ],
  },
  {
    brand: 'Volkswagen', model: 'Tiguan',
    trims: [
      {
        name: 'Life', base_price: 38000, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV familial VW essentiel',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Elegance', base_price: 43500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Confort premium et technologie avancée',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', head_up_display: 'standard', keyless_entry: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'R-Line', base_price: 46000, is_base_trim: false, sort_order: 3,
        summary_fr: 'Look sportif avec équipement complet',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', head_up_display: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_19: 'standard', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ BMW ═══
  {
    brand: 'BMW', model: 'Serie 3',
    trims: [
      {
        name: 'Lounge', base_price: 44950, is_base_trim: true, sort_order: 1,
        summary_fr: 'L\'élégance BMW accessible',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'M Sport', base_price: 51500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Sportivité et dynamisme au quotidien',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', ambient_lighting: 'standard', head_up_display: 'option', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard', memory_seats: 'option' },
      },
    ],
  },
  {
    brand: 'BMW', model: 'X3',
    trims: [
      {
        name: 'Lounge', base_price: 52950, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV premium BMW pour la famille',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard', split_folding_rear_seats: 'standard', power_tailgate: 'standard' },
      },
      {
        name: 'M Sport', marketing_name: 'M Sport', base_price: 59500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Performance et style M',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', ambient_lighting: 'standard', head_up_display: 'option', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_19: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ MERCEDES ═══
  {
    brand: 'Mercedes-Benz', model: 'Classe C',
    trims: [
      {
        name: 'Avantgarde Line', base_price: 48900, is_base_trim: true, sort_order: 1,
        summary_fr: 'Élégance et modernité Mercedes',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard' },
      },
      {
        name: 'AMG Line', base_price: 55500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Style sportif AMG, confort Mercedes',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', memory_seats: 'standard', ambient_lighting: 'standard', head_up_display: 'option', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard', premium_audio: 'option' },
      },
    ],
  },
  {
    brand: 'Mercedes-Benz', model: 'GLC',
    trims: [
      {
        name: 'Avantgarde Line', base_price: 55900, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV premium confortable',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'AMG Line', base_price: 62500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le GLC dynamique et luxueux',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', memory_seats: 'standard', ambient_lighting: 'standard', head_up_display: 'option', panoramic_roof: 'option', premium_audio: 'option', keyless_entry: 'standard', keyless_start: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ TESLA ═══
  {
    brand: 'Tesla', model: 'Model 3',
    trims: [
      {
        name: 'Propulsion', base_price: 38990, is_base_trim: true, sort_order: 1,
        summary_fr: 'La Tesla accessible',
        equipment: { ...SAFETY_FULL, led_headlights: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Grande Autonomie', marketing_name: 'Long Range', base_price: 46990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Jusqu\'à 629 km d\'autonomie',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', heated_steering_wheel: 'standard', premium_audio: 'standard', keyless_entry: 'standard', keyless_start: 'standard', ambient_lighting: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Performance', base_price: 52990, is_base_trim: false, sort_order: 3,
        summary_fr: '0-100 en 3.1s, la sportive électrique',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', heated_steering_wheel: 'standard', premium_audio: 'standard', keyless_entry: 'standard', keyless_start: 'standard', ambient_lighting: 'standard', alloy_wheels_19: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  {
    brand: 'Tesla', model: 'Model Y',
    trims: [
      {
        name: 'Propulsion', base_price: 42990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV électrique best-seller',
        equipment: { ...SAFETY_FULL, led_headlights: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', keyless_entry: 'standard', keyless_start: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Grande Autonomie', marketing_name: 'Long Range AWD', base_price: 49990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Autonomie maximale et transmission intégrale',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', heated_steering_wheel: 'standard', premium_audio: 'standard', keyless_entry: 'standard', keyless_start: 'standard', ambient_lighting: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Performance', base_price: 56990, is_base_trim: false, sort_order: 3,
        summary_fr: '0-100 en 3.7s avec 4 roues motrices',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_charging: 'standard', heated_seats_front: 'standard', heated_seats_rear: 'standard', heated_steering_wheel: 'standard', premium_audio: 'standard', keyless_entry: 'standard', keyless_start: 'standard', ambient_lighting: 'standard', alloy_wheels_19: 'standard', power_tailgate: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ DACIA ═══
  {
    brand: 'Dacia', model: 'Duster',
    trims: [
      {
        name: 'Essential', base_price: 19490, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV au prix imbattable',
        equipment: { automatic_emergency_braking: 'standard', lane_keep_assist: 'standard', led_headlights: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Expression', base_price: 21490, is_base_trim: false, sort_order: 2,
        summary_fr: 'Connectivité et confort en plus',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'option', led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', split_folding_rear_seats: 'standard', parking_sensors_front: 'option' },
      },
      {
        name: 'Extreme', base_price: 24990, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le Duster tout équipé',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', keyless_entry: 'standard', '360_camera': 'standard', split_folding_rear_seats: 'standard', roof_rails: 'standard' },
      },
    ],
  },
  {
    brand: 'Dacia', model: 'Sandero',
    trims: [
      {
        name: 'Essential', base_price: 11990, is_base_trim: true, sort_order: 1,
        summary_fr: 'La voiture neuve la moins chère',
        equipment: { automatic_emergency_braking: 'standard', lane_keep_assist: 'standard' },
      },
      {
        name: 'Expression', base_price: 14490, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le meilleur rapport qualité-prix du marché',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard' },
      },
      {
        name: 'Extreme', base_price: 16490, is_base_trim: false, sort_order: 3,
        summary_fr: 'Sandero suréquipée',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', parking_sensors_rear: 'standard', keyless_entry: 'standard' },
      },
    ],
  },
  {
    brand: 'Dacia', model: 'Jogger',
    trims: [
      {
        name: 'Essential', base_price: 17490, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le break 7 places accessible',
        equipment: { automatic_emergency_braking: 'standard', lane_keep_assist: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Expression', base_price: 19490, is_base_trim: false, sort_order: 2,
        summary_fr: 'Familial connecté',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Extreme', base_price: 22490, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le Jogger ultime',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', keyless_entry: 'standard', '360_camera': 'standard', split_folding_rear_seats: 'standard', roof_rails: 'standard' },
      },
    ],
  },
  // ═══ TOYOTA ═══
  {
    brand: 'Toyota', model: 'Corolla',
    trims: [
      {
        name: 'Dynamic', base_price: 30990, is_base_trim: true, sort_order: 1,
        summary_fr: 'L\'hybride japonaise fiable',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard' },
      },
      {
        name: 'Design', base_price: 34490, is_base_trim: false, sort_order: 2,
        summary_fr: 'Plus de style et de confort',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard', keyless_start: 'standard', heated_seats_front: 'standard', alloy_wheels_17: 'standard' },
      },
      {
        name: 'Collection', base_price: 37990, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le meilleur de la Corolla',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', head_up_display: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard' },
      },
    ],
  },
  {
    brand: 'Toyota', model: 'RAV4',
    trims: [
      {
        name: 'Dynamic', base_price: 38990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV hybride référence',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Collection', base_price: 44990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Équipement complet pour la famille',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', head_up_display: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ HYUNDAI ═══
  {
    brand: 'Hyundai', model: 'Tucson',
    trims: [
      {
        name: 'Intuitive', base_price: 33400, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV coréen bien né',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Creative', base_price: 38400, is_base_trim: false, sort_order: 2,
        summary_fr: 'Technologie et design distinctif',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', ventilated_seats: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', head_up_display: 'standard', keyless_entry: 'standard', keyless_start: 'standard', panoramic_roof: 'option', premium_audio: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  {
    brand: 'Hyundai', model: 'Ioniq 5',
    trims: [
      {
        name: 'Intuitive', base_price: 43500, is_base_trim: true, sort_order: 1,
        summary_fr: 'L\'électrique design coréenne',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Creative', base_price: 49500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le premium électrique coréen',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', ventilated_seats: 'standard', electric_seats_driver: 'standard', electric_seats_passenger: 'standard', memory_seats: 'standard', power_tailgate: 'standard', head_up_display: 'standard', premium_audio: 'standard', panoramic_roof: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ KIA ═══
  {
    brand: 'Kia', model: 'Sportage',
    trims: [
      {
        name: 'Motion', base_price: 31990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV familial Kia accessible',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Style', base_price: 36990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Design et technologie avancée',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', ventilated_seats: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', head_up_display: 'standard', keyless_entry: 'standard', keyless_start: 'standard', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  {
    brand: 'Kia', model: 'EV6',
    trims: [
      {
        name: 'Air', base_price: 47990, is_base_trim: true, sort_order: 1,
        summary_fr: 'L\'électrique sportive de Kia',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', keyless_entry: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'GT-Line', base_price: 55990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le sommet de la gamme EV6',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', ventilated_seats: 'standard', electric_seats_driver: 'standard', memory_seats: 'standard', power_tailgate: 'standard', head_up_display: 'standard', premium_audio: 'standard', panoramic_roof: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ SKODA ═══
  {
    brand: 'Skoda', model: 'Octavia',
    trims: [
      {
        name: 'Active', base_price: 28990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le choix rationnel',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Style', base_price: 33990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Simply Clever au complet',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  {
    brand: 'Skoda', model: 'Kodiaq',
    trims: [
      {
        name: 'Selection', base_price: 39990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV 7 places malin',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Style', base_price: 45990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Familial tout équipé',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', tri_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ MAZDA ═══
  {
    brand: 'Mazda', model: 'CX-5',
    trims: [
      {
        name: 'Elegance', base_price: 31990, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV au plaisir de conduite',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Homura', base_price: 38990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Sportif et exclusif',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', ventilated_seats: 'standard', electric_seats_driver: 'standard', head_up_display: 'standard', keyless_entry: 'standard', keyless_start: 'standard', leather_seats: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ HONDA ═══
  {
    brand: 'Honda', model: 'Civic',
    trims: [
      {
        name: 'Elegance', base_price: 34990, is_base_trim: true, sort_order: 1,
        summary_fr: 'La Civic hybride moderne',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard' },
      },
      {
        name: 'Advance', base_price: 38990, is_base_trim: false, sort_order: 2,
        summary_fr: 'Tout équipée sans option',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard' },
      },
    ],
  },
  // ═══ VOLVO ═══
  {
    brand: 'Volvo', model: 'XC40',
    trims: [
      {
        name: 'Core', base_price: 37800, is_base_trim: true, sort_order: 1,
        summary_fr: 'Sécurité scandinave accessible',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Plus', base_price: 43500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le XC40 au complet',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', heated_steering_wheel: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', head_up_display: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', premium_audio: 'option', panoramic_roof: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ CITROEN ═══
  {
    brand: 'Citroen', model: 'C5 Aircross',
    trims: [
      {
        name: 'Start', base_price: 28900, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le confort Citroën accessible',
        equipment: { ...SAFETY_BASE, led_headlights: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Feel Pack', base_price: 32500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Le compromis idéal',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', blind_spot_monitoring: 'standard', led_headlights: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', keyless_entry: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'Shine Pack', base_price: 37500, is_base_trim: false, sort_order: 3,
        summary_fr: 'Le premium Citroën',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', power_tailgate: 'standard', keyless_entry: 'standard', keyless_start: 'standard', split_folding_rear_seats: 'standard' },
      },
    ],
  },
  // ═══ FORD ═══
  {
    brand: 'Ford', model: 'Puma',
    trims: [
      {
        name: 'Titanium', base_price: 28900, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le petit SUV fun',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard' },
      },
      {
        name: 'ST-Line X', base_price: 33900, is_base_trim: false, sort_order: 2,
        summary_fr: 'Sportif et bien équipé',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', heated_steering_wheel: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard' },
      },
    ],
  },
  // ═══ AUDI ═══
  {
    brand: 'Audi', model: 'A3',
    trims: [
      {
        name: 'Design', base_price: 33500, is_base_trim: true, sort_order: 1,
        summary_fr: 'La compacte premium Audi',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard' },
      },
      {
        name: 'S line', base_price: 39500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Sportivité et technologie',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_18: 'standard', electric_seats_driver: 'option', head_up_display: 'option' },
      },
    ],
  },
  {
    brand: 'Audi', model: 'Q3',
    trims: [
      {
        name: 'Design', base_price: 39500, is_base_trim: true, sort_order: 1,
        summary_fr: 'Le SUV compact premium',
        equipment: { ...SAFETY_BASE, adaptive_cruise_control: 'standard', led_headlights: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', dual_zone_climate: 'standard', split_folding_rear_seats: 'standard' },
      },
      {
        name: 'S line', base_price: 45500, is_base_trim: false, sort_order: 2,
        summary_fr: 'Style sportif et équipement complet',
        equipment: { ...SAFETY_FULL, matrix_led: 'standard', digital_cockpit: 'standard', wireless_carplay: 'standard', wireless_android_auto: 'standard', wireless_charging: 'standard', dual_zone_climate: 'standard', heated_seats_front: 'standard', electric_seats_driver: 'standard', ambient_lighting: 'standard', keyless_entry: 'standard', keyless_start: 'standard', alloy_wheels_19: 'standard', power_tailgate: 'option', split_folding_rear_seats: 'standard' },
      },
    ],
  },
];

// Equipment name -> UUID cache
const equipmentCache: Record<string, string> = {};

async function loadEquipmentIds(): Promise<void> {
  const { data } = await supabase.from('equipment').select('id, name');
  if (data) {
    for (const eq of data) {
      equipmentCache[eq.name] = eq.id;
    }
  }
  console.log(`📦 Loaded ${Object.keys(equipmentCache).length} equipment IDs`);
}

async function findGenerationId(brand: string, model: string): Promise<string | null> {
  const { data } = await supabase
    .from('generations')
    .select('id, name, production_start, models!inner(name, brands!inner(name))')
    .ilike('models.brands.name', `%${brand}%`)
    .ilike('models.name', `%${model}%`)
    .order('production_start', { ascending: false })
    .limit(1);
  return data?.[0]?.id || null;
}

async function main() {
  console.log('🏷️  FLM AUTO — Trims & Equipment Seeder');
  console.log(`📊 ${MODELS.length} models, ~${MODELS.reduce((a, m) => a + m.trims.length, 0)} trims to seed\n`);

  await loadEquipmentIds();

  let totalTrims = 0;
  let totalLinks = 0;
  let notFound = 0;

  for (const modelDef of MODELS) {
    const genId = await findGenerationId(modelDef.brand, modelDef.model);

    if (!genId) {
      console.log(`  ❌ ${modelDef.brand} ${modelDef.model} — generation not found`);
      notFound++;
      continue;
    }

    for (const trimDef of modelDef.trims) {
      // Insert trim
      const { data: trim, error: trimErr } = await supabase
        .from('trims')
        .upsert(
          {
            generation_id: genId,
            name: trimDef.name,
            marketing_name: trimDef.marketing_name || null,
            base_price: trimDef.base_price,
            is_base_trim: trimDef.is_base_trim,
            sort_order: trimDef.sort_order,
            summary_fr: trimDef.summary_fr,
          },
          { onConflict: 'generation_id,name' }
        )
        .select('id')
        .single();

      if (trimErr || !trim) {
        console.log(`  ⚠️  ${modelDef.brand} ${modelDef.model} ${trimDef.name} — ${trimErr?.message}`);
        continue;
      }

      totalTrims++;

      // Insert equipment links
      const links: Array<{ trim_id: string; equipment_id: string; status: string; option_price: number | null }> = [];

      for (const [eqName, statusOrTuple] of Object.entries(trimDef.equipment)) {
        const eqId = equipmentCache[eqName];
        if (!eqId) continue;

        const status = Array.isArray(statusOrTuple) ? statusOrTuple[0] : statusOrTuple;
        const optionPrice = Array.isArray(statusOrTuple) ? statusOrTuple[1] : null;

        links.push({ trim_id: trim.id, equipment_id: eqId, status, option_price: optionPrice });
      }

      if (links.length > 0) {
        const { error: linkErr } = await supabase.from('trim_equipment').upsert(links, {
          onConflict: 'trim_id,equipment_id',
        });
        if (linkErr) {
          console.log(`  ⚠️  ${trimDef.name} links — ${linkErr.message}`);
        } else {
          totalLinks += links.length;
        }
      }
    }

    console.log(`  ✅ ${modelDef.brand} ${modelDef.model} — ${modelDef.trims.length} trims`);
  }

  console.log(`\n🎉 Done! Trims: ${totalTrims}, Equipment links: ${totalLinks}, Not found: ${notFound}`);
}

main().catch(console.error);
