// Turning an itinerary's wall-clock times into real instants.
//
// Itineraries print each time in the airport's own local clock ("07:45" at
// Melbourne). To store a true absolute instant we have to pin that wall clock
// to the airport's timezone ourselves, using the shared AIRPORTS table — never
// by trusting an upstream parser (a language model especially) to work out UTC
// offsets, which is where the +00:00 mis-tagged times came from. Client- and
// server-safe: pure date maths, no secrets, no server-only imports.

import { airportZone } from "@/lib/airports";
import { TRIP_TZ } from "@/lib/format";

/** DST-aware offset (ms) between a UTC instant and how `tz` renders it. */
function offsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** Wall-clock fields read straight off a string, ignoring any offset it carries. */
function wallClock(iso: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}

/**
 * Interpret a time as local to `iata`'s airport and return a true UTC instant
 * (`YYYY-MM-DDTHH:mm:ssZ`). The offset carried by the input string is ignored
 * on purpose: only its wall-clock digits are read, then re-pinned to the
 * airport's real zone. An airport we don't hold falls back to trip time, so a
 * time is never dropped; the display already labels those as trip time.
 * Returns null when there's no time or its digits can't be read.
 */
export function airportLocalToUtcIso(time: string | null | undefined, iata: string | null | undefined): string | null {
  if (!time) return null;
  const wc = wallClock(time);
  if (!wc) return null;
  const tz = airportZone(iata) ?? TRIP_TZ;
  const guess = Date.UTC(wc.y, wc.mo, wc.d, wc.h, wc.mi);
  const off = offsetMs(new Date(guess), tz);
  return new Date(guess - off).toISOString().replace(/\.000Z$/, "Z");
}
