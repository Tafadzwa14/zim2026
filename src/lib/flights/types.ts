// Provider-neutral flight shapes. Vendor responses are mapped into these
// so the rest of the app never depends on a specific flight API.

import type { FlightStatus } from "@/lib/types";

export interface FlightEndpoint {
  airport: string; // IATA, e.g. HRE
  city: string | null;
  scheduledTime: string | null; // ISO
  estimatedTime: string | null; // ISO
  actualTime: string | null; // ISO
  terminal: string | null;
  gate: string | null;
}

export interface FlightSearchResult {
  providerFlightId: string;
  flightNumber: string;
  airlineName: string | null;
  airlineCode: string | null;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  aircraftType: string | null;
  aircraftTypeCode: string | null;
  aircraftRegistration: string | null;
  status: FlightStatus;
}

export interface FlightStatusResult extends FlightSearchResult {
  /** 0..1 progress estimate. Treat as estimated, never as live radar. */
  progress: number | null;
  delayMinutes: number | null;
  lastUpdated: string; // ISO
}

export interface FlightPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  groundSpeed: number | null;
  heading: number | null;
  recordedAt: string;
  source: string;
}

export interface AircraftDetails {
  registration: string;
  type: string | null;
  typeCode: string | null;
  ageYears: number | null;
}
