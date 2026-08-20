import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import type { ExtractedItinerary, ExtractedLeg } from "@/lib/itinerary";
import { AIRPORTS } from "@/lib/airports";

/**
 * Deterministic, no-AI itinerary reader for Aunt Betty / Flight Centre
 * "Booking itinerary / eTicket" PDFs (metaw.auntbetty.com). It extracts the
 * PDF's text layer and pattern-matches the fixed segment blocks, so there's no
 * API key, cost, or quota involved. Throws when the PDF has no usable text
 * (e.g. a scan) or the layout isn't recognised; the caller turns that into a
 * friendly error and the "add by flight number" path stays available.
 *
 * Each segment renders as five lines in the text layer:
 *   <origin city> <dest city>
 *   XXX - <origin airport> YYY - <dest airport>
 *   Terminal <dep> Terminal <arr>
 *   <h:mm AM/PM> - <Weekday, D Month YYYY> <h:mm AM/PM> - <Weekday, D Month YYYY>
 *   <Airline> - <FLIGHTNO> <aircraft> <class>   (aircraft/class may wrap to the next line)
 */

// Airport timezones (for pinning an absolute instant) and display cities come
// from the shared table in @/lib/airports. Times on these itineraries are the
// airport's local wall-clock, so we convert to UTC using the airport's zone;
// the app then projects to trip time.

// Keyed by the first three letters, lower-cased, so both full ("September")
// and abbreviated ("Sep", "Sept") month names parse for every month.
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const monthIndex = (name: string): number | undefined => MONTHS[name.slice(0, 3).toLowerCase()];

const AIRPORTS_LINE = /^([A-Z]{3})\s+-\s+(.+?)\s+([A-Z]{3})\s+-\s+(.+)$/;
const TERMINAL_LINE = /^Terminal\s+(.+?)\s+Terminal\s+(.+)$/;
const TIMES_LINE = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*([A-Za-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}).*?(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*([A-Za-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4})/;
const FLIGHT_LINE = /^(.+?)\s+-\s+([A-Z]{2})\s?(\d{1,4})\b(.*)$/;
const CLASS_RE = /\b((?:Premium\s+)?Economy|Business|First)\s+Class\b.*$/i;
const AIRFRAME_RE = /(Boeing|Airbus|Embraer|Bombardier|ATR|De Havilland|McDonnell Douglas)[\w .\/-]*$/i;

/** Offset in ms between a UTC instant and how a zone renders it (DST-aware). */
function offsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** A wall-clock time in `tz` -> an absolute UTC ISO string (or null if unknown). */
function localToIso(y: number, mo: number, d: number, h: number, mi: number, tz: string | undefined): string | null {
  if (!tz) return null;
  const guess = Date.UTC(y, mo, d, h, mi);
  const off = offsetMs(new Date(guess), tz);
  return new Date(guess - off).toISOString().replace(/\.000Z$/, "Z");
}

function parseDateTime(timeStr: string, dateStr: string) {
  const t = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const dm = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!t || !dm) return null;
  let h = +t[1] % 12;
  if (/pm/i.test(t[3])) h += 12;
  const mo = monthIndex(dm[2]);
  if (mo === undefined) return null;
  return { h, mi: +t[2], y: +dm[3], mo, d: +dm[1] };
}

function cityFrom(iata: string, airportName: string): string | null {
  if (AIRPORTS[iata]) return AIRPORTS[iata].city;
  return airportName.replace(/\s+(International\s+)?Airport$/i, "").trim() || null;
}

function aircraftFrom(rest: string): string | null {
  const s = rest.replace(CLASS_RE, "").trim();
  const m = s.match(AIRFRAME_RE);
  if (m) return m[0].trim();
  return /^Operated by/i.test(s) ? null : (s || null);
}

/** Placeholder terminals ("TBD") aren't real data. */
function cleanTerminal(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  return t && !/^TBD$/i.test(t) ? t : null;
}

function parseItineraryText(text: string): ExtractedItinerary {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/auntbetty\.com|https?:\/\/|^\d{2}\/\d{2}\/\d{4},/.test(l));

  const legs: ExtractedLeg[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ap = lines[i].match(AIRPORTS_LINE);
    if (!ap) continue;

    let times: RegExpMatchArray | null = null;
    let flight: RegExpMatchArray | null = null;
    let flightRest = "";
    let depTerminal: string | null = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (!times) {
        const tm = lines[j].match(TERMINAL_LINE);
        if (tm) depTerminal = tm[1].trim();
      }
      if (!times) {
        const m = lines[j].match(TIMES_LINE);
        if (m) { times = m; continue; }
      }
      const f = lines[j].match(FLIGHT_LINE);
      if (f && times) {
        flight = f;
        flightRest = f[4].trim();
        if (!flightRest && lines[j + 1]) flightRest = lines[j + 1].trim();
        break;
      }
    }
    if (!times || !flight) continue;

    const [, oCode, oName, dCode, dName] = ap;
    const dep = parseDateTime(times[1], times[2]);
    const arr = parseDateTime(times[3], times[4]);

    legs.push({
      flight_number: (flight[2] + flight[3]).toUpperCase(),
      airline_code: flight[2].toUpperCase(),
      airline_name: flight[1].trim() || null,
      origin_airport: oCode,
      origin_city: cityFrom(oCode, oName),
      destination_airport: dCode,
      destination_city: cityFrom(dCode, dName),
      scheduled_departure: dep ? localToIso(dep.y, dep.mo, dep.d, dep.h, dep.mi, AIRPORTS[oCode]?.tz) : null,
      scheduled_arrival: arr ? localToIso(arr.y, arr.mo, arr.d, arr.h, arr.mi, AIRPORTS[dCode]?.tz) : null,
      terminal_departure: cleanTerminal(depTerminal),
      aircraft_type: aircraftFrom(flightRest),
    });
  }

  const passengers: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^[A-Z][A-Z .,'-]+,\s*[A-Z].*$/.test(lines[i]) && /^eTicket/i.test(lines[i + 1] || "")) {
      if (!passengers.includes(lines[i])) passengers.push(lines[i]);
    }
  }

  const refIdx = lines.findIndex((l) => /^Airline Reference$/i.test(l));
  const booking_reference = refIdx >= 0 ? (lines[refIdx + 1] ?? null) : null;

  return { legs, passengers, booking_reference };
}

/** Drop-in replacement for the AI reader: same signature and return shape. */
export async function parseItineraryPdfLocal(bytes: Uint8Array, _filename: string): Promise<ExtractedItinerary> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  if (!text || text.replace(/\s/g, "").length < 40) {
    // Almost no text layer — likely a scan; deterministic parsing can't help.
    throw new Error("PDF has no extractable text (scanned image?)");
  }
  const result = parseItineraryText(text);
  if (!result.legs.length) throw new Error("No recognisable flight segments in itinerary");
  return result;
}
