/**
 * FLM AUTO - API Test Script
 */

import { api } from '../lib/api';

async function main() {
  console.log('🧪 FLM AUTO - API Test\n');
  console.log('═'.repeat(60));
  
  // Test 1: List vehicles
  console.log('\n📋 Test 1: List Vehicles (BMW)\n');
  const bmwVehicles = await api.listVehicles({ brand: 'BMW', limit: 5 });
  console.log(`   Found ${bmwVehicles?.length} BMW vehicles`);
  bmwVehicles?.slice(0, 3).forEach(v => {
    console.log(`   - ${v.brand} ${v.model} (${v.generation})`);
  });
  
  // Test 2: Get vehicle details
  if (bmwVehicles && bmwVehicles.length > 0) {
    console.log('\n📄 Test 2: Vehicle Details\n');
    const details = await api.getVehicleDetails(bmwVehicles[0].id);
    if (details) {
      console.log(`   ${details.brand} ${details.model} ${details.generation}`);
      console.log(`   - Has EV data: ${!!details.ev_data}`);
      console.log(`   - Has prices: ${!!details.prices}`);
      console.log(`   - Has safety rating: ${!!details.safety_rating}`);
      console.log(`   - Videos: ${details.videos?.length || 0}`);
      console.log(`   - Photos: ${details.photos?.length || 0}`);
      console.log(`   - Spec types: ${Object.keys(details.specs).length}`);
    }
  }
  
  // Test 3: Search
  console.log('\n🔍 Test 3: Search "porsche 911"\n');
  const searchResults = await api.searchVehicles('porsche 911', 5);
  console.log(`   Found ${searchResults.length} results`);
  searchResults.forEach(v => {
    console.log(`   - ${v.brand} ${v.model} (${v.generation})`);
  });
  
  // Test 4: TCO calculation
  if (bmwVehicles && bmwVehicles.length > 0) {
    console.log('\n💰 Test 4: TCO Calculation\n');
    const tco = await api.calculateTCO({
      generation_id: bmwVehicles[0].id,
      purchase_type: 'new',
      annual_km: 15000,
    });
    if (tco) {
      console.log(`   ${tco.vehicle.brand} ${tco.vehicle.model}`);
      console.log(`   Purchase price: €${tco.purchase_price.toLocaleString()}`);
      console.log(`   Total 5 years: €${tco.total_5_years.toLocaleString()}`);
      console.log(`   Monthly cost: €${tco.monthly_cost}`);
      console.log(`   Breakdown:`);
      console.log(`     - Depreciation: €${tco.breakdown.depreciation.toLocaleString()}`);
      console.log(`     - Fuel/Energy: €${tco.breakdown.fuel_energy.toLocaleString()}`);
      console.log(`     - Insurance: €${tco.breakdown.insurance.toLocaleString()}`);
      console.log(`     - Maintenance: €${tco.breakdown.maintenance.toLocaleString()}`);
      console.log(`     - Taxes: €${tco.breakdown.taxes.toLocaleString()}`);
    }
  }
  
  // Test 5: Family Fit
  console.log('\n👨‍👩‍👧‍👦 Test 5: Family Fit Search\n');
  const familyResults = await api.searchFamilyFit({
    num_children: 2,
    seat_types: ['infant', 'toddler'],
    three_across_required: false,
    min_trunk_volume: 400,
  });
  console.log(`   Found ${familyResults.length} family-friendly vehicles`);
  familyResults.slice(0, 5).forEach(r => {
    console.log(`   - ${r.vehicle.brand} ${r.vehicle.model}: Score ${r.score}/100`);
  });
  
  // Test 6: Compare vehicles
  console.log('\n⚖️ Test 6: Compare Vehicles\n');
  const allVehicles = await api.listVehicles({ limit: 10 });
  if (allVehicles && allVehicles.length >= 3) {
    const comparison = await api.compareVehicles([
      allVehicles[0].id,
      allVehicles[1].id,
      allVehicles[2].id,
    ]);
    console.log(`   Comparing ${comparison.length} vehicles:`);
    comparison.forEach(v => {
      console.log(`   - ${v?.brand} ${v?.model}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ All API tests completed!\n');
}

main().catch(console.error);
