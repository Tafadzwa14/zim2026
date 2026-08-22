// One-off: correct flight_legs times that were written before the itinerary
// timezone fix (commit ab9aa1d).
//
// The old import asked the model for ISO 8601 with a UTC offset. It returned
// times already converted to UTC, which the importer then re-pinned to the
// airport's zone, shifting every time back by that airport's offset. Corrected
// values below are confirmed against live airport boards, not derived.
//
// Also fixes EK713's Dubai departure, which was pinned to Harare's UTC+2
// instead of Dubai's UTC+4.
//
// Writes a timestamped backup of the affected rows before touching anything.
// Run from the project root:  node scripts/fix-flight-times.mjs

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

const FIXES = [
  { id: "d6109e25-fe6e-493b-8bbe-627bc152d2b2", fl: "VA697",  dep: "2026-08-28T07:45:00Z", arr: "2026-08-28T12:10:00Z" },
  { id: "c1587ef9-6d18-4297-a365-08af465ed986", fl: "SA281",  dep: "2026-08-28T15:50:00Z", arr: "2026-08-29T03:15:00Z" },
  { id: "ab67c196-4122-4e08-8e8a-1f8f6f78f479", fl: "SA22",   dep: "2026-08-29T08:00:00Z", arr: "2026-08-29T09:45:00Z" },
  { id: "2ef30d62-3a18-47e4-802a-5d56db1418c6", fl: "SA23",   dep: "2026-09-17T10:40:00Z", arr: "2026-09-17T12:25:00Z" },
  { id: "5ae9569f-a119-4283-b764-ee6dd45c07ce", fl: "SA355",  dep: "2026-09-17T14:40:00Z", arr: "2026-09-17T16:55:00Z" },
  { id: "6f312751-b008-4905-ab91-662d2709ee40", fl: "SA354",  dep: "2026-09-21T15:25:00Z", arr: "2026-09-21T17:25:00Z" },
  { id: "61fca5e0-62a8-4744-8aa7-7f9494d985f0", fl: "SA280",  dep: "2026-09-21T18:55:00Z", arr: "2026-09-22T04:20:00Z" },
  { id: "835cf7f1-5659-4a48-b5b6-fdd6e7b06a03", fl: "SA7267", dep: "2026-09-22T08:45:00Z", arr: "2026-09-22T12:20:00Z" },
  // EK713: departure only. Its Harare arrival of 17:10 CAT was already correct.
  { id: "cb271680-868b-41d1-8d2d-836d25534dbf", fl: "EK713",  dep: "2026-09-11T05:35:00Z", arr: null },
];

const ids = FIXES.map((f) => f.id);
const { data: before, error: readErr } = await sb.from("flight_legs").select("*").in("id", ids);
if (readErr) throw readErr;
if (before.length !== ids.length) throw new Error(`expected ${ids.length} rows, found ${before.length}`);

const stamp = "2026-08-22T1200";
const backup = `scripts/backup-flight-legs-${stamp}.json`;
writeFileSync(backup, JSON.stringify(before, null, 2));
console.log(`Backed up ${before.length} rows to ${backup}\n`);

for (const f of FIXES) {
  const patch = { scheduled_departure: f.dep };
  if (f.arr) patch.scheduled_arrival = f.arr;
  const { error } = await sb.from("flight_legs").update(patch).eq("id", f.id);
  if (error) throw new Error(`${f.fl}: ${error.message}`);
  console.log(`  updated ${f.fl.padEnd(7)} ${f.dep}${f.arr ? " -> " + f.arr : "  (departure only)"}`);
}

console.log("\nVerifying:\n");
const TZ = { MEL:"Australia/Melbourne", PER:"Australia/Perth", JNB:"Africa/Johannesburg",
             CPT:"Africa/Johannesburg", HRE:"Africa/Harare", DXB:"Asia/Dubai" };
const fmt = (iso, iata) => new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ[iata] ?? "UTC", weekday: "short", day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(iso));

const { data: after } = await sb.from("flight_legs").select("*").in("id", ids).order("flight_number");
for (const l of after) {
  const mins = (new Date(l.scheduled_arrival) - new Date(l.scheduled_departure)) / 60000;
  console.log(
    `  ${l.flight_number.padEnd(7)} ${l.origin_airport}->${l.destination_airport}  ` +
    `${fmt(l.scheduled_departure, l.origin_airport)}  ->  ${fmt(l.scheduled_arrival, l.destination_airport)}  ` +
    `(${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")})`
  );
}
