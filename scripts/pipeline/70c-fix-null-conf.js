const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  let total = 0;
  while (true) {
    const { data: batch } = await supabase.from("vehicle_images").select("id").is("confidence", null).limit(100);
    if (!batch || batch.length === 0) break;
    const ids = batch.map(r => r.id);
    await supabase.from("vehicle_images").update({ confidence: "B" }).in("id", ids);
    total += ids.length;
    process.stdout.write("  Fixed: " + total + "\r");
  }
  console.log("\n  Total null → B: " + total);
}
main().catch(console.error);
