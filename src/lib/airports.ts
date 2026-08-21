// IATA airport reference: IANA timezone (for showing local time) and a display
// city. Client-safe — no secrets, no server-only imports — so it can be used in
// both the itinerary parser (server) and the world-clocks UI (client).
// Extend as new airports appear on itineraries.

export interface AirportInfo {
  tz: string;
  city: string;
}

export const AIRPORTS: Record<string, AirportInfo> = {
  MEL: { tz: "Australia/Melbourne", city: "Melbourne" },
  SYD: { tz: "Australia/Sydney", city: "Sydney" },
  BNE: { tz: "Australia/Brisbane", city: "Brisbane" },
  PER: { tz: "Australia/Perth", city: "Perth" },
  ADL: { tz: "Australia/Adelaide", city: "Adelaide" },
  JNB: { tz: "Africa/Johannesburg", city: "Johannesburg" },
  CPT: { tz: "Africa/Johannesburg", city: "Cape Town" },
  DUR: { tz: "Africa/Johannesburg", city: "Durban" },
  HRE: { tz: "Africa/Harare", city: "Harare" },
  BUQ: { tz: "Africa/Harare", city: "Bulawayo" },
  VFA: { tz: "Africa/Harare", city: "Victoria Falls" },
  ADD: { tz: "Africa/Addis_Ababa", city: "Addis Ababa" },
  NBO: { tz: "Africa/Nairobi", city: "Nairobi" },
  DXB: { tz: "Asia/Dubai", city: "Dubai" },
  AUH: { tz: "Asia/Dubai", city: "Abu Dhabi" },
  DOH: { tz: "Asia/Qatar", city: "Doha" },
  SIN: { tz: "Asia/Singapore", city: "Singapore" },
  KUL: { tz: "Asia/Kuala_Lumpur", city: "Kuala Lumpur" },
  IST: { tz: "Europe/Istanbul", city: "Istanbul" },
  LHR: { tz: "Europe/London", city: "London" },
};

/** IANA timezone for an IATA code, or undefined if we don't know the airport. */
export function airportZone(iata: string | null | undefined): string | undefined {
  return iata ? AIRPORTS[iata.toUpperCase()]?.tz : undefined;
}
