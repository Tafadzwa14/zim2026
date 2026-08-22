import { airportZone, AIRPORTS } from "@/lib/airports";
import { fmtTime, fmtTimeIn, isoToZonedInput, TRIP_TZ, zonedInputToIso } from "@/lib/format";
import type { TravelView } from "@/lib/repo/types";
import type { FlightLeg } from "@/lib/types";

export function legDeparture(leg: FlightLeg | null): string | null {
  return leg?.actual_departure ?? leg?.estimated_departure ?? leg?.scheduled_departure ?? null;
}

export function legArrival(leg: FlightLeg | null): string | null {
  return leg?.actual_arrival ?? leg?.estimated_arrival ?? leg?.scheduled_arrival ?? null;
}

export function finalLeg(travel: TravelView): FlightLeg | null {
  const legs = [...travel.legs].sort((a, b) => a.leg_order - b.leg_order);
  return legs[legs.length - 1] ?? null;
}

export function currentLeg(travel: TravelView): FlightLeg | null {
  const legs = [...travel.legs].sort((a, b) => a.leg_order - b.leg_order);
  const now = Date.now();
  const flown = (l: FlightLeg) => {
    const arr = legArrival(l);
    return l.status === "landed" || l.status === "cancelled" || (arr ? Date.parse(arr) < now : false);
  };
  return (
    legs.find((l) => l.status === "air") ??
    legs.find((l) => l.status === "boarding" && !flown(l)) ??
    legs.find((l) => !flown(l)) ??
    legs[legs.length - 1] ??
    null
  );
}

export function tripRouteLabel(travel: TravelView): string {
  const first = travel.legs[0];
  const last = finalLeg(travel);
  if (!first || !last) return "";
  return `${first.origin_airport}→${last.destination_airport}`;
}

export function legRouteLabel(leg: FlightLeg | null): string {
  return leg ? `${leg.origin_airport}→${leg.destination_airport}` : "";
}

export function airportCity(iata: string | null | undefined, fallback: string | null | undefined): string {
  if (!iata) return fallback ?? "";
  return fallback ?? AIRPORTS[iata.toUpperCase()]?.city ?? iata;
}

/** Clock time at an airport, in its own zone, 24-hour, e.g. `06:30`. */
export function fmtAirportTime(iso: string | null, airport: string | null | undefined): string {
  return fmtTimeIn(iso, airportZone(airport) ?? TRIP_TZ);
}

export function isoToAirportInput(iso: string | null | undefined, airport: string | null | undefined): string {
  return isoToZonedInput(iso, airportZone(airport) ?? TRIP_TZ);
}

export function airportInputToIso(v: string, airport: string | null | undefined): string | null {
  return zonedInputToIso(v, airportZone(airport) ?? TRIP_TZ);
}

export function dualTimeLabel(iso: string | null, airport: string | null | undefined): string {
  if (!iso) return "";
  const local = fmtAirportTime(iso, airport);
  const trip = fmtTime(iso);
  const zone = airportZone(airport);
  if (!zone || zone === TRIP_TZ || local === trip) return `${trip} Zim`;
  return `${local} local · ${trip} Zim`;
}

export function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.round(diff / 60_000);
}

export function minutesUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.round(diff / 60_000);
}

export function pickupLeaveBy(arrivalIso: string | null, bufferMinutes = 75): string | null {
  if (!arrivalIso) return null;
  const t = new Date(arrivalIso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t - bufferMinutes * 60_000).toISOString();
}
