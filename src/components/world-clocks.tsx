"use client";

import { useEffect, useState } from "react";
import { TRIP_TZ } from "@/lib/format";

/**
 * Three live clocks for a flight in progress: the relevant airport, Zimbabwe
 * (the trip's time), and wherever the viewer actually is (device timezone).
 * Ticks each second; renders a stable placeholder before mount so the
 * device-timezone reading can't cause a hydration mismatch.
 */
export function WorldClocks({
  airportZone,
  airportLabel,
  airportSub,
}: {
  /** IANA zone for the current airport, or null when we don't know it. */
  airportZone: string | null;
  /** Short label for the airport clock, e.g. "PER" or "Arriving PER". */
  airportLabel: string;
  /** City under the airport label, e.g. "Perth". */
  airportSub: string | null;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const deviceZone = now
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "";
  const deviceCity = deviceZone
    ? (deviceZone.split("/").pop() ?? deviceZone).replace(/_/g, " ")
    : "";

  const clocks: { label: string; sub: string | null; zone: string | null }[] = [
    { label: airportLabel, sub: airportSub, zone: airportZone },
    { label: "Zimbabwe", sub: "Harare", zone: TRIP_TZ },
    { label: "You", sub: deviceCity || null, zone: deviceZone || null },
  ];

  return (
    <div className="mt-3 flex gap-[7px]">
      {clocks.map((c, i) => (
        <div key={i} className="flex-1 rounded-[14px] border border-line bg-card px-2 py-2.5 text-center">
          <div className="mono text-[15px] font-semibold text-ink">{clockTime(now, c.zone)}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink2">{c.label}</div>
          {c.sub && <div className="text-[9px] text-muted">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function clockTime(now: Date | null, zone: string | null): string {
  if (!now || !zone) return "—";
  try {
    // en-US for uppercase AM/PM, matching the app's fmtTime house style.
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  } catch {
    return "—";
  }
}
