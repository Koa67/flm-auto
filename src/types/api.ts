/**
 * FLM AUTO - Shared API Types
 * Used by both API routes and frontend
 */

// ============================================
// Common
// ============================================

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  error: string;
  data?: never;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ============================================
// Brand
// ============================================

export interface Brand {
  id: string;
  name: string;
  slug: string;
  country?: string | null;
  logo_url?: string | null;
  stats: {
    models: number;
    generations: number;
  };
}

export interface BrandRef {
  id: string;
  name: string;
  slug: string;
}

// ============================================
// Model
// ============================================

export interface ModelRef {
  id: string;
  name: string;
  slug: string;
}

// ============================================
// Generation
// ============================================

export interface GenerationRef {
  id: string;
  name: string;
  slug: string;
  internal_code: string | null;
  chassis_code?: string | null;
  year_start: number | null;
  year_end: number | null;
}

// ============================================
// Vehicle (List Item)
// ============================================

export interface VehicleListItem {
  id: string;
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  generation: string;
  generation_slug: string;
  year_start: number | null;
  year_end: number | null;
}

// ============================================
// Vehicle (Full Detail)
// ============================================

export interface VehicleDetail {
  id: string;
  brand: BrandRef;
  model: ModelRef;
  generation: GenerationRef;
  variants: Variant[];
  variants_count: number;
  safety: SafetyRating | null;
  screen_appearances: ScreenAppearances;
}

export interface Variant {
  id: string;
  name: string;
  engine_code: string | null;
  fuel_type: string | null;
  displacement_cc: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  transmission: string | null;
  drivetrain: string | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
}

export interface SafetyRating {
  rating: number;
  test_year: number;
  adult_occupant: number | null;
  child_occupant: number | null;
  pedestrian: number | null;
  safety_assist: number | null;
  source_url: string | null;
}

export interface ScreenAppearances {
  films: FilmAppearance[];
  games: GameAppearance[];
}

export interface FilmAppearance {
  title: string;
  year: number | null;
  type: 'movie' | 'tv_series' | 'documentary';
  role: 'star' | 'featured' | 'background';
}

export interface GameAppearance {
  title: string;
  year: number | null;
  playable: boolean;
}

// ============================================
// Search
// ============================================

export interface SearchResult {
  id: string;
  label: string;
  brand: string;
  model: string;
  generation: string;
  slug: string;
  year_start: number | null;
  year_end: number | null;
}

export interface SearchResponse {
  data: SearchResult[];
  query: string;
  count: number;
}

// ============================================
// Compare
// ============================================

export interface CompareVehicle {
  id: string;
  brand: string;
  model: string;
  generation: string;
  years: string;
  top_spec: TopSpec | null;
  base_spec: BaseSpec | null;
  power_range: PowerRange | null;
  variants_count: number;
  safety: {
    rating: number;
    year: number;
  } | null;
}

export interface TopSpec {
  name: string;
  power_hp: number | null;
  torque_nm: number | null;
  displacement_cc: number | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
}

export interface BaseSpec {
  name: string;
  power_hp: number | null;
}

export interface PowerRange {
  min: number | null;
  max: number | null;
}

export interface CompareResponse {
  data: {
    vehicles: CompareVehicle[];
    insights: string[];
  };
}

// ============================================
// Screen Cars
// ============================================

export interface ScreenCar {
  generation_id: string;
  brand: string;
  model: string;
  generation: string | null;
  stats: {
    total_appearances: number;
    movies_count: number;
    games_count: number;
    star_roles: number;
  };
  notable_titles: {
    title: string;
    year: number;
    type: string;
  }[];
}

export interface ScreenCarsResponse {
  data: ScreenCar[];
  summary: {
    total_appearances: number;
    unique_movies: number;
    unique_games: number;
    vehicles_count: number;
  };
}

// ============================================
// Health Check
// ============================================

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  database: {
    connected: boolean;
    latency_ms: number;
  };
  stats: {
    generations: number;
    variants: number;
    appearances: number;
  };
}
