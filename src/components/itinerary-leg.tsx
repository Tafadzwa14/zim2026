"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { airportZone } from "@/lib/airports";
import { flightStatusMeta } from "@/lib/display";
import { durationLabel, fmtDayShortIn, fmtTimeIn, fmtZoneLabel, minutesBetween } from "@/lib/format";
import { legArrival, legDeparture } from "@/lib/travel";
import type { FlightLeg } from "@/lib/types";

/** One airport's own reading of an instant. `local` is false when the value is trip time. */
interface LocalTime {
  time: string;
  day: string;
  zone: string;
  local: boolean;
}

/**
 * Read an instant in an airport's local time. An IATA code we don't hold falls
 * back to trip time, labelled with the trip zone and flagged `local: false` so
 * the row can say so: a new airport can never blank out a time, and never
 * passes trip time off as the airport's own clock.
 */
function localTime(iso: string | null, iata: string): LocalTime {
  const tz = airportZone(iata);
  const local = !!tz;
  if (!iso || Number.isNaN(new Date(iso).getTime())) return { time: "TBC", day: "", zone: "", local };
  return { time: fmtTimeIn(iso, tz), day: fmtDayShortIn(iso, tz), zone: fmtZoneLabel(iso, tz), local };
}

/** `Terminal 2 · Gate B14`, whichever parts we have, or "TBC". */
function gateLabel(terminal: string | null, gate: string | null): string {
  return [terminal && `Terminal ${terminal}`, gate && `Gate ${gate}`].filter(Boolean).join(" · ") || "TBC";
}

/** One labelled value in the expanded grid. */
function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mono mt-0.5 text-[12px] font-semibold text-ink2">{value}</div>
    </div>
  );
}

/**
 * One segment of the journey, as a card that taps open for the full detail:
 * each end's local time and zone, terminals and gates, the flight time, the
 * aircraft, and the layover that led into it. Every time is the best one known
 * (actual, then estimated, then scheduled) and every duration is measured
 * between absolute instants, so nothing drifts across timezones.
 */
export function ItineraryLeg({
  leg,
  index,
  total,
  current,
  previous,
  layoverMins,
}: {
  leg: FlightLeg;
  index: number;
  total: number;
  /** This is the leg the travellers are on right now (see `currentLeg()`). */
  current: boolean;
  /** The leg flown before this one. Null on the first leg. */
  previous: FlightLeg | null;
  /** Ground time before this leg, in minutes. Null when it can't be worked out. */
  layoverMins: number | null;
}) {
  const [open, setOpen] = useState(false);
  const meta = flightStatusMeta(leg.status);
  const dep = legDeparture(leg);
  const arr = legArrival(leg);
  const depLocal = localTime(dep, leg.origin_airport);
  const arrLocal = localTime(arr, leg.destination_airport);
  const late = leg.status !== "landed" && (leg.delay_minutes ?? 0) > 0;
  const flightMins = minutesBetween(dep, arr);
  const layover = previous && layoverMins != null && layoverMins > 0 ? layoverMins : null;
  const tone =
    meta.tone === "air" ? "text-good" : meta.tone === "land" ? "text-[#5f86a8]" : meta.tone === "cancel" ? "text-berry" : "text-honey";
  const legName = total > 1 ? `Leg ${index + 1}` : "Flight";
  const stamp = (t: LocalTime) => [t.time, t.zone].filter(Boolean).join(" ") + (t.day ? ` · ${t.day}` : "");
  // An airport we don't hold reads in trip time, so say that rather than calling
  // it the airport's own clock.
  const endLabel = (verb: string, iata: string, t: LocalTime) => `${verb} ${iata} ${t.local ? "local" : "(trip time)"}`;
  const dayLine = (t: LocalTime) => [t.day, t.day && !t.local ? "trip time" : ""].filter(Boolean).join(" · ");
  return (
    <div className={cn("zc-card", current && "border-[1.5px] border-honey")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} details for ${leg.flight_number}, ${leg.origin_airport} to ${leg.destination_airport}`}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="mono rounded-md bg-chip px-1.5 py-0.5 text-[10px] font-bold text-muted">{legName}</span>
            <span className="mono text-[14px] font-semibold">{leg.flight_number}</span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{leg.airline_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("mono text-[10px] font-semibold uppercase", current ? "text-good" : tone)}>{leg.status === "air" ? "In air" : meta.label}{late ? ` · ${leg.delay_minutes}m late` : ""}</span>
            <span className={cn("text-muted transition-transform", open && "rotate-90")} aria-hidden>›</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <div className="mono text-[22px] font-semibold leading-none">{leg.origin_airport}</div>
            <div className="mt-1 text-[11px] font-bold text-muted">{leg.origin_city}</div>
            <div className="mono mt-1 text-[12px] font-semibold">{depLocal.time}</div>
            <div className="mono text-[10px] text-muted">{dayLine(depLocal)}</div>
          </div>
          <span className="text-lg text-muted" aria-hidden>✈</span>
          <div className="text-right">
            <div className="mono text-[22px] font-semibold leading-none">{leg.destination_airport}</div>
            <div className="mt-1 text-[11px] font-bold text-muted">{leg.destination_city}</div>
            <div className="mono mt-1 text-[12px] font-semibold">{arrLocal.time}</div>
            <div className="mono text-[10px] text-muted">{dayLine(arrLocal)}</div>
          </div>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line2 px-4 pb-4 pt-3">
          <Detail label={endLabel("Departs", leg.origin_airport, depLocal)} value={stamp(depLocal)} />
          <Detail label={endLabel("Arrives", leg.destination_airport, arrLocal)} value={stamp(arrLocal)} />
          <Detail label="Departure gate" value={gateLabel(leg.terminal_departure, leg.gate_departure)} />
          <Detail label="Arrival gate" value={gateLabel(leg.terminal_arrival, leg.gate_arrival)} />
          <Detail label="Flight time" value={flightMins != null && flightMins > 0 ? durationLabel(flightMins) : "TBC"} />
          <Detail label="Aircraft" value={[leg.aircraft_type, leg.aircraft_registration].filter(Boolean).join(" · ") || "TBC"} />
          {layover != null && (
            <Detail label="Layover before this leg" value={`${durationLabel(layover)} in ${leg.origin_city ?? leg.origin_airport} (${leg.origin_airport})`} wide />
          )}
        </div>
      )}
    </div>
  );
}
