"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { durationLabel, viewerReading } from "@/lib/format";

/**
 * The viewer's own clock, shown beside a trip time.
 *
 * Everything here is quoted in Harare time so the whole family agrees on when
 * things happen (spec 48). That leaves anyone in Australia doing the sums in
 * their head, so we add their own reading next to it, and only where it tells
 * them something they didn't already know.
 *
 * Named "viewer", not "local": local already means airport-local in this app
 * (see itinerary-leg.tsx), and the two are different ideas.
 *
 * Display only. Nothing here feeds a date bucket, a filter or a sort key: which
 * day something belongs to stays Harare's answer for everybody, otherwise the
 * family stops sharing a calendar. A request to sort by the viewer's clock has
 * to be refused, not accommodated.
 */

// The zone is stable per device but not forever: a phone crossing into a new
// zone updates while the app is still open, and the people in the air are
// exactly the ones who care most. Cache the read, then re-check when the app
// comes back to the foreground.
let cached: string | null = null;
let read = false;

function currentZone(): string | null {
  if (!read) {
    try {
      cached = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      cached = null;
    }
    read = true;
  }
  return cached;
}

const listeners = new Set<() => void>();
function recheck() {
  const before = cached;
  read = false;
  if (currentZone() !== before) listeners.forEach((l) => l());
}
function subscribeZone(cb: () => void) {
  listeners.add(cb);
  document.addEventListener("visibilitychange", recheck);
  window.addEventListener("focus", recheck);
  return () => {
    listeners.delete(cb);
    document.removeEventListener("visibilitychange", recheck);
    window.removeEventListener("focus", recheck);
  };
}

/**
 * The device's IANA zone. Null on the server and on the first client render, so
 * the markup matches and there is no hydration mismatch; the real value arrives
 * in the pass straight after hydration.
 */
export function useViewerZone(): string | null {
  return useSyncExternalStore(subscribeZone, currentZone, () => null);
}

/**
 * "· 3:00 AM Sun your time", or nothing at all when the viewer is already on the
 * same clock (or we don't know yet).
 *
 * `iso` must be a real instant. For a date-only value pass null: a date has no
 * time of day, so projecting it into another zone would invent a deadline hour
 * and can land on the wrong day entirely. Build it with tripInstant(date, time),
 * and pass null when there is no time.
 *
 * `baseTz` is the zone of the time this sits beside, when that is not Harare.
 */
export function ViewerTime({
  iso,
  baseTz,
  stacked,
  className,
}: {
  iso: string | null | undefined;
  baseTz?: string;
  /** Render on its own line instead of inline after a middot. */
  stacked?: boolean;
  className?: string;
}) {
  const zone = useViewerZone();
  const reading = viewerReading(iso, zone, baseTz);
  if (!reading) return null;
  const text = `${reading.label} your time`;
  return (
    <span className={cn("mono text-muted", stacked && "block", className)}>
      {stacked ? text : ` · ${text}`}
    </span>
  );
}

/**
 * One line explaining the whole screen, for surfaces where annotating every row
 * would cost more than it buys. Renders nothing for a viewer already on Harare's
 * clock. This is the one place the viewer's city is named, deliberately: a phone
 * that has landed in Harare but not resynced will confidently mislabel every
 * time on the screen, and this is where someone can catch that.
 */
export function ZoneNote({ className }: { className?: string }) {
  const zone = useViewerZone();
  // Compared at "now", since this describes the screen rather than one event.
  const reading = viewerReading(new Date().toISOString(), zone);
  if (!reading || !zone) return null;
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  const gap = durationLabel(Math.abs(reading.deltaMinutes));
  const dir = reading.deltaMinutes > 0 ? "ahead" : "behind";
  return (
    <p className={cn("text-[12px] text-muted", className)}>
      Times are Harare time. You are {gap} {dir} in {city}.
    </p>
  );
}
