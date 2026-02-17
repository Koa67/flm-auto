import { normalizeModelName, getModelAliases } from './model-aliases';

// Test normalization
console.log('🧪 MODEL ALIAS TESTS\n');

const tests = [
  ['BMW', '3 Series'],
  ['BMW', '3-Series'],
  ['BMW', 'Série 3'],
  ['BMW', '3er'],
  ['BMW', 'M3'],
  ['BMW', 'X5'],
  ['Mercedes-Benz', 'C-Class'],
  ['Mercedes-Benz', 'C Class'],
  ['Mercedes-Benz', 'C-Klasse'],
  ['Mercedes-Benz', 'GLE-Class'],
  ['Audi', 'A4'],
  ['Audi', 'A 4'],
  ['Audi', 'RS6'],
  ['Volkswagen', 'ID.4'],
  ['Volkswagen', 'ID4'],
  ['Porsche', '911 Carrera'],
  ['Porsche', '718 Boxster'],
  ['Volvo', 'XC 60'],
  ['Renault', 'Mégane'],
];

console.log('Normalization (scraper → DB):');
for (const [brand, model] of tests) {
  const normalized = normalizeModelName(brand, model);
  const changed = normalized !== model;
  console.log(`  ${brand} | ${model} → ${normalized} ${changed ? '✓' : ''}`);
}

console.log('\n\nReverse lookup (DB → aliases for searching):');
const dbModels = [
  ['BMW', '3'],
  ['BMW', 'M3'],
  ['Mercedes-Benz', 'Classe C'],
  ['Mercedes-Benz', 'GLE'],
  ['Audi', 'A4'],
  ['Porsche', '911'],
  ['Volvo', 'XC60'],
];

for (const [brand, model] of dbModels) {
  const aliases = getModelAliases(brand, model);
  console.log(`  ${brand} | ${model}: [${aliases.join(', ')}]`);
}
