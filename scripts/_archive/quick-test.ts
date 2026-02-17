/**
 * FLM AUTO - API Quick Test
 */

import { api } from '../lib/api';

async function test() {
  console.log('🧪 FLM AUTO - API Quick Test\n');

  // BMW vehicles
  const bmw = await api.listVehicles({ brand: 'BMW', limit: 100 });
  console.log('BMW vehicles:', bmw?.length);
  bmw?.slice(0,3).forEach(v => console.log('  -', v.model, v.generation));

  // Get details for first BMW
  if (bmw?.length) {
    const details = await api.getVehicleDetails(bmw[0].id);
    console.log('\nDetails for', details?.brand, details?.model + ':');
    console.log('  EV data:', !!details?.ev_data);
    console.log('  Prices:', !!details?.prices);
    console.log('  Safety:', !!details?.safety_rating);
    console.log('  Reliability:', !!details?.reliability);
    console.log('  Videos:', details?.videos?.length);
    console.log('  Specs:', Object.keys(details?.specs || {}).length, 'types');
  }

  // TCO for BMW
  if (bmw?.length) {
    const tco = await api.calculateTCO({
      generation_id: bmw[0].id,
      purchase_type: 'new',
      annual_km: 15000
    });
    console.log('\nTCO 5 ans:', '€' + tco?.total_5_years?.toLocaleString());
    console.log('  Mensuel:', '€' + tco?.monthly_cost);
  }

  // Search
  const p911 = await api.searchVehicles('911', 5);
  console.log('\nSearch 911:', p911?.length, 'results');
  p911?.forEach(v => console.log('  -', v.brand, v.model));

  console.log('\n✅ API working!');
}

test().catch(console.error);
