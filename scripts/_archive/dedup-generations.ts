/**
 * FLM AUTO — Generation Deduplicator
 * 
 * Finds duplicate generations within the same model and merges them:
 * - Transfers specs from the duplicate to the "winner" (most specs)
 * - Deletes empty duplicates
 * 
 * SAFE: runs in dry-run mode by default. Pass --execute to actually modify DB.
 * 
 * Usage:
 *   npx ts-node dedup-generations.ts              # dry-run, shows what would happen
 *   npx ts-node dedup-generations.ts --execute     # actually merge + delete
 *   npx ts-node dedup-generations.ts --brand BMW   # filter by brand
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const brandArg = args.find(a => a.startsWith('--brand'));
const BRAND_FILTER = brandArg ? (brandArg.includes('=') ? brandArg.split('=')[1] : args[args.indexOf(brandArg) + 1]) : null;

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/facelift$/g, '')  // keep facelift separate — don't merge
    .trim();
}

// More aggressive normalize for grouping candidates
function normalizeGroup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

interface DupeGroup {
  brand: string;
  model: string;
  modelId: string;
  generations: {
    id: string;
    name: string;
    normalized: string;
    specCount: number;
    hasProductionStart: boolean;
    productionStart: string | null;
  }[];
  action: 'merge' | 'case_only' | 'skip';
  winner?: string; // id of the gen to keep
  losers?: string[]; // ids to merge into winner then delete
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║   FLM AUTO — DEDUP GENERATIONS ${EXECUTE ? '⚡ EXECUTE MODE' : '🔍 DRY-RUN'}${' '.repeat(EXECUTE ? 14 : 16)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!EXECUTE) {
    console.log('  ℹ️  Dry-run mode. Pass --execute to actually modify the database.\n');
  }

  // Load data
  process.stdout.write('  Loading brands...');
  const brands = await paginate('brands', 'id, name');
  console.log(` ${brands.length}`);

  process.stdout.write('  Loading models...');
  const models = await paginate('models', 'id, name, brand_id');
  console.log(` ${models.length}`);

  process.stdout.write('  Loading generations...');
  const gens = await paginate('generations', 'id, name, model_id, production_start');
  console.log(` ${gens.length}`);

  process.stdout.write('  Loading spec counts...');
  const specs = await paginate('third_party_specs', 'generation_id');
  const specCount = new Map<string, number>();
  for (const s of specs) {
    specCount.set(s.generation_id, (specCount.get(s.generation_id) || 0) + 1);
  }
  console.log(` ${specs.length} specs across ${specCount.size} gens\n`);

  // Index
  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const modelBrand = new Map(models.map((m: any) => [m.id, m.brand_id]));
  const modelName = new Map(models.map((m: any) => [m.id, m.name]));

  // Group gens by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Find duplicates
  const dupeGroups: DupeGroup[] = [];
  let totalDupes = 0;

  for (const [modelId, modelGens] of gensByModel) {
    if (modelGens.length < 2) continue;

    const brandId = modelBrand.get(modelId);
    const brand = brandId ? brandMap.get(brandId) || '?' : '?';
    const model = modelName.get(modelId) || '?';

    if (BRAND_FILTER && !brand.toLowerCase().includes(BRAND_FILTER.toLowerCase())) continue;

    // Group by normalized name
    const groups = new Map<string, any[]>();
    for (const g of modelGens) {
      const norm = normalizeGroup(g.name);
      if (!groups.has(norm)) groups.set(norm, []);
      groups.get(norm)!.push(g);
    }

    for (const [norm, groupGens] of groups) {
      if (groupGens.length < 2) continue;

      // Check if they're truly duplicates vs legitimate variants (e.g. "W211" vs "W211 facelift")
      // Rule: if normalized names are identical, they're dupes
      // But "w211" and "w211facelift" should NOT merge (facelift is a separate gen)
      
      // Sub-group: separate facelift from non-facelift
      const withFacelift = groupGens.filter((g: any) => /facelift/i.test(g.name));
      const withoutFacelift = groupGens.filter((g: any) => !/facelift/i.test(g.name));

      const subGroups = [];
      if (withoutFacelift.length >= 2) subGroups.push(withoutFacelift);
      if (withFacelift.length >= 2) subGroups.push(withFacelift);

      for (const sub of subGroups) {
        if (sub.length < 2) continue;

        const enriched = sub.map((g: any) => ({
          id: g.id,
          name: g.name,
          normalized: normalizeGroup(g.name),
          specCount: specCount.get(g.id) || 0,
          hasProductionStart: !!g.production_start,
          productionStart: g.production_start,
        }));

        // Winner = most specs, then has production_start, then shortest name
        enriched.sort((a: any, b: any) => {
          if (b.specCount !== a.specCount) return b.specCount - a.specCount;
          if (a.hasProductionStart !== b.hasProductionStart) return a.hasProductionStart ? -1 : 1;
          return a.name.length - b.name.length;
        });

        const winner = enriched[0];
        const losers = enriched.slice(1);

        // Determine action
        const isCaseOnly = sub.every((g: any) => 
          g.name.toLowerCase() === sub[0].name.toLowerCase()
        );

        dupeGroups.push({
          brand, model, modelId,
          generations: enriched,
          action: isCaseOnly ? 'case_only' : 'merge',
          winner: winner.id,
          losers: losers.map((l: any) => l.id),
        });

        totalDupes += losers.length;
      }
    }
  }

  // Also find "Default" generations that could merge into real ones
  const defaultGroups: DupeGroup[] = [];
  for (const [modelId, modelGens] of gensByModel) {
    const defaults = modelGens.filter((g: any) => g.name === 'Default');
    const nonDefaults = modelGens.filter((g: any) => g.name !== 'Default');
    
    if (defaults.length === 0 || nonDefaults.length === 0) continue;
    if (defaults.length > 1) continue; // Multiple defaults = weird, skip

    const brandId = modelBrand.get(modelId);
    const brand = brandId ? brandMap.get(brandId) || '?' : '?';
    const model = modelName.get(modelId) || '?';

    if (BRAND_FILTER && !brand.toLowerCase().includes(BRAND_FILTER.toLowerCase())) continue;

    const def = defaults[0];
    const defSpecs = specCount.get(def.id) || 0;

    // If there's exactly 1 non-default gen, merge the one with fewer specs into the other
    if (nonDefaults.length === 1 && defSpecs > 0) {
      const target = nonDefaults[0];
      const targetSpecs = specCount.get(target.id) || 0;

      // Winner = more specs. If tied, prefer the named gen over "Default"
      const winnerId = targetSpecs >= defSpecs ? target.id : def.id;
      const loserId = winnerId === target.id ? def.id : target.id;

      defaultGroups.push({
        brand, model, modelId,
        generations: [
          { id: target.id, name: target.name, normalized: normalizeGroup(target.name), specCount: targetSpecs, hasProductionStart: !!target.production_start, productionStart: target.production_start },
          { id: def.id, name: 'Default', normalized: 'default', specCount: defSpecs, hasProductionStart: false, productionStart: null },
        ],
        action: 'merge',
        winner: winnerId,
        losers: [loserId],
      });
      totalDupes++;
    }
  }

  // Report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  DUPLICATE GROUPS: ${dupeGroups.length}  |  DEFAULT MERGES: ${defaultGroups.length}`);
  console.log(`  TOTAL GENERATIONS TO REMOVE: ${totalDupes}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Show details
  const allGroups = [...dupeGroups, ...defaultGroups];
  
  // Group by brand for display
  const byBrand = new Map<string, DupeGroup[]>();
  for (const g of allGroups) {
    if (!byBrand.has(g.brand)) byBrand.set(g.brand, []);
    byBrand.get(g.brand)!.push(g);
  }

  for (const [brand, groups] of [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
    const removable = groups.reduce((sum, g) => sum + (g.losers?.length || 0), 0);
    console.log(`\n  🏷️  ${brand} — ${groups.length} groups, ${removable} to remove`);
    
    for (const g of groups.slice(0, 5)) {
      const winner = g.generations.find(gen => gen.id === g.winner)!;
      const losers = g.generations.filter(gen => g.losers?.includes(gen.id));
      console.log(`    ${g.model}: KEEP "${winner.name}" (${winner.specCount} specs)`);
      for (const l of losers) {
        console.log(`      ↳ MERGE "${l.name}" (${l.specCount} specs) → delete`);
      }
    }
    if (groups.length > 5) console.log(`    ... +${groups.length - 5} more groups`);
  }

  // Execute
  if (EXECUTE) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ⚡ EXECUTING MERGES');
    console.log('═══════════════════════════════════════════════════════════════');

    let merged = 0, deleted = 0, errors = 0;

    for (const group of allGroups) {
      if (!group.winner || !group.losers) continue;

      for (const loserId of group.losers) {
        // 1. Transfer specs: update generation_id on loser's specs to winner
        //    But only for spec_types the winner doesn't already have
        const { data: loserSpecs } = await supabase
          .from('third_party_specs')
          .select('id, spec_type, source')
          .eq('generation_id', loserId);

        const { data: winnerSpecs } = await supabase
          .from('third_party_specs')
          .select('spec_type, source')
          .eq('generation_id', group.winner);

        const winnerKeys = new Set((winnerSpecs || []).map(s => `${s.spec_type}|${s.source}`));

        let transferred = 0;
        for (const spec of (loserSpecs || [])) {
          const key = `${spec.spec_type}|${spec.source}`;
          if (!winnerKeys.has(key)) {
            const { error } = await supabase
              .from('third_party_specs')
              .update({ generation_id: group.winner })
              .eq('id', spec.id);
            if (!error) {
              transferred++;
              winnerKeys.add(key); // prevent further dupes
            }
          }
        }

        // 2. Delete remaining specs on loser (already covered by winner)
        const { error: delSpecErr } = await supabase
          .from('third_party_specs')
          .delete()
          .eq('generation_id', loserId);

        // 3. Delete the generation itself
        const { error: delGenErr } = await supabase
          .from('generations')
          .delete()
          .eq('id', loserId);

        if (delGenErr) {
          errors++;
          console.log(`    ❌ ${group.brand} ${group.model} "${group.generations.find(g => g.id === loserId)?.name}": ${delGenErr.message}`);
        } else {
          merged += transferred;
          deleted++;
        }
      }

      process.stdout.write(`\r  Progress: ${deleted} deleted, ${merged} specs transferred, ${errors} errors`);
    }

    console.log(`\n\n  ✅ Done: ${deleted} generations deleted, ${merged} specs transferred, ${errors} errors`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Duplicate groups found: ${dupeGroups.length}`);
  console.log(`  Default merge candidates: ${defaultGroups.length}`);
  console.log(`  Total gens to remove: ${totalDupes}`);
  console.log(`  Mode: ${EXECUTE ? '⚡ EXECUTED' : '🔍 DRY-RUN (pass --execute to apply)'}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
