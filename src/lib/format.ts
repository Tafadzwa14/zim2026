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

export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const { hour, minute } = parts(iso);
  const ap = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${ap}`;
}

export function fmtTime24(iso: string | null): string {
  if (!iso) return "";
  const { hour, minute } = parts(iso);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function fmtDayShort(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TRIP_TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
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

/** The YYYY-MM-DD (trip tz) an instant falls on. */
export function tripDateOf(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isSameTripDay(iso: string, dateStr: string): boolean {
  return tripDateOf(iso) === dateStr;
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
