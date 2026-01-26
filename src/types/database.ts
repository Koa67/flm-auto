// Types générés à partir du schema Supabase
// Régénérer avec: npx supabase gen types typescript --project-id xxx > src/types/database.ts

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string
          slug: string
          name: string
          name_display: string | null
          country_origin: string | null
          founded_year: number | null
          parent_company: string | null
          logo_url: string | null
          website_url: string | null
          description_fr: string | null
          description_en: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['brands']['Insert']>
      }
      models: {
        Row: {
          id: string
          brand_id: string
          slug: string
          name: string
          name_internal: string | null
          segment: string | null
          body_styles: string[] | null
          first_year: number | null
          last_year: number | null
          is_current: boolean
          description_fr: string | null
          description_en: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['models']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['models']['Insert']>
      }
      generations: {
        Row: {
          id: string
          model_id: string
          slug: string
          name: string
          chassis_code: string | null
          internal_code: string | null
          production_start: string | null
          production_end: string | null
          facelift_year: number | null
          platform: string | null
          body_style: string | null
          doors: number | null
          predecessor_id: string | null
          successor_id: string | null
          description_fr: string | null
          description_en: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['generations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['generations']['Insert']>
      }
      engine_variants: {
        Row: {
          id: string
          generation_id: string
          slug: string
          name: string
          engine_code: string | null
          fuel_type: string | null
          is_performance_variant: boolean
          badge: string | null
          market_availability: string[] | null
          production_start: string | null
          production_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['engine_variants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['engine_variants']['Insert']>
      }
      powertrain_specs: {
        Row: {
          id: string
          engine_variant_id: string
          engine_type: string | null
          cylinders: number | null
          displacement_cc: number | null
          displacement_liters: number | null
          power_hp: number | null
          power_kw: number | null
          power_rpm: number | null
          torque_nm: number | null
          torque_rpm: number | null
          aspiration: string | null
          fuel_system: string | null
          compression_ratio: number | null
          transmission_type: string | null
          gears: number | null
          drivetrain: string | null
          differential_type: string | null
          electric_motor_power_kw: number | null
          battery_capacity_kwh: number | null
          electric_range_km: number | null
          source_type: string
          source_url: string | null
          confidence: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['powertrain_specs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['powertrain_specs']['Insert']>
      }
      performance_specs: {
        Row: {
          id: string
          engine_variant_id: string
          acceleration_0_100_kmh: number | null
          acceleration_0_60_mph: number | null
          acceleration_0_200_kmh: number | null
          acceleration_0_300_kmh: number | null
          quarter_mile_seconds: number | null
          quarter_mile_speed_kmh: number | null
          top_speed_kmh: number | null
          top_speed_limited: boolean
          acceleration_80_120_kmh: number | null
          acceleration_100_200_kmh: number | null
          braking_100_0_kmh: number | null
          braking_200_0_kmh: number | null
          nurburgring_time: string | null
          nurburgring_variant: string | null
          data_source: string | null
          test_conditions: string | null
          source_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['performance_specs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['performance_specs']['Insert']>
      }
    }
    Views: {
      vehicle_overview: {
        Row: {
          variant_id: string
          brand_name: string
          brand_slug: string
          model_name: string
          model_slug: string
          generation_name: string
          chassis_code: string | null
          production_start: string | null
          production_end: string | null
          body_style: string | null
          variant_name: string
          fuel_type: string | null
          is_performance_variant: boolean
          power_hp: number | null
          torque_nm: number | null
          displacement_liters: number | null
          transmission_type: string | null
          drivetrain: string | null
          acceleration_0_100_kmh: number | null
          top_speed_kmh: number | null
          length_mm: number | null
          width_mm: number | null
          height_mm: number | null
          trunk_volume_liters: number | null
          curb_weight_kg: number | null
          wltp_combined_l100km: number | null
        }
      }
    }
    Functions: {
      search_vehicles: {
        Args: { search_term: string }
        Returns: {
          variant_id: string
          brand_name: string
          model_name: string
          generation_name: string
          variant_name: string
          relevance: number
        }[]
      }
    }
  }
}

// Convenience types
export type Brand = Database['public']['Tables']['brands']['Row']
export type Model = Database['public']['Tables']['models']['Row']
export type Generation = Database['public']['Tables']['generations']['Row']
export type EngineVariant = Database['public']['Tables']['engine_variants']['Row']
export type PowertrainSpecs = Database['public']['Tables']['powertrain_specs']['Row']
export type PerformanceSpecs = Database['public']['Tables']['performance_specs']['Row']
export type VehicleOverview = Database['public']['Views']['vehicle_overview']['Row']
