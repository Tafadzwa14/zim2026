// One-off: correct Tinashe's EK713 arrival details.
//
// EK713 is Dubai to Harare routing via Lusaka. The provider row recorded the
// Lusaka leg as the destination: destination_city said "Lusaka" against a HRE
// airport code, and estimated_arrival held the Lusaka touchdown (14:35 CAT).
// Because the display path prefers estimated_arrival over scheduled_arrival
// (see flight-view.ts, travel.ts, repo/supabase.ts), the app showed him landing
// at 14:35 rather than the real Harare arrival of 17:10 CAT.
//
// estimated_arrival is cleared rather than mirrored onto scheduled_arrival:
// there is no live estimate for a flight three weeks out, so the display should
// fall through to the scheduled time without an "Est." badge.
//
// Run from the project root:  node scripts/fix-ek713-arrival.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

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

const ID = "cb271680-868b-41d1-8d2d-836d25534dbf";

const { data: before, error: readErr } = await sb.from("flight_legs").select("*").eq("id", ID).single();
if (readErr) throw readErr;
if (before.flight_number !== "EK713") throw new Error(`unexpected row: ${before.flight_number}`);

const backup = "scripts/backup-ek713-2026-08-22T1215.json";
writeFileSync(backup, JSON.stringify(before, null, 2));
console.log(`Backed up to ${backup}\n`);

console.log("before:");
console.log(`  destination_city  ${before.destination_city}`);
console.log(`  estimated_arrival ${before.estimated_arrival}`);
console.log(`  terminal_arrival  ${before.terminal_arrival}`);

const { error } = await sb
  .from("flight_legs")
  .update({
    destination_city: "Harare",
    estimated_arrival: null,
    terminal_arrival: "I", // Harare International, confirmed on the live board
  })
  .eq("id", ID);
if (error) throw error;

const { data: after } = await sb.from("flight_legs").select("*").eq("id", ID).single();
console.log("\nafter:");
console.log(`  destination_city  ${after.destination_city}`);
console.log(`  estimated_arrival ${after.estimated_arrival}`);
console.log(`  terminal_arrival  ${after.terminal_arrival}`);

const fmt = (iso, tz) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));

// Mirrors flight-view.ts: actual, then estimated, then scheduled.
const shown = after.actual_arrival ?? after.estimated_arrival ?? after.scheduled_arrival;
console.log(`\nApp will now show arrival: ${fmt(shown, "Africa/Harare")} Harare time`);
console.log(`Departs Dubai:             ${fmt(after.scheduled_departure, "Asia/Dubai")} Dubai time`);
