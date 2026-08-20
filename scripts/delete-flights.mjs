// One-off: delete ALL flight info (travel_groups) so it can be re-uploaded.
// Deleting a travel_group cascades to its flight_legs, members and pickup.
// Run from the project root:  node scripts/delete-flights.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: groups, error: gErr } = await sb.from("travel_groups").select("id,title");
if (gErr) throw gErr;
if (!groups?.length) {
  console.log("No travel groups to delete.");
  process.exit(0);
}

for (const g of groups) {
  const { error } = await sb.from("travel_groups").delete().eq("id", g.id);
  if (error) throw error;
  console.log(`deleted "${g.title}" (${g.id}) + cascaded legs/members/pickup`);
}

const [{ count: tg }, { count: legs }, { count: mem }, { count: pk }] = await Promise.all([
  sb.from("travel_groups").select("*", { count: "exact", head: true }),
  sb.from("flight_legs").select("*", { count: "exact", head: true }),
  sb.from("travel_group_members").select("*", { count: "exact", head: true }),
  sb.from("pickups").select("*", { count: "exact", head: true }),
]);
console.log(`remaining -> travel_groups: ${tg}, flight_legs: ${legs}, members: ${mem}, pickups: ${pk}`);
