// Pure date/time helpers. Safe to import on client or server.
// Trip times are shown in Zimbabwe local time (spec section 48).

export const TRIP_TZ = "Africa/Harare";

function parts(iso: string, tz = TRIP_TZ) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    year: +get("year"),
    month: +get("month"),
    day: +get("day"),
    hour: +get("hour"),
    minute: +get("minute"),
  };
}

/** Clock time in a given zone, e.g. `9:05 PM`. Defaults to trip time. */
export function fmtTimeIn(iso: string | null, tz?: string): string {
  if (!iso) return "";
  const { hour, minute } = parts(iso, tz ?? TRIP_TZ);
  const ap = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${ap}`;
}

export function fmtTime(iso: string | null): string {
  return fmtTimeIn(iso);
}

export function fmtTime24(iso: string | null): string {
  if (!iso) return "";
  const { hour, minute } = parts(iso);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Day and month in a given zone, e.g. `12 Sep`. Defaults to trip time. */
export function fmtDayShortIn(iso: string | null, tz?: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz ?? TRIP_TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function fmtDayShort(iso: string | null): string {
  return fmtDayShortIn(iso);
}

/**
 * Short zone name for an instant, e.g. `AEST` or `GMT+2`. "" when unknown.
 *
 * Formatted en-AU on purpose: most of this family flies out of Australia, and
 * en-AU names those zones properly (AEST, AEDT in daylight saving, AWST) where
 * en-GB only manages `GMT+10`. Everywhere else falls back to an unambiguous
 * GMT offset.
 */
export function fmtZoneLabel(iso: string | null, tz?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const f = new Intl.DateTimeFormat("en-AU", { timeZone: tz ?? TRIP_TZ, timeZoneName: "short" }).formatToParts(d);
    return f.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function fmtDayShortUpper(iso: string | null): string {
  return fmtDayShort(iso).toUpperCase();
}

export function fmtWeekdayLong(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TRIP_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function fmtDateLong(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TRIP_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** Today's date in the trip timezone, as YYYY-MM-DD. */
export function tripTodayISO(now: Date = new Date()): string {
  const { year, month, day } = parts(now.toISOString());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The YYYY-MM-DD an instant falls on in a given zone. Defaults to trip time.
 * Use this for anything keyed to the destination's calendar day, such as an
 * arrival-day forecast: 6:30 AM in Melbourne is the day before in Harare.
 */
export function dateIn(iso: string, tz?: string): string {
  const { year, month, day } = parts(iso, tz ?? TRIP_TZ);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The YYYY-MM-DD (trip tz) an instant falls on. */
export function tripDateOf(iso: string): string {
  return dateIn(iso);
}

export function isSameTripDay(iso: string, dateStr: string): boolean {
  return tripDateOf(iso) === dateStr;
}

/**
 * Render an instant as a `datetime-local` value (`YYYY-MM-DDTHH:mm`) in trip
 * time, so flight-form inputs read in Zimbabwe wall-clock like the rest of the
 * app rather than the viewer's browser timezone.
 */
export function isoToTripInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { year, month, day, hour, minute } = parts(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}`;
}

/**
 * Interpret a `datetime-local` value as trip (Zimbabwe) wall-clock time and
 * return an absolute ISO string. Harare is UTC+2 year-round (no DST), so the
 * offset is fixed — the inverse of {@link isoToTripInput}.
 */
export function tripInputToIso(v: string): string | null {
  return v ? `${v}:00+02:00` : null;
}

/**
 * A date-only column plus an optional time-only column, as one real instant in
 * trip time. Plans, tasks and the wedding store `date` and `start_time`
 * separately with no zone of their own, so pinning them to Harare wall-clock is
 * what turns them into something a formatter can read. Harare is UTC+2 all year,
 * so the offset is fixed, as in {@link tripInputToIso}.
 */
export function tripInstant(date: string, time?: string | null): string {
  // Accept both `HH:mm` (from forms) and `HH:mm:ss` (Postgres `time` columns
  // hand back seconds). Taking hour and minute and re-adding seconds ourselves
  // keeps the output a valid ISO instant either way; appending `:00` blindly
  // turned "18:00:00" into "18:00:00:00", an invalid date that blanked the page.
  const [h = "00", m = "00"] = (time ?? "00:00").split(":");
  return `${date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00+02:00`;
}

/**
 * How far ahead of UTC a zone runs at a given instant, in whole minutes.
 * DST-aware. Rounded on purpose: the wall clock we read back has no seconds, so
 * the raw division carries the instant's own seconds as a fraction, and
 * subtracting two such values can land on 479.99999999999994 rather than 480.
 * Every real zone offset is a whole number of minutes.
 */
export function zoneOffsetMinutes(iso: string, tz: string): number {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return 0;
  const { year, month, day, hour, minute } = parts(iso, tz);
  return Math.round((Date.UTC(year, month - 1, day, hour, minute) - at) / 60_000);
}

/** Abbreviated weekday in a zone, e.g. `Sun`. */
function weekdayShortIn(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short" }).format(new Date(iso));
}

export interface ViewerReading {
  /** Clock time in the viewer's zone, e.g. `3:00 AM`. */
  time: string;
  /** Day qualifier in the viewer's zone, e.g. `Sun`. Null when it's the same day. */
  day: string | null;
  /** How far ahead of the primary reading the viewer is, in minutes. Never 0. */
  deltaMinutes: number;
  /** Ready to render, e.g. `3:00 AM Sun`. */
  label: string;
}

/**
 * How a viewer reads an instant on their own clock, or null when there is
 * nothing worth saying.
 *
 * Null when we don't know their zone yet, and null when their clock already
 * matches the reading beside it. That test compares UTC offsets rather than zone
 * names on purpose: someone in Johannesburg or Maputo is on a different zone but
 * the very same clock, and a second identical reading would be pure noise.
 *
 * `baseTz` is the zone the primary reading is ALREADY in, and defaults to trip
 * time. Pass it whenever the time beside this one is not Harare, or a viewer will
 * be told "your time" for a clock that is already theirs.
 *
 * `day` is set only when their calendar day differs, which is not an edge case.
 * A 7pm dinner in Harare is 3am the next morning in Melbourne, so a bare
 * "3:00 AM your time" would leave someone expecting it tonight.
 *
 * `minDeltaMinutes` suppresses readings below a threshold, for the day we decide
 * that telling London they are one hour out is not worth the line.
 */
export function viewerReading(
  iso: string | null | undefined,
  viewerTz: string | null,
  baseTz: string = TRIP_TZ,
  minDeltaMinutes = 0,
): ViewerReading | null {
  if (!iso || !viewerTz) return null;
  if (Number.isNaN(new Date(iso).getTime())) return null;
  try {
    const delta = zoneOffsetMinutes(iso, viewerTz) - zoneOffsetMinutes(iso, baseTz);
    if (delta === 0 || Math.abs(delta) < minDeltaMinutes) return null;
    const time = fmtTimeIn(iso, viewerTz);
    const day = dateIn(iso, viewerTz) !== dateIn(iso, baseTz) ? weekdayShortIn(iso, viewerTz) : null;
    return { time, day, deltaMinutes: delta, label: day ? `${time} ${day}` : time };
  } catch {
    // Intl throws on a zone it can't resolve. A browser reporting something odd
    // should cost the reader this one line, not the whole page.
    return null;
  }
}

export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const today = tripTodayISO(now);
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Whole minutes from `a` to `b`; null if either is missing or unparseable. */
export function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 60_000);
}

/**
 * Minutes as `2h 40m`, `40m` or `3h`. Zero and negatives read as `0m`.
 * Rounds to a whole minute before splitting, so a hair under 480 reads as `8h`
 * rather than the `7h 60m` that rounding each part separately would produce.
 */
export function durationLabel(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "0m";
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 0..1 progress estimate from times. Always treated as estimated. */
export function progressFromTimes(
  departure: string | null,
  arrival: string | null,
  now: Date = new Date()
): number {
  if (!departure || !arrival) return 0;
  const dep = new Date(departure).getTime();
  const arr = new Date(arrival).getTime();
  if (!(arr > dep)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - dep) / (arr - dep)));
}

/** Time-remaining label derived from progress and total duration. */
export function remainingLabel(
  departure: string | null,
  arrival: string | null,
  progress: number
): string {
  if (!departure || !arrival) return "";
  const total = new Date(arrival).getTime() - new Date(departure).getTime();
  const rem = total * (1 - progress);
  if (rem <= 0) return "Any min";
  const h = Math.floor(rem / 3_600_000);
  const m = Math.round((rem % 3_600_000) / 60_000);
  return `${h ? `${h}h ` : ""}${m}m`;
}
