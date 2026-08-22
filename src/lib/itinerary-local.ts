import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import type { ExtractedItinerary, ExtractedLeg } from "@/lib/itinerary";
import { AIRPORTS } from "@/lib/airports";
import { airportLocalToUtcIso } from "@/lib/itinerary-time";

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

// Times on these itineraries are the airport's local wall-clock. Pinning them
// to a real UTC instant is delegated to airportLocalToUtcIso, which resolves
// the airport's zone from the shared @/lib/airports table; the app then
// projects that instant back to trip time (or the airport's own time) for
// display. Display cities still come from AIRPORTS here.

// Keyed by the first three letters, lower-cased, so both full ("September")
// and abbreviated ("Sep", "Sept") month names parse for every month.
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const monthIndex = (name: string): number | undefined => MONTHS[name.slice(0, 3).toLowerCase()];

const pad = (n: number) => String(n).padStart(2, "0");
/** Parsed wall-clock fields -> naive ISO the shared pinner can read. */
const naiveIso = (p: { y: number; mo: number; d: number; h: number; mi: number }): string =>
  `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;

const AIRPORTS_LINE = /^([A-Z]{3})\s+-\s+(.+?)\s+([A-Z]{3})\s+-\s+(.+)$/;
const TERMINAL_LINE = /^Terminal\s+(.+?)\s+Terminal\s+(.+)$/;
const TIMES_LINE = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*([A-Za-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}).*?(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*([A-Za-z]+,\s*\d{1,2}\s+[A-Za-z]+\s+\d{4})/;
const FLIGHT_LINE = /^(.+?)\s+-\s+([A-Z]{2})\s?(\d{1,4})\b(.*)$/;
const JETABROAD_FLIGHT_LINE = /^([A-Z0-9]{2})\s+(\d{3,4}[A-Z]?)$/;
const JETABROAD_DATE_LINE = /DEPARTURE:\s*([A-Z]+DAY\s+\d{1,2}\s+[A-Z]{3})(?:\s+ARRIVAL:\s*([A-Z]+DAY\s+\d{1,2}\s+[A-Z]{3}))?/i;
const JETABROAD_TIME_NOTE = /^\(([A-Za-z]{3}),\s*([A-Za-z]{3})\s+(\d{1,2})\)$/;
const CLASS_RE = /\b((?:Premium\s+)?Economy|Business|First)\s+Class\b.*$/i;
const AIRFRAME_RE = /(Boeing|Airbus|Embraer|Bombardier|ATR|De Havilland|McDonnell Douglas)[\w .\/-]*$/i;
const ROUTE_LABELS = new Set([
  "Aircraft:", "Arriving At:", "Cabin:", "Cabin Baggage:", "Checked Baggage:",
  "Departing At:", "Distance (in", "Duration:", "Est. emission:", "Meals:",
  "Passenger Name:", "Please verify flight times prior to", "Status:", "Terminal:",
]);

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

function parseDateOnly(dateStr: string, fallbackYear: number): { y: number; mo: number; d: number } | null {
  const dm = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (!dm) return null;
  const mo = monthIndex(dm[2]);
  if (mo === undefined) return null;
  return { y: dm[3] ? +dm[3] : fallbackYear, mo, d: +dm[1] };
}

function parseTimeOnly(timeStr: string) {
  const t = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!t) return null;
  let h = +t[1];
  if (t[3]) {
    h %= 12;
    if (/pm/i.test(t[3])) h += 12;
  }
  return { h, mi: +t[2] };
}

function combineDateTime(date: { y: number; mo: number; d: number } | null, timeStr: string, iata: string): string | null {
  const time = parseTimeOnly(timeStr);
  if (!date || !time) return null;
  return airportLocalToUtcIso(naiveIso({ ...date, ...time }), iata);
}

function dateFromJetabroadNote(note: string | undefined, fallbackYear: number): { y: number; mo: number; d: number } | null {
  const m = note?.match(JETABROAD_TIME_NOTE);
  if (!m) return null;
  const mo = monthIndex(m[2]);
  if (mo === undefined) return null;
  return { y: fallbackYear, mo, d: +m[3] };
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

function cleanAircraft(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s || /^Air$/i.test(s)) return null;
  return s;
}

/** Placeholder terminals ("TBD") aren't real data. */
function cleanTerminal(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  return t && !/^TBD$/i.test(t) ? t : null;
}

function normaliseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/auntbetty\.com|https?:\/\/|^\d{2}\/\d{2}\/\d{4},/.test(l));
}

function isRouteBoundary(line: string | undefined): boolean {
  if (!line) return true;
  if (/^[A-Z0-9]{2}\s+\d{3,4}[A-Z]?$/.test(line)) return true;
  if (/^[A-Z]{3}$/.test(line)) return true;
  if (/^DEPARTURE:/i.test(line)) return true;
  return ROUTE_LABELS.has(line);
}

function cityFromJetabroadRoute(lines: string[], start: number, fallbackIata: string): string | null {
  const parts: string[] = [];
  for (let i = start; i < lines.length && !isRouteBoundary(lines[i]); i++) parts.push(lines[i]);
  const joined = parts.join(" ").replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  const city = joined.split(",")[0]?.trim();
  return city || AIRPORTS[fallbackIata]?.city || null;
}

function valueAfterLabel(block: string[], label: string): string | null {
  const i = block.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  if (i < 0) return null;
  const first = block[i + 1]?.trim();
  const second = block[i + 2]?.trim();
  if (first && second && !isRouteBoundary(second) && /(?:airbus|boeing|jet|\b[AB]\d{3}\b)/i.test(`${first} ${second}`)) {
    return `${first} ${second}`;
  }
  return first || null;
}

function terminalAfterLabel(block: string[], label: string): string | null {
  const i = block.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  if (i < 0) return null;
  for (let j = i + 1; j < Math.min(i + 4, block.length); j++) {
    if (/^TERMINAL\b|^INTERNATIONAL$/i.test(block[j])) return cleanTerminal(block[j]);
  }
  return null;
}

function parseJetabroadBlocks(lines: string[], fallbackYear: number): ExtractedLeg[] {
  const legs: ExtractedLeg[] = [];
  const starts = lines.reduce<number[]>((acc, line, i) => /^DEPARTURE:/i.test(line) ? [...acc, i] : acc, []);

  for (let s = 0; s < starts.length; s++) {
    const block = lines.slice(starts[s], starts[s + 1] ?? lines.length);
    const dateLine = block[0].match(JETABROAD_DATE_LINE);
    const depDate = dateLine ? parseDateOnly(dateLine[1], fallbackYear) : null;
    const headerArrDate = dateLine?.[2] ? parseDateOnly(dateLine[2], fallbackYear) : null;

    const flightIdx = block.findIndex((l) => JETABROAD_FLIGHT_LINE.test(l));
    if (flightIdx <= 0) continue;
    const flight = block[flightIdx].match(JETABROAD_FLIGHT_LINE)!;

    const routeCodes: { code: string; index: number }[] = [];
    for (let i = flightIdx + 1; i < block.length; i++) {
      if (/^[A-Z]{3}$/.test(block[i])) routeCodes.push({ code: block[i], index: i });
      if (routeCodes.length === 2) break;
    }
    if (routeCodes.length < 2) continue;

    const departingAtIdx = block.findIndex((l) => /^Departing At:$/i.test(l));
    const arrivingAtIdx = block.findIndex((l) => /^Arriving At:$/i.test(l));
    const depTime = departingAtIdx >= 0 ? block[departingAtIdx + 1] : null;
    const arrTime = arrivingAtIdx >= 0 ? block[arrivingAtIdx + 1] : null;
    const depNote = departingAtIdx >= 0 ? block[departingAtIdx + 2] : undefined;
    const arrNote = arrivingAtIdx >= 0 ? block[arrivingAtIdx + 2] : undefined;
    if (!depTime || !arrTime) continue;

    const origin = routeCodes[0].code;
    const destination = routeCodes[1].code;
    const arrDate = dateFromJetabroadNote(arrNote, fallbackYear)
      ?? headerArrDate
      ?? dateFromJetabroadNote(depNote, fallbackYear)
      ?? depDate;
    const aircraft = valueAfterLabel(block, "Aircraft:");

    legs.push({
      flight_number: (flight[1] + flight[2]).toUpperCase(),
      airline_code: flight[1].toUpperCase(),
      airline_name: block[flightIdx - 1]?.trim() || null,
      origin_airport: origin,
      origin_city: cityFromJetabroadRoute(block, routeCodes[0].index + 1, origin),
      destination_airport: destination,
      destination_city: cityFromJetabroadRoute(block, routeCodes[1].index + 1, destination),
      scheduled_departure: combineDateTime(dateFromJetabroadNote(depNote, fallbackYear) ?? depDate, depTime, origin),
      scheduled_arrival: combineDateTime(arrDate, arrTime, destination),
      terminal_departure: terminalAfterLabel(block.slice(departingAtIdx >= 0 ? departingAtIdx : 0), "Terminal:"),
      aircraft_type: cleanAircraft(aircraft),
    });
  }

  return legs;
}

function parseJetabroadText(lines: string[], text: string): ExtractedItinerary {
  const years = [...text.matchAll(/\b\d{1,2}\s+[A-Z]{3}\s+(\d{4})\b/g)].map((m) => +m[1]);
  const fallbackYear = years[0] ?? new Date().getFullYear();
  const passengers = [...new Set(
    lines
      .filter((l) => /^»\s+/.test(l))
      .map((l) => l.replace(/^»\s+/, "").replace(/\s+Check-In Required.*$/i, "").trim())
      .filter(Boolean),
  )];
  const booking_reference = lines.find((l) => /^RESERVATION CODE\s+\S+/i.test(l))?.replace(/^RESERVATION CODE\s+/i, "").trim()
    ?? lines.find((l) => /^AIRLINE RESERVATION CODE\s+/i.test(l))?.replace(/^AIRLINE RESERVATION CODE\s+/i, "").trim()
    ?? null;

  return { legs: parseJetabroadBlocks(lines, fallbackYear), passengers, booking_reference };
}

function parseItineraryText(text: string): ExtractedItinerary {
  const lines = normaliseLines(text);

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
      scheduled_departure: dep ? airportLocalToUtcIso(naiveIso(dep), oCode) : null,
      scheduled_arrival: arr ? airportLocalToUtcIso(naiveIso(arr), dCode) : null,
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

  if (legs.length) return { legs, passengers, booking_reference };
  return parseJetabroadText(lines, text);
}

/** Drop-in replacement for the AI reader: same signature and return shape. */
export async function parseItineraryPdfLocal(bytes: Uint8Array, _filename: string): Promise<ExtractedItinerary> {
  void _filename;
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
