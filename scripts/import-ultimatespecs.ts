#!/usr/bin/env ts-node
/**
 * FLM AUTO - Import UltimateSpecs JSON → Supabase
 * 
 * Usage:
 *   npx ts-node scripts/import-ultimatespecs.ts ../FLM_NXUS/ultimatespecs_data/
 * 
 * Expects JSON files: mercedes_benz.json, bmw.json, lamborghini.json
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load env
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

interface ScrapedVehicle {
  brand: string
  model: string
  variant: string
  engine_type: string | null
  displacement_cc: number | null
  cylinders: number | null
  power_hp: number | null
  power_kw: number | null
  torque_nm: number | null
  acceleration_0_100: number | null
  top_speed_kmh: number | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  wheelbase_mm: number | null
  trunk_volume_l: number | null
  curb_weight_kg: number | null
  drivetrain: string | null
  fuel_consumption_l100km: number | null
  co2_gkm: number | null
  source_url: string | null
  scraped_at: string | null
}

// Slug generator
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}

// Extract model name from variant (e.g., "BMW G81 M3 Touring LCI" → "M3")
function extractModelName(variant: string, brand: string): string {
  // Remove brand prefix
  let name = variant.replace(new RegExp(`^${brand}\\s*`, 'i'), '')
  
  // Common patterns
  const patterns = [
    /^([A-Z]-?Class)/i,           // Mercedes: A-Class, E-Class
    /^(CLA|CLS|GLA|GLC|GLE|GLS|AMG GT)/i, // Mercedes models
    /^[A-Z]\d{2,3}\s+(\w+)/,      // BMW: G81 M3 → M3
    /^(\d\s*Series)/i,            // BMW: 3 Series
    /^(M\d)/i,                    // BMW M cars
    /^(X\d)/i,                    // BMW X cars
    /^([A-Za-z]+)/,               // First word (Lamborghini: Aventador, Huracan)
  ]
  
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  // Fallback: first word
  return name.split(/\s+/)[0] || 'Unknown'
}

// Extract generation/chassis code
function extractChassisCode(variant: string): string | null {
  // BMW: G81, F30, E46, etc.
  const bmwMatch = variant.match(/\b([EFGU]\d{2})\b/)
  if (bmwMatch) return bmwMatch[1]
  
  // Mercedes: W124, W205, X174, etc.
  const mbMatch = variant.match(/\b([WVXCRA]\d{3})\b/)
  if (mbMatch) return mbMatch[1]
  
  // Lamborghini: LP400, LP640, etc.
  const lamboMatch = variant.match(/\b(LP\d{3})\b/)
  if (lamboMatch) return lamboMatch[1]
  
  return null
}

async function getBrandId(brandName: string): Promise<string | null> {
  const slug = slugify(brandName)
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', slug)
    .single()
  
  if (error || !data) {
    console.error(`❌ Brand not found: ${brandName}`)
    return null
  }
  return data.id
}

async function upsertModel(brandId: string, modelName: string): Promise<string> {
  const slug = slugify(modelName)
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('models')
    .select('id')
    .eq('brand_id', brandId)
    .eq('slug', slug)
    .single()
  
  if (existing) return existing.id
  
  // Insert new
  const { data, error } = await supabase
    .from('models')
    .insert({
      brand_id: brandId,
      slug,
      name: modelName,
      is_current: true
    })
    .select('id')
    .single()
  
  if (error) throw new Error(`Failed to insert model ${modelName}: ${error.message}`)
  return data.id
}

async function upsertGeneration(modelId: string, chassisCode: string | null, variant: string): Promise<string> {
  const name = chassisCode || 'Default'
  const slug = slugify(name)
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('generations')
    .select('id')
    .eq('model_id', modelId)
    .eq('slug', slug)
    .single()
  
  if (existing) return existing.id
  
  // Insert new
  const { data, error } = await supabase
    .from('generations')
    .insert({
      model_id: modelId,
      slug,
      name,
      chassis_code: chassisCode
    })
    .select('id')
    .single()
  
  if (error) throw new Error(`Failed to insert generation ${name}: ${error.message}`)
  return data.id
}

async function importVehicle(vehicle: ScrapedVehicle, brandId: string): Promise<boolean> {
  try {
    const modelName = extractModelName(vehicle.variant, vehicle.brand)
    const chassisCode = extractChassisCode(vehicle.variant)
    
    // 1. Upsert model
    const modelId = await upsertModel(brandId, modelName)
    
    // 2. Upsert generation
    const generationId = await upsertGeneration(modelId, chassisCode, vehicle.variant)
    
    // 3. Insert engine variant
    const variantSlug = slugify(vehicle.variant)
    
    const { data: existingVariant } = await supabase
      .from('engine_variants')
      .select('id')
      .eq('generation_id', generationId)
      .eq('slug', variantSlug)
      .single()
    
    let variantId: string
    
    if (existingVariant) {
      variantId = existingVariant.id
    } else {
      const fuelType = vehicle.engine_type?.toLowerCase().includes('electric') ? 'electrique' :
                       vehicle.drivetrain?.includes('Hybrid') ? 'hybride' : 'essence'
      
      const { data: newVariant, error } = await supabase
        .from('engine_variants')
        .insert({
          generation_id: generationId,
          slug: variantSlug,
          name: vehicle.variant,
          fuel_type: fuelType,
          is_performance_variant: /AMG|M\s*\d|Competition|CS|SVJ|Performante/i.test(vehicle.variant)
        })
        .select('id')
        .single()
      
      if (error) throw error
      variantId = newVariant.id
    }
    
    // 4. Insert powertrain specs
    const { error: powertrainError } = await supabase
      .from('powertrain_specs')
      .upsert({
        engine_variant_id: variantId,
        engine_type: vehicle.engine_type,
        cylinders: vehicle.cylinders,
        displacement_cc: vehicle.displacement_cc,
        power_hp: vehicle.power_hp,
        power_kw: vehicle.power_kw,
        torque_nm: vehicle.torque_nm,
        drivetrain: vehicle.drivetrain,
        source_type: 'scrape',
        source_url: vehicle.source_url,
        confidence: 'medium'
      }, { onConflict: 'engine_variant_id' })
    
    if (powertrainError) console.warn(`  Powertrain upsert warning: ${powertrainError.message}`)
    
    // 5. Insert performance specs
    const { error: perfError } = await supabase
      .from('performance_specs')
      .upsert({
        engine_variant_id: variantId,
        acceleration_0_100_kmh: vehicle.acceleration_0_100,
        top_speed_kmh: vehicle.top_speed_kmh,
        data_source: 'ultimatespecs',
        source_url: vehicle.source_url
      }, { onConflict: 'engine_variant_id' })
    
    if (perfError) console.warn(`  Performance upsert warning: ${perfError.message}`)
    
    // 6. Insert weight specs if available
    if (vehicle.curb_weight_kg) {
      const { error: weightError } = await supabase
        .from('weight_specs')
        .upsert({
          engine_variant_id: variantId,
          curb_weight_kg: vehicle.curb_weight_kg
        }, { onConflict: 'engine_variant_id' })
      
      if (weightError) console.warn(`  Weight upsert warning: ${weightError.message}`)
    }
    
    return true
  } catch (error) {
    console.error(`  ❌ Error importing ${vehicle.variant}: ${error}`)
    return false
  }
}

async function importBrandFile(filePath: string): Promise<{ success: number; errors: number }> {
  console.log(`\n📁 Processing: ${filePath}`)
  
  const content = fs.readFileSync(filePath, 'utf-8')
  const vehicles: ScrapedVehicle[] = JSON.parse(content)
  
  console.log(`   Found ${vehicles.length} vehicles`)
  
  if (vehicles.length === 0) {
    return { success: 0, errors: 0 }
  }
  
  // Get brand ID
  const brandName = vehicles[0].brand
  const brandId = await getBrandId(brandName)
  
  if (!brandId) {
    console.error(`   ❌ Could not find brand: ${brandName}`)
    return { success: 0, errors: vehicles.length }
  }
  
  let success = 0
  let errors = 0
  
  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i]
    
    // Progress every 100
    if ((i + 1) % 100 === 0) {
      console.log(`   Progress: ${i + 1}/${vehicles.length} (${((i + 1) / vehicles.length * 100).toFixed(1)}%)`)
    }
    
    const result = await importVehicle(vehicle, brandId)
    if (result) {
      success++
    } else {
      errors++
    }
  }
  
  console.log(`   ✅ Imported: ${success}, ❌ Errors: ${errors}`)
  return { success, errors }
}

async function main() {
  const dataDir = process.argv[2] || '../FLM_NXUS/ultimatespecs_data'
  
  console.log('═'.repeat(60))
  console.log('FLM AUTO - UltimateSpecs Import')
  console.log('═'.repeat(60))
  console.log(`Data directory: ${dataDir}`)
  
  const files = ['mercedes_benz.json', 'bmw.json', 'lamborghini.json']
  
  let totalSuccess = 0
  let totalErrors = 0
  
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  File not found: ${filePath}`)
      continue
    }
    
    const result = await importBrandFile(filePath)
    totalSuccess += result.success
    totalErrors += result.errors
  }
  
  console.log('\n' + '═'.repeat(60))
  console.log('IMPORT COMPLETE')
  console.log('═'.repeat(60))
  console.log(`Total imported: ${totalSuccess}`)
  console.log(`Total errors: ${totalErrors}`)
}

main().catch(console.error)
