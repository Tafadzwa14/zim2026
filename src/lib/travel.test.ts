import { describe, expect, it } from "vitest";
import type { TravelView } from "@/lib/repo/types";
import type { FlightLeg, Pickup } from "@/lib/types";
import {
  airportRunsFor,
  currentLeg,
  journeyStatus,
  locationStatusForJourneys,
  pickupForLeg,
} from "./travel";

function leg(input: Partial<FlightLeg> & Pick<FlightLeg, "id" | "leg_order" | "origin_airport" | "destination_airport">): FlightLeg {
  return {
    travel_group_id: "trip", provider: null, provider_flight_id: null,
    flight_number: `ZZ${input.leg_order + 1}`, airline_code: null, airline_name: null,
    origin_city: null, destination_city: null, scheduled_departure: null,
    estimated_departure: null, actual_departure: null, scheduled_arrival: null,
    estimated_arrival: null, actual_arrival: null, terminal_departure: null,
    gate_departure: null, terminal_arrival: null, gate_arrival: null,
    aircraft_type: null, aircraft_type_code: null, aircraft_registration: null,
    status: "scheduled", progress: null, progress_source: null, delay_minutes: null,
    last_synced_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...input,
  };
}

function trip(legs: FlightLeg[], pickups: Pickup[] = []): TravelView {
  return {
    id: "trip", title: "Round trip", status: "upcoming", accommodation: null,
    luggage_notes: null, general_notes: null, created_by: "owner",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    members: [], legs, pickup: null, pickups, driver: null, activeLeg: null,
    arrivalIso: legs.at(-1)?.scheduled_arrival ?? null,
  };
}

describe("multi-leg travel derivations", () => {
  const inbound = leg({
    id: "in", leg_order: 0, origin_airport: "MEL", destination_airport: "HRE",
    scheduled_departure: "2026-09-01T00:00:00Z", scheduled_arrival: "2026-09-01T12:00:00Z",
  });
  const outbound = leg({
    id: "out", leg_order: 1, origin_airport: "HRE", destination_airport: "MEL",
    scheduled_departure: "2026-09-20T08:00:00Z", scheduled_arrival: "2026-09-21T00:00:00Z",
  });

  it("creates a pickup and a drop-off from the actual Harare legs", () => {
    const runs = airportRunsFor(trip([outbound, inbound]));
    expect(runs.map((run) => [run.kind, run.leg.id]))
      .toEqual([["pickup", "in"], ["dropoff", "out"]]);
    expect(runs.find((run) => run.kind === "dropoff")?.hreIso).toBe("2026-09-20T06:00:00.000Z");
  });

  it("selects the next unflown leg and returns null after the whole trip", () => {
    expect(currentLeg([inbound, outbound], new Date("2026-09-10T00:00:00Z"))?.id).toBe("out");
    expect(currentLeg([inbound, outbound], new Date("2026-09-22T00:00:00Z"))).toBeNull();
  });

  it("matches a pickup only to its own arrival leg", () => {
    const pickup = { id: "pickup", travel_group_id: "trip", flight_leg_id: "in", requested: true } as Pickup;
    const view = trip([inbound, outbound], [pickup]);
    expect(pickupForLeg(view, "in")?.id).toBe("pickup");
    expect(pickupForLeg(view, "out")).toBeNull();
  });

  it("respects an explicitly disabled pickup", () => {
    const pickup = { id: "pickup", travel_group_id: "trip", flight_leg_id: "in", requested: false } as Pickup;
    expect(pickupForLeg(trip([inbound], [pickup]), "in")).toBeNull();
  });

  it("does not mark a journey arrived until every leg is complete", () => {
    expect(journeyStatus(["landed", "scheduled"])).toBe("upcoming");
    expect(journeyStatus(["landed", "air"])).toBe("travelling");
    expect(journeyStatus(["landed", "cancelled"])).toBe("arrived");
  });

  it("gives an active journey precedence in a person's status", () => {
    expect(locationStatusForJourneys(["arrived", "upcoming", "travelling"])).toBe("travelling");
    expect(locationStatusForJourneys(["arrived"])).toBe("here");
  });
});
