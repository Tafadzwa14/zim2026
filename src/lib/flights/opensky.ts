import "server-only";

import { serverEnv } from "@/lib/env";
import type { PositionProvider } from "./provider";
import type { FlightPosition } from "./types";

// OpenSky returns live positions keyed by ATC callsign (e.g. "UAE713"),
// not the IATA flight number the app uses ("EK713"). Map the airline's IATA
// prefix to its ICAO callsign prefix so we can match. Covers the carriers on
// our routes plus common ones; unknown prefixes yield no match (never a wrong
// one). Extend as new airlines appear in itineraries.
const ICAO_PREFIX: Record<string, string> = {
  EK: "UAE", // Emirates
  QR: "QTR", // Qatar Airways
  SA: "SAA", // South African Airways
  ET: "ETH", // Ethiopian Airlines
  KQ: "KQA", // Kenya Airways
  UM: "AZW", // Air Zimbabwe
  BA: "BAW", // British Airways
  QF: "QFA", // Qantas
  SQ: "SIA", // Singapore Airlines
  EY: "ETD", // Etihad
  TK: "THY", // Turkish Airlines
  LH: "DLH", // Lufthansa
  KL: "KLM", // KLM
  VS: "VIR", // Virgin Atlantic
};

/** Split an IATA flight number into [airlineCode, numericPart]. */
function parseFlightNumber(flightNumber: string): [string, number] | null {
  const clean = flightNumber.toUpperCase().replace(/\s/g, "");
  const m = /^([A-Z0-9]{2})0*(\d{1,4})[A-Z]?$/.exec(clean);
  if (!m) return null;
  return [m[1], Number(m[2])];
}

// OpenSky state-vector tuple indices we rely on (see OpenSky REST docs).
const S = {
  callsign: 1,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  velocity: 9, // m/s
  trueTrack: 10, // degrees
  geoAltitude: 13,
} as const;

const MS_TO_KNOTS = 1.943844;

interface StatesResponse {
  time: number;
  states: unknown[][] | null;
}

// Bearer token is short-lived; cache it in module scope and refresh lazily.
let tokenCache: { value: string; expiresAt: number } | null = null;

/**
 * Live-position provider backed by OpenSky Network. Free for personal use.
 * Uses OAuth2 client credentials when configured (higher rate limits),
 * otherwise falls back to anonymous access. Position-only: it never provides
 * schedule, status or gate data.
 *
 * Coverage comes from volunteer ADS-B receivers, so it is dense over Europe
 * and North America and thin over open ocean and parts of Africa. Callers
 * must treat a null result as "not currently visible", not "not flying".
 */
export class OpenSkyPositionProvider implements PositionProvider {
  readonly name = "opensky";

  private async accessToken(): Promise<string | null> {
    const id = serverEnv.openskyClientId;
    const secret = serverEnv.openskyClientSecret;
    if (!id || !secret) return null; // anonymous access

    const now = Date.now();
    if (tokenCache && now < tokenCache.expiresAt) return tokenCache.value;

    const res = await fetch(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: id,
          client_secret: secret,
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`OpenSky auth ${res.status}`);
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    const ttl = (json.expires_in ?? 1800) * 1000;
    // Refresh a minute early to avoid using a token mid-expiry.
    tokenCache = { value: json.access_token, expiresAt: now + ttl - 60_000 };
    return tokenCache.value;
  }

  async getFlightPosition(
    flightNumber: string,
    date: string
  ): Promise<FlightPosition | null> {
    // OpenSky only serves the live present; positions for a past/future date
    // are not available from the free state-vector endpoint.
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) return null;

    const parsed = parseFlightNumber(flightNumber);
    if (!parsed) return null;
    const [iata, num] = parsed;
    const icao = ICAO_PREFIX[iata];
    if (!icao) return null;

    const token = await this.accessToken();
    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // OpenSky updates roughly every 5-10s; a short fetch cache is plenty and
      // protects the daily credit budget. The service layer adds its own TTL.
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      throw new Error(`OpenSky states ${res.status}`);
    }

    const data = (await res.json()) as StatesResponse;
    const states = data.states ?? [];

    for (const s of states) {
      const callsign = String(s[S.callsign] ?? "").trim().toUpperCase();
      const cs = /^([A-Z]{3})0*(\d{1,4})$/.exec(callsign);
      if (!cs) continue;
      if (cs[1] !== icao || Number(cs[2]) !== num) continue;

      const lat = s[S.latitude];
      const lon = s[S.longitude];
      if (typeof lat !== "number" || typeof lon !== "number") continue;

      const altitude =
        (typeof s[S.geoAltitude] === "number" ? (s[S.geoAltitude] as number) : null) ??
        (typeof s[S.baroAltitude] === "number" ? (s[S.baroAltitude] as number) : null);
      const velocity = typeof s[S.velocity] === "number" ? (s[S.velocity] as number) : null;
      const heading = typeof s[S.trueTrack] === "number" ? (s[S.trueTrack] as number) : null;
      const recorded =
        (typeof s[S.timePosition] === "number" ? (s[S.timePosition] as number) : null) ??
        (typeof s[S.lastContact] === "number" ? (s[S.lastContact] as number) : null) ??
        data.time;

      return {
        latitude: lat,
        longitude: lon,
        altitude,
        groundSpeed: velocity === null ? null : Math.round(velocity * MS_TO_KNOTS),
        heading,
        recordedAt: new Date(recorded * 1000).toISOString(),
        source: "opensky",
      };
    }

    return null;
  }
}
