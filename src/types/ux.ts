// Types for UX interior scoring

export interface UXInteriorRating {
  generation_id: string;

  // Commandes
  physical_buttons_climate: number;
  physical_buttons_volume: number;
  physical_buttons_other: number;

  // Écran
  screen_size_inches: number;
  screen_responsiveness: number;
  screen_lag_ms?: number;
  screen_glare_resistance: number;
  menu_depth: number;

  // Ergonomie
  steering_wheel_buttons: number;
  gear_selector_usability: number;
  turn_signal_stalk: boolean;
  wiper_stalk: boolean;

  // Visibilité
  visibility_front: number;
  visibility_rear: number;
  visibility_three_quarters: number;
  pillar_a_thickness_mm?: number;

  // Confort sièges
  seat_comfort_short: number;
  seat_comfort_long: number;
  seat_adjustments_driver: number;
  seat_adjustments_passenger: number;
  lumbar_support: boolean;
  massage_function: boolean;
  ventilated_seats: boolean;

  // Bruit
  noise_level_idle_db?: number;
  noise_level_city_db?: number;
  noise_level_highway_db: number;

  // Tech
  wireless_carplay: boolean;
  wireless_android_auto: boolean;
  usb_ports_front: number;
  usb_ports_rear: number;
  usb_type_c: boolean;
  wireless_charging: boolean;
  hud_available: boolean;

  // Qualité
  materials_quality: number;
  soft_touch_surfaces: number;
  squeaks_rattles: number;

  // Scores calculés
  overall_ux_score?: number;
  family_friendly_score?: number;
  senior_friendly_score?: number;
}

export interface UXScoreWeights {
  physical_buttons: number;
  screen: number;
  ergonomics: number;
  visibility: number;
  comfort: number;
  noise: number;
  tech: number;
  quality: number;
}

export const DEFAULT_UX_WEIGHTS: UXScoreWeights = {
  physical_buttons: 0.2,
  screen: 0.15,
  ergonomics: 0.15,
  visibility: 0.1,
  comfort: 0.15,
  noise: 0.1,
  tech: 0.1,
  quality: 0.05,
};

export function calculateUXScore(
  rating: UXInteriorRating,
  weights: UXScoreWeights = DEFAULT_UX_WEIGHTS
): number {
  const scores = {
    physical_buttons:
      rating.physical_buttons_climate * 0.4 +
      rating.physical_buttons_volume * 0.4 +
      rating.physical_buttons_other * 0.2,
    screen:
      rating.screen_responsiveness * 0.5 +
      (10 - Math.min(rating.menu_depth, 10)) * 0.3 +
      rating.screen_glare_resistance * 0.2,
    ergonomics:
      rating.steering_wheel_buttons * 0.4 +
      rating.gear_selector_usability * 0.3 +
      (rating.turn_signal_stalk ? 10 : 5) * 0.15 +
      (rating.wiper_stalk ? 10 : 5) * 0.15,
    visibility:
      rating.visibility_front * 0.4 +
      rating.visibility_rear * 0.3 +
      rating.visibility_three_quarters * 0.3,
    comfort:
      rating.seat_comfort_short * 0.3 +
      rating.seat_comfort_long * 0.5 +
      Math.min(rating.seat_adjustments_driver / 12, 1) * 10 * 0.2,
    noise: Math.max(0, 10 - (rating.noise_level_highway_db - 60) / 3),
    tech:
      ((rating.wireless_carplay ? 3 : 0) +
        (rating.wireless_android_auto ? 3 : 0) +
        Math.min(rating.usb_ports_front + rating.usb_ports_rear, 4) +
        (rating.hud_available ? 2 : 0)) /
      10 *
      10,
    quality:
      rating.materials_quality * 0.4 +
      rating.soft_touch_surfaces * 0.3 +
      rating.squeaks_rattles * 0.3,
  };

  const overall = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + (scores[key as keyof typeof scores] || 0) * weight;
  }, 0);

  return Math.round(overall * 10);
}

export interface UXVerdict {
  text: string;
  color: "green" | "blue" | "amber" | "orange" | "red";
}

export function getUXVerdict(score: number): UXVerdict {
  if (score >= 80) return { text: "Excellent", color: "green" };
  if (score >= 65) return { text: "Bon", color: "blue" };
  if (score >= 50) return { text: "Correct", color: "amber" };
  if (score >= 35) return { text: "Médiocre", color: "orange" };
  return { text: "À éviter", color: "red" };
}
