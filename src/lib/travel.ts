// Shared flight/trip derivations. Pure and client-safe, with no server-only
// imports and no fetching, so both the dashboard read and the widgets can use
// exactly the same rules. TravelView.activeLeg is legacy and misleading; use
// currentLeg() here instead.

import type { FlightLeg } from "@/lib/types";
import type { TravelView } from "@/lib/repo/types";

/** Harare, the trip's home airport. */
export const HARARE = "HRE";

/**
 * An IATA code as we compare it: trimmed and uppercased. Codes arrive from
 * itinerary PDFs and admin paste, so " hre " has to match HRE or the family
 * lands with no airport run at all.
 */
function iata(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** An ISO instant as a sortable number. Missing or unparseable sorts last. */
function instant(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Compare two {@link instant} values, treating two unknowns as a tie. */
function byInstant(a: number, b: number): number {
  return a === b ? 0 : a - b;
}

/** Best-known departure instant for a leg: actual, then estimated, then scheduled. */
export function legDeparture(l: FlightLeg): string | null {
  return l.actual_departure ?? l.estimated_departure ?? l.scheduled_departure;
}

/** Best-known arrival instant for a leg: actual, then estimated, then scheduled. */
export function legArrival(l: FlightLeg): string | null {
  return l.actual_arrival ?? l.estimated_arrival ?? l.scheduled_arrival;
}

/** A trip's legs in leg_order, as a copy (never mutates the view). */
export function orderedLegs(t: TravelView): FlightLeg[] {
  return [...t.legs].sort((a, b) => a.leg_order - b.leg_order);
}

/**
 * The leg the travellers are on right now: anything in the air wins, otherwise
 * the earliest leg still to come. Null once every leg has landed, been
 * cancelled or flown (and for an empty list). Statuses only move when someone
 * taps Refresh, so a leg whose arrival is already behind us counts as flown
 * even while it still reads "scheduled". A leg with no known times stays
 * selectable.
 */
export function currentLeg(legs: FlightLeg[], now: Date = new Date()): FlightLeg | null {
  const flown = (l: FlightLeg) =>
    l.status === "landed" || l.status === "cancelled" || instant(legArrival(l)) < now.getTime();
  return legs.find((l) => l.status === "air") ?? legs.find((l) => !flown(l)) ?? null;
}

/** Whether a trip starts or ends at Harare, ignoring times. */
export function touchesHarare(t: TravelView): boolean {
  const legs = orderedLegs(t);
  if (!legs.length) return false;
  return iata(legs[0].origin_airport) === HARARE || iata(legs[legs.length - 1].destination_airport) === HARARE;
}

/** A pickup is someone landing at HRE; a dropoff is someone flying out of it. */
export type AirportRunKind = "pickup" | "dropoff";

/** One car run to or from Harare airport, with the leg and trip behind it. */
export interface AirportRun {
  id: string;
  tripId: string;
  kind: AirportRunKind;
  hreIso: string;
  /**
   * The Harare leg was cancelled, so the run is shown flagged and carries no
   * driver control. A cancelled run stays on the board so a driver who was
   * expecting it sees why it went away.
   */
  cancelled: boolean;
  leg: FlightLeg;
  trip: TravelView;
}

/**
 * The airport runs a single trip generates. A return trip can yield both. Each
 * run is derived from its own leg, landed or not; use {@link runIsPast} to work
 * out what is behind us.
 */
export function airportRunsFor(t: TravelView): AirportRun[] {
  const legs = orderedLegs(t);
  if (!legs.length) return [];
  const runs: AirportRun[] = [];

  const last = legs[legs.length - 1];
  if (iata(last.destination_airport) === HARARE) {
    const hreIso = legArrival(last);
    if (hreIso) {
      runs.push({
        id: `${t.id}:arr`, tripId: t.id, kind: "pickup", hreIso,
        cancelled: last.status === "cancelled", leg: last, trip: t,
      });
    }
  }

  const first = legs[0];
  if (iata(first.origin_airport) === HARARE) {
    const hreIso = legDeparture(first);
    if (hreIso) {
      runs.push({
        id: `${t.id}:dep`, tripId: t.id, kind: "dropoff", hreIso,
        cancelled: first.status === "cancelled", leg: first, trip: t,
      });
    }
  }

  return runs;
}

/** Every airport run across all trips, soonest first. */
export function airportRuns(travel: TravelView[]): AirportRun[] {
  return travel.flatMap(airportRunsFor).sort((a, b) => byInstant(instant(a.hreIso), instant(b.hreIso)));
}

/** Whether a run is already behind us: the plane has landed or left, or its Harare time has passed. */
export function runIsPast(r: AirportRun, now: Date = new Date()): boolean {
  if (instant(r.hreIso) <= now.getTime()) return true;
  if (r.kind === "pickup") return r.leg.status === "landed";
  return r.leg.status === "air" || r.leg.status === "landed";
}

/**
 * The trip to show a person as "my flight": their soonest live trip that
 * touches Harare and still has a leg to fly. Trips whose final arrival is
 * already behind us are dropped, whatever their stored statuses say. Null when
 * they have none.
 */
export function myFlightTrip(travel: TravelView[], meId: string, now: Date = new Date()): TravelView | null {
  const landedAlready = (t: TravelView) => {
    const legs = orderedLegs(t);
    return legs.length ? instant(legArrival(legs[legs.length - 1])) < now.getTime() : false;
  };
  const mine = travel.filter(
    (t) =>
      t.status !== "arrived" &&
      t.members.some((m) => m.id === meId) &&
      touchesHarare(t) &&
      currentLeg(orderedLegs(t), now) !== null &&
      !landedAlready(t),
  );
  // Numeric key, so a trip with no readable times sorts last rather than first.
  const key = (t: TravelView) => {
    const cur = currentLeg(orderedLegs(t), now);
    return instant((cur ? legDeparture(cur) : null) ?? t.arrivalIso);
  };
  return mine.sort((a, b) => byInstant(key(a), key(b)))[0] ?? null;
}
