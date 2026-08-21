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

/** Short zone name for an instant, e.g. `CAT` or `GMT+11`. "" when unknown. */
export function fmtZoneLabel(iso: string | null, tz?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz ?? TRIP_TZ, timeZoneName: "short" }).formatToParts(d);
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

/** Minutes as `2h 40m`, `40m` or `3h`. Zero and negatives read as `0m`. */
export function durationLabel(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
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
