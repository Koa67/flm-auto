const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const BATCH = 100;
  let total = 0;

  // Process in batches
  while (true) {
    const { data: batch, error } = await supabase
      .from("vehicle_images")
      .select("id")
      .is("confidence", null)
      .eq("source", "Wikimedia Commons")
      .limit(BATCH);

    if (error) { console.error("Select error:", error.message); break; }
    if (!batch || batch.length === 0) break;

    const ids = batch.map(r => r.id);
    const { error: updateErr } = await supabase
      .from("vehicle_images")
      .update({ confidence: "A" })
      .in("id", ids);

    if (updateErr) { console.error("Update error:", updateErr.message); break; }
    total += ids.length;
    process.stdout.write("  Updated: " + total + "\r");
  }

  console.log("\n  Total Wikimedia Commons → A: " + total);

  // Fix small sources
  await supabase.from("vehicle_images").update({ confidence: "A" }).is("confidence", null).eq("source", "wikimedia_commons");
  await supabase.from("vehicle_images").update({ confidence: "A" }).is("confidence", null).eq("source", "Wikipedia");
  await supabase.from("vehicle_images").update({ confidence: "B" }).is("confidence", null).eq("source", "Pexels");
  console.log("  Fixed wikimedia_commons, Wikipedia, Pexels");

  // Check remaining null
  const { count } = await supabase.from("vehicle_images").select("id", { count: "exact", head: true }).is("confidence", null);
  console.log("  Remaining null-confidence: " + count);
}
main().catch(console.error);
