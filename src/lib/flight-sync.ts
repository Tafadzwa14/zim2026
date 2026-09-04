import "server-only";

import { airportZone } from "@/lib/airports";
import { dateIn } from "@/lib/format";
import { estimateProgress, getFlightPosition, getFlightStatus } from "@/lib/flights";
import { routeFraction } from "@/lib/flights/geo";
import type { TravelView, Repo } from "@/lib/repo/types";
import { journeyStatus, locationStatusForJourneys } from "@/lib/travel";
import type { FlightLeg, FlightStatus } from "@/lib/types";

const SIX_HOURS = 6 * 60 * 60 * 1000;

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A live leg or a flight near its scheduled window needs fresh provider data. */
export function needsPageLoadSync(leg: FlightLeg, now = new Date()): boolean {
  if (leg.status === "air" || leg.status === "boarding") return true;
  const departure = timestamp(leg.actual_departure ?? leg.estimated_departure ?? leg.scheduled_departure);
  const arrival = timestamp(leg.actual_arrival ?? leg.estimated_arrival ?? leg.scheduled_arrival);
  const current = now.getTime();
  return (departure !== null && current >= departure - SIX_HOURS && current <= departure + SIX_HOURS) ||
    (arrival !== null && current >= arrival - SIX_HOURS && current <= arrival + SIX_HOURS);
}

async function syncUserTravelStatuses(repo: Repo, userIds: string[]): Promise<void> {
  const travel = await repo.listTravel();
  for (const userId of new Set(userIds)) {
    const mine = travel.filter((trip) => trip.members.some((member) => member.id === userId));
    await repo.setUserStatus(userId, locationStatusForJourneys(mine.map((trip) => trip.status)));
  }
}

async function syncLeg(repo: Repo, leg: FlightLeg): Promise<FlightStatus | null> {
  const date = leg.scheduled_departure
    ? dateIn(leg.scheduled_departure, airportZone(leg.origin_airport))
    : "";
  const status = date
    ? await getFlightStatus(leg.flight_number, date, leg.status === "air", {
      origin: leg.origin_airport,
      destination: leg.destination_airport,
      providerFlightId: leg.provider_flight_id,
    })
    : null;
  if (!status) return null;

  const departure = status.departure.actualTime ?? status.departure.estimatedTime ?? status.departure.scheduledTime ?? leg.scheduled_departure;
  const arrival = status.arrival.actualTime ?? status.arrival.estimatedTime ?? status.arrival.scheduledTime ?? leg.scheduled_arrival;
  let progress = status.status === "landed" ? 1 : status.status === "air" ? estimateProgress(departure, arrival) : 0;
  let progressSource: FlightLeg["progress_source"] = null;
  if (status.status === "air") {
    progressSource = "estimated";
    const position = await getFlightPosition(leg.flight_number, date, true);
    if (position) {
      const liveProgress = routeFraction(
        status.departure.airport || leg.origin_airport,
        status.arrival.airport || leg.destination_airport,
        position,
      );
      if (liveProgress !== null) {
        progress = liveProgress;
        progressSource = "live";
      }
    }
  }

  await repo.syncLeg(leg.id, {
    status: status.status,
    airline_name: status.airlineName ?? leg.airline_name,
    estimated_departure: status.departure.estimatedTime,
    actual_departure: status.departure.actualTime,
    estimated_arrival: status.arrival.estimatedTime,
    actual_arrival: status.arrival.actualTime,
    terminal_departure: status.departure.terminal ?? leg.terminal_departure,
    gate_departure: status.departure.gate ?? leg.gate_departure,
    terminal_arrival: status.arrival.terminal ?? leg.terminal_arrival,
    gate_arrival: status.arrival.gate ?? leg.gate_arrival,
    aircraft_type: status.aircraftType ?? leg.aircraft_type,
    aircraft_type_code: status.aircraftTypeCode ?? leg.aircraft_type_code,
    aircraft_registration: status.aircraftRegistration ?? leg.aircraft_registration,
    delay_minutes: status.delayMinutes ?? leg.delay_minutes,
    progress,
    progress_source: progressSource,
  });
  return status.status;
}

/** Refresh every leg in one journey. Used by the explicit Refresh control. */
export async function syncTravelFlights(
  repo: Repo,
  travel: TravelView,
  shouldSync: (leg: FlightLeg) => boolean = () => true,
): Promise<void> {
  const statuses = [...travel.legs.map((leg) => leg.status)];
  for (let index = 0; index < travel.legs.length; index += 1) {
    if (!shouldSync(travel.legs[index])) continue;
    const status = await syncLeg(repo, travel.legs[index]);
    if (status) statuses[index] = status;
  }
  await repo.setTravelStatus(travel.id, journeyStatus(statuses));
  await syncUserTravelStatuses(repo, travel.members.map((member) => member.id));
}

/**
 * Page-load sync deliberately limits itself to flights someone may be taking
 * today plus any leg marked active. The latter also heals a stale "in air"
 * record even when it is long past its scheduled arrival.
 */
export async function syncFlightsForPageLoad(repo: Repo, travel: TravelView[]): Promise<void> {
  await Promise.all(travel.filter((trip) => trip.legs.some((leg) => needsPageLoadSync(leg))).map(async (trip) => {
    try {
      await syncTravelFlights(repo, trip, needsPageLoadSync);
    } catch {
      // Flight data is advisory; a temporary provider outage must never block a page.
    }
  }));
}
