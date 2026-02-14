/**
 * 81-garbage-cleanup.ts — Delete garbage generations (Category A from diagnostic)
 *
 * Handles non-CASCADE tables manually, then deletes generation + orphan models.
 * Usage:
 *   --dry-run   Show what would be deleted
 *   (no flag)   Live delete
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes("--dry-run");

// Tables WITHOUT ON DELETE CASCADE that reference generation_id
const NON_CASCADE_TABLES = [
  "vehicle_videos",
  "vehicle_pricing",
  "child_seat_vehicle_compatibility",
  "reliability_issues",
];

// Tables WITHOUT ON DELETE CASCADE that reference engine_variant_id
const ENGINE_VARIANT_CHILD_TABLES = [
  "vehicle_pricing",  // has engine_variant_id FK
];

async function deleteGeneration(gen: any, backup: any[]) {
  const genId = gen.id;
  const label = `${gen.brand} "${gen.model}" gen:"${gen.gen}" (${gen.reason})`;

  // 1. Delete from non-CASCADE tables
  for (const table of NON_CASCADE_TABLES) {
    if (DRY_RUN) {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("generation_id", genId);
      if (count && count > 0) console.log(`  [DRY] Would delete ${count} rows from ${table}`);
    } else {
      const { error } = await supabase.from(table).delete().eq("generation_id", genId);
      if (error && !error.message.includes("0 rows")) {
        console.warn(`  WARN: ${table} delete error: ${error.message}`);
      }
    }
  }

  // 2. Delete vehicle_images (no migration file, might not have CASCADE)
  if (DRY_RUN) {
    const { count } = await supabase
      .from("vehicle_images")
      .select("id", { count: "exact", head: true })
      .eq("generation_id", genId);
    if (count && count > 0) console.log(`  [DRY] Would delete ${count} rows from vehicle_images`);
  } else {
    await supabase.from("vehicle_images").delete().eq("generation_id", genId);
  }

  // 3. Delete engine_variants (and their children first)
  const { data: variants } = await supabase
    .from("engine_variants")
    .select("id")
    .eq("generation_id", genId);

  if (variants && variants.length > 0) {
    const variantIds = variants.map((v: any) => v.id);
    for (const childTable of ENGINE_VARIANT_CHILD_TABLES) {
      if (DRY_RUN) {
        console.log(`  [DRY] Would clean ${variantIds.length} variant refs from ${childTable}`);
      } else {
        // Delete in batches of 50 to avoid URL length issues
        for (let i = 0; i < variantIds.length; i += 50) {
          const batch = variantIds.slice(i, i + 50);
          await supabase.from(childTable).delete().in("engine_variant_id", batch);
        }
      }
    }

    if (DRY_RUN) {
      console.log(`  [DRY] Would delete ${variants.length} engine_variants`);
    } else {
      await supabase.from("engine_variants").delete().eq("generation_id", genId);
    }
  }

  // 4. Delete generation itself (CASCADE tables auto-clean)
  if (DRY_RUN) {
    console.log(`  [DRY] Would delete generation: ${label}`);
  } else {
    const { error } = await supabase.from("generations").delete().eq("id", genId);
    if (error) {
      console.error(`  ERROR deleting gen ${genId}: ${error.message}`);
      return false;
    }
    console.log(`  DELETED: ${label}`);
  }

  backup.push({
    ...gen,
    deleted_at: new Date().toISOString(),
  });

  return true;
}

async function main() {
  console.log(`=== GARBAGE CLEANUP ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const diagPath = path.resolve(__dirname, "../../data/garbage-diagnostic.json");
  if (!fs.existsSync(diagPath)) {
    console.error("No diagnostic file found. Run 80-garbage-diagnostic.ts first.");
    process.exit(1);
  }

  const diag = JSON.parse(fs.readFileSync(diagPath, "utf-8"));
  const toDelete = diag.category_A_delete;

  console.log(`Entries to delete: ${toDelete.length}`);
  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (toDelete.length > 200) {
    console.error(`WARNING: ${toDelete.length} entries is > 200. Aborting for safety.`);
    process.exit(1);
  }

  const backup: any[] = [];
  let deleted = 0;
  let failed = 0;

  // Track model_ids for orphan check
  const modelIds = new Set(toDelete.map((e: any) => e.model_id));

  for (const entry of toDelete) {
    const ok = await deleteGeneration(entry, backup);
    if (ok !== false) deleted++;
    else failed++;
  }

  // Check for orphan models (no remaining generations)
  if (!DRY_RUN) {
    console.log(`\nChecking for orphan models...`);
    let orphanCount = 0;
    for (const modelId of modelIds) {
      const { count } = await supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("model_id", modelId);

      if (count === 0) {
        const { data: modelData } = await supabase
          .from("models")
          .select("name")
          .eq("id", modelId)
          .single();

        console.log(`  Deleting orphan model: ${modelData?.name} (${modelId})`);
        await supabase.from("models").delete().eq("id", modelId);
        orphanCount++;
      }
    }
    console.log(`Orphan models deleted: ${orphanCount}`);
  } else {
    console.log(`\n[DRY] Would check ${modelIds.size} models for orphaned status`);
  }

  // Save backup
  const backupPath = path.resolve(__dirname, "../../data/backup-phase17-cleanup.json");
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(`\n=== SUMMARY ===`);
  console.log(`  Processed: ${toDelete.length}`);
  console.log(`  ${DRY_RUN ? "Would delete" : "Deleted"}: ${deleted}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Backup saved to: ${backupPath}`);
}

main().catch(console.error);
