// Seed two clearly-labelled DEMO flights into the live database so the flight
// card's live tracking can be demonstrated: one whose position is driven by
// live radar (OpenSky) and one that falls back to the schedule estimate. Run
// from the project root:
//
//   node scripts/seed-demo-flight.mjs           # insert / refresh the demos
//   node scripts/seed-demo-flight.mjs --remove  # delete them again
//
// Idempotent: fixed UUIDs mean re-running just refreshes the same two rows.
// The airline is "Demo Air" and titles are flagged so nobody mistakes these
// for a real booking.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Fixed ids so the seed is idempotent and easy to remove.
const GROUP_LIVE = "d3110000-0000-4000-8000-000000000001";
const GROUP_EST = "d3110000-0000-4000-8000-000000000002";
const LEG_LIVE = "d3110000-0000-4000-8000-00000000000a";
const LEG_EST = "d3110000-0000-4000-8000-00000000000b";

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const HOUR = 3600_000;

if (process.argv.includes("--remove")) {
  await sb.from("flight_legs").delete().in("id", [LEG_LIVE, LEG_EST]);
  await sb.from("travel_groups").delete().in("id", [GROUP_LIVE, GROUP_EST]);
  console.log("removed demo flights");
  process.exit(0);
}

const groups = [
  { id: GROUP_LIVE, title: "🧪 Demo — live tracking", status: "travelling", general_notes: "Demo data. Delete with: node scripts/seed-demo-flight.mjs --remove" },
  { id: GROUP_EST, title: "🧪 Demo — estimated", status: "travelling", general_notes: "Demo data. Delete with: node scripts/seed-demo-flight.mjs --remove" },
];

// A leg mid-flight: departed a few hours ago, still time to go.
const legBase = {
  provider: "demo",
  airline_code: "DZ",
  airline_name: "Demo Air",
  scheduled_departure: iso(-3.2 * HOUR),
  estimated_departure: iso(-3.2 * HOUR),
  actual_departure: iso(-3.1 * HOUR),
  scheduled_arrival: iso(1.4 * HOUR),
  estimated_arrival: iso(1.4 * HOUR),
  aircraft_type: "Boeing 777-300ER",
  aircraft_type_code: "B77W",
  aircraft_registration: "DZ-DEMO",
  status: "air",
  delay_minutes: 0,
};

const legs = [
  {
    ...legBase, id: LEG_LIVE, travel_group_id: GROUP_LIVE, leg_order: 0,
    flight_number: "DZ100", origin_airport: "DXB", origin_city: "Dubai",
    destination_airport: "HRE", destination_city: "Harare",
    progress: 0.62, progress_source: "live",
    last_synced_at: iso(0),
  },
  {
    ...legBase, id: LEG_EST, travel_group_id: GROUP_EST, leg_order: 0,
    flight_number: "DZ200", origin_airport: "JNB", origin_city: "Johannesburg",
    destination_airport: "HRE", destination_city: "Harare",
    progress: 0.38, progress_source: "estimated",
    last_synced_at: iso(0),
  },
];

let err = (await sb.from("travel_groups").upsert(groups)).error;
if (err) { console.error("groups:", err.message); process.exit(1); }
err = (await sb.from("flight_legs").upsert(legs)).error;
if (err) { console.error("legs:", err.message); process.exit(1); }

console.log("seeded 2 demo flights: DZ100 (live) DXB→HRE, DZ200 (estimated) JNB→HRE");
