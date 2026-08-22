import type {
  AircraftDetails,
  FlightPosition,
  FlightSearchResult,
  FlightStatusResult,
} from "./types";

/**
 * The one interface the app talks to for flight data. Swap the concrete
 * provider (AeroDataBox, FlightAware, ...) without touching any UI or
 * data-access code. Optional methods may be unsupported by a provider and
 * return null rather than throwing.
 */
export interface FlightProvider {
  readonly name: string;

  /** Find flights matching a flight number on a given date (YYYY-MM-DD). */
  searchFlight(flightNumber: string, date: string): Promise<FlightSearchResult[]>;

  /** Latest status for a flight number on a date. Null if not found. */
  getFlightStatus(
    flightNumber: string,
    date: string,
    match?: { origin?: string; destination?: string; providerFlightId?: string | null },
  ): Promise<FlightStatusResult | null>;

  /** Live position, if the provider supports it. */
  getFlightPosition?(
    flightNumber: string,
    date: string
  ): Promise<FlightPosition | null>;

  /** Aircraft details by registration, if supported. */
  getAircraftDetails?(registration: string): Promise<AircraftDetails | null>;
}

/**
 * Live positions are a separate concern from schedule/status. OpenSky (and
 * similar radar sources) only know where a plane is right now, not its gate
 * or delay. Keep it split so the status provider (AeroDataBox) and the
 * position provider (OpenSky) can be chosen independently.
 */
export interface PositionProvider {
  readonly name: string;

  /** Live position for a flight number today, or null if not currently tracked. */
  getFlightPosition(
    flightNumber: string,
    date: string
  ): Promise<FlightPosition | null>;
}
