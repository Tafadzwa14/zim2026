import "server-only";

import { serverEnv } from "@/lib/env";
import { AeroDataBoxProvider } from "./aerodatabox";
import { MockFlightProvider } from "./mock";
import type { FlightProvider } from "./provider";
import type { FlightSearchResult, FlightStatusResult } from "./types";

export type { FlightProvider } from "./provider";
export type * from "./types";

let singleton: FlightProvider | null = null;

/** Resolve the configured flight provider (defaults to mock without a key). */
export function getFlightProvider(): FlightProvider {
  if (singleton) return singleton;
  const choice = serverEnv.flightProvider.toLowerCase();
  if (choice === "aerodatabox" && serverEnv.aerodataboxKey) {
    singleton = new AeroDataBoxProvider();
  } else {
    singleton = new MockFlightProvider();
  }
  return singleton;
}

// ---- tiny in-memory TTL cache to respect provider rate limits (section 25) ----
const cache = new Map<string, { at: number; ttl: number; val: unknown }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < hit.ttl) return hit.val as T;
  const val = await fn();
  cache.set(key, { at: now, ttl: ttlMs, val });
  return val;
}

export async function searchFlight(
  flightNumber: string,
  date: string
): Promise<FlightSearchResult[]> {
  return cached(`search:${flightNumber}:${date}`, 5 * 60_000, () =>
    getFlightProvider().searchFlight(flightNumber, date)
  );
}

export async function getFlightStatus(
  flightNumber: string,
  date: string,
  active = false
): Promise<FlightStatusResult | null> {
  // Poll active flights more often; scheduled/landed rarely (section 25).
  const ttl = active ? 60_000 : 10 * 60_000;
  return cached(`status:${flightNumber}:${date}`, ttl, () =>
    getFlightProvider().getFlightStatus(flightNumber, date)
  );
}

/**
 * Estimate 0..1 route progress from times. Used to place the plane along
 * the animated route. Always treated as estimated, never as live radar.
 */
export function estimateProgress(
  departure: string | null,
  arrival: string | null,
  now: Date = new Date()
): number {
  if (!departure || !arrival) return 0;
  const dep = new Date(departure).getTime();
  const arr = new Date(arrival).getTime();
  if (!(arr > dep)) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - dep) / (arr - dep)));
}
